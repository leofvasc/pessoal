import "server-only";

/**
 * Contagem de vagas ocupadas e reserva da vaga na inscrição.
 *
 * Separado de `vagas.ts` porque este lado toca o banco: `vagas.ts` é
 * isomórfico e roda também no navegador, e um import de Prisma ali entraria no
 * pacote enviado ao cliente.
 *
 * O ponto delicado aqui é a corrida entre duas inscrições simultâneas na
 * última vaga. Contar e depois inserir, em duas idas ao banco, deixa uma
 * janela entre a contagem e a gravação em que as duas passam — e um evento com
 * 40 lugares recebe 41 inscritos.
 *
 * A saída é uma trava consultiva do Postgres (`pg_advisory_xact_lock`) por
 * evento e modalidade: quem chega primeiro conta e grava; quem chega junto
 * espera na porta e só então conta, já enxergando a inscrição do primeiro. A
 * trava cai sozinha no commit ou no rollback, não sobrevive a queda de conexão
 * e só disputa com quem quer a mesma vaga — inscrições em eventos diferentes,
 * ou em modalidades diferentes do mesmo evento, não se esperam.
 *
 * O isolamento serializável foi a primeira tentativa e foi descartado: ele
 * resolve a contagem, mas transfere o problema para o tratamento do conflito,
 * que chega ao cliente com formatos diferentes conforme o driver e ainda exige
 * repetir a transação. A trava resolve na entrada, sem erro nenhum para
 * interpretar.
 */
import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import {
  calcularVagas,
  modalidadeUnica,
  modalidadesDeInscricao,
  situacaoDeVagas,
  type SituacaoDeVagas,
  type VagasDaModalidade,
} from "./vagas";
import type { Modalidade, ModalidadeInscricao, Prisma } from "@/generated/prisma/client";

/** Cliente ou transação: as contagens têm de rodar dentro da transação. */
type Executor = Prisma.TransactionClient | typeof prisma;

export type ContagemPorModalidade = { presencial: number; online: number };

/**
 * Quantas inscrições ativas há em cada modalidade.
 *
 * Inscrição cancelada não ocupa vaga: quem desistiu devolveu o lugar. Conta de
 * participante excluída também não — a linha da inscrição sai do banco junto
 * com ela, e o total histórico do evento é preservado à parte, em
 * `inscricoesDeContasExcluidas`, que é número agregado e não lugar reservado.
 */
export async function contarInscricoesAtivas(
  eventoId: string,
  executor: Executor = prisma,
): Promise<ContagemPorModalidade> {
  const grupos = await executor.inscricao.groupBy({
    by: ["modalidade"],
    where: { eventoId, canceladaEm: null },
    _count: { _all: true },
  });

  const por = (modalidade: ModalidadeInscricao) =>
    grupos.find((g) => g.modalidade === modalidade)?._count._all ?? 0;

  return { presencial: por("PRESENCIAL"), online: por("ONLINE") };
}

export type EventoComVagas = {
  modalidade: Modalidade;
  vagasPresencial: number | null;
  vagasOnline: number | null;
};

/** Situação das vagas de um evento, pronta para a tela. */
export async function vagasDoEvento(
  eventoId: string,
  evento: EventoComVagas,
  executor: Executor = prisma,
): Promise<SituacaoDeVagas> {
  const ocupadas = await contarInscricoesAtivas(eventoId, executor);
  return situacaoDeVagas({
    modalidade: evento.modalidade,
    vagasPresencial: evento.vagasPresencial,
    vagasOnline: evento.vagasOnline,
    ocupadasPresencial: ocupadas.presencial,
    ocupadasOnline: ocupadas.online,
  });
}

/** Situação de uma modalidade específica, dentro de uma transação em curso. */
async function vagasDaModalidade(
  eventoId: string,
  evento: EventoComVagas,
  modalidade: ModalidadeInscricao,
  executor: Executor,
): Promise<VagasDaModalidade> {
  const ocupadas = await contarInscricoesAtivas(eventoId, executor);
  return modalidade === "PRESENCIAL"
    ? calcularVagas("PRESENCIAL", evento.vagasPresencial, ocupadas.presencial)
    : calcularVagas("ONLINE", evento.vagasOnline, ocupadas.online);
}

/**
 * Modalidade em que a inscrição vai ser gravada.
 *
 * Em evento presencial ou online a escolha do participante é ignorada de
 * propósito: quem manda o formulário direto, sem passar pela tela, não pode
 * conseguir uma modalidade que o evento não tem.
 */
export function modalidadeEscolhida(
  modalidadeDoEvento: Modalidade,
  escolha: string | null | undefined,
): ModalidadeInscricao {
  const aceitas = modalidadesDeInscricao(modalidadeDoEvento);
  if (aceitas.length === 1) return aceitas[0];
  return escolha === "ONLINE" || escolha === "PRESENCIAL"
    ? (escolha as ModalidadeInscricao)
    : modalidadeUnica(modalidadeDoEvento);
}

export type ResultadoDaReserva =
  | { ok: true; inscricaoId: string; jaInscrito: boolean }
  | { ok: false; erro: string };

export const MENSAGEM_ESGOTADO: Record<ModalidadeInscricao, string> = {
  PRESENCIAL: "As vagas presenciais deste evento se esgotaram.",
  ONLINE: "As vagas para participação online deste evento se esgotaram.",
};

/**
 * Cria ou reativa a inscrição respeitando o limite de vagas.
 *
 * Devolve o id da inscrição para que quem chamou grave as respostas dos campos
 * personalizados — a gravação fica fora da transação porque ela não disputa
 * vaga com ninguém, e segurar a trava durante uma escrita que não precisa dela
 * só faria a fila andar mais devagar.
 *
 * Trocar de modalidade dentro de um evento híbrido passa pelo mesmo controle:
 * sair do online para o presencial é ocupar uma vaga presencial, e ela pode não
 * existir. Quem já estava inscrito naquela mesma modalidade não é recontado.
 */
export async function reservarVaga(params: {
  eventoId: string;
  usuarioId: string;
  evento: EventoComVagas;
  modalidade: ModalidadeInscricao;
}): Promise<ResultadoDaReserva> {
  const { eventoId, usuarioId, evento, modalidade } = params;

  return prisma.$transaction(async (tx) => {
    // Primeira coisa da transação, antes de qualquer leitura: daqui até o
    // commit, ninguém mais conta as vagas desta modalidade deste evento.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${chaveDaTrava(eventoId, modalidade)})`;

    const existente = await tx.inscricao.findUnique({
      where: { eventoId_usuarioId: { eventoId, usuarioId } },
      select: { id: true, canceladaEm: true, modalidade: true },
    });

    const jaInscrito = Boolean(existente && !existente.canceladaEm);
    // Só se disputa vaga quando ela é nova para aquela modalidade: quem já
    // está inscrito e reenvia o formulário não ocupa um segundo lugar.
    const ocupaVagaNova = !jaInscrito || existente!.modalidade !== modalidade;

    if (ocupaVagaNova) {
      const vagas = await vagasDaModalidade(eventoId, evento, modalidade, tx);
      if (vagas.esgotado) {
        return { ok: false as const, erro: MENSAGEM_ESGOTADO[modalidade] };
      }
    }

    if (existente) {
      await tx.inscricao.update({
        where: { id: existente.id },
        data: { canceladaEm: null, modalidade },
      });
      return { ok: true as const, inscricaoId: existente.id, jaInscrito };
    }

    const criada = await tx.inscricao.create({
      data: { eventoId, usuarioId, modalidade },
      select: { id: true },
    });
    return { ok: true as const, inscricaoId: criada.id, jaInscrito: false };
  });
}

/**
 * Chave da trava consultiva, derivada do evento e da modalidade.
 *
 * `pg_advisory_xact_lock` recebe um inteiro de 64 bits com sinal, e não um
 * texto: o número tem de sair de um resumo do par. SHA-256 truncado em oito
 * bytes serve — não há segredo aqui, só a necessidade de que chaves diferentes
 * quase nunca coincidam. Uma coincidência, se acontecesse, apenas faria dois
 * eventos sem relação esperarem um pelo outro por alguns milissegundos.
 */
function chaveDaTrava(eventoId: string, modalidade: ModalidadeInscricao): bigint {
  return createHash("sha256")
    .update(`vaga:${eventoId}:${modalidade}`)
    .digest()
    .readBigInt64BE(0);
}
