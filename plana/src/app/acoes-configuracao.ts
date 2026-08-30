"use server";

/**
 * Ações sobre a configuração global da plataforma.
 *
 * O modelo-base padrão de certificado é enviado uma vez, aqui, e passa a valer
 * para todo evento criado depois — o organizador não precisa repetir o envio a
 * cada evento, e continua livre para substituí-lo dentro de um evento
 * específico.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirMaster, exigirOrganizador } from "@/lib/sessao";
import { guardarArquivo, apagarArquivo } from "@/lib/armazenamento";
import { ID_CONFIGURACAO, idDoGabarito, idDoModeloPadrao } from "@/lib/configuracao";

export type EstadoConfiguracao = { erro?: string; ok?: string };

export async function enviarModeloPadraoCertificado(
  _anterior: EstadoConfiguracao,
  dados: FormData,
): Promise<EstadoConfiguracao> {
  const sessao = await exigirOrganizador();

  const arquivo = dados.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Escolha um arquivo." };
  }

  const resultado = await guardarArquivo({
    arquivo,
    categoria: "imagemBase",
    enviadoPorId: sessao.usuarioId,
  });
  if (!resultado.ok) return { erro: resultado.erro };

  const anterior = await idDoModeloPadrao();

  await prisma.configuracao.upsert({
    where: { id: ID_CONFIGURACAO },
    create: { id: ID_CONFIGURACAO, certificadoBasePadraoArquivoId: resultado.arquivoId },
    update: { certificadoBasePadraoArquivoId: resultado.arquivoId },
  });

  // Os eventos que ainda apontavam para o modelo antigo passam a apontar para
  // o novo. Sem isso, trocar o padrão deixaria para trás eventos presos a uma
  // arte que ninguém mais consegue ver na tela de configurações.
  if (anterior) {
    await prisma.evento.updateMany({
      where: { certificadoBaseArquivoId: anterior },
      data: { certificadoBaseArquivoId: resultado.arquivoId },
    });
    await apagarArquivo(anterior);
  }

  revalidatePath("/painel/configuracoes");
  revalidatePath("/painel");
  return { ok: "Modelo padrão de certificado atualizado." };
}

export async function removerModeloPadraoCertificado() {
  await exigirOrganizador();

  const atual = await idDoModeloPadrao();
  if (!atual) return;

  // Os eventos que usavam o padrão ficam sem imagem-base: o certificado deles
  // volta a sair sobre fundo branco, e não sobre um arquivo que já não existe.
  await prisma.evento.updateMany({
    where: { certificadoBaseArquivoId: atual },
    data: { certificadoBaseArquivoId: null },
  });

  await prisma.configuracao.update({
    where: { id: ID_CONFIGURACAO },
    data: { certificadoBasePadraoArquivoId: null },
  });

  await apagarArquivo(atual);

  revalidatePath("/painel/configuracoes");
  revalidatePath("/painel");
}

// ---------------------------------------------------------------------------
// Gabarito de medidas do certificado
// ---------------------------------------------------------------------------

/**
 * Envia ou substitui o gabarito que os organizadores baixam.
 *
 * Só o master: o gabarito é a documentação da automação da plataforma, e não
 * material de um evento. Se cada organizador pudesse trocá-lo, o arquivo que
 * os demais baixam mudaria sem que ninguém soubesse por quê.
 *
 * A substituição é o caso comum, e não a exceção — o desenho do certificado
 * muda, e a administração precisa poder atualizar o gabarito sozinha, sem
 * implantação. O arquivo anterior é apagado: ninguém mais o referencia, e
 * guardá-lo ocuparia o armazenamento contratado à toa.
 */
export async function enviarGabaritoCertificado(
  _anterior: EstadoConfiguracao,
  dados: FormData,
): Promise<EstadoConfiguracao> {
  const sessao = await exigirMaster();

  const arquivo = dados.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Escolha um arquivo." };
  }

  const resultado = await guardarArquivo({
    arquivo,
    categoria: "gabarito",
    enviadoPorId: sessao.usuarioId,
  });
  if (!resultado.ok) return { erro: resultado.erro };

  const anterior = await idDoGabarito();

  await prisma.configuracao.upsert({
    where: { id: ID_CONFIGURACAO },
    create: { id: ID_CONFIGURACAO, gabaritoCertificadoArquivoId: resultado.arquivoId },
    update: { gabaritoCertificadoArquivoId: resultado.arquivoId },
  });

  if (anterior) await apagarArquivo(anterior);

  revalidatePath("/painel/configuracoes");
  revalidatePath("/painel");
  return { ok: "Gabarito do certificado atualizado." };
}

export async function removerGabaritoCertificado() {
  await exigirMaster();

  const atual = await idDoGabarito();
  if (!atual) return;

  await prisma.configuracao.update({
    where: { id: ID_CONFIGURACAO },
    data: { gabaritoCertificadoArquivoId: null },
  });
  await apagarArquivo(atual);

  revalidatePath("/painel/configuracoes");
  revalidatePath("/painel");
}
