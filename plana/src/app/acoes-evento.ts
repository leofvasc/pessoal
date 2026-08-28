"use server";

/**
 * Ações de evento: criação pelo organizador e inscrição do participante.
 * Planejamento, seções 3, 6 e 7.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao, exigirOrganizador } from "@/lib/sessao";
import { codigoCurto, codigoEvento, paraSlug, tokenQr } from "@/lib/codigos";
import { doAcreParaUtc } from "@/lib/fuso";
import { notificar } from "@/lib/notificacoes";

export type EstadoEvento = { erro?: string; campos?: Record<string, string> };

const esquema = z
  .object({
    nome: z.string().trim().min(4, "Dê um nome ao evento.").max(160),
    descricao: z.string().trim().min(10, "Descreva o evento.").max(4000),
    modalidade: z.enum(["PRESENCIAL", "ONLINE", "HIBRIDO"]),
    inicioLocal: z.string().min(1, "Informe o início."),
    fimLocal: z.string().min(1, "Informe o término."),
    localNome: z.string().trim().max(160).optional(),
    localEndereco: z.string().trim().max(300).optional(),
    meioTransmissao: z.string().trim().max(300).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    cargaHorariaMinutos: z.coerce.number().int().min(15).max(60 * 24 * 30),
    tutorVirtualUrl: z.url("Endereço inválido.").optional().or(z.literal("")),
    palestranteNome: z.string().trim().min(3, "Informe o palestrante.").max(160),
    palestranteQualificacao: z.string().trim().min(3, "Informe a qualificação.").max(600),
  })
  .refine(
    // Sem ponto no mapa não há como validar presença por geolocalização — e a
    // seção 3 é explícita: a coordenada vem de um pino inserido manualmente,
    // nunca de geocodificação do endereço.
    (d) => d.modalidade === "ONLINE" || (d.latitude !== undefined && d.longitude !== undefined),
    { path: ["latitude"], message: "Marque o local do evento no mapa." },
  )
  .refine((d) => d.modalidade === "ONLINE" || Boolean(d.localNome), {
    path: ["localNome"],
    message: "Informe o nome do local.",
  })
  .refine((d) => d.modalidade === "PRESENCIAL" || Boolean(d.meioTransmissao), {
    path: ["meioTransmissao"],
    message: "Informe o meio de transmissão.",
  });

function texto(dados: FormData, chave: string): string {
  const valor = dados.get(chave);
  return typeof valor === "string" ? valor.trim() : "";
}

function opcional(dados: FormData, chave: string): string | undefined {
  return texto(dados, chave) || undefined;
}

/** Sequencial do evento dentro do ano, para compor EVT-AAAA-NNNN. */
async function proximoSequencial(ano: number): Promise<number> {
  const total = await prisma.evento.count({
    where: { codigoEvento: { startsWith: `EVT-${ano}-` } },
  });
  return total + 1;
}

/** Garante slug único acrescentando um sufixo numérico quando houver colisão. */
async function slugLivre(base: string): Promise<string> {
  const raiz = base || "evento";
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const candidato = tentativa === 0 ? raiz : `${raiz}-${tentativa + 1}`;
    const existe = await prisma.evento.findUnique({
      where: { slug: candidato },
      select: { id: true },
    });
    if (!existe) return candidato;
  }
  return `${raiz}-${Date.now()}`;
}

export async function criarEvento(
  _anterior: EstadoEvento,
  dados: FormData,
): Promise<EstadoEvento> {
  const sessao = await exigirOrganizador();

  const analise = esquema.safeParse({
    nome: texto(dados, "nome"),
    descricao: texto(dados, "descricao"),
    modalidade: texto(dados, "modalidade"),
    inicioLocal: texto(dados, "inicioLocal"),
    fimLocal: texto(dados, "fimLocal"),
    localNome: opcional(dados, "localNome"),
    localEndereco: opcional(dados, "localEndereco"),
    meioTransmissao: opcional(dados, "meioTransmissao"),
    latitude: opcional(dados, "latitude"),
    longitude: opcional(dados, "longitude"),
    cargaHorariaMinutos: texto(dados, "cargaHorariaMinutos"),
    tutorVirtualUrl: opcional(dados, "tutorVirtualUrl"),
    palestranteNome: texto(dados, "palestranteNome"),
    palestranteQualificacao: texto(dados, "palestranteQualificacao"),
  });

  if (!analise.success) {
    const campos: Record<string, string> = {};
    for (const problema of analise.error.issues) {
      const chave = String(problema.path[0] ?? "");
      if (chave && !campos[chave]) campos[chave] = problema.message;
    }
    return { erro: "Confira os campos destacados.", campos };
  }

  const entrada = analise.data;

  // Os campos de data são digitados em horário do Acre — a referência
  // principal da plataforma — e persistidos em UTC.
  const inicioEm = doAcreParaUtc(entrada.inicioLocal);
  const fimEm = doAcreParaUtc(entrada.fimLocal);

  if (fimEm <= inicioEm) {
    return { erro: "Confira os campos destacados.", campos: { fimLocal: "O término tem de vir depois do início." } };
  }

  const ano = Number(
    new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone: "America/Rio_Branco" }).format(
      inicioEm,
    ),
  );

  const evento = await prisma.evento.create({
    data: {
      nome: entrada.nome,
      descricao: entrada.descricao,
      modalidade: entrada.modalidade,
      inicioEm,
      fimEm,
      localNome: entrada.localNome ?? null,
      localEndereco: entrada.localEndereco ?? null,
      meioTransmissao: entrada.meioTransmissao ?? null,
      latitude: entrada.latitude ?? null,
      longitude: entrada.longitude ?? null,
      cargaHorariaMinutos: entrada.cargaHorariaMinutos,
      tutorVirtualUrl: entrada.tutorVirtualUrl || null,
      slug: await slugLivre(paraSlug(entrada.nome)),
      codigoCurto: codigoCurto(),
      tokenQr: tokenQr(),
      codigoEvento: codigoEvento(ano, await proximoSequencial(ano)),
      organizadorId: sessao.usuarioId,
      palestrantes: {
        create: {
          nome: entrada.palestranteNome,
          qualificacao: entrada.palestranteQualificacao,
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/painel");
  redirect(`/painel/eventos/${evento.id}`);
}

export async function inscrever(eventoId: string) {
  const sessao = await exigirSessao();

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, nome: true, slug: true, publicado: true, fimEm: true },
  });
  if (!evento || !evento.publicado) return { erro: "Evento indisponível para inscrição." };
  if (evento.fimEm.getTime() < Date.now()) return { erro: "Este evento já foi encerrado." };

  const jaInscrito = await prisma.inscricao.findUnique({
    where: { eventoId_usuarioId: { eventoId, usuarioId: sessao.usuarioId } },
    select: { id: true, canceladaEm: true },
  });

  if (jaInscrito && !jaInscrito.canceladaEm) return { ok: true as const, jaInscrito: true };

  if (jaInscrito) {
    await prisma.inscricao.update({
      where: { id: jaInscrito.id },
      data: { canceladaEm: null },
    });
  } else {
    await prisma.inscricao.create({ data: { eventoId, usuarioId: sessao.usuarioId } });
  }

  // Seção 7: confirmação automática pela central de notificações da conta.
  await notificar({
    usuarioId: sessao.usuarioId,
    tipo: "INSCRICAO_CONFIRMADA",
    titulo: "Inscrição confirmada",
    corpo: `Sua inscrição em ${evento.nome} está confirmada. No dia, leia o QR Code projetado na sala para registrar presença.`,
    link: `/eventos/${evento.slug}`,
  });

  revalidatePath(`/eventos/${evento.slug}`);
  revalidatePath("/conta");
  return { ok: true as const, jaInscrito: false };
}

export async function publicarEvento(eventoId: string) {
  const sessao = await exigirOrganizador();
  await prisma.evento.updateMany({
    where: { id: eventoId, organizadorId: sessao.usuarioId },
    data: { publicado: true },
  });
  revalidatePath(`/painel/eventos/${eventoId}`);
}
