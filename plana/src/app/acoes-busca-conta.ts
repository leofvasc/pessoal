"use server";

/**
 * Busca de contas para a administração.
 *
 * A lista completa de usuários não é exibida de propósito. Navegar por cadastro
 * de participante sem motivo é tratamento sem finalidade — o art. 6º, I, da
 * LGPD exige propósito legítimo e explícito —, e a administração precisa
 * alcançar a conta sobre a qual vai agir, não folhear todas.
 *
 * Por isso a busca exige termo e devolve apenas o necessário para identificar e
 * operar: nunca telefone, nunca coordenada de check-in, nunca resposta a campo
 * personalizado.
 */
import { prisma } from "@/lib/prisma";
import { exigirMaster } from "@/lib/sessao";

export type ContaEncontrada = {
  id: string;
  nome: string;
  email: string;
  papel: "PARTICIPANTE" | "ORGANIZADOR" | "MASTER";
  suspensoEm: string | null;
  motivoSuspensao: string | null;
  criadoEm: string;
  inscricoes: number;
  certificados: number;
  eventosOrganizados: number;
  instituicoes: string[];
};

export async function buscarContas(termo: string): Promise<ContaEncontrada[]> {
  await exigirMaster();

  const busca = termo.trim();
  if (busca.length < 3) return [];

  const contas = await prisma.usuario.findMany({
    where: {
      excluidoEm: null,
      OR: [
        { nome: { contains: busca, mode: "insensitive" } },
        { email: { contains: busca, mode: "insensitive" } },
      ],
    },
    orderBy: { nome: "asc" },
    take: 25,
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      suspensoEm: true,
      motivoSuspensao: true,
      criadoEm: true,
      _count: {
        select: { inscricoes: true, eventosOrganizados: true },
      },
      instituicoesGeridas: {
        select: { instituicao: { select: { nome: true, nomeCurto: true } } },
      },
    },
  });

  const porConta = await Promise.all(
    contas.map(async (conta) => ({
      id: conta.id,
      total: await prisma.certificado.count({ where: { inscricao: { usuarioId: conta.id } } }),
    })),
  );
  const totalDeCertificados = new Map(porConta.map((c) => [c.id, c.total]));

  return contas.map((conta) => ({
    id: conta.id,
    nome: conta.nome,
    email: conta.email,
    papel: conta.papel as ContaEncontrada["papel"],
    suspensoEm: conta.suspensoEm?.toISOString() ?? null,
    motivoSuspensao: conta.motivoSuspensao,
    criadoEm: conta.criadoEm.toISOString(),
    inscricoes: conta._count.inscricoes,
    certificados: totalDeCertificados.get(conta.id) ?? 0,
    eventosOrganizados: conta._count.eventosOrganizados,
    instituicoes: conta.instituicoesGeridas.map(
      ({ instituicao }) => instituicao.nomeCurto?.trim() || instituicao.nome,
    ),
  }));
}

export type LinhaDaTrilha = {
  id: string;
  autorNome: string;
  acao: string;
  alvoTipo: string;
  alvoNome: string;
  detalhe: string | null;
  criadoEm: string;
};

export async function lerTrilha(quantidade = 30): Promise<LinhaDaTrilha[]> {
  await exigirMaster();
  const linhas = await prisma.registroAdministrativo.findMany({
    orderBy: { criadoEm: "desc" },
    take: Math.min(quantidade, 100),
  });
  return linhas.map((linha) => ({
    id: linha.id,
    autorNome: linha.autorNome,
    acao: linha.acao,
    alvoTipo: linha.alvoTipo,
    alvoNome: linha.alvoNome,
    detalhe: linha.detalhe,
    criadoEm: linha.criadoEm.toISOString(),
  }));
}
