"use server";

/**
 * Conferência do nome em certificado cujo titular excluiu a conta.
 *
 * A consulta pública não tem mais nome para exibir nesses casos — e é assim de
 * propósito. Quem confere o documento tem o nome impresso diante dos olhos;
 * quem só tem o código não tem por que descobri-lo. Esta ação recebe o nome
 * digitado e responde apenas se confere.
 *
 * O limite de tentativas é por código, e não por sessão: a página é pública e
 * não há sessão a que prender a contagem. Cinco tentativas a cada quinze
 * minutos bastam para quem está copiando de um papel e inviabilizam varrer uma
 * lista de nomes contra o registro.
 */
import { prisma } from "@/lib/prisma";
import { conferirNome } from "@/lib/verificacao-nome";
import { registrarTentativa } from "@/lib/limite-tentativas";

export type EstadoConferencia = {
  resultado?: "CONFERE" | "NAO_CONFERE";
  erro?: string;
};

export async function conferirNomeDoCertificado(
  codigoValidacao: string,
  _anterior: EstadoConferencia,
  dados: FormData,
): Promise<EstadoConferencia> {
  const bruto = dados.get("nome");
  const nome = typeof bruto === "string" ? bruto : "";
  if (!nome.trim()) return { erro: "Digite o nome que consta no certificado." };

  const codigo = codigoValidacao.trim().toUpperCase();

  const limite = registrarTentativa(`conferencia-nome:${codigo}`, {
    maximo: 5,
    janelaSegundos: 15 * 60,
  });
  if (!limite.permitido) {
    const minutos = Math.ceil(limite.segundosParaLiberar / 60);
    return {
      erro: `Muitas conferências seguidas para este código. Tente de novo em ${minutos} minuto(s).`,
    };
  }

  const arquivado = await prisma.certificadoArquivado.findUnique({
    where: { codigoValidacao: codigo },
    select: { nomeHash: true },
  });
  if (!arquivado) return { erro: "Código não encontrado." };

  const confere = await conferirNome(nome, arquivado.nomeHash);
  return { resultado: confere ? "CONFERE" : "NAO_CONFERE" };
}
