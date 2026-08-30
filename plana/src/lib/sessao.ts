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
import { prisma } from "@/lib/prisma";

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

    // Revogação por troca de senha: se o titular alterou a senha depois que
    // este token foi emitido, o token não é mais válido — mesmo que a assinatura
    // esteja correta e o prazo de expiração não tenha vencido.
    //
    // `iat` (issued at) vem em segundos; `senhaAlteradaEm` é um instante em ms.
    // NULL em `senhaAlteradaEm` significa que a senha nunca foi trocada desde
    // que a conta foi criada, e o token é aceito normalmente.
    if (payload.iat) {
      const usuario = await prisma.usuario.findUnique({
        where: { id: payload.sub },
        select: { senhaAlteradaEm: true },
      });
      if (usuario?.senhaAlteradaEm) {
        const emitidoEm = payload.iat * 1000; // converte segundos → ms
        if (emitidoEm < usuario.senhaAlteradaEm.getTime()) {
          return null; // Sessão anterior à última troca de senha
        }
      }
    }

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

/**
 * Sessão de quem gere eventos: organizador ou master.
 *
 * O master faz tudo que o organizador faz — a diferença não está no que pode
 * fazer com um evento, e sim em quais eventos alcança. Por isso as ações de
 * gestão continuam chamando esta função, e o recorte de alcance fica a cargo
 * de `escopoDeEventos`, um só lugar em vez de espalhado por cada consulta.
 */
export async function exigirOrganizador(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.papel !== "ORGANIZADOR" && sessao.papel !== "MASTER") {
    throw new Error("NAO_AUTORIZADO");
  }
  return sessao;
}

/** Sessão de quem administra a plataforma e as contas de organizador. */
export async function exigirMaster(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.papel !== "MASTER") throw new Error("NAO_AUTORIZADO");
  return sessao;
}

export function ehMaster(sessao: Pick<Sessao, "papel">): boolean {
  return sessao.papel === "MASTER";
}

/** Quem tem painel: organizador ou master. Usado para decidir para onde
 *  mandar a pessoa depois do login e qual botão mostrar no cabeçalho. */
export function temPainel(papel: Papel): boolean {
  return papel === "ORGANIZADOR" || papel === "MASTER";
}

/** Mensagem exibida a quem tenta entrar com conta suspensa. */
export const AVISO_DE_SUSPENSAO =
  "Esta conta está suspensa pela administração da plataforma. Abra um chamado ou fale com quem organiza o evento.";

/**
 * Recorte de quais eventos a sessão alcança, para usar em `where`.
 *
 * Organizador vê os próprios; master vê todos. Escrever isso em cada consulta
 * convidaria ao esquecimento em uma delas — e a consulta esquecida seria
 * exatamente a que vaza evento alheio para o organizador errado.
 */
export function escopoDeEventos(sessao: Pick<Sessao, "usuarioId" | "papel">): {
  organizadorId?: string;
} {
  return sessao.papel === "MASTER" ? {} : { organizadorId: sessao.usuarioId };
}
