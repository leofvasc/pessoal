/**
 * Teste de integração do controle de vagas e da modalidade da inscrição.
 *
 * Roda contra Postgres real, pelo mesmo motivo dos demais testes desta pasta:
 * o que precisa ser provado aqui é comportamento de banco. A parte central —
 * duas pessoas disputando a última vaga ao mesmo tempo — não existe fora de um
 * banco de verdade, porque é o isolamento serializável do Postgres que faz o
 * trabalho. Um banco falso provaria apenas que a contagem em memória fecha.
 *
 *     npm run testar:vagas
 */
import { prisma } from "../src/lib/prisma";
import { hashDeSenha } from "../src/lib/sessao";
import { sortearCodigoLivre } from "../src/lib/codigo-de-usuario";
import { codigoCurto, codigoEvento, tokenQr, tokenRemoto } from "../src/lib/codigos";
import { contarInscricoesAtivas, modalidadeEscolhida, reservarVaga, vagasDoEvento } from "../src/lib/lotacao";
import {
  calcularVagas,
  exigeEscolhaDeModalidade,
  modalidadesDeInscricao,
  rotuloDeVagas,
  totalmenteEsgotado,
} from "../src/lib/vagas";
import type { Modalidade } from "../src/generated/prisma/client";

let falhas = 0;
function conferir(descricao: string, condicao: boolean) {
  console.log(`${condicao ? "  ok  " : " FALHA"}  ${descricao}`);
  if (!condicao) falhas += 1;
}

const marca = `v${Date.now().toString(36)}`;
let sequencial = 0;

/**
 * Ponto de partida do sequencial dos códigos de evento.
 *
 * O teste roda contra um banco que já pode ter eventos — inclusive de execuções
 * anteriores dele mesmo. Começar sempre do mesmo número faria a segunda
 * execução esbarrar na unicidade de `codigoEvento`, e a falha não teria nada a
 * ver com o que se está testando.
 */
let inicioDoSequencial = 0;

async function conta(nome: string) {
  return prisma.usuario.create({
    data: {
      nome,
      email: `${nome.toLowerCase()}-${marca}@exemplo.test`,
      senhaHash: await hashDeSenha("senha-de-teste-longa"),
      papel: "PARTICIPANTE",
      perfil: "OUTROS",
      codigoUsuario: await sortearCodigoLivre(),
    },
  });
}

async function evento(params: {
  organizadorId: string;
  modalidade: Modalidade;
  vagasPresencial?: number | null;
  vagasOnline?: number | null;
}) {
  sequencial += 1;
  const agora = new Date();
  return prisma.evento.create({
    data: {
      nome: `Evento ${marca}-${sequencial}`,
      descricao: "Evento criado pelo teste de vagas.",
      inicioEm: agora,
      fimEm: new Date(agora.getTime() + 3_600_000),
      modalidade: params.modalidade,
      cargaHorariaMinutos: 60,
      vagasPresencial: params.vagasPresencial ?? null,
      vagasOnline: params.vagasOnline ?? null,
      slug: `${marca}-${sequencial}`,
      codigoCurto: codigoCurto(),
      tokenQr: tokenQr(),
      tokenRemoto: params.modalidade === "PRESENCIAL" ? null : tokenRemoto(),
      codigoEvento: codigoEvento(2026, inicioDoSequencial + sequencial),
      organizadorId: params.organizadorId,
      publicado: true,
    },
  });
}

async function principal() {
  inicioDoSequencial = (await prisma.evento.count()) + 9000;

  console.log("\n1. Cálculo puro das vagas");
  conferir(
    "limite nulo é sem limite, e nunca esgota",
    calcularVagas("ONLINE", null, 5_000).esgotado === false,
  );
  conferir(
    "limite zero esgota desde o início",
    calcularVagas("PRESENCIAL", 0, 0).esgotado === true,
  );
  conferir(
    "restante não fica negativo quando o limite é reduzido",
    calcularVagas("PRESENCIAL", 10, 14).restantes === 0,
  );
  conferir('rótulo no singular', rotuloDeVagas(calcularVagas("PRESENCIAL", 10, 9)) === "1 vaga restante");
  conferir('rótulo sem limite', rotuloDeVagas(calcularVagas("ONLINE", null, 9)) === "Sem limite de vagas");

  console.log("\n2. Modalidades aceitas por tipo de evento");
  conferir("presencial só aceita presencial", modalidadesDeInscricao("PRESENCIAL").join() === "PRESENCIAL");
  conferir("online só aceita online", modalidadesDeInscricao("ONLINE").join() === "ONLINE");
  conferir("híbrido aceita as duas", modalidadesDeInscricao("HIBRIDO").length === 2);
  conferir("só o híbrido pergunta", exigeEscolhaDeModalidade("HIBRIDO") && !exigeEscolhaDeModalidade("ONLINE"));
  conferir(
    "escolha forjada é ignorada em evento online",
    modalidadeEscolhida("ONLINE", "PRESENCIAL") === "ONLINE",
  );
  conferir(
    "escolha forjada é ignorada em evento presencial",
    modalidadeEscolhida("PRESENCIAL", "ONLINE") === "PRESENCIAL",
  );
  conferir(
    "escolha válida é respeitada no híbrido",
    modalidadeEscolhida("HIBRIDO", "ONLINE") === "ONLINE",
  );
  conferir(
    "escolha ausente no híbrido cai no presencial",
    modalidadeEscolhida("HIBRIDO", "") === "PRESENCIAL",
  );

  console.log("\n3. Reserva de vaga em evento com limite");
  const organizador = await prisma.usuario.create({
    data: {
      nome: `Org${marca}`,
      email: `org-${marca}@exemplo.test`,
      senhaHash: await hashDeSenha("senha-de-teste-longa"),
      papel: "ORGANIZADOR",
      perfil: "OUTROS",
      codigoUsuario: await sortearCodigoLivre(),
    },
  });

  const comDuasVagas = await evento({
    organizadorId: organizador.id,
    modalidade: "PRESENCIAL",
    vagasPresencial: 2,
  });

  const a = await conta("Ana");
  const b = await conta("Bia");
  const c = await conta("Caio");

  for (const pessoa of [a, b]) {
    const reserva = await reservarVaga({
      eventoId: comDuasVagas.id,
      usuarioId: pessoa.id,
      evento: comDuasVagas,
      modalidade: "PRESENCIAL",
    });
    conferir(`${pessoa.nome} conseguiu vaga`, reserva.ok);
  }

  const terceira = await reservarVaga({
    eventoId: comDuasVagas.id,
    usuarioId: c.id,
    evento: comDuasVagas,
    modalidade: "PRESENCIAL",
  });
  conferir("terceira inscrição é recusada por lotação", !terceira.ok);

  const situacao = await vagasDoEvento(comDuasVagas.id, comDuasVagas);
  conferir("evento aparece esgotado", totalmenteEsgotado(situacao));

  console.log("\n4. Cancelar devolve a vaga");
  await prisma.inscricao.updateMany({
    where: { eventoId: comDuasVagas.id, usuarioId: b.id },
    data: { canceladaEm: new Date() },
  });
  const depoisDoCancelamento = await reservarVaga({
    eventoId: comDuasVagas.id,
    usuarioId: c.id,
    evento: comDuasVagas,
    modalidade: "PRESENCIAL",
  });
  conferir("a vaga devolvida é ocupada por quem estava de fora", depoisDoCancelamento.ok);

  console.log("\n5. Sem limite não fecha");
  const semLimite = await evento({
    organizadorId: organizador.id,
    modalidade: "ONLINE",
    vagasOnline: null,
  });
  const muitos = await Promise.all(
    Array.from({ length: 5 }, (_, i) => conta(`Online${i}`)),
  );
  const reservas = [];
  for (const pessoa of muitos) {
    reservas.push(
      await reservarVaga({
        eventoId: semLimite.id,
        usuarioId: pessoa.id,
        evento: semLimite,
        modalidade: "ONLINE",
      }),
    );
  }
  conferir("todas as inscrições passam", reservas.every((r) => r.ok));
  conferir(
    "evento sem limite nunca aparece esgotado",
    !totalmenteEsgotado(await vagasDoEvento(semLimite.id, semLimite)),
  );

  console.log("\n6. Híbrido conta as duas modalidades em separado");
  const hibrido = await evento({
    organizadorId: organizador.id,
    modalidade: "HIBRIDO",
    vagasPresencial: 1,
    vagasOnline: null,
  });

  const naSala = await conta("Sala");
  const naTransmissao = await conta("Transmissao");
  const semSala = await conta("SemSala");

  conferir(
    "primeira vaga presencial é ocupada",
    (await reservarVaga({ eventoId: hibrido.id, usuarioId: naSala.id, evento: hibrido, modalidade: "PRESENCIAL" })).ok,
  );
  conferir(
    "presencial esgotado recusa a segunda",
    !(await reservarVaga({ eventoId: hibrido.id, usuarioId: semSala.id, evento: hibrido, modalidade: "PRESENCIAL" })).ok,
  );
  conferir(
    "online continua aberto, porque é contagem própria",
    (await reservarVaga({ eventoId: hibrido.id, usuarioId: naTransmissao.id, evento: hibrido, modalidade: "ONLINE" })).ok,
  );
  conferir(
    "quem não achou lugar na sala consegue vaga na transmissão",
    (await reservarVaga({ eventoId: hibrido.id, usuarioId: semSala.id, evento: hibrido, modalidade: "ONLINE" })).ok,
  );

  const contagemHibrido = await contarInscricoesAtivas(hibrido.id);
  conferir(
    "contagem separa uma presencial e duas online",
    contagemHibrido.presencial === 1 && contagemHibrido.online === 2,
  );
  conferir(
    "híbrido com online sem limite nunca fica totalmente esgotado",
    !totalmenteEsgotado(await vagasDoEvento(hibrido.id, hibrido)),
  );

  console.log("\n7. Trocar de modalidade disputa vaga na modalidade de destino");
  conferir(
    "voltar para o presencial esgotado é recusado",
    !(await reservarVaga({ eventoId: hibrido.id, usuarioId: semSala.id, evento: hibrido, modalidade: "PRESENCIAL" })).ok,
  );
  conferir(
    "quem já está no presencial reenvia sem consumir vaga nova",
    (await reservarVaga({ eventoId: hibrido.id, usuarioId: naSala.id, evento: hibrido, modalidade: "PRESENCIAL" })).ok,
  );
  conferir(
    "reenvio não duplica a contagem",
    (await contarInscricoesAtivas(hibrido.id)).presencial === 1,
  );

  console.log("\n8. Corrida pela última vaga");
  const ultimaVaga = await evento({
    organizadorId: organizador.id,
    modalidade: "PRESENCIAL",
    vagasPresencial: 1,
  });
  const disputantes = await Promise.all(
    Array.from({ length: 6 }, (_, i) => conta(`Disputa${i}`)),
  );
  const resultados = await Promise.all(
    disputantes.map((pessoa) =>
      reservarVaga({
        eventoId: ultimaVaga.id,
        usuarioId: pessoa.id,
        evento: ultimaVaga,
        modalidade: "PRESENCIAL",
      }),
    ),
  );
  const aceitos = resultados.filter((r) => r.ok).length;
  const ativas = await prisma.inscricao.count({
    where: { eventoId: ultimaVaga.id, canceladaEm: null },
  });
  conferir(`seis pedidos simultâneos, uma vaga: ${aceitos} aceito(s)`, aceitos === 1);
  conferir(`o banco tem exatamente uma inscrição ativa (tem ${ativas})`, ativas === 1);

  console.log(`\n${falhas === 0 ? "Tudo certo." : `${falhas} falha(s).`}`);
  if (falhas > 0) process.exitCode = 1;
}

principal()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
