/**
 * O que se diz ao participante depois de confirmada a inscrição.
 *
 * A instrução muda com a modalidade, e essa é a razão de o texto morar num
 * módulo só: quem se inscreveu na transmissão de um evento híbrido não vai
 * encontrar QR Code projetado em sala nenhuma, e mandá-lo procurar um é
 * instrução que só produz chamado de suporte.
 *
 * Isomórfico de propósito — a mesma frase sai no popup da inscrição, na
 * central de notificações e no e-mail.
 */
import type { ModalidadeInscricao } from "@/generated/prisma/client";

/** Como registrar presença, conforme a modalidade da inscrição. */
export const COMO_REGISTRAR_PRESENCA: Record<ModalidadeInscricao, string> = {
  PRESENCIAL: "No dia, leia o QR Code projetado na sala para registrar presença.",
  ONLINE:
    "No dia, abra o endereço de presença a distância que a organização enviar e informe o código pessoal da sua conta para registrar presença.",
};

/** Corpo da notificação de inscrição confirmada. */
export function corpoDaConfirmacao(
  nomeDoEvento: string,
  modalidade: ModalidadeInscricao,
): string {
  return `Sua inscrição em ${nomeDoEvento} está confirmada. ${COMO_REGISTRAR_PRESENCA[modalidade]}`;
}
