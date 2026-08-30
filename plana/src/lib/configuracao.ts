import "server-only";

/**
 * Configuração global da plataforma.
 *
 * Existe uma única linha, de id fixo `global`. É onde mora o que vale para
 * todos os eventos — hoje, o modelo-base padrão de certificado.
 *
 * Manual de identidade visual, seção 15: a arte do certificado pertence às
 * organizadoras e a PlanA não a redesenha. O modelo padrão daqui não contraria
 * isso: ele é o que se usa quando o evento não tem arte própria, para que
 * nenhum participante receba um certificado sobre fundo branco. Basta o
 * organizador enviar a imagem do evento para que ela prevaleça.
 */
import { prisma } from "./prisma";

export const ID_CONFIGURACAO = "global";

export type ModeloPadrao = {
  arquivoId: string;
  caminho: string;
  nomeOriginal: string;
  tamanhoBytes: number;
  criadoEm: Date;
};

/** Garante a existência da linha única e a devolve. */
export async function configuracao() {
  return prisma.configuracao.upsert({
    where: { id: ID_CONFIGURACAO },
    create: { id: ID_CONFIGURACAO },
    update: {},
    select: { id: true, certificadoBasePadraoArquivoId: true, atualizadoEm: true },
  });
}

/** Modelo-base padrão em uso, ou null enquanto nenhum tiver sido enviado. */
export async function modeloPadraoDeCertificado(): Promise<ModeloPadrao | null> {
  const atual = await prisma.configuracao.findUnique({
    where: { id: ID_CONFIGURACAO },
    select: {
      certificadoBasePadraoArquivo: {
        select: {
          id: true,
          caminho: true,
          nomeOriginal: true,
          tamanhoBytes: true,
          criadoEm: true,
        },
      },
    },
  });

  const arquivo = atual?.certificadoBasePadraoArquivo;
  if (!arquivo) return null;

  return {
    arquivoId: arquivo.id,
    caminho: arquivo.caminho,
    nomeOriginal: arquivo.nomeOriginal,
    tamanhoBytes: arquivo.tamanhoBytes,
    criadoEm: arquivo.criadoEm,
  };
}

/** Só o id, para quando basta saber qual arquivo aplicar a um evento novo. */
export async function idDoModeloPadrao(): Promise<string | null> {
  const atual = await prisma.configuracao.findUnique({
    where: { id: ID_CONFIGURACAO },
    select: { certificadoBasePadraoArquivoId: true },
  });
  return atual?.certificadoBasePadraoArquivoId ?? null;
}

/**
 * Diz se um arquivo é o modelo padrão da plataforma.
 *
 * É a trava que impede que trocar ou remover a imagem de *um* evento apague o
 * arquivo compartilhado por todos os outros.
 */
export async function ehModeloPadrao(arquivoId: string | null): Promise<boolean> {
  if (!arquivoId) return false;
  return (await idDoModeloPadrao()) === arquivoId;
}
