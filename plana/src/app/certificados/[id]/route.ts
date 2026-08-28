/**
 * Emissão do certificado em PDF, sob demanda.
 *
 * Planejamento, seção 6: o arquivo é montado no momento da solicitação e não
 * fica armazenado — o que persiste é só o registro de aptidão e o código de
 * validação. Esta rota é, portanto, o único lugar onde o PDF existe.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessaoAtual } from "@/lib/sessao";
import { gerarCertificado } from "@/lib/certificado";
import { origemPublica } from "@/lib/origem";
import { descartarGeolocalizacaoDoCheckin } from "@/lib/retencao";
import { caminhoAbsoluto } from "@/lib/armazenamento";

export async function GET(
  _requisicao: Request,
  contexto: RouteContext<"/certificados/[id]">,
) {
  const { id } = await contexto.params;

  const sessao = await sessaoAtual();
  if (!sessao) return new NextResponse("Não autenticado", { status: 401 });

  const certificado = await prisma.certificado.findFirst({
    where: { id, inscricao: { usuarioId: sessao.usuarioId } },
    select: {
      id: true,
      codigoValidacao: true,
      inscricaoId: true,
      inscricao: {
        select: {
          usuario: { select: { nome: true } },
          presenca: { select: { id: true, metodo: true } },
          evento: {
            select: {
              nome: true,
              inicioEm: true,
              fimEm: true,
              cargaHorariaMinutos: true,
              certificadoBaseArquivo: { select: { caminho: true } },
              instituicoes: {
                orderBy: { ordem: "asc" },
                select: { instituicao: { select: { nome: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!certificado) return new NextResponse("Certificado não encontrado", { status: 404 });

  const { evento, usuario, presenca } = certificado.inscricao;

  if (!presenca) {
    return new NextResponse("Presença não registrada neste evento.", { status: 409 });
  }
  if (evento.fimEm.getTime() > Date.now()) {
    return new NextResponse("O certificado fica disponível ao término do evento.", { status: 409 });
  }

  const pdf = await gerarCertificado({
    nomeParticipante: usuario.nome,
    nomeEvento: evento.nome,
    inicioEm: evento.inicioEm,
    cargaHorariaMinutos: evento.cargaHorariaMinutos,
    instituicoes: evento.instituicoes.map((i) => i.instituicao.nome),
    codigoValidacao: certificado.codigoValidacao,
    caminhoImagemBase: evento.certificadoBaseArquivo
      ? caminhoAbsoluto(evento.certificadoBaseArquivo.caminho)
      : null,
    origem: await origemPublica(),
    metodoPresenca: presenca.metodo,
  });

  await prisma.certificado.update({
    where: { id: certificado.id },
    data: { totalEmissoes: { increment: 1 } },
  });

  // `updateMany` com o filtro `primeiraEmissaoEm: null` grava a data só na
  // primeira vez, sem precisar de leitura prévia nem de transação.
  await prisma.certificado.updateMany({
    where: { id: certificado.id, primeiraEmissaoEm: null },
    data: { primeiraEmissaoEm: new Date() },
  });

  // Retenção mínima (seção 9): emitido o certificado, a coordenada do check-in
  // esgotou sua função probatória e é descartada. O registro da presença e do
  // método permanece.
  await descartarGeolocalizacaoDoCheckin(certificado.inscricaoId);

  const arquivo = `${certificado.codigoValidacao}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${arquivo}"`,
      // Documento nominal: nunca em cache compartilhado.
      "Cache-Control": "private, no-store",
    },
  });
}
