/**
 * Vagas e modalidade da inscrição.
 *
 * Módulo isomórfico de propósito: o mesmo cálculo tem de dar o mesmo resultado
 * no formulário do organizador, na página pública, no botão de inscrição e no
 * relatório. Duas contas paralelas divergiriam justamente na única situação
 * que importa — a última vaga.
 *
 * A regra de leitura é uma só, e vale para as duas modalidades: limite nulo
 * significa **sem limite**, e a inscrição nunca fecha por lotação. Não é o
 * mesmo que limite zero, que fecha desde o primeiro instante — a distinção
 * existe porque "não quero controlar vagas" e "não quero ninguém aqui" são
 * decisões diferentes do organizador.
 *
 * Evento online sem limite é o caso que motivou o desenho: transmissão não tem
 * cadeira, e fechar a inscrição por um número arbitrário seria inventar uma
 * restrição que a realidade não impõe.
 */
import type { Modalidade, ModalidadeInscricao } from "@/generated/prisma/client";

export const ROTULO_MODALIDADE_INSCRICAO = {
  PRESENCIAL: "Presencial",
  ONLINE: "Online",
} as const satisfies Record<ModalidadeInscricao, string>;

export type RotuloModalidadeInscricao =
  (typeof ROTULO_MODALIDADE_INSCRICAO)[ModalidadeInscricao];

/** Como cada modalidade de inscrição se descreve para quem vai escolher. */
export const EXPLICACAO_MODALIDADE_INSCRICAO: Record<ModalidadeInscricao, string> = {
  PRESENCIAL: "Assisto no local, e registro presença lendo o QR Code projetado na sala.",
  ONLINE: "Assisto pela transmissão, e registro presença com meu código pessoal.",
};

/**
 * Modalidades de inscrição que um evento aceita.
 *
 * Presencial e online têm uma só, e ela é a do próprio evento — não há escolha
 * a oferecer, e oferecê-la seria uma pergunta com uma resposta possível. O
 * híbrido tem as duas, e é o único caso em que o participante decide.
 */
export function modalidadesDeInscricao(modalidade: Modalidade): ModalidadeInscricao[] {
  switch (modalidade) {
    case "PRESENCIAL":
      return ["PRESENCIAL"];
    case "ONLINE":
      return ["ONLINE"];
    case "HIBRIDO":
      return ["PRESENCIAL", "ONLINE"];
  }
}

/** Diz se o participante escolhe a modalidade ou se ela já está decidida. */
export function exigeEscolhaDeModalidade(modalidade: Modalidade): boolean {
  return modalidadesDeInscricao(modalidade).length > 1;
}

/** Modalidade da inscrição quando não há escolha a fazer. */
export function modalidadeUnica(modalidade: Modalidade): ModalidadeInscricao {
  return modalidadesDeInscricao(modalidade)[0];
}

export type VagasDaModalidade = {
  modalidade: ModalidadeInscricao;
  /** `null` é sem limite. */
  limite: number | null;
  ocupadas: number;
  /** `null` quando não há limite; nunca negativo quando há. */
  restantes: number | null;
  esgotado: boolean;
};

export type SituacaoDeVagas = VagasDaModalidade[];

export function calcularVagas(
  modalidade: ModalidadeInscricao,
  limite: number | null,
  ocupadas: number,
): VagasDaModalidade {
  // O restante nunca vira negativo: se o limite foi reduzido depois de as
  // inscrições já terem passado dele, quem já entrou continua inscrito — tirar
  // alguém de um evento em que se inscreveu é decisão da organização, não
  // efeito colateral de editar um número.
  const restantes = limite === null ? null : Math.max(0, limite - ocupadas);
  return {
    modalidade,
    limite,
    ocupadas,
    restantes,
    esgotado: restantes !== null && restantes === 0,
  };
}

/**
 * Situação das vagas de um evento, uma linha por modalidade que ele aceita.
 *
 * As contagens vêm de fora porque quem as faz é o servidor; aqui só se aplica
 * a regra, o que permite reusar o mesmo cálculo na tela e no formulário.
 */
export function situacaoDeVagas(evento: {
  modalidade: Modalidade;
  vagasPresencial: number | null;
  vagasOnline: number | null;
  ocupadasPresencial: number;
  ocupadasOnline: number;
}): SituacaoDeVagas {
  return modalidadesDeInscricao(evento.modalidade).map((modalidade) =>
    modalidade === "PRESENCIAL"
      ? calcularVagas("PRESENCIAL", evento.vagasPresencial, evento.ocupadasPresencial)
      : calcularVagas("ONLINE", evento.vagasOnline, evento.ocupadasOnline),
  );
}

/** O evento inteiro está lotado quando nenhuma das suas modalidades tem vaga. */
export function totalmenteEsgotado(situacao: SituacaoDeVagas): boolean {
  return situacao.length > 0 && situacao.every((vagas) => vagas.esgotado);
}

/** "Sem limite de vagas", "12 vagas restantes", "Esgotado". */
export function rotuloDeVagas(vagas: VagasDaModalidade): string {
  if (vagas.limite === null) return "Sem limite de vagas";
  if (vagas.restantes === 0) return "Esgotado";
  return vagas.restantes === 1 ? "1 vaga restante" : `${vagas.restantes} vagas restantes`;
}

/** O mesmo, prefixado pela modalidade — para o evento híbrido, que tem duas. */
export function rotuloDeVagasComModalidade(vagas: VagasDaModalidade): string {
  return `${ROTULO_MODALIDADE_INSCRICAO[vagas.modalidade]}: ${rotuloDeVagas(vagas).toLocaleLowerCase("pt-BR")}`;
}
