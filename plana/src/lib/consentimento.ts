import "server-only";

/**
 * Registro de consentimento por finalidade (seção 9 do planejamento).
 *
 * O texto apresentado ao titular fica gravado junto com o aceite: o que prova o
 * consentimento não é a marcação da caixa, é saber exatamente o que foi lido
 * quando ela foi marcada. Por isso os textos vivem aqui, versionados no código,
 * e são copiados para a linha de Consentimento no momento do aceite.
 */
import type { FinalidadeConsentimento } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { TOLERANCIA_METROS } from "./geo";

export const TEXTOS_CONSENTIMENTO: Record<FinalidadeConsentimento, string> = {
  COMUNICACAO_URGENTE_EMAIL:
    "Autorizo o uso do meu e-mail para comunicações urgentes sobre os eventos em que me inscrever — mudança de horário, cancelamento e avisos que não possam esperar a central de notificações. Não será usado para divulgação.",
  COMUNICACAO_URGENTE_WHATSAPP:
    "Autorizo o uso do meu telefone para comunicações urgentes por WhatsApp sobre os eventos em que me inscrever. Posso revogar esta autorização a qualquer momento na minha conta, sem perder o acesso aos eventos nem aos certificados.",
  GEOLOCALIZACAO_CHECKIN: `Autorizo a leitura da localização do meu aparelho no momento em que eu registrar presença, apenas para conferir que estou a até ${TOLERANCIA_METROS} metros do local do evento. A coordenada é descartada assim que o certificado correspondente é emitido.`,
};

export async function registrarConsentimento(
  usuarioId: string,
  finalidade: FinalidadeConsentimento,
): Promise<void> {
  const texto = TEXTOS_CONSENTIMENTO[finalidade];
  await prisma.consentimento.upsert({
    where: { usuarioId_finalidade: { usuarioId, finalidade } },
    create: { usuarioId, finalidade, textoApresentado: texto },
    // Reaceitar depois de revogar reabre o consentimento e regrava o texto
    // vigente — o histórico do texto antigo já cumpriu sua função probatória.
    update: { revogadoEm: null, concedidoEm: new Date(), textoApresentado: texto },
  });
}

export async function revogarConsentimento(
  usuarioId: string,
  finalidade: FinalidadeConsentimento,
): Promise<void> {
  await prisma.consentimento.updateMany({
    where: { usuarioId, finalidade, revogadoEm: null },
    data: { revogadoEm: new Date() },
  });
}

export async function temConsentimento(
  usuarioId: string,
  finalidade: FinalidadeConsentimento,
): Promise<boolean> {
  const registro = await prisma.consentimento.findUnique({
    where: { usuarioId_finalidade: { usuarioId, finalidade } },
    select: { revogadoEm: true },
  });
  return Boolean(registro && registro.revogadoEm === null);
}
