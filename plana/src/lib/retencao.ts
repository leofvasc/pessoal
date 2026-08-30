import "server-only";

/**
 * Retenção mínima de dados pessoais.
 * Planejamento, seção 9: dados que não sejam essenciais aos serviços de
 * natureza mais duradoura devem ser excluídos automaticamente assim que
 * cumprida sua finalidade.
 *
 * O exemplo dado no próprio planejamento é o desta rotina: a coordenada de
 * geolocalização coletada no check-in esgota sua função probatória assim que o
 * certificado correspondente é emitido, podendo ser descartada — enquanto o
 * registro de emissão do certificado, serviço de natureza duradoura, permanece
 * na área do participante.
 *
 * O que é apagado: latitude, longitude, distância e precisão.
 * O que permanece: que houve presença, quando, e por qual método.
 */
import { prisma } from "./prisma";

/**
 * Prazo máximo para descarte da coordenada quando o certificado nunca é
 * emitido. Sem ele, o participante que se inscreve, comparece e nunca baixa o
 * certificado teria a coordenada guardada indefinidamente — o que contraria a
 * retenção mínima tanto quanto guardá-la depois da emissão.
 */
export const DIAS_LIMITE_SEM_EMISSAO = 90;

export async function descartarGeolocalizacaoDoCheckin(inscricaoId: string) {
  await prisma.presenca.updateMany({
    where: { inscricaoId, geoDescartadaEm: null },
    data: {
      latitude: null,
      longitude: null,
      distanciaMetros: null,
      precisaoMetros: null,
      geoDescartadaEm: new Date(),
    },
  });
}

/**
 * Varredura periódica. Descarta coordenadas de presenças cuja finalidade já se
 * esgotou: as com certificado já emitido e as antigas demais para ainda servir
 * de prova. Pensada para rodar uma vez por dia na VPS.
 */
export async function varrerRetencao(): Promise<{ descartadas: number; redefinicoesExcluidas: number }> {
  const limite = new Date(Date.now() - DIAS_LIMITE_SEM_EMISSAO * 24 * 60 * 60 * 1000);

  const [resultado, redefinicoes] = await prisma.$transaction([
    prisma.presenca.updateMany({
    where: {
      geoDescartadaEm: null,
      latitude: { not: null },
      OR: [
        { inscricao: { certificado: { primeiraEmissaoEm: { not: null } } } },
        { registradaEm: { lt: limite } },
      ],
    },
    data: {
      latitude: null,
      longitude: null,
      distanciaMetros: null,
      precisaoMetros: null,
      geoDescartadaEm: new Date(),
    },
    }),
    prisma.redefinicaoSenha.deleteMany({
      where: { expiraEm: { lt: new Date() } },
    }),
  ]);

  return { descartadas: resultado.count, redefinicoesExcluidas: redefinicoes.count };
}
