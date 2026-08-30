import "server-only";

/**
 * Download do relatório consolidado.
 *
 * Os filtros vêm pela query, mas nenhum deles amplia alcance: `escopoDeEventos`
 * já fixou o recorte da sessão dentro de `relatorioConsolidado`, e o filtro por
 * organizador só tem efeito para quem enxerga a plataforma inteira.
 */
import { NextResponse } from "next/server";
import { exigirOrganizador } from "@/lib/sessao";
import { relatorioConsolidado, type FiltrosConsolidado } from "@/lib/relatorios";
import { doAcreParaUtc } from "@/lib/fuso";

function comoData(valor: string | null, fimDoDia: boolean): Date | undefined {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
  return doAcreParaUtc(`${valor}T${fimDoDia ? "23:59" : "00:00"}`);
}

export async function GET(requisicao: Request) {
  const sessao = await exigirOrganizador().catch(() => null);
  if (!sessao) return new NextResponse("Não autorizado.", { status: 403 });

  const parametros = new URL(requisicao.url).searchParams;
  const modalidade = parametros.get("modalidade");

  const filtros: FiltrosConsolidado = {
    de: comoData(parametros.get("de"), false),
    ate: comoData(parametros.get("ate"), true),
    organizadorId: parametros.get("organizador") || undefined,
    eventoIds: parametros.getAll("evento").filter(Boolean),
    modalidade:
      modalidade === "PRESENCIAL" || modalidade === "ONLINE" || modalidade === "HIBRIDO"
        ? modalidade
        : undefined,
    incluirCancelados: parametros.get("cancelados") === "1",
    incluirNaoPublicados: parametros.get("rascunhos") === "1",
  };

  const relatorio = await relatorioConsolidado(sessao, filtros);

  return new NextResponse(new Uint8Array(relatorio.conteudo), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${relatorio.nomeArquivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
