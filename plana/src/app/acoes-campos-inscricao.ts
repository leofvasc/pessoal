"use server";

/**
 * Configuração dos campos personalizados e inscrição com respostas.
 *
 * A inscrição continua tendo dois caminhos, e é essa a exigência de desenho:
 * evento sem campo configurado se inscreve no clique, como sempre foi; evento
 * com campo abre a tela de formulário. Nenhuma etapa nova aparece para quem
 * não precisa dela.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { escopoDeEventos, exigirOrganizador, exigirSessao } from "@/lib/sessao";
import {
  LIMITE_DE_CAMPOS,
  LIMITE_DE_OPCOES,
  camposAtivosDoEvento,
  exigeOpcoes,
  gravarRespostas,
  validarRespostas,
} from "@/lib/campos-inscricao";
import { notificar } from "@/lib/notificacoes";
import type { TipoCampoInscricao } from "@/generated/prisma/client";

export type EstadoCampo = { erro?: string; campos?: Record<string, string>; ok?: boolean };

const TIPOS: TipoCampoInscricao[] = [
  "TEXTO_CURTO",
  "TEXTO_LONGO",
  "NUMERO",
  "DATA",
  "SELECAO_UNICA",
  "SELECAO_MULTIPLA",
  "SIM_NAO",
];

/** Confirma que o evento é gerido por quem está pedindo. */
async function eventoDoGestor(eventoId: string) {
  const sessao = await exigirOrganizador();
  const evento = await prisma.evento.findFirst({
    where: { id: eventoId, ...escopoDeEventos(sessao), excluidoEm: null },
    select: { id: true, slug: true },
  });
  if (!evento) throw new Error("NAO_AUTORIZADO");
  return evento;
}

export async function criarCampoInscricao(
  eventoId: string,
  _anterior: EstadoCampo,
  dados: FormData,
): Promise<EstadoCampo> {
  const evento = await eventoDoGestor(eventoId);

  const rotulo = String(dados.get("rotulo") ?? "").trim();
  const ajuda = String(dados.get("ajuda") ?? "").trim();
  const tipoBruto = String(dados.get("tipo") ?? "");
  const obrigatorio = dados.get("obrigatorio") === "on";
  const opcoesBrutas = String(dados.get("opcoes") ?? "");

  const campos: Record<string, string> = {};
  if (rotulo.length < 2) campos.rotulo = "Escreva a pergunta como o participante vai lê-la.";
  if (rotulo.length > 120) campos.rotulo = "Máximo de 120 caracteres.";
  if (!TIPOS.includes(tipoBruto as TipoCampoInscricao)) campos.tipo = "Selecione o tipo.";

  const tipo = tipoBruto as TipoCampoInscricao;
  let opcoes: string[] = [];

  if (!campos.tipo && exigeOpcoes(tipo)) {
    opcoes = [
      ...new Set(
        opcoesBrutas
          .split("\n")
          .map((linha) => linha.trim())
          .filter(Boolean),
      ),
    ];
    if (opcoes.length < 2) campos.opcoes = "Informe pelo menos duas alternativas, uma por linha.";
    if (opcoes.length > LIMITE_DE_OPCOES) {
      campos.opcoes = `Máximo de ${LIMITE_DE_OPCOES} alternativas.`;
    }
    if (opcoes.some((opcao) => opcao.length > 120)) {
      campos.opcoes = "Cada alternativa deve ter no máximo 120 caracteres.";
    }
  }

  if (Object.keys(campos).length > 0) {
    return { erro: "Confira os campos destacados.", campos };
  }

  const ativos = await prisma.campoInscricao.count({
    where: { eventoId, arquivadoEm: null },
  });
  if (ativos >= LIMITE_DE_CAMPOS) {
    return {
      erro: `Este evento já tem ${LIMITE_DE_CAMPOS} campos ativos. Arquive algum antes de criar outro.`,
    };
  }

  const ultimo = await prisma.campoInscricao.findFirst({
    where: { eventoId },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });

  await prisma.campoInscricao.create({
    data: {
      eventoId,
      rotulo,
      ajuda: ajuda || null,
      tipo,
      obrigatorio,
      opcoes,
      ordem: (ultimo?.ordem ?? -1) + 1,
    },
  });

  revalidatePath(`/painel/eventos/${eventoId}/campos`);
  revalidatePath(`/eventos/${evento.slug}`);
  return { ok: true };
}

/**
 * Arquiva o campo, sem apagar. As respostas já dadas continuam existindo e
 * continuam saindo no relatório, porque integram o registro de inscrições que
 * já aconteceram.
 */
export async function arquivarCampoInscricao(eventoId: string, campoId: string) {
  await eventoDoGestor(eventoId);
  await prisma.campoInscricao.updateMany({
    where: { id: campoId, eventoId, arquivadoEm: null },
    data: { arquivadoEm: new Date() },
  });
  revalidatePath(`/painel/eventos/${eventoId}/campos`);
}

export async function reativarCampoInscricao(eventoId: string, campoId: string) {
  await eventoDoGestor(eventoId);
  const ativos = await prisma.campoInscricao.count({ where: { eventoId, arquivadoEm: null } });
  if (ativos >= LIMITE_DE_CAMPOS) return;
  await prisma.campoInscricao.updateMany({
    where: { id: campoId, eventoId },
    data: { arquivadoEm: null },
  });
  revalidatePath(`/painel/eventos/${eventoId}/campos`);
}

/** Move o campo uma posição para cima ou para baixo. */
export async function moverCampoInscricao(
  eventoId: string,
  campoId: string,
  direcao: "cima" | "baixo",
) {
  await eventoDoGestor(eventoId);

  const campos = await prisma.campoInscricao.findMany({
    where: { eventoId, arquivadoEm: null },
    orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
    select: { id: true },
  });

  const posicao = campos.findIndex((campo) => campo.id === campoId);
  const destino = direcao === "cima" ? posicao - 1 : posicao + 1;
  if (posicao < 0 || destino < 0 || destino >= campos.length) return;

  const reordenados = [...campos];
  [reordenados[posicao], reordenados[destino]] = [reordenados[destino], reordenados[posicao]];

  // Reescreve a ordem inteira: renumerar tudo evita empates herdados de
  // arquivamentos e reativações anteriores.
  await prisma.$transaction(
    reordenados.map((campo, indice) =>
      prisma.campoInscricao.update({ where: { id: campo.id }, data: { ordem: indice } }),
    ),
  );

  revalidatePath(`/painel/eventos/${eventoId}/campos`);
}

/**
 * Inscrição com respostas aos campos personalizados.
 *
 * Repete as mesmas checagens de disponibilidade da inscrição direta, e não
 * confia em ter passado por elas na tela anterior: o formulário é público e
 * pode ser reenviado depois de o evento encerrar ou ser cancelado.
 */
export async function inscreverComRespostas(
  eventoId: string,
  _anterior: EstadoCampo,
  dados: FormData,
): Promise<EstadoCampo> {
  const sessao = await exigirSessao();

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: {
      id: true,
      nome: true,
      slug: true,
      publicado: true,
      fimEm: true,
      canceladoEm: true,
      excluidoEm: true,
    },
  });
  if (!evento || !evento.publicado || evento.excluidoEm) {
    return { erro: "Evento indisponível para inscrição." };
  }
  if (evento.canceladoEm) return { erro: "Este evento foi cancelado." };
  if (evento.fimEm.getTime() < Date.now()) return { erro: "Este evento já foi encerrado." };

  const campos = await camposAtivosDoEvento(eventoId);
  const validacao = validarRespostas(campos, dados);
  if (!validacao.ok) {
    return { erro: "Confira os campos destacados.", campos: validacao.erros };
  }

  const existente = await prisma.inscricao.findUnique({
    where: { eventoId_usuarioId: { eventoId, usuarioId: sessao.usuarioId } },
    select: { id: true, canceladaEm: true },
  });

  let inscricaoId: string;
  if (existente) {
    await prisma.inscricao.update({
      where: { id: existente.id },
      data: { canceladaEm: null },
    });
    inscricaoId = existente.id;
  } else {
    const criada = await prisma.inscricao.create({
      data: { eventoId, usuarioId: sessao.usuarioId },
      select: { id: true },
    });
    inscricaoId = criada.id;
  }

  await gravarRespostas(inscricaoId, validacao.respostas);

  await notificar({
    usuarioId: sessao.usuarioId,
    tipo: "INSCRICAO_CONFIRMADA",
    titulo: "Inscrição confirmada",
    corpo: `Sua inscrição em ${evento.nome} está confirmada. No dia, leia o QR Code projetado na sala para registrar presença.`,
    link: `/eventos/${evento.slug}`,
  });

  revalidatePath(`/eventos/${evento.slug}`);
  revalidatePath("/conta");
  redirect(`/eventos/${evento.slug}?inscrito=1`);
}
