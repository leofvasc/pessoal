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
import { prisma } from "@/lib/prisma";
import { exigirOrganizador , escopoDeEventos } from "@/lib/sessao";
import type { Papel } from "@/generated/prisma/client";
import { guardarArquivo, apagarArquivo, type Categoria } from "@/lib/armazenamento";
import { ehModeloPadrao, idDoModeloPadrao } from "@/lib/configuracao";

export type EstadoArquivo = { erro?: string; ok?: string };

function arquivoDoFormulario(dados: FormData, campo: string): File | null {
  const valor = dados.get(campo);
  if (!(valor instanceof File) || valor.size === 0) return null;
  return valor;
}

/** Confirma que o evento pertence a quem está pedindo. */
async function eventoDoOrganizador(eventoId: string, sessao: { usuarioId: string; papel: Papel }) {
  const evento = await prisma.evento.findFirst({
    where: { id: eventoId, ...escopoDeEventos(sessao), excluidoEm: null },
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
  await eventoDoOrganizador(eventoId, sessao);

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
  // armazenamento contratado sem que nada mais a referencie. A exceção é o
  // modelo padrão da plataforma, que é um só e serve a todos os outros
  // eventos — trocar a arte de um evento não pode apagá-lo.
  if (
    anterior?.certificadoBaseArquivoId &&
    !(await ehModeloPadrao(anterior.certificadoBaseArquivoId))
  ) {
    await apagarArquivo(anterior.certificadoBaseArquivoId);
  }

  revalidatePath(`/painel/eventos/${eventoId}`);
  return { ok: "Imagem-base do certificado atualizada." };
}

export async function removerImagemBase(eventoId: string) {
  const sessao = await exigirOrganizador();
  await eventoDoOrganizador(eventoId, sessao);

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { certificadoBaseArquivoId: true },
  });
  if (!evento?.certificadoBaseArquivoId) return;

  // Remover a arte própria devolve o evento ao modelo padrão da plataforma —
  // é o que a plataforma mantém justamente para nenhum certificado sair sobre
  // fundo branco. Quando o evento já estava no padrão, remover deixa em branco.
  const padrao = await idDoModeloPadrao();
  const estavaNoPadrao = evento.certificadoBaseArquivoId === padrao;

  await prisma.evento.update({
    where: { id: eventoId },
    data: { certificadoBaseArquivoId: estavaNoPadrao ? null : padrao },
  });

  // O arquivo do modelo padrão é compartilhado: só se apaga arte própria.
  if (!estavaNoPadrao) await apagarArquivo(evento.certificadoBaseArquivoId);

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
  await eventoDoOrganizador(eventoId, sessao);

  const resultado = await enviar(dados, "arquivo", "banner", sessao.usuarioId);
  if ("erro" in resultado) return { erro: resultado.erro };

  const anterior = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { bannerArquivoId: true, slug: true },
  });

  await prisma.evento.update({
    where: { id: eventoId },
    data: { bannerArquivoId: resultado.arquivoId },
  });
  if (anterior?.bannerArquivoId) await apagarArquivo(anterior.bannerArquivoId);

  revalidatePath(`/painel/eventos/${eventoId}`);
  if (anterior) revalidatePath(`/eventos/${anterior.slug}`);
  return { ok: "Banner atualizado." };
}

export async function removerBanner(eventoId: string) {
  const sessao = await exigirOrganizador();
  await eventoDoOrganizador(eventoId, sessao);

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { bannerArquivoId: true, slug: true },
  });
  if (!evento?.bannerArquivoId) return;

  await prisma.evento.update({ where: { id: eventoId }, data: { bannerArquivoId: null } });
  await apagarArquivo(evento.bannerArquivoId);

  revalidatePath(`/painel/eventos/${eventoId}`);
  revalidatePath(`/eventos/${evento.slug}`);
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
  await eventoDoOrganizador(eventoId, sessao);

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
    where: { id: materialId, evento: { ...escopoDeEventos(sessao) } },
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

export async function enviarLogotipoDaInstituicao(dados: FormData): Promise<EstadoArquivo> {
  const sessao = await exigirOrganizador();
  const instituicaoId = String(dados.get("instituicaoId") ?? "");

  // Quem gere a instituição troca o logotipo dela; o master troca o de
  // qualquer uma. O cadastro em si continua sendo só do master.
  const autorizado =
    sessao.papel === "MASTER" ||
    (await prisma.instituicaoGestor.count({
      where: { instituicaoId, usuarioId: sessao.usuarioId },
    })) > 0;
  if (!autorizado) return { erro: "Você não gere esta instituição." };

  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { logoArquivoId: true },
  });
  if (!instituicao) return { erro: "Instituição não encontrada." };

  if (!arquivoDoFormulario(dados, "logo")) return { erro: "Selecione um arquivo." };
  const resultado = await enviar(dados, "logo", "logo", sessao.usuarioId);
  if ("erro" in resultado) return resultado;

  await prisma.instituicao.update({
    where: { id: instituicaoId },
    data: { logoArquivoId: resultado.arquivoId },
  });

  // O antigo só some depois de o novo estar gravado: falha no meio do caminho
  // deixaria a instituição sem logotipo nenhum.
  if (instituicao.logoArquivoId) await apagarArquivo(instituicao.logoArquivoId);

  revalidatePath("/painel/instituicoes");
  revalidatePath("/painel/configuracoes");
  return { ok: "Logotipo atualizado." };
}

export async function definirOrganizadoras(eventoId: string, instituicaoIds: string[]) {
  const sessao = await exigirOrganizador();
  await eventoDoOrganizador(eventoId, sessao);

  // O organizador só assina em nome de instituição que ele gere. Sem esta
  // conferência, bastaria mandar outro identificador para emitir certificado
  // com o nome de uma universidade qualquer — que é exatamente o que a lista
  // fechada de instituições existe para impedir.
  if (sessao.papel !== "MASTER" && instituicaoIds.length > 0) {
    const permitidas = await prisma.instituicaoGestor.count({
      where: { usuarioId: sessao.usuarioId, instituicaoId: { in: instituicaoIds } },
    });
    if (permitidas !== new Set(instituicaoIds).size) {
      throw new Error("NAO_AUTORIZADO");
    }
  }

  await prisma.$transaction([
    prisma.eventoInstituicao.deleteMany({ where: { eventoId } }),
    prisma.eventoInstituicao.createMany({
      data: instituicaoIds.map((instituicaoId, ordem) => ({ eventoId, instituicaoId, ordem })),
    }),
  ]);

  revalidatePath(`/painel/eventos/${eventoId}`);
}
