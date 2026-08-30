import "server-only";

/**
 * Download da planilha de inscrições e presenças de um evento.
 *
 * O alcance é decidido aqui, no servidor: `relatorioDoEvento` só devolve o
 * evento se ele estiver dentro do escopo da sessão. Organizador que troque o
 * id na barra de endereço recebe 404, não a planilha de outro.
 */
import { NextResponse } from "next/server";
import { exigirOrganizador } from "@/lib/sessao";
import { relatorioDoEvento } from "@/lib/relatorios";

export async function GET(
  _requisicao: Request,
  { params }: RouteContext<"/painel/eventos/[id]/relatorio">,
) {
  const sessao = await exigirOrganizador().catch(() => null);
  if (!sessao) return new NextResponse("Não autorizado.", { status: 403 });

  const { id } = await params;
  const relatorio = await relatorioDoEvento(sessao, id);
  if (!relatorio) return new NextResponse("Evento não encontrado.", { status: 404 });

  return new NextResponse(new Uint8Array(relatorio.conteudo), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${relatorio.nomeArquivo}"`,
      // Lista nominal de participantes: nunca em cache compartilhado.
      "Cache-Control": "private, no-store",
    },
  });
}
