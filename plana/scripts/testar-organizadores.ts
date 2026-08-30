/**
 * Teste de integração de organizadores, papel master, campos personalizados e
 * relatórios.
 *
 * Roda contra Postgres real, pelo mesmo motivo do teste de exclusão: o que
 * precisa ser provado aqui é comportamento de banco — cascatas, unicidade,
 * recorte de consulta — e teste com banco falso só provaria que o código chama
 * as funções que o autor imaginou chamar.
 *
 *     npm run testar:organizadores
 */
import { prisma } from "../src/lib/prisma";
import { hashDeSenha, escopoDeEventos, temPainel } from "../src/lib/sessao";
import { sortearCodigoLivre } from "../src/lib/codigo-de-usuario";
import {
  cnpjValido,
  cpfValido,
  ehGestorDeAlguma,
  instituicoesDoGestor,
  semInstituicaoAtiva,
  sincronizarPapel,
} from "../src/lib/organizadores";
import { validarRespostas, camposAtivosDoEvento, gravarRespostas } from "../src/lib/campos-inscricao";
import { relatorioConsolidado, relatorioDoEvento } from "../src/lib/relatorios";

let falhas = 0;
function conferir(descricao: string, condicao: boolean) {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${descricao}`);
  if (!condicao) falhas += 1;
}

const marca = `t${Date.now().toString(36)}`;

async function conta(papel: "ORGANIZADOR" | "MASTER" | "PARTICIPANTE", nome: string) {
  return prisma.usuario.create({
    data: {
      nome,
      email: `${nome.toLowerCase().replace(/\W/g, "")}-${marca}@exemplo.test`,
      senhaHash: await hashDeSenha("senha-de-teste-longa"),
      papel,
      perfil: "OUTROS",
      perfilDetalhe: "teste",
      codigoUsuario: await sortearCodigoLivre(),
    },
  });
}

async function principal() {
  console.log("\n1. Validação de documento");
  conferir("CPF válido aceito", cpfValido("11144477735"));
  conferir("CPF com dígito errado recusado", !cpfValido("11144477736"));
  conferir("CPF repetido recusado", !cpfValido("11111111111"));
  conferir("CNPJ válido aceito", cnpjValido("11222333000181"));
  conferir("CNPJ com dígito errado recusado", !cnpjValido("11222333000182"));

  console.log("\n2. Contas e perfis");
  const master = await conta("MASTER", `Master${marca}`);
  const orgA = await conta("ORGANIZADOR", `OrgA${marca}`);
  const orgB = await conta("ORGANIZADOR", `OrgB${marca}`);
  const participante = await conta("PARTICIPANTE", `Part${marca}`);

  const mp = await prisma.instituicao.create({
    data: {
      nome: `Ministério Público de Teste ${marca}`,
      nomeCurto: `MP ${marca}`,
      tipo: "ORGAO_PUBLICO",
      documento: "11222333000181",
      esfera: "estadual",
    },
  });
  const faculdade = await prisma.instituicao.create({
    data: { nome: `Faculdade de Teste ${marca}`, tipo: "PESSOA_JURIDICA" },
  });

  await prisma.instituicaoGestor.create({
    data: { instituicaoId: mp.id, usuarioId: orgA.id, vinculadoPor: master.id },
  });
  await prisma.instituicaoGestor.create({
    data: { instituicaoId: faculdade.id, usuarioId: orgB.id, vinculadoPor: master.id },
  });

  conferir("master tem painel", temPainel("MASTER"));
  conferir("organizador tem painel", temPainel("ORGANIZADOR"));
  conferir("participante não tem painel", !temPainel("PARTICIPANTE"));

  const sessaoMaster = { usuarioId: master.id, nome: master.nome, papel: "MASTER" as const };
  const sessaoOrgA = { usuarioId: orgA.id, nome: orgA.nome, papel: "ORGANIZADOR" as const };

  conferir("escopo do master é irrestrito", Object.keys(escopoDeEventos(sessaoMaster)).length === 0);
  conferir(
    "escopo do organizador fixa a própria conta",
    escopoDeEventos(sessaoOrgA).organizadorId === orgA.id,
  );

  const geridas = await instituicoesDoGestor(orgA.id);
  conferir("gestor enxerga a instituição vinculada", geridas.length === 1 && geridas[0].id === mp.id);
  conferir("nome curto tem preferência", geridas[0]?.nomeCurto === `MP ${marca}`);
  conferir("participante não gere nada", !(await ehGestorDeAlguma(participante.id)));
  conferir("organizador gere alguma", await ehGestorDeAlguma(orgA.id));

  console.log("\n3. Papel é consequência do vínculo, não escolha");
  await sincronizarPapel(participante.id);
  conferir(
    "participante sem vínculo continua participante",
    (await prisma.usuario.findUniqueOrThrow({ where: { id: participante.id } })).papel ===
      "PARTICIPANTE",
  );

  await prisma.instituicaoGestor.create({
    data: { instituicaoId: faculdade.id, usuarioId: participante.id, vinculadoPor: master.id },
  });
  await sincronizarPapel(participante.id);
  conferir(
    "vincular promove a organizador",
    (await prisma.usuario.findUniqueOrThrow({ where: { id: participante.id } })).papel ===
      "ORGANIZADOR",
  );

  await prisma.instituicaoGestor.delete({
    where: { instituicaoId_usuarioId: { instituicaoId: faculdade.id, usuarioId: participante.id } },
  });
  await sincronizarPapel(participante.id);
  conferir(
    "desvincular devolve a participante",
    (await prisma.usuario.findUniqueOrThrow({ where: { id: participante.id } })).papel ===
      "PARTICIPANTE",
  );

  await sincronizarPapel(master.id);
  conferir(
    "master não é rebaixado por não gerir instituição",
    (await prisma.usuario.findUniqueOrThrow({ where: { id: master.id } })).papel === "MASTER",
  );

  console.log("\n3b. Suspensão da instituição");
  conferir("gestor começa com instituição ativa", !(await semInstituicaoAtiva(orgA.id)));
  await prisma.instituicao.update({
    where: { id: mp.id },
    data: { suspensaEm: new Date(), motivoSuspensao: "teste" },
  });
  conferir("suspensão bloqueia evento novo", await semInstituicaoAtiva(orgA.id));
  await prisma.instituicao.update({ where: { id: mp.id }, data: { suspensaEm: null } });
  conferir("reativação libera de novo", !(await semInstituicaoAtiva(orgA.id)));

  console.log("\n4. Eventos e recorte por organizador");
  async function evento(dono: string, sufixo: string) {
    return prisma.evento.create({
      data: {
        nome: `Evento ${sufixo} ${marca}`,
        descricao: "teste",
        inicioEm: new Date("2026-04-10T13:00:00Z"),
        fimEm: new Date("2026-04-10T17:00:00Z"),
        modalidade: "PRESENCIAL",
        localNome: "Auditório",
        latitude: -9.97,
        longitude: -67.81,
        cargaHorariaMinutos: 240,
        slug: `evento-${sufixo}-${marca}`,
        codigoCurto: `${sufixo}${marca}`.slice(0, 10),
        tokenQr: `qr-${sufixo}-${marca}`,
        codigoEvento: `EVT-2026-${sufixo}${marca}`.slice(0, 20),
        organizadorId: dono,
        publicado: true,
      },
    });
  }

  async function assinar(eventoId: string, instituicaoId: string) {
    await prisma.eventoInstituicao.create({ data: { eventoId, instituicaoId, ordem: 0 } });
  }

  const eventoA = await evento(orgA.id, "a");
  const eventoB = await evento(orgB.id, "b");
  await assinar(eventoA.id, mp.id);
  await assinar(eventoB.id, faculdade.id);

  const vistosPorA = await prisma.evento.count({
    where: { ...escopoDeEventos(sessaoOrgA), id: { in: [eventoA.id, eventoB.id] } },
  });
  const vistosPorMaster = await prisma.evento.count({
    where: { ...escopoDeEventos(sessaoMaster), id: { in: [eventoA.id, eventoB.id] } },
  });
  conferir("organizador A enxerga só o próprio evento", vistosPorA === 1);
  conferir("master enxerga os dois", vistosPorMaster === 2);

  console.log("\n5. Campos personalizados");
  conferir("evento sem campo devolve lista vazia", (await camposAtivosDoEvento(eventoA.id)).length === 0);

  const campoPeriodo = await prisma.campoInscricao.create({
    data: {
      eventoId: eventoA.id,
      rotulo: "Período que está cursando",
      tipo: "SELECAO_UNICA",
      obrigatorio: true,
      opcoes: ["1º", "2º", "3º"],
      ordem: 0,
    },
  });
  const campoTurnos = await prisma.campoInscricao.create({
    data: {
      eventoId: eventoA.id,
      rotulo: "Turnos disponíveis",
      tipo: "SELECAO_MULTIPLA",
      opcoes: ["Manhã", "Tarde", "Noite"],
      ordem: 1,
    },
  });
  const campoMatricula = await prisma.campoInscricao.create({
    data: { eventoId: eventoA.id, rotulo: "Matrícula", tipo: "TEXTO_CURTO", ordem: 2 },
  });

  const campos = await camposAtivosDoEvento(eventoA.id);
  conferir("três campos ativos, na ordem", campos.length === 3 && campos[0].id === campoPeriodo.id);

  const vazio = new FormData();
  const semObrigatorio = validarRespostas(campos, vazio);
  conferir("obrigatório vazio é recusado", !semObrigatorio.ok);
  conferir(
    "só o obrigatório acusa erro",
    !semObrigatorio.ok && Object.keys(semObrigatorio.erros).length === 1,
  );

  const invalido = new FormData();
  invalido.append(`campo:${campoPeriodo.id}`, "9º");
  conferir("opção fora da lista é recusada", !validarRespostas(campos, invalido).ok);

  const bom = new FormData();
  bom.append(`campo:${campoPeriodo.id}`, "2º");
  bom.append(`campo:${campoTurnos.id}`, "Noite");
  bom.append(`campo:${campoTurnos.id}`, "Manhã");
  bom.append(`campo:${campoMatricula.id}`, "  2026001  ");
  const validado = validarRespostas(campos, bom);
  conferir("respostas válidas passam", validado.ok);
  if (validado.ok) {
    const porCampo = new Map(validado.respostas.map((r) => [r.campoId, r.valor]));
    conferir(
      "seleção múltipla sai na ordem cadastrada",
      porCampo.get(campoTurnos.id) === "Manhã; Noite",
    );
    conferir("texto é aparado", porCampo.get(campoMatricula.id) === "2026001");
  }

  console.log("\n6. Inscrição com respostas");
  const inscricao = await prisma.inscricao.create({
    data: { eventoId: eventoA.id, usuarioId: participante.id },
  });
  if (validado.ok) await gravarRespostas(inscricao.id, validado.respostas);
  conferir(
    "três respostas gravadas",
    (await prisma.respostaInscricao.count({ where: { inscricaoId: inscricao.id } })) === 3,
  );

  // Regravar substitui, não duplica: a chave única por inscrição e campo
  // impediria o insere-por-cima, e reenviar o formulário tem de funcionar.
  if (validado.ok) await gravarRespostas(inscricao.id, validado.respostas);
  conferir(
    "regravar não duplica",
    (await prisma.respostaInscricao.count({ where: { inscricaoId: inscricao.id } })) === 3,
  );

  await prisma.campoInscricao.update({
    where: { id: campoMatricula.id },
    data: { arquivadoEm: new Date() },
  });
  conferir("campo arquivado sai do formulário", (await camposAtivosDoEvento(eventoA.id)).length === 2);
  conferir(
    "resposta do campo arquivado permanece",
    (await prisma.respostaInscricao.count({ where: { campoId: campoMatricula.id } })) === 1,
  );

  console.log("\n7. Relatório por evento");
  const doOrganizador = await relatorioDoEvento(sessaoOrgA, eventoA.id);
  conferir("organizador emite o próprio evento", doOrganizador !== null);
  conferir(
    "nome do arquivo traz o código do evento",
    doOrganizador?.nomeArquivo.includes("EVT-2026") === true,
  );
  conferir("planilha tem conteúdo", (doOrganizador?.conteudo.length ?? 0) > 3000);
  conferir(
    "organizador não emite evento alheio",
    (await relatorioDoEvento(sessaoOrgA, eventoB.id)) === null,
  );
  conferir("master emite evento alheio", (await relatorioDoEvento(sessaoMaster, eventoB.id)) !== null);

  console.log("\n8. Relatório consolidado");
  const consolidadoMaster = await relatorioConsolidado(sessaoMaster, {
    incluirCancelados: true,
    incluirNaoPublicados: true,
  });
  conferir("master gera consolidado", consolidadoMaster.conteudo.length > 3000);

  const consolidadoOrg = await relatorioConsolidado(sessaoOrgA, {
    incluirCancelados: true,
    incluirNaoPublicados: true,
    // Forja: organizador tentando ver a base de outro. O escopo deve prevalecer.
    organizadorId: orgB.id,
  });
  conferir("organizador gera consolidado", consolidadoOrg.conteudo.length > 3000);
  conferir(
    "consolidado do organizador é menor que o do master",
    consolidadoOrg.conteudo.length !== consolidadoMaster.conteudo.length,
  );

  console.log("\n9. Cascatas");
  await prisma.evento.delete({ where: { id: eventoA.id } });
  conferir(
    "campos somem com o evento",
    (await prisma.campoInscricao.count({ where: { eventoId: eventoA.id } })) === 0,
  );
  conferir(
    "respostas somem com o evento",
    (await prisma.respostaInscricao.count({ where: { inscricaoId: inscricao.id } })) === 0,
  );

  await prisma.usuario.delete({ where: { id: orgA.id } });
  conferir(
    "vínculo some com a conta",
    (await prisma.instituicaoGestor.count({ where: { usuarioId: orgA.id } })) === 0,
  );
  conferir(
    "instituição sobrevive à conta do gestor",
    (await prisma.instituicao.count({ where: { id: mp.id } })) === 1,
  );

  console.log("\n10. Limpeza");
  await prisma.evento.delete({ where: { id: eventoB.id } });
  await prisma.instituicao.deleteMany({ where: { id: { in: [mp.id, faculdade.id] } } });
  await prisma.usuario.deleteMany({ where: { id: { in: [orgB.id, master.id, participante.id] } } });
  
  console.log("  ok    dados de teste removidos");

  console.log(falhas === 0 ? "\nTodos os testes passaram.\n" : `\n${falhas} teste(s) falharam.\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
