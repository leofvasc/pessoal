import "server-only";

/**
 * Ciclo de vida do código pessoal do participante.
 *
 * O código é o que identifica a pessoa na página de registro de presença à
 * distância, onde não há sessão. Por isso ele pode ser trocado pelo titular: se
 * ele suspeitar que o código vazou — mostrou a tela numa transmissão, deixou
 * anotado em algum lugar —, trocar precisa ser imediato e não pode custar nada
 * do que já foi registrado.
 *
 * Como o código vive numa única coluna, e presenças e certificados ligam pelo
 * id da conta, a troca vale na hora em toda a plataforma. Nada do que já
 * aconteceu depende do código: ele só é lido no instante do check-in remoto.
 */
import { prisma } from "./prisma";
import { codigoUsuario } from "./codigos";

/**
 * Sorteia um código livre — livre tanto entre os códigos em uso quanto entre
 * os já aposentados.
 *
 * A colisão é improvável (25^8 ≈ 1,5 × 10^11 combinações), mas a coluna é
 * única: sem a checagem, o azar viraria erro na cara de quem está criando a
 * conta. E a exclusão dos aposentados é o que garante que um código trocado por
 * suspeita de vazamento não volte a circular na conta de outra pessoa.
 */
export async function sortearCodigoLivre(): Promise<string> {
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const candidato = codigoUsuario();
    if (await codigoEstaLivre(candidato)) return candidato;
  }
  throw new Error("Não foi possível gerar um código de usuário livre.");
}

/**
 * Um código está livre quando não está em uso por nenhuma conta e não foi
 * aposentado. As duas condições contam: um código aposentado por suspeita de
 * vazamento não pode reaparecer na conta de outra pessoa.
 */
export async function codigoEstaLivre(candidato: string): Promise<boolean> {
  const [emUso, aposentado] = await Promise.all([
    prisma.usuario.findUnique({
      where: { codigoUsuario: candidato },
      select: { id: true },
    }),
    prisma.codigoUsuarioAposentado.findUnique({
      where: { codigo: candidato },
      select: { codigo: true },
    }),
  ]);

  return !emUso && !aposentado;
}

/**
 * Troca o código do participante e aposenta o anterior, numa transação só.
 * Devolve o código novo.
 */
export async function trocarCodigo(usuarioId: string): Promise<string> {
  const novo = await sortearCodigoLivre();

  const [, atualizado] = await prisma.$transaction(async (tx) => {
    const atual = await tx.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { codigoUsuario: true },
    });

    const aposentado = await tx.codigoUsuarioAposentado.create({
      data: { codigo: atual.codigoUsuario },
    });

    const usuario = await tx.usuario.update({
      where: { id: usuarioId },
      data: { codigoUsuario: novo, codigoUsuarioTrocadoEm: new Date() },
      select: { codigoUsuario: true },
    });

    return [aposentado, usuario] as const;
  });

  return atualizado.codigoUsuario;
}
