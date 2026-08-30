"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conferirSenha, exigirSessao, hashDeSenha } from "@/lib/sessao";
import { registrarConsentimento, revogarConsentimento } from "@/lib/consentimento";
import { notificar } from "@/lib/notificacoes";
import type { FinalidadeConsentimento } from "@/generated/prisma/client";

export type EstadoDadosConta = {
  erro?: string;
  ok?: string;
  campos?: Record<string, string>;
};

const esquemaContato = z.object({
  email: z.email("E-mail inválido.").toLowerCase(),
  telefone: z.string().trim().max(20, "Telefone muito longo.").optional(),
  senhaAtual: z.string().min(1, "Informe sua senha atual."),
});

const esquemaSenha = z
  .object({
    senhaAtual: z.string().min(1, "Informe sua senha atual."),
    novaSenha: z.string().min(10, "Use ao menos 10 caracteres."),
    confirmarSenha: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((dados) => dados.novaSenha === dados.confirmarSenha, {
    path: ["confirmarSenha"],
    message: "As novas senhas não coincidem.",
  })
  .refine((dados) => dados.novaSenha !== dados.senhaAtual, {
    path: ["novaSenha"],
    message: "A nova senha precisa ser diferente da atual.",
  });

function texto(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor : "";
}

function camposDosErros(problemas: z.core.$ZodIssue[]): EstadoDadosConta {
  const campos: Record<string, string> = {};
  for (const problema of problemas) {
    const campo = String(problema.path[0] ?? "");
    if (campo && !campos[campo]) campos[campo] = problema.message;
  }
  return { erro: "Confira os campos destacados.", campos };
}

export async function alternarConsentimento(
  finalidade: FinalidadeConsentimento,
  autorizar: boolean,
  telefone?: string,
) {
  const sessao = await exigirSessao();

  if (autorizar) {
    if (finalidade === "COMUNICACAO_URGENTE_WHATSAPP" && telefone) {
      await prisma.usuario.update({
        where: { id: sessao.usuarioId },
        data: { telefone: telefone.trim().slice(0, 20) },
      });
    }
    await registrarConsentimento(sessao.usuarioId, finalidade);
  } else {
    await revogarConsentimento(sessao.usuarioId, finalidade);

    // Revogada a autorização de WhatsApp, o telefone perde a finalidade que
    // justificava a coleta — e sem finalidade o dado não fica guardado
    // (planejamento, seção 9).
    if (finalidade === "COMUNICACAO_URGENTE_WHATSAPP") {
      await prisma.usuario.update({
        where: { id: sessao.usuarioId },
        data: { telefone: null },
      });
    }
  }

  revalidatePath("/conta/privacidade");
}

export async function atualizarDadosDeContato(
  _anterior: EstadoDadosConta,
  dados: FormData,
): Promise<EstadoDadosConta> {
  const sessao = await exigirSessao();
  const analise = esquemaContato.safeParse({
    email: texto(dados, "email").trim(),
    telefone: texto(dados, "telefone").trim() || undefined,
    senhaAtual: texto(dados, "senhaAtual"),
  });
  if (!analise.success) return camposDosErros(analise.error.issues);

  const [usuario, consentimentoWhatsapp] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: sessao.usuarioId },
      select: { email: true, telefone: true, senhaHash: true },
    }),
    prisma.consentimento.findUnique({
      where: {
        usuarioId_finalidade: {
          usuarioId: sessao.usuarioId,
          finalidade: "COMUNICACAO_URGENTE_WHATSAPP",
        },
      },
      select: { revogadoEm: true },
    }),
  ]);
  if (!usuario || !(await conferirSenha(analise.data.senhaAtual, usuario.senhaHash))) {
    return { erro: "A senha atual está incorreta.", campos: { senhaAtual: "Senha incorreta." } };
  }

  const whatsappAtivo = Boolean(consentimentoWhatsapp && !consentimentoWhatsapp.revogadoEm);
  if (whatsappAtivo && !analise.data.telefone) {
    return { erro: "Confira os campos destacados.", campos: { telefone: "Informe o telefone usado para os avisos por WhatsApp." } };
  }

  const emailEmUso = await prisma.usuario.findUnique({
    where: { email: analise.data.email },
    select: { id: true },
  });
  if (emailEmUso && emailEmUso.id !== sessao.usuarioId) {
    return { erro: "Este e-mail já está em uso.", campos: { email: "E-mail já cadastrado." } };
  }

  const novoTelefone = whatsappAtivo ? analise.data.telefone! : null;
  const alterouEmail = usuario.email !== analise.data.email;
  const alterouTelefone = usuario.telefone !== novoTelefone;
  if (!alterouEmail && !alterouTelefone) return { ok: "Nenhuma alteração necessária." };

  await prisma.usuario.update({
    where: { id: sessao.usuarioId },
    data: { email: analise.data.email, telefone: novoTelefone },
  });
  await notificar({
    usuarioId: sessao.usuarioId,
    tipo: "SEGURANCA_CONTA",
    titulo: "Dados de contato atualizados",
    corpo: "O e-mail ou o telefone da sua conta foi alterado.",
    link: "/conta/privacidade",
  });

  revalidatePath("/conta/privacidade");
  return { ok: "Dados de contato atualizados." };
}

export async function alterarSenha(
  _anterior: EstadoDadosConta,
  dados: FormData,
): Promise<EstadoDadosConta> {
  const sessao = await exigirSessao();
  const analise = esquemaSenha.safeParse({
    senhaAtual: texto(dados, "senhaAtual"),
    novaSenha: texto(dados, "novaSenha"),
    confirmarSenha: texto(dados, "confirmarSenha"),
  });
  if (!analise.success) return camposDosErros(analise.error.issues);

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.usuarioId },
    select: { senhaHash: true },
  });
  if (!usuario || !(await conferirSenha(analise.data.senhaAtual, usuario.senhaHash))) {
    return { erro: "A senha atual está incorreta.", campos: { senhaAtual: "Senha incorreta." } };
  }

  await prisma.usuario.update({
    where: { id: sessao.usuarioId },
    data: {
      senhaHash: await hashDeSenha(analise.data.novaSenha),
      // Marca o instante da troca para que sessaoAtual() invalide tokens JWT
      // emitidos antes deste momento — revoga sessões abertas em outros
      // dispositivos sem exigir uma lista negra centralizada.
      senhaAlteradaEm: new Date(),
    },
  });
  await notificar({
    usuarioId: sessao.usuarioId,
    tipo: "SEGURANCA_CONTA",
    titulo: "Senha alterada",
    corpo: "A senha da sua conta foi alterada. Se não foi você, abra um chamado imediatamente.",
    link: "/conta/chamados/novo",
  });

  return { ok: "Senha alterada com segurança." };
}
