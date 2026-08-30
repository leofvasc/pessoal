/**
 * Arquivo .ics do evento, para o participante salvar na agenda do aparelho.
 *
 * Serve Apple Calendar, Outlook, Thunderbird e qualquer outro que leia o
 * formato padrão de calendário (RFC 5545). O Google tem caminho próprio, por
 * URL, e não passa por aqui.
 *
 * A rota é pública e não guarda nada — nem quem baixou, nem quando. Tudo que
 * sai no arquivo já está na página pública do evento: nome, descrição,
 * horário, local ou meio de transmissão e o endereço do evento. Nenhum dado do
 * participante entra, e não há registro do download: a comodidade de salvar na
 * agenda não é motivo para criar um dado novo sobre alguém.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { icsDoEvento, nomeDoArquivoIcs } from "@/lib/agenda";
import { localParaAgenda } from "@/lib/agenda-evento";
import { origemPublica } from "@/lib/origem";

export async function GET(_requisicao: Request, contexto: RouteContext<"/eventos/[slug]/agenda.ics">) {
  const { slug } = await contexto.params;

  const evento = await prisma.evento.findFirst({
    where: { slug, publicado: true, excluidoEm: null },
    select: {
      nome: true,
      descricao: true,
      inicioEm: true,
      fimEm: true,
      modalidade: true,
      localNome: true,
      localEndereco: true,
      meioTransmissao: true,
      codigoEvento: true,
      slug: true,
      canceladoEm: true,
    },
  });

  if (!evento) return new NextResponse("Evento não encontrado", { status: 404 });
  // Evento cancelado continua com página pública, para informar os inscritos,
  // mas não faz sentido entrar na agenda de ninguém como compromisso.
  if (evento.canceladoEm) {
    return new NextResponse("Este evento foi cancelado.", { status: 410 });
  }

  const origem = await origemPublica();
  const conteudo = icsDoEvento(
    {
      nome: evento.nome,
      descricao: evento.descricao,
      inicioEm: evento.inicioEm,
      fimEm: evento.fimEm,
      local: localParaAgenda(evento),
      url: `${origem}/eventos/${evento.slug}`,
      codigoEvento: evento.codigoEvento,
    },
    origem,
  );

  return new NextResponse(conteudo, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeDoArquivoIcs(evento.codigoEvento)}"`,
      // Data e local mudam com a edição do evento: um .ics em cache
      // desatualizado entra na agenda com a informação antiga.
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
