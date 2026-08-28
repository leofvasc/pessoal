"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/sessao";
import { registrarConsentimento, revogarConsentimento } from "@/lib/consentimento";
import type { FinalidadeConsentimento } from "@/generated/prisma/client";

export async function alternarConsentimento(
  finalidade: FinalidadeConsentimento,
  autorizar: boolean,
  telefone?: string,
) {
  const sessao = await exigirSessao();

  if (autorizar) {
    if (finalidade === "COMUNICACAO_URGENTE_WHATSAPP" && telefone) {
      await prisma.usuario.update({
        where: { id: sessao.usuarioId },
        data: { telefone: telefone.trim().slice(0, 20) },
      });
    }
    await registrarConsentimento(sessao.usuarioId, finalidade);
  } else {
    await revogarConsentimento(sessao.usuarioId, finalidade);

    // Revogada a autorização de WhatsApp, o telefone perde a finalidade que
    // justificava a coleta — e sem finalidade o dado não fica guardado
    // (planejamento, seção 9).
    if (finalidade === "COMUNICACAO_URGENTE_WHATSAPP") {
      await prisma.usuario.update({
        where: { id: sessao.usuarioId },
        data: { telefone: null },
      });
    }
  }

  revalidatePath("/conta/privacidade");
}
