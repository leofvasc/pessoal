"use server";

/**
 * Ações de evento: criação pelo organizador e inscrição do participante.
 * Planejamento, seções 3, 6 e 7.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao, exigirOrganizador, escopoDeEventos } from "@/lib/sessao";
import { semInstituicaoAtiva } from "@/lib/organizadores";
import { codigoCurto, codigoEvento, paraSlug, tokenQr, tokenRemoto } from "@/lib/codigos";
import { doAcreParaUtc } from "@/lib/fuso";
import { idDoModeloPadrao } from "@/lib/configuracao";
import { notificar } from "@/lib/notificacoes";

export type EstadoEvento = { erro?: string; ok?: string; campos?: Record<string, string> };

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
    // Gratuidade: a plataforma não cobra nem processa pagamento. O campo existe
    // para que o participante saiba antes de se inscrever, e para que o evento
    // gratuito diga isso de forma expressa em vez de deixar em silêncio.
    gratuito: z.boolean(),
    valorReais: z.coerce
      .number()
      .min(0.01, "Informe um valor maior que zero.")
      .max(1_000_000)
      .optional(),
    instrucoesPagamento: z.string().trim().max(2000).optional(),
    tutorVirtualUrl: z.url("Endereço inválido.").optional().or(z.literal("")),
    palestrantes: z
      .array(
        z.object({
          nome: z.string().trim().min(3, "Informe o palestrante.").max(160),
          qualificacao: z.string().trim().min(3, "Informe a qualificação.").max(600),
        }),
      )
      .min(1, "Inclua ao menos um palestrante.")
      .max(20, "Cada evento pode ter no máximo 20 palestrantes."),
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
  })
  .refine((d) => d.gratuito || d.valorReais !== undefined, {
    path: ["valorReais"],
    message: "Informe o valor da inscrição.",
  })
  .refine((d) => d.gratuito || Boolean(d.instrucoesPagamento), {
    path: ["instrucoesPagamento"],
    // Sem sistema de pagamento na plataforma, um evento pago sem instruções
    // deixaria o participante sem saber como pagar.
    message: "Explique como o participante deve efetuar o pagamento.",
  });

function texto(dados: FormData, chave: string): string {
  const valor = dados.get(chave);
  return typeof valor === "string" ? valor.trim() : "";
}

function opcional(dados: FormData, chave: string): string | undefined {
  return texto(dados, chave) || undefined;
}

function analisarFormulario(dados: FormData) {
  const nomes = dados
    .getAll("palestranteNome")
    .map((valor) => (typeof valor === "string" ? valor.trim() : ""));
  const qualificacoes = dados
    .getAll("palestranteQualificacao")
    .map((valor) => (typeof valor === "string" ? valor.trim() : ""));

  return esquema.safeParse({
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
    gratuito: texto(dados, "gratuidade") !== "PAGO",
    valorReais: opcional(dados, "valorReais")?.replace(",", "."),
    instrucoesPagamento: opcional(dados, "instrucoesPagamento"),
    tutorVirtualUrl: opcional(dados, "tutorVirtualUrl"),
    palestrantes: nomes.map((nome, indice) => ({
      nome,
      qualificacao: qualificacoes[indice] ?? "",
    })),
  });
}

function estadoDeErro(problemas: z.core.$ZodIssue[]): EstadoEvento {
  const campos: Record<string, string> = {};
  for (const problema of problemas) {
    let chave = String(problema.path[0] ?? "");
    if (
      problema.path[0] === "palestrantes" &&
      typeof problema.path[1] === "number" &&
      (problema.path[2] === "nome" || problema.path[2] === "qualificacao")
    ) {
      const prefixo = problema.path[2] === "nome" ? "palestranteNome" : "palestranteQualificacao";
      chave = `${prefixo}.${problema.path[1]}`;
    }
    if (chave && !campos[chave]) campos[chave] = problema.message;
  }
  return { erro: "Confira os campos destacados.", campos };
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

  const analise = analisarFormulario(dados);

  if (!analise.success) {
    return estadoDeErro(analise.error.issues);
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

  // A plataforma mantém um modelo-base padrão de certificado (configurado uma
  // única vez em /painel/configuracoes). Todo evento novo já nasce com ele,
  // para que ninguém precise reenviar a mesma arte a cada evento — e para que
  // Sem instituição ativa não há em nome de quem criar o evento. Ou a conta
  // não gere nenhuma, ou todas as que ela gere estão suspensas — e em ambos os
  // casos o histórico, as listas e os relatórios continuam acessíveis.
  if (sessao.papel !== "MASTER" && (await semInstituicaoAtiva(sessao.usuarioId))) {
    return {
      erro: "Sua conta não gere nenhuma instituição ativa. Fale com a administração da plataforma.",
    };
  }

  // nenhum certificado saia sobre fundo branco por esquecimento. O organizador
  // pode substituí-lo dentro do evento a qualquer momento.
  const certificadoBaseArquivoId = await idDoModeloPadrao();

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
      gratuito: entrada.gratuito,
      // Centavos inteiros: dinheiro em ponto flutuante acumula erro de
      // arredondamento, e o valor aqui é o que o participante vai pagar.
      valorCentavos: entrada.gratuito ? null : Math.round((entrada.valorReais ?? 0) * 100),
      instrucoesPagamento: entrada.gratuito ? null : (entrada.instrucoesPagamento ?? null),
      tutorVirtualUrl: entrada.tutorVirtualUrl || null,
      certificadoBaseArquivoId,
      slug: await slugLivre(paraSlug(entrada.nome)),
      codigoCurto: codigoCurto(),
      tokenQr: tokenQr(),
      // Só evento online ou híbrido tem página de presença a distância: no
      // presencial, a presença é a leitura do QR projetado na sala.
      tokenRemoto: entrada.modalidade === "PRESENCIAL" ? null : tokenRemoto(),
      codigoEvento: codigoEvento(ano, await proximoSequencial(ano)),
      // Criar é diferente de alcançar: o evento nasce da conta que o criou,
      // inclusive quando quem cria é o master.
      organizadorId: sessao.usuarioId,
      palestrantes: {
        create: entrada.palestrantes.map((palestrante, ordem) => ({
          ...palestrante,
          ordem,
        })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/painel");
  redirect(`/painel/eventos/${evento.id}`);
}

export async function editarEvento(
  eventoId: string,
  _anterior: EstadoEvento,
  dados: FormData,
): Promise<EstadoEvento> {
  const sessao = await exigirOrganizador();
  const evento = await prisma.evento.findFirst({
    where: { id: eventoId, ...escopoDeEventos(sessao), excluidoEm: null },
    select: { id: true, slug: true, modalidade: true, tokenRemoto: true },
  });
  if (!evento) return { erro: "Evento não encontrado ou sem autorização." };

  const analise = analisarFormulario(dados);
  if (!analise.success) return estadoDeErro(analise.error.issues);

  const entrada = analise.data;
  const inicioEm = doAcreParaUtc(entrada.inicioLocal);
  const fimEm = doAcreParaUtc(entrada.fimLocal);
  if (fimEm <= inicioEm) {
    return { erro: "Confira os campos destacados.", campos: { fimLocal: "O término tem de vir depois do início." } };
  }

  await prisma.$transaction(async (tx) => {
    await tx.evento.update({
      where: { id: evento.id },
      data: {
        nome: entrada.nome,
        descricao: entrada.descricao,
        modalidade: entrada.modalidade,
        inicioEm,
        fimEm,
        localNome: entrada.modalidade === "ONLINE" ? null : (entrada.localNome ?? null),
        localEndereco: entrada.modalidade === "ONLINE" ? null : (entrada.localEndereco ?? null),
        latitude: entrada.modalidade === "ONLINE" ? null : (entrada.latitude ?? null),
        longitude: entrada.modalidade === "ONLINE" ? null : (entrada.longitude ?? null),
        meioTransmissao: entrada.modalidade === "PRESENCIAL" ? null : (entrada.meioTransmissao ?? null),
        cargaHorariaMinutos: entrada.cargaHorariaMinutos,
        gratuito: entrada.gratuito,
        valorCentavos: entrada.gratuito ? null : Math.round((entrada.valorReais ?? 0) * 100),
        instrucoesPagamento: entrada.gratuito ? null : (entrada.instrucoesPagamento ?? null),
        tutorVirtualUrl: entrada.tutorVirtualUrl || null,
        tokenRemoto:
          entrada.modalidade === "PRESENCIAL"
            ? null
            : evento.tokenRemoto ?? tokenRemoto(),
      },
    });

    await tx.palestrante.deleteMany({ where: { eventoId: evento.id } });
    await tx.palestrante.createMany({
      data: entrada.palestrantes.map((palestrante, ordem) => ({
        eventoId: evento.id,
        ...palestrante,
        ordem,
      })),
    });
  });

  revalidatePath(`/painel/eventos/${evento.id}`);
  revalidatePath(`/eventos/${evento.slug}`);
  redirect(`/painel/eventos/${evento.id}`);
}

export async function inscrever(eventoId: string) {
  const sessao = await exigirSessao();

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, nome: true, slug: true, publicado: true, fimEm: true, canceladoEm: true, excluidoEm: true },
  });
  if (!evento || !evento.publicado || evento.excluidoEm) return { erro: "Evento indisponível para inscrição." };
  if (evento.canceladoEm) return { erro: "Este evento foi cancelado." };
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
  if (sessao.papel !== "MASTER" && (await semInstituicaoAtiva(sessao.usuarioId))) {
    return { erro: "Sua conta não gere nenhuma instituição ativa." };
  }
  const resultado = await prisma.evento.updateMany({
    where: {
      id: eventoId,
      ...escopoDeEventos(sessao),
      canceladoEm: null,
      excluidoEm: null,
    },
    data: { publicado: true },
  });
  if (resultado.count === 0) return { erro: "O evento não pode ser publicado." };
  revalidatePath(`/painel/eventos/${eventoId}`);
  revalidatePath("/painel");
  return { ok: true as const };
}

export async function despublicarEvento(eventoId: string) {
  const sessao = await exigirOrganizador();
  const resultado = await prisma.evento.updateMany({
    where: { id: eventoId, ...escopoDeEventos(sessao), excluidoEm: null },
    data: { publicado: false },
  });
  if (resultado.count === 0) return { erro: "Evento não encontrado ou sem autorização." };
  revalidatePath(`/painel/eventos/${eventoId}`);
  revalidatePath("/painel");
  return { ok: true as const };
}

export async function cancelarEvento(eventoId: string) {
  const sessao = await exigirOrganizador();
  const evento = await prisma.evento.findFirst({
    where: { id: eventoId, ...escopoDeEventos(sessao), excluidoEm: null },
    select: {
      id: true,
      nome: true,
      slug: true,
      canceladoEm: true,
      inscricoes: { where: { canceladaEm: null }, select: { usuarioId: true } },
    },
  });
  if (!evento) return { erro: "Evento não encontrado ou sem autorização." };
  if (evento.canceladoEm) return { ok: true as const };

  await prisma.evento.update({ where: { id: evento.id }, data: { canceladoEm: new Date() } });
  await Promise.all(
    evento.inscricoes.map(({ usuarioId }) =>
      notificar({
        usuarioId,
        tipo: "AVISO_EVENTO",
        titulo: "Evento cancelado",
        corpo: `O evento ${evento.nome} foi cancelado pela organização.`,
        link: `/eventos/${evento.slug}`,
      }),
    ),
  );

  revalidatePath(`/painel/eventos/${evento.id}`);
  revalidatePath(`/eventos/${evento.slug}`);
  revalidatePath("/painel");
  return { ok: true as const };
}

export async function excluirEvento(eventoId: string) {
  const sessao = await exigirOrganizador();
  const evento = await prisma.evento.findFirst({
    where: { id: eventoId, ...escopoDeEventos(sessao), excluidoEm: null },
    select: {
      canceladoEm: true,
      _count: { select: { inscricoes: { where: { canceladaEm: null } } } },
    },
  });
  if (!evento) return { erro: "Evento não encontrado ou sem autorização." };
  if (evento._count.inscricoes > 0 && !evento.canceladoEm) {
    return { erro: "Cancele o evento antes de excluí-lo, para que os inscritos sejam avisados." };
  }

  const agora = new Date();
  const resultado = await prisma.evento.updateMany({
    where: { id: eventoId, ...escopoDeEventos(sessao), excluidoEm: null },
    data: { publicado: false, excluidoEm: agora },
  });
  if (resultado.count === 0) return { erro: "Evento não encontrado ou sem autorização." };
  revalidatePath("/painel");
  redirect("/painel");
}

/**
 * Devolve o token da página de presença à distância do evento, criando-o se
 * ainda não houver.
 *
 * Existe para os eventos online e híbridos criados antes desta funcionalidade:
 * a migração deixou a coluna nula de propósito, porque gerar segredo em SQL
 * exigiria a extensão pgcrypto ou um `random()` que não serve para isso.
 */
export async function garantirTokenRemoto(eventoId: string): Promise<string> {
  const sessao = await exigirOrganizador();
  const evento = await prisma.evento.findFirstOrThrow({
    where: { id: eventoId, ...escopoDeEventos(sessao), excluidoEm: null },
    select: { tokenRemoto: true, modalidade: true },
  });

  if (evento.modalidade === "PRESENCIAL") {
    throw new Error("Evento presencial não tem página de presença a distância.");
  }
  if (evento.tokenRemoto) return evento.tokenRemoto;

  const novo = tokenRemoto();
  const atualizado = await prisma.evento.updateMany({
    where: {
      id: eventoId,
      ...escopoDeEventos(sessao),
      excluidoEm: null,
      tokenRemoto: null,
    },
    data: { tokenRemoto: novo },
  });
  if (atualizado.count === 0) {
    const existente = await prisma.evento.findFirstOrThrow({
      where: { id: eventoId, ...escopoDeEventos(sessao), excluidoEm: null },
      select: { tokenRemoto: true },
    });
    if (existente.tokenRemoto) return existente.tokenRemoto;
    throw new Error("Não foi possível criar o endereço de presença a distância.");
  }
  return novo;
}
