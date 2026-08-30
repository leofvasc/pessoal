"use server";

/**
 * Ação de exclusão da conta pelo titular (planejamento, seção 9).
 *
 * Três conferências antes de apagar: sessão válida, senha atual correta e a
 * frase de confirmação digitada. A senha existe porque a exclusão é
 * irreversível e um cookie de sessão esquecido em aparelho compartilhado não
 * pode bastar para destruir os certificados de alguém.
 */
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { conferirSenha, encerrarSessao, exigirSessao } from "@/lib/sessao";
import { ExclusaoBloqueada, excluirConta } from "@/lib/exclusao-de-conta";
import { FRASE_DE_CONFIRMACAO } from "@/lib/textos-exclusao";
import { liberar, registrarTentativa } from "@/lib/limite-tentativas";

export type EstadoExclusao = { erro?: string; campos?: Record<string, string> };

function texto(dados: FormData, chave: string): string {
  const valor = dados.get(chave);
  return typeof valor === "string" ? valor : "";
}

/** Normaliza para comparar a frase sem punir espaço sobrando ou caixa baixa. */
function normalizar(valor: string): string {
  return valor.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
}

export async function excluirMinhaConta(
  _anterior: EstadoExclusao,
  dados: FormData,
): Promise<EstadoExclusao> {
  const sessao = await exigirSessao();

  const limite = registrarTentativa(`exclusao:${sessao.usuarioId}`, {
    maximo: 5,
    janelaSegundos: 15 * 60,
  });
  if (!limite.permitido) {
    const minutos = Math.ceil(limite.segundosParaLiberar / 60);
    return { erro: `Muitas tentativas seguidas. Tente de novo em ${minutos} minuto(s).` };
  }

  const senha = texto(dados, "senha");
  const frase = texto(dados, "frase");

  if (!senha) {
    return { erro: "Confira os campos destacados.", campos: { senha: "Informe sua senha atual." } };
  }
  if (normalizar(frase) !== FRASE_DE_CONFIRMACAO) {
    return {
      erro: "Confira os campos destacados.",
      campos: { frase: `Digite exatamente: ${FRASE_DE_CONFIRMACAO}` },
    };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.usuarioId },
    select: { senhaHash: true },
  });
  if (!usuario || !(await conferirSenha(senha, usuario.senhaHash))) {
    return { erro: "A senha atual está incorreta.", campos: { senha: "Senha incorreta." } };
  }

  try {
    await excluirConta(sessao.usuarioId);
  } catch (erro) {
    if (erro instanceof ExclusaoBloqueada) {
      return {
        erro:
          "Esta conta não pode ser excluída por aqui porque há eventos ou arquivos sob a sua responsabilidade. Abra um chamado para que a exclusão seja tratada junto com a destinação deles.",
      };
    }
    throw erro;
  }

  liberar(`exclusao:${sessao.usuarioId}`);
  await encerrarSessao();
  redirect("/conta-excluida");
}
