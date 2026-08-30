"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enviarEmailRedefinicaoSenha } from "@/lib/email";
import { registrarTentativa } from "@/lib/limite-tentativas";
import { origemPublica } from "@/lib/origem";
import { hashDeSenha } from "@/lib/sessao";
import { notificar } from "@/lib/notificacoes";
import { hashTokenRedefinicao } from "@/lib/redefinicao-senha";

export type EstadoRedefinicao = { erro?: string; ok?: string; campos?: Record<string, string> };

const RESPOSTA_GENERICA =
  "Se existir uma conta ativa com esse e-mail, enviaremos um link válido por 30 minutos.";

function texto(dados: FormData, campo: string): string {
  const valor = dados.get(campo);
  return typeof valor === "string" ? valor : "";
}

export async function solicitarRedefinicaoSenha(
  _anterior: EstadoRedefinicao,
  dados: FormData,
): Promise<EstadoRedefinicao> {
  const analise = z.email("E-mail inválido.").safeParse(texto(dados, "email").trim().toLowerCase());
  if (!analise.success) return { erro: "Informe um e-mail válido.", campos: { email: "E-mail inválido." } };

  const limite = registrarTentativa(`redefinir-senha:${analise.data}`, {
    maximo: 3,
    janelaSegundos: 15 * 60,
  });
  if (!limite.permitido) return { ok: RESPOSTA_GENERICA };

  const usuario = await prisma.usuario.findUnique({
    where: { email: analise.data },
    select: { id: true, nome: true, email: true, excluidoEm: true },
  });
  if (!usuario || usuario.excluidoEm) return { ok: RESPOSTA_GENERICA };

  const token = randomBytes(32).toString("base64url");
  const registro = await prisma.$transaction(async (tx) => {
    await tx.redefinicaoSenha.deleteMany({
      where: { usuarioId: usuario.id, usadoEm: null },
    });
    return tx.redefinicaoSenha.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: hashTokenRedefinicao(token),
        expiraEm: new Date(Date.now() + 30 * 60 * 1000),
      },
      select: { id: true },
    });
  });

  try {
    const origem = await origemPublica();
    await enviarEmailRedefinicaoSenha({
      destinatario: usuario.email,
      nome: usuario.nome,
      url: `${origem}/redefinir-senha/${token}`,
    });
  } catch (erro) {
    await prisma.redefinicaoSenha.delete({ where: { id: registro.id } }).catch(() => {});
    console.error("Não foi possível enviar o e-mail de redefinição de senha.", erro);
  }

  return { ok: RESPOSTA_GENERICA };
}

export async function redefinirSenha(
  token: string,
  _anterior: EstadoRedefinicao,
  dados: FormData,
): Promise<EstadoRedefinicao> {
  const analise = z
    .object({
      novaSenha: z.string().min(10, "Use ao menos 10 caracteres."),
      confirmarSenha: z.string().min(1, "Confirme a nova senha."),
    })
    .refine((entrada) => entrada.novaSenha === entrada.confirmarSenha, {
      path: ["confirmarSenha"],
      message: "As senhas não coincidem.",
    })
    .safeParse({
      novaSenha: texto(dados, "novaSenha"),
      confirmarSenha: texto(dados, "confirmarSenha"),
    });

  if (!analise.success) {
    const campos: Record<string, string> = {};
    for (const problema of analise.error.issues) {
      const campo = String(problema.path[0] ?? "");
      if (campo && !campos[campo]) campos[campo] = problema.message;
    }
    return { erro: "Confira os campos destacados.", campos };
  }

  const tokenHash = hashTokenRedefinicao(token);
  const registro = await prisma.redefinicaoSenha.findUnique({
    where: { tokenHash },
    select: { id: true, usuarioId: true, expiraEm: true, usadoEm: true },
  });
  if (!registro || registro.usadoEm || registro.expiraEm <= new Date()) {
    return { erro: "Este link é inválido, já foi usado ou expirou." };
  }

  const novaSenhaHash = await hashDeSenha(analise.data.novaSenha);
  try {
    await prisma.$transaction(async (tx) => {
      const uso = await tx.redefinicaoSenha.updateMany({
        where: { id: registro.id, usadoEm: null, expiraEm: { gt: new Date() } },
        data: { usadoEm: new Date() },
      });
      if (uso.count !== 1) throw new Error("TOKEN_INDISPONIVEL");
      await tx.usuario.update({
        where: { id: registro.usuarioId },
        data: { senhaHash: novaSenhaHash },
      });
      await tx.redefinicaoSenha.updateMany({
        where: { usuarioId: registro.usuarioId, usadoEm: null },
        data: { usadoEm: new Date() },
      });
    });
  } catch {
    return { erro: "Este link é inválido, já foi usado ou expirou." };
  }

  await notificar({
    usuarioId: registro.usuarioId,
    tipo: "SEGURANCA_CONTA",
    titulo: "Senha redefinida",
    corpo: "A senha da sua conta foi redefinida pelo fluxo de recuperação.",
    link: "/conta/privacidade",
  });
  redirect("/entrar?senha=redefinida");
}
