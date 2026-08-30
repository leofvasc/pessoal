"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirOrganizador, exigirSessao } from "@/lib/sessao";
import { notificar } from "@/lib/notificacoes";

export type EstadoChamado = { erro?: string };

const esquemaNovo = z.object({
  assunto: z.string().trim().min(4, "Informe o assunto.").max(160),
  mensagem: z.string().trim().min(10, "Descreva a solicitação.").max(5000),
});

const esquemaMensagem = z.string().trim().min(2, "Escreva a mensagem.").max(5000);
const esquemaStatus = z.enum(["ABERTO", "EM_ANDAMENTO", "RESOLVIDO"]);

function texto(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

async function avisarOrganizadores(titulo: string, corpo: string, chamadoId: string) {
  const organizadores = await prisma.usuario.findMany({
    where: { papel: "ORGANIZADOR", excluidoEm: null },
    select: { id: true },
  });
  await Promise.all(
    organizadores.map(({ id }) =>
      notificar({
        usuarioId: id,
        tipo: "SUPORTE",
        titulo,
        corpo,
        link: `/painel/chamados/${chamadoId}`,
      }),
    ),
  );
}

export async function criarChamado(
  _anterior: EstadoChamado,
  dados: FormData,
): Promise<EstadoChamado> {
  const sessao = await exigirSessao();
  const analise = esquemaNovo.safeParse({
    assunto: texto(dados, "assunto"),
    mensagem: texto(dados, "mensagem"),
  });
  if (!analise.success) return { erro: analise.error.issues[0].message };

  const chamado = await prisma.chamado.create({
    data: {
      usuarioId: sessao.usuarioId,
      assunto: analise.data.assunto,
      mensagens: {
        create: { autorId: sessao.usuarioId, corpo: analise.data.mensagem },
      },
    },
    select: { id: true },
  });

  await avisarOrganizadores("Novo chamado", analise.data.assunto, chamado.id);
  revalidatePath("/conta/chamados");
  redirect(`/conta/chamados/${chamado.id}`);
}

export async function responderChamado(
  chamadoId: string,
  _anterior: EstadoChamado,
  dados: FormData,
): Promise<EstadoChamado> {
  const sessao = await exigirSessao();
  const analise = esquemaMensagem.safeParse(texto(dados, "mensagem"));
  if (!analise.success) return { erro: analise.error.issues[0].message };

  const chamado = await prisma.chamado.findFirst({
    where: { id: chamadoId, usuarioId: sessao.usuarioId },
    select: { id: true, assunto: true },
  });
  if (!chamado) return { erro: "Chamado não encontrado ou sem autorização." };

  await prisma.$transaction([
    prisma.chamadoMensagem.create({
      data: { chamadoId: chamado.id, autorId: sessao.usuarioId, corpo: analise.data },
    }),
    prisma.chamado.update({ where: { id: chamado.id }, data: { status: "ABERTO" } }),
  ]);
  await avisarOrganizadores("Nova mensagem em chamado", chamado.assunto, chamado.id);
  revalidatePath(`/conta/chamados/${chamado.id}`);
  return {};
}

export async function responderChamadoComoOrganizador(
  chamadoId: string,
  _anterior: EstadoChamado,
  dados: FormData,
): Promise<EstadoChamado> {
  const sessao = await exigirOrganizador();
  const analise = esquemaMensagem.safeParse(texto(dados, "mensagem"));
  if (!analise.success) return { erro: analise.error.issues[0].message };

  const chamado = await prisma.chamado.findUnique({
    where: { id: chamadoId },
    select: { id: true, assunto: true, usuarioId: true, status: true },
  });
  if (!chamado) return { erro: "Chamado não encontrado." };

  await prisma.$transaction([
    prisma.chamadoMensagem.create({
      data: { chamadoId: chamado.id, autorId: sessao.usuarioId, corpo: analise.data },
    }),
    prisma.chamado.update({
      where: { id: chamado.id },
      data: { status: chamado.status === "RESOLVIDO" ? "RESOLVIDO" : "EM_ANDAMENTO" },
    }),
  ]);
  await notificar({
    usuarioId: chamado.usuarioId,
    tipo: "SUPORTE",
    titulo: "Resposta ao seu chamado",
    corpo: chamado.assunto,
    link: `/conta/chamados/${chamado.id}`,
  });
  revalidatePath(`/painel/chamados/${chamado.id}`);
  return {};
}

export async function alterarStatusChamado(chamadoId: string, novoStatus: string) {
  await exigirOrganizador();
  const analise = esquemaStatus.safeParse(novoStatus);
  if (!analise.success) return { erro: "Status inválido." };

  const chamado = await prisma.chamado.update({
    where: { id: chamadoId },
    data: { status: analise.data },
    select: { id: true, assunto: true, usuarioId: true },
  });
  await notificar({
    usuarioId: chamado.usuarioId,
    tipo: "SUPORTE",
    titulo: analise.data === "RESOLVIDO" ? "Chamado resolvido" : "Status do chamado atualizado",
    corpo: chamado.assunto,
    link: `/conta/chamados/${chamado.id}`,
  });
  revalidatePath(`/painel/chamados/${chamado.id}`);
  revalidatePath("/painel/chamados");
  return { ok: true as const };
}
