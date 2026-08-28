/**
 * Servir arquivo enviado pelo gestor, com autorização por uso.
 *
 * Os arquivos não ficam em `public/` justamente para passar por aqui: material
 * de apoio é dos inscritos no evento, e o que está em `public/` é servido a
 * qualquer um que descubra o endereço.
 *
 * A regra é por uso, não por arquivo:
 *  - logotipo de instituição e banner de evento são públicos, porque aparecem
 *    na página pública do evento;
 *  - material de apoio é de quem está inscrito naquele evento, e do organizador;
 *  - imagem-base de certificado é só do organizador — o participante recebe o
 *    PDF já montado, nunca o fundo separado.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessaoAtual } from "@/lib/sessao";
import { lerArquivo } from "@/lib/armazenamento";

export async function GET(_requisicao: Request, contexto: RouteContext<"/arquivos/[id]">) {
  const { id } = await contexto.params;

  const arquivo = await prisma.arquivo.findUnique({
    where: { id },
    select: {
      caminho: true,
      tipoMime: true,
      nomeOriginal: true,
      logosDeInstituicoes: { select: { id: true }, take: 1 },
      banners: { select: { id: true }, take: 1 },
      imagensBase: { select: { organizadorId: true }, take: 1 },
      materiais: {
        select: { eventoId: true, evento: { select: { organizadorId: true } } },
        take: 1,
      },
    },
  });

  if (!arquivo) return new NextResponse("Arquivo não encontrado", { status: 404 });

  const publico = arquivo.logosDeInstituicoes.length > 0 || arquivo.banners.length > 0;
  const material = arquivo.materiais[0];
  const imagemBase = arquivo.imagensBase[0];

  let liberado = publico;

  if (!liberado && (material || imagemBase)) {
    const sessao = await sessaoAtual();
    if (!sessao) return new NextResponse("Não autenticado", { status: 401 });

    if (imagemBase) {
      liberado = imagemBase.organizadorId === sessao.usuarioId;
    }

    if (!liberado && material) {
      if (material.evento.organizadorId === sessao.usuarioId) {
        liberado = true;
      } else {
        const inscricao = await prisma.inscricao.findUnique({
          where: {
            eventoId_usuarioId: { eventoId: material.eventoId, usuarioId: sessao.usuarioId },
          },
          select: { canceladaEm: true },
        });
        liberado = Boolean(inscricao && !inscricao.canceladaEm);
      }
    }
  }

  if (!liberado) return new NextResponse("Sem acesso a este arquivo", { status: 403 });

  const conteudo = await lerArquivo(arquivo.caminho).catch(() => null);
  if (!conteudo) return new NextResponse("Arquivo indisponível", { status: 404 });

  // `attachment` para material — é para baixar; `inline` para logo e banner,
  // que a página exibe.
  const disposicao = material ? "attachment" : "inline";
  // O nome original volta só no cabeçalho, entre aspas e sem quebras: ele foi
  // digitado por quem enviou, e cabeçalho aceita injeção por CR/LF.
  const nomeSeguro = arquivo.nomeOriginal.replace(/[\r\n"\\]/g, "_");

  return new NextResponse(new Uint8Array(conteudo), {
    headers: {
      "Content-Type": arquivo.tipoMime,
      "Content-Disposition": `${disposicao}; filename="${nomeSeguro}"`,
      // Um SVG servido inline executaria script na origem da plataforma.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": publico ? "public, max-age=3600" : "private, no-store",
    },
  });
}
