/**
 * Download do QR Code do evento em PNG com fundo transparente.
 *
 *   .../qr/presenca.png    — token do evento, para projeção na sala
 *   .../qr/divulgacao.png  — link curto, para peça gráfica
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirOrganizador } from "@/lib/sessao";
import { qrPngBytes, urlCurta, urlDePresenca } from "@/lib/qr";
import { origemPublica } from "@/lib/origem";

export async function GET(
  _requisicao: Request,
  contexto: RouteContext<"/painel/eventos/[id]/qr/[arquivo]">,
) {
  const { id, arquivo } = await contexto.params;
  const sessao = await exigirOrganizador();

  const evento = await prisma.evento.findFirst({
    where: { id, organizadorId: sessao.usuarioId },
    select: { tokenQr: true, codigoCurto: true, codigoEvento: true },
  });
  if (!evento) return new NextResponse("Evento não encontrado", { status: 404 });

  const tipo = arquivo.replace(/\.png$/, "");
  if (tipo !== "presenca" && tipo !== "divulgacao") {
    return new NextResponse("QR desconhecido", { status: 404 });
  }

  const origem = await origemPublica();
  const conteudo =
    tipo === "presenca"
      ? urlDePresenca(origem, evento.tokenQr)
      : urlCurta(origem, evento.codigoCurto);

  // 2048 px porque o QR de presença vai para projetor: o que é lido de longe é
  // o tamanho do módulo na tela, e sobra de resolução não custa nada aqui.
  const png = await qrPngBytes(conteudo, { tamanho: 2048, margem: 4 });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${evento.codigoEvento}-${tipo}.png"`,
      // Contém o token secreto do evento: nunca em cache compartilhado.
      "Cache-Control": "private, no-store",
    },
  });
}
