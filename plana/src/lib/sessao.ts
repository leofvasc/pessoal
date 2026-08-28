import "server-only";

/**
 * Sessão do usuário.
 *
 * Optou-se por sessão própria e explícita, e não por uma biblioteca de auth
 * com múltiplos provedores: a plataforma é de uso pessoal, tem um único método
 * de entrada (e-mail e senha) e precisa que o caminho do dado do titular seja
 * auditável de ponta a ponta para a diretriz de privacy by design (seção 9).
 *
 * O token é um JWT assinado, guardado em cookie httpOnly. Ele carrega apenas o
 * id, o papel e o nome — nada de e-mail, telefone ou perfil, que são dados
 * pessoais sem finalidade dentro de um cookie.
 */
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Papel } from "@/generated/prisma/client";

const NOME_COOKIE = "plana_sessao";
const DURACAO_DIAS = 30;

export type Sessao = {
  usuarioId: string;
  nome: string;
  papel: Papel;
};

function segredo(): Uint8Array {
  const valor = process.env.AUTH_SECRET;
  if (!valor || valor.length < 32) {
    throw new Error(
      "AUTH_SECRET ausente ou curto demais. Gere um com: openssl rand -base64 48",
    );
  }
  return new TextEncoder().encode(valor);
}

export async function hashDeSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12);
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export async function abrirSessao(sessao: Sessao): Promise<void> {
  const expiraEm = new Date(Date.now() + DURACAO_DIAS * 24 * 60 * 60 * 1000);

  const token = await new SignJWT({ nome: sessao.nome, papel: sessao.papel })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sessao.usuarioId)
    .setIssuedAt()
    .setExpirationTime(expiraEm)
    .sign(segredo());

  const jar = await cookies();
  jar.set(NOME_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEm,
  });
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  jar.delete(NOME_COOKIE);
}

/** Sessão atual, ou `null` se não houver token válido. */
export async function sessaoAtual(): Promise<Sessao | null> {
  const jar = await cookies();
  const token = jar.get(NOME_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, segredo(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      usuarioId: payload.sub,
      nome: String(payload.nome ?? ""),
      papel: payload.papel as Papel,
    };
  } catch {
    // Token expirado, adulterado ou assinado com outro segredo.
    return null;
  }
}

/** Sessão atual, lançando quando não há — para rotas que já estão protegidas. */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await sessaoAtual();
  if (!sessao) throw new Error("NAO_AUTENTICADO");
  return sessao;
}

export async function exigirOrganizador(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.papel !== "ORGANIZADOR") throw new Error("NAO_AUTORIZADO");
  return sessao;
}
