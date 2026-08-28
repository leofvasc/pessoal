"use server";

/**
 * Ações do gestor sobre arquivos e instituições organizadoras.
 *
 * Planejamento, seção 3: cada evento tem imagem-base do certificado, banner,
 * material de apoio para download dos inscritos e uma ou mais instituições
 * organizadoras cadastradas como entidade própria.
 *
 * Tudo aqui é restrito ao organizador, e as ações que mexem num evento
 * confirmam que ele é daquele organizador antes de gravar — a checagem de papel
 * sozinha diria apenas que a pessoa organiza *algum* evento.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirOrganizador } from "@/lib/sessao";
import { guardarArquivo, apagarArquivo, type Categoria } from "@/lib/armazenamento";

export type EstadoArquivo = { erro?: string; ok?: string };

function arquivoDoFormulario(dados: FormData, campo: string): File | null {
  const valor = dados.get(campo);
  if (!(valor instanceof File) || valor.size === 0) return null;
  return valor;
}

/** Confirma que o evento pertence a quem está pedindo. */
async function eventoDoOrganizador(eventoId: string, organizadorId: string) {
  const evento = await prisma.evento.findFirst({
    where: { id: eventoId, organizadorId },
    select: { id: true },
  });
  if (!evento) throw new Error("NAO_AUTORIZADO");
  return evento;
}

async function enviar(
  dados: FormData,
  campo: string,
  categoria: Categoria,
  enviadoPorId: string,
): Promise<{ arquivoId: string } | { erro: string }> {
  const arquivo = arquivoDoFormulario(dados, campo);
  if (!arquivo) return { erro: "Escolha um arquivo." };

  const resultado = await guardarArquivo({ arquivo, categoria, enviadoPorId });
  return resultado.ok ? { arquivoId: resultado.arquivoId } : { erro: resultado.erro };
}

// ---------------------------------------------------------------------------
// Imagem-base do certificado
// ---------------------------------------------------------------------------

export async function enviarImagemBase(
  _anterior: EstadoArquivo,
  dados: FormData,
): Promise<EstadoArquivo> {
  const sessao = await exigirOrganizador();
  const eventoId = String(dados.get("eventoId") ?? "");
  await eventoDoOrganizador(eventoId, sessao.usuarioId);

  const resultado = await enviar(dados, "arquivo", "imagemBase", sessao.usuarioId);
  if ("erro" in resultado) return { erro: resultado.erro };

  const anterior = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { certificadoBaseArquivoId: true },
  });

  await prisma.evento.update({
    where: { id: eventoId },
    data: { certificadoBaseArquivoId: resultado.arquivoId },
  });

  // Substituir a imagem-base apaga a anterior: guardá-la ocuparia o
  // armazenamento contratado sem que nada mais a referencie.
  if (anterior?.certificadoBaseArquivoId) {
    await apagarArquivo(anterior.certificadoBaseArquivoId);
  }

  revalidatePath(`/painel/eventos/${eventoId}`);
  return { ok: "Imagem-base do certificado atualizada." };
}

export async function removerImagemBase(eventoId: string) {
  const sessao = await exigirOrganizador();
  await eventoDoOrganizador(eventoId, sessao.usuarioId);

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { certificadoBaseArquivoId: true },
  });
  if (!evento?.certificadoBaseArquivoId) return;

  await prisma.evento.update({
    where: { id: eventoId },
    data: { certificadoBaseArquivoId: null },
  });
  await apagarArquivo(evento.certificadoBaseArquivoId);

  revalidatePath(`/painel/eventos/${eventoId}`);
}

// ---------------------------------------------------------------------------
// Banner do evento
// ---------------------------------------------------------------------------

export async function enviarBanner(
  _anterior: EstadoArquivo,
  dados: FormData,
): Promise<EstadoArquivo> {
  const sessao = await exigirOrganizador();
  const eventoId = String(dados.get("eventoId") ?? "");
  await eventoDoOrganizador(eventoId, sessao.usuarioId);

  const resultado = await enviar(dados, "arquivo", "banner", sessao.usuarioId);
  if ("erro" in resultado) return { erro: resultado.erro };

  const anterior = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { bannerArquivoId: true },
  });

  await prisma.evento.update({
    where: { id: eventoId },
    data: { bannerArquivoId: resultado.arquivoId },
  });
  if (anterior?.bannerArquivoId) await apagarArquivo(anterior.bannerArquivoId);

  revalidatePath(`/painel/eventos/${eventoId}`);
  return { ok: "Banner atualizado." };
}

// ---------------------------------------------------------------------------
// Material de apoio
// ---------------------------------------------------------------------------

export async function enviarMaterial(
  _anterior: EstadoArquivo,
  dados: FormData,
): Promise<EstadoArquivo> {
  const sessao = await exigirOrganizador();
  const eventoId = String(dados.get("eventoId") ?? "");
  await eventoDoOrganizador(eventoId, sessao.usuarioId);

  const arquivo = arquivoDoFormulario(dados, "arquivo");
  if (!arquivo) return { erro: "Escolha um arquivo." };

  const nomeInformado = String(dados.get("nome") ?? "").trim();
  // Sem rótulo, o nome do arquivo enviado serve — é o que o participante
  // esperaria ver na lista de qualquer forma.
  const nome = (nomeInformado || arquivo.name).slice(0, 160);

  const resultado = await guardarArquivo({
    arquivo,
    categoria: "material",
    enviadoPorId: sessao.usuarioId,
  });
  if (!resultado.ok) return { erro: resultado.erro };

  const total = await prisma.materialApoio.count({ where: { eventoId } });
  await prisma.materialApoio.create({
    data: { eventoId, nome, arquivoId: resultado.arquivoId, ordem: total },
  });

  revalidatePath(`/painel/eventos/${eventoId}`);
  return { ok: `“${nome}” disponível para os inscritos.` };
}

export async function removerMaterial(materialId: string) {
  const sessao = await exigirOrganizador();

  const material = await prisma.materialApoio.findFirst({
    where: { id: materialId, evento: { organizadorId: sessao.usuarioId } },
    select: { id: true, arquivoId: true, eventoId: true },
  });
  if (!material) throw new Error("NAO_AUTORIZADO");

  await prisma.materialApoio.delete({ where: { id: material.id } });
  await apagarArquivo(material.arquivoId);

  revalidatePath(`/painel/eventos/${material.eventoId}`);
}

// ---------------------------------------------------------------------------
// Instituições organizadoras
// ---------------------------------------------------------------------------

const esquemaInstituicao = z.object({
  nome: z.string().trim().min(2, "Informe o nome da instituição.").max(160),
});

export async function criarInstituicao(
  _anterior: EstadoArquivo,
  dados: FormData,
): Promise<EstadoArquivo> {
  const sessao = await exigirOrganizador();

  const analise = esquemaInstituicao.safeParse({ nome: String(dados.get("nome") ?? "") });
  if (!analise.success) return { erro: analise.error.issues[0].message };

  // Duas instituições com o mesmo nome ficariam indistinguíveis na lista de
  // organizadoras do evento, e o gestor não teria como saber qual marcar. A
  // comparação ignora acento e caixa porque o engano típico é redigitar o
  // nome, não copiá-lo.
  const jaCadastrada = await prisma.instituicao.findFirst({
    where: { nome: { equals: analise.data.nome, mode: "insensitive" } },
    select: { nome: true },
  });
  if (jaCadastrada) {
    return { erro: `“${jaCadastrada.nome}” já está cadastrada.` };
  }

  // O logotipo é opcional: nem toda organizadora tem arquivo vetorial à mão no
  // momento do cadastro, e isso não pode impedir a criação do evento.
  let logoArquivoId: string | null = null;
  if (arquivoDoFormulario(dados, "logo")) {
    const resultado = await enviar(dados, "logo", "logo", sessao.usuarioId);
    if ("erro" in resultado) return { erro: resultado.erro };
    logoArquivoId = resultado.arquivoId;
  }

  await prisma.instituicao.create({
    data: { nome: analise.data.nome, logoArquivoId },
  });

  revalidatePath("/painel/instituicoes");
  return { ok: `“${analise.data.nome}” cadastrada.` };
}

export async function removerInstituicao(instituicaoId: string) {
  await exigirOrganizador();

  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { logoArquivoId: true, _count: { select: { eventos: true } } },
  });
  if (!instituicao) return;

  // Instituição associada a evento não é removida: o nome dela consta do
  // certificado já emitido, e apagá-la reescreveria o passado.
  if (instituicao._count.eventos > 0) {
    throw new Error("INSTITUICAO_EM_USO");
  }

  await prisma.instituicao.delete({ where: { id: instituicaoId } });
  if (instituicao.logoArquivoId) await apagarArquivo(instituicao.logoArquivoId);

  revalidatePath("/painel/instituicoes");
}

/** Define quais instituições organizam o evento, na ordem informada. */
export async function definirOrganizadoras(eventoId: string, instituicaoIds: string[]) {
  const sessao = await exigirOrganizador();
  await eventoDoOrganizador(eventoId, sessao.usuarioId);

  await prisma.$transaction([
    prisma.eventoInstituicao.deleteMany({ where: { eventoId } }),
    prisma.eventoInstituicao.createMany({
      data: instituicaoIds.map((instituicaoId, ordem) => ({ eventoId, instituicaoId, ordem })),
    }),
  ]);

  revalidatePath(`/painel/eventos/${eventoId}`);
}
