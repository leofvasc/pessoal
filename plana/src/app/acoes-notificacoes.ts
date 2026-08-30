"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/sessao";

export async function marcarTodasComoLidas() {
  const sessao = await exigirSessao();
  await prisma.notificacao.updateMany({
    where: { usuarioId: sessao.usuarioId, lidaEm: null },
    data: { lidaEm: new Date() },
  });
  revalidatePath("/conta", "layout");
}

/** Grava a inscrição de push do navegador (seção 8.2). */
export async function salvarAssinaturaPush(assinatura: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const sessao = await exigirSessao();
  await prisma.assinaturaPush.upsert({
    where: { endpoint: assinatura.endpoint },
    create: {
      usuarioId: sessao.usuarioId,
      endpoint: assinatura.endpoint,
      p256dh: assinatura.p256dh,
      auth: assinatura.auth,
      userAgent: assinatura.userAgent ?? null,
    },
    // O mesmo endpoint pode reaparecer noutra conta quando duas pessoas usam o
    // mesmo aparelho; a inscrição passa a valer para quem está autenticado.
    update: {
      usuarioId: sessao.usuarioId,
      p256dh: assinatura.p256dh,
      auth: assinatura.auth,
      userAgent: assinatura.userAgent ?? null,
    },
  });
}

export async function removerAssinaturaPush(endpoint: string) {
  const sessao = await exigirSessao();
  await prisma.assinaturaPush.deleteMany({ where: { endpoint, usuarioId: sessao.usuarioId } });
}
