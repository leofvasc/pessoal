/**
 * Link curto de divulgação: planaeventos.app/e/XXXXXXX
 * Planejamento, seção 7 — é dele que sai o QR Code das peças gráficas.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  requisicao: Request,
  contexto: RouteContext<"/e/[codigo]">,
) {
  const { codigo } = await contexto.params;

  const evento = await prisma.evento.findUnique({
    where: { codigoCurto: codigo },
    select: { slug: true },
  });

  const destino = evento ? `/eventos/${evento.slug}` : "/";
  return NextResponse.redirect(new URL(destino, requisicao.url), 307);
}
