import "server-only";

/**
 * Instituições organizadoras e seus gestores.
 *
 * A PlanA serve a um círculo definido de instituições, e ninguém se torna
 * organizador por conta própria. O master cadastra a instituição e vincula a
 * ela uma conta já existente, que passa a geri-la. É esse vínculo — e não uma
 * marcação na conta — que cria um organizador.
 *
 * A razão é o próprio valor do produto. O certificado da PlanA tem código
 * impresso e página pública que o declara autêntico. Se qualquer pessoa
 * pudesse ativar um painel e emitir, bastaria cadastrar uma organização com
 * nome de universidade para que a plataforma passasse a avalizar credencial
 * fabricada — e esses documentos circulam para horas complementares, educação
 * continuada e progressão funcional.
 *
 * Uma consequência do desenho merece registro: a conta é uma só. Quem gere uma
 * instituição continua se inscrevendo em eventos alheios com a mesma conta, e
 * desfazer o vínculo devolve a pessoa à condição de participante sem lhe tirar
 * inscrição, presença ou certificado nenhum.
 */
import { prisma } from "./prisma";
import type { TipoOrganizador } from "@/generated/prisma/client";

export const ROTULO_DO_TIPO: Record<TipoOrganizador, string> = {
  PESSOA_FISICA: "Pessoa física",
  PESSOA_JURIDICA: "Pessoa jurídica",
  ORGAO_PUBLICO: "Órgão público",
};

export function documentoDoTipo(tipo: TipoOrganizador): "CPF" | "CNPJ" {
  return tipo === "PESSOA_FISICA" ? "CPF" : "CNPJ";
}

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function formatarDocumento(digitos: string): string {
  if (digitos.length === 11) {
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digitos.length === 14) {
    return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return digitos;
}

/**
 * Validação de CPF pelos dígitos verificadores.
 *
 * Vale a pena mesmo sendo o campo opcional: documento errado é pior que
 * documento ausente, porque parece identificar alguém e não identifica
 * ninguém — e é sobre ele que uma instituição eventualmente decidirá algo.
 */
export function cpfValido(digitos: string): boolean {
  if (digitos.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  for (const [tamanho, posicao] of [
    [9, 9],
    [10, 10],
  ] as const) {
    let soma = 0;
    for (let i = 0; i < tamanho; i += 1) soma += Number(digitos[i]) * (tamanho + 1 - i);
    const resto = ((soma * 10) % 11) % 10;
    if (resto !== Number(digitos[posicao])) return false;
  }
  return true;
}

export function cnpjValido(digitos: string): boolean {
  if (digitos.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digitos)) return false;

  const conferir = (tamanho: number) => {
    const pesos =
      tamanho === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < tamanho; i += 1) soma += Number(digitos[i]) * pesos[i];
    const resto = soma % 11;
    return (resto < 2 ? 0 : 11 - resto) === Number(digitos[tamanho]);
  };

  return conferir(12) && conferir(13);
}

export function documentoValido(tipo: TipoOrganizador, digitos: string): boolean {
  return documentoDoTipo(tipo) === "CPF" ? cpfValido(digitos) : cnpjValido(digitos);
}

export function nomeDeExibicao(instituicao: {
  nomeCurto: string | null;
  nome: string;
}): string {
  return instituicao.nomeCurto?.trim() || instituicao.nome;
}

/** Instituições que a conta gere. Vazio significa que ela não é organizadora. */
export async function instituicoesDoGestor(usuarioId: string) {
  const vinculos = await prisma.instituicaoGestor.findMany({
    where: { usuarioId },
    orderBy: { instituicao: { nome: "asc" } },
    select: {
      vinculadoEm: true,
      instituicao: {
        select: {
          id: true,
          nome: true,
          nomeCurto: true,
          tipo: true,
          logoArquivoId: true,
          suspensaEm: true,
        },
      },
    },
  });
  return vinculos.map((v) => ({ ...v.instituicao, vinculadoEm: v.vinculadoEm }));
}

export async function ehGestorDeAlguma(usuarioId: string): Promise<boolean> {
  return (await prisma.instituicaoGestor.count({ where: { usuarioId } })) > 0;
}

/**
 * Alguma instituição gerida está suspensa a ponto de impedir evento novo?
 *
 * Se a conta gere mais de uma e apenas parte está suspensa, ela ainda cria
 * evento — pelas que continuam ativas. Só fica impedida quando não sobra
 * nenhuma.
 */
export async function semInstituicaoAtiva(usuarioId: string): Promise<boolean> {
  const ativas = await prisma.instituicaoGestor.count({
    where: { usuarioId, instituicao: { suspensaEm: null } },
  });
  return ativas === 0;
}

/**
 * Sincroniza o papel da conta com os vínculos que ela tem.
 *
 * O papel deixou de ser atribuído à mão: ele é consequência do vínculo. Conta
 * com ao menos uma instituição é organizadora; sem nenhuma, volta a
 * participante. Master nunca é rebaixado por aqui — esse papel é decisão
 * administrativa própria, não efeito colateral de desvincular uma instituição.
 */
export async function sincronizarPapel(usuarioId: string): Promise<void> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { papel: true },
  });
  if (!usuario || usuario.papel === "MASTER") return;

  const vinculos = await prisma.instituicaoGestor.count({ where: { usuarioId } });
  const papel = vinculos > 0 ? "ORGANIZADOR" : "PARTICIPANTE";
  if (papel !== usuario.papel) {
    await prisma.usuario.update({ where: { id: usuarioId }, data: { papel } });
  }
}

/** Grava o que o master fez. Ver o modelo RegistroAdministrativo. */
export async function registrarAto(dados: {
  autorId: string;
  autorNome: string;
  acao: string;
  alvoTipo: "conta" | "instituicao" | "vinculo";
  alvoId: string;
  alvoNome: string;
  detalhe?: string;
}): Promise<void> {
  await prisma.registroAdministrativo.create({
    data: { ...dados, detalhe: dados.detalhe?.trim() || null },
  });
}
