/**
 * Teste de integração da exclusão de conta.
 *
 * Roda contra um Postgres real, porque o que precisa ser provado aqui é
 * justamente o comportamento do banco: as cascatas declaradas no schema, a
 * restrição que impede apagar quem organiza eventos e o comportamento da
 * transação. Um teste com banco falso confirmaria apenas que o código chama as
 * funções que o autor imaginou chamar.
 *
 *     npx tsx --env-file-if-exists=.env scripts/testar-exclusao.ts
 *
 * Cria os próprios dados, confere e limpa o que sobrar. Não serve para rodar
 * contra a base de produção — ele apaga o que cria, mas cria de verdade.
 */
import { prisma } from "../src/lib/prisma";
import { excluirConta, impedimentoParaExcluir, resumoDaConta } from "../src/lib/exclusao-de-conta";
import { conferirNome } from "../src/lib/verificacao-nome";
import { hashDeSenha } from "../src/lib/sessao";
import { sortearCodigoLivre } from "../src/lib/codigo-de-usuario";

let falhas = 0;

function conferir(descricao: string, condicao: boolean) {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${descricao}`);
  if (!condicao) falhas += 1;
}

const marca = `teste-exclusao-${Date.now()}`;

async function semear() {
  const organizador = await prisma.usuario.create({
    data: {
      nome: "Organizadora de Teste",
      email: `org-${marca}@exemplo.test`,
      senhaHash: await hashDeSenha("senha-de-teste-longa"),
      papel: "ORGANIZADOR",
      perfil: "PROFESSOR",
      codigoUsuario: await sortearCodigoLivre(),
    },
  });

  const instituicao = await prisma.instituicao.create({
    data: { nome: `Instituição ${marca}` },
  });

  const evento = await prisma.evento.create({
    data: {
      nome: `Evento ${marca}`,
      descricao: "Evento criado apenas para o teste de exclusão.",
      inicioEm: new Date("2026-03-10T13:00:00Z"),
      fimEm: new Date("2026-03-10T17:00:00Z"),
      modalidade: "PRESENCIAL",
      localNome: "Auditório de teste",
      latitude: -9.97,
      longitude: -67.81,
      cargaHorariaMinutos: 240,
      slug: `evento-${marca}`,
      codigoCurto: marca.slice(-10),
      tokenQr: `qr-${marca}`,
      codigoEvento: `EVT-2026-${String(Date.now()).slice(-4)}`,
      organizadorId: organizador.id,
      publicado: true,
      instituicoes: { create: [{ instituicaoId: instituicao.id, ordem: 0 }] },
    },
  });

  // Participante com o caminho completo: inscrição, presença e certificado.
  const participante = await prisma.usuario.create({
    data: {
      nome: "João da Silva Ávila",
      email: `part-${marca}@exemplo.test`,
      senhaHash: await hashDeSenha("senha-de-teste-longa"),
      perfil: "ACADEMICO",
      telefone: "68999999999",
      codigoUsuario: await sortearCodigoLivre(),
      consentimentos: {
        create: [
          { finalidade: "COMUNICACAO_URGENTE_EMAIL", textoApresentado: "texto de teste" },
          { finalidade: "GEOLOCALIZACAO_CHECKIN", textoApresentado: "texto de teste" },
        ],
      },
      notificacoes: {
        create: [{ tipo: "INSCRICAO_CONFIRMADA", titulo: "Inscrição", corpo: "confirmada" }],
      },
      assinaturasPush: {
        create: [{ endpoint: `https://push.test/${marca}`, p256dh: "chave", auth: "auth" }],
      },
      chamados: {
        create: [
          {
            assunto: "Dúvida de teste",
            mensagens: { create: [{ autorId: "auto", corpo: "mensagem de teste" }] },
          },
        ],
      },
      redefinicoesSenha: {
        create: [{ tokenHash: `hash-${marca}`, expiraEm: new Date(Date.now() + 60_000) }],
      },
    },
  });

  const inscricao = await prisma.inscricao.create({
    data: {
      eventoId: evento.id,
      usuarioId: participante.id,
      presenca: {
        create: {
          metodo: "QR_GEOLOCALIZACAO",
          latitude: -9.97,
          longitude: -67.81,
          distanciaMetros: 12,
          precisaoMetros: 8,
        },
      },
      certificado: { create: { codigoValidacao: `CERT-2026-TEST-${marca.slice(-6)}` } },
    },
    include: { certificado: true },
  });

  // Segundo participante, sem certificado: confirma que a exclusão de quem não
  // tem certificado não deixa nada para trás.
  const semCertificado = await prisma.usuario.create({
    data: {
      nome: "Maria Sem Certificado",
      email: `sem-${marca}@exemplo.test`,
      senhaHash: await hashDeSenha("senha-de-teste-longa"),
      perfil: "OUTROS",
      perfilDetalhe: "teste",
      codigoUsuario: await sortearCodigoLivre(),
      inscricoes: { create: [{ eventoId: evento.id }] },
    },
  });

  return { organizador, evento, participante, inscricao, semCertificado, instituicao };
}

async function principal() {
  const dados = await semear();
  const codigoValidacao = dados.inscricao.certificado!.codigoValidacao;
  const codigoPessoal = (
    await prisma.usuario.findUniqueOrThrow({
      where: { id: dados.participante.id },
      select: { codigoUsuario: true },
    })
  ).codigoUsuario;

  console.log("\n1. Resumo apresentado ao titular antes de confirmar");
  const resumo = await resumoDaConta(dados.participante.id);
  conferir("conta uma inscrição ativa", resumo.inscricoesAtivas === 1);
  conferir("conta uma presença", resumo.presencas === 1);
  conferir("conta um certificado", resumo.certificados === 1);
  conferir("conta um chamado", resumo.chamados === 1);
  conferir("conta dois consentimentos ativos", resumo.consentimentosAtivos === 2);

  console.log("\n2. Bloqueio da autoexclusão de organizador");
  conferir(
    "organizador é impedido",
    (await impedimentoParaExcluir(dados.organizador.id)) === "ORGANIZADOR",
  );
  conferir("participante não é impedido", (await impedimentoParaExcluir(dados.participante.id)) === null);
  let recusou = false;
  try {
    await excluirConta(dados.organizador.id);
  } catch {
    recusou = true;
  }
  conferir("excluirConta recusa organizador", recusou);
  conferir(
    "organizador permanece no banco",
    (await prisma.usuario.count({ where: { id: dados.organizador.id } })) === 1,
  );

  console.log("\n3. Exclusão do participante com certificado");
  const resultado = await excluirConta(dados.participante.id);
  conferir("um certificado arquivado", resultado.certificadosArquivados === 1);

  conferir(
    "usuário apagado",
    (await prisma.usuario.count({ where: { id: dados.participante.id } })) === 0,
  );
  conferir(
    "consentimentos apagados em cascata",
    (await prisma.consentimento.count({ where: { usuarioId: dados.participante.id } })) === 0,
  );
  conferir(
    "inscrição apagada em cascata",
    (await prisma.inscricao.count({ where: { id: dados.inscricao.id } })) === 0,
  );
  conferir(
    "presença apagada em cascata",
    (await prisma.presenca.count({ where: { inscricaoId: dados.inscricao.id } })) === 0,
  );
  conferir(
    "certificado apagado em cascata",
    (await prisma.certificado.count({ where: { codigoValidacao } })) === 0,
  );
  conferir(
    "notificações apagadas em cascata",
    (await prisma.notificacao.count({ where: { usuarioId: dados.participante.id } })) === 0,
  );
  conferir(
    "assinaturas de push apagadas em cascata",
    (await prisma.assinaturaPush.count({ where: { usuarioId: dados.participante.id } })) === 0,
  );
  conferir(
    "chamados apagados em cascata",
    (await prisma.chamado.count({ where: { usuarioId: dados.participante.id } })) === 0,
  );
  conferir(
    "mensagens de chamado apagadas em cascata",
    (await prisma.chamadoMensagem.count({ where: { corpo: "mensagem de teste" } })) === 0,
  );
  conferir(
    "pedidos de redefinição apagados em cascata",
    (await prisma.redefinicaoSenha.count({ where: { tokenHash: `hash-${marca}` } })) === 0,
  );
  conferir(
    "código pessoal aposentado",
    (await prisma.codigoUsuarioAposentado.count({ where: { codigo: codigoPessoal } })) === 1,
  );

  console.log("\n4. Registro de validação: sem nome legível, com conferência");
  const arquivado = await prisma.certificadoArquivado.findUnique({ where: { codigoValidacao } });
  conferir("registro de validação criado", arquivado !== null);
  conferir("evento preservado", arquivado?.eventoNome === `Evento ${marca}`);
  conferir("carga horária preservada", arquivado?.cargaHorariaMinutos === 240);
  conferir("organizadoras preservadas", arquivado?.organizacoes === `Instituição ${marca}`);
  conferir("método da presença preservado", arquivado?.metodoPresenca === "QR_GEOLOCALIZACAO");

  const colunas = Object.values(arquivado ?? {}).map((v) => String(v));
  conferir(
    "nome não aparece em texto em nenhuma coluna",
    !colunas.some((valor) => valor.toUpperCase().includes("JOÃO") || valor.includes("Silva")),
  );
  conferir(
    "nome exato confere",
    await conferirNome("João da Silva Ávila", arquivado!.nomeHash),
  );
  conferir(
    "nome sem acento e em caixa alta confere",
    await conferirNome("JOAO DA SILVA AVILA", arquivado!.nomeHash),
  );
  conferir(
    "nome com espaços sobrando confere",
    await conferirNome("  joão   da silva   ávila ", arquivado!.nomeHash),
  );
  conferir("nome diferente não confere", !(await conferirNome("Maria Souza", arquivado!.nomeHash)));
  conferir("nome vazio não confere", !(await conferirNome("   ", arquivado!.nomeHash)));

  console.log("\n5. Totais agregados do evento");
  const eventoDepois = await prisma.evento.findUniqueOrThrow({ where: { id: dados.evento.id } });
  conferir("uma inscrição contabilizada", eventoDepois.inscricoesDeContasExcluidas === 1);
  conferir("uma presença contabilizada", eventoDepois.presencasDeContasExcluidas === 1);
  conferir(
    "evento continua sem limite de vagas por padrão",
    eventoDepois.vagasPresencial === null && eventoDepois.vagasOnline === null,
  );

  console.log("\n6. Exclusão de participante sem certificado");
  const semCert = await excluirConta(dados.semCertificado.id);
  conferir("nada arquivado", semCert.certificadosArquivados === 0);
  const eventoFinal = await prisma.evento.findUniqueOrThrow({ where: { id: dados.evento.id } });
  conferir("inscrições agregadas somam duas", eventoFinal.inscricoesDeContasExcluidas === 2);
  conferir("presenças agregadas seguem em uma", eventoFinal.presencasDeContasExcluidas === 1);

  console.log("\n7. Limpeza");
  await prisma.certificadoArquivado.deleteMany({ where: { codigoValidacao } });
  await prisma.evento.delete({ where: { id: dados.evento.id } });
  await prisma.instituicao.delete({ where: { id: dados.instituicao.id } });
  await prisma.usuario.delete({ where: { id: dados.organizador.id } });
  await prisma.codigoUsuarioAposentado.deleteMany({ where: { codigo: codigoPessoal } });
  console.log("  ok    dados de teste removidos");

  console.log(falhas === 0 ? "\nTodos os testes passaram.\n" : `\n${falhas} teste(s) falharam.\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
