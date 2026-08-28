/**
 * Verificação de saúde, usada pelo HEALTHCHECK do container.
 *
 * Confere o banco, e não apenas se o processo está de pé: uma aplicação que
 * responde mas não alcança o Postgres está fora do ar para todo efeito prático.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, erro: "banco indisponível" }, { status: 503 });
  }
}
