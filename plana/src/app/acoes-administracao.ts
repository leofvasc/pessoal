"use server";

/**
 * Administração de instituições organizadoras e de contas, pelo master.
 *
 * Todas as ações daqui exigem papel master e deixam rastro em
 * RegistroAdministrativo. Poder administrativo sem trilha é o que costuma dar
 * errado: depois de uma suspensão contestada ou de uma senha redefinida,
 * ninguém consegue reconstruir quem fez o quê.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirMaster, hashDeSenha } from "@/lib/sessao";
import {
  apenasDigitos,
  documentoDoTipo,
  documentoValido,
  registrarAto,
  sincronizarPapel,
} from "@/lib/organizadores";
import { excluirConta, ExclusaoBloqueada } from "@/lib/exclusao-de-conta";
import { notificar } from "@/lib/notificacoes";

export type EstadoAdmin = { erro?: string; campos?: Record<string, string>; ok?: boolean };

function texto(dados: FormData, chave: string): string {
  const valor = dados.get(chave);
  return typeof valor === "string" ? valor.trim() : "";
}

function opcional(dados: FormData, chave: string): string | undefined {
  const valor = texto(dados, chave);
  return valor === "" ? undefined : valor;
}

function erros(erro: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const questao of erro.issues) {
    const chave = String(questao.path[0] ?? "");
    if (chave && !campos[chave]) campos[chave] = questao.message;
  }
  return campos;
}

const esquema = z.object({
  nome: z.string().trim().min(3, "Informe o nome ou a razão social.").max(200),
  tipo: z.enum(["PESSOA_FISICA", "PESSOA_JURIDICA", "ORGAO_PUBLICO"]),
  nomeCurto: z.string().trim().max(60).optional(),
  documento: z.string().trim().max(20).optional(),
  emailContato: z.email("Endereço inválido.").optional().or(z.literal("")),
  telefoneContato: z.string().trim().max(20).optional(),
  site: z.url("Endereço inválido.").optional().or(z.literal("")),
  esfera: z.string().trim().max(120).optional(),
});

function ler(dados: FormData) {
  return esquema.safeParse({
    nome: texto(dados, "nome"),
    tipo: texto(dados, "tipo"),
    nomeCurto: opcional(dados, "nomeCurto"),
    documento: opcional(dados, "documento"),
    emailContato: opcional(dados, "emailContato"),
    telefoneContato: opcional(dados, "telefoneContato"),
    site: opcional(dados, "site"),
    esfera: opcional(dados, "esfera"),
  });
}

function conferirDocumento(
  tipo: "PESSOA_FISICA" | "PESSOA_JURIDICA" | "ORGAO_PUBLICO",
  bruto: string | undefined,
): { digitos: string | null; erro?: string } {
  if (!bruto) return { digitos: null };
  const digitos = apenasDigitos(bruto);
  if (!documentoValido(tipo, digitos)) {
    return { digitos: null, erro: `${documentoDoTipo(tipo)} inválido.` };
  }
  return { digitos };
}

function atualizarTelas() {
  revalidatePath("/painel/configuracoes");
  revalidatePath("/painel/instituicoes");
}

// ---------------------------------------------------------------------------
// Instituições
// ---------------------------------------------------------------------------

export async function salvarInstituicao(
  instituicaoId: string | null,
  _anterior: EstadoAdmin,
  dados: FormData,
): Promise<EstadoAdmin> {
  const sessao = await exigirMaster();

  const analisado = ler(dados);
  if (!analisado.success) {
    return { erro: "Confira os campos destacados.", campos: erros(analisado.error) };
  }
  const entrada = analisado.data;

  const documento = conferirDocumento(entrada.tipo, entrada.documento);
  if (documento.erro) {
    return { erro: "Confira os campos destacados.", campos: { documento: documento.erro } };
  }

  const homonima = await prisma.instituicao.findFirst({
    where: { nome: entrada.nome, ...(instituicaoId ? { id: { not: instituicaoId } } : {}) },
    select: { id: true },
  });
  if (homonima) {
    return {
      erro: "Já existe instituição com este nome.",
      campos: { nome: "Nome já cadastrado. Use a que já existe ou diferencie a denominação." },
    };
  }

  const valores = {
    nome: entrada.nome,
    tipo: entrada.tipo,
    nomeCurto: entrada.nomeCurto ?? null,
    documento: documento.digitos,
    emailContato: entrada.emailContato || null,
    telefoneContato: entrada.telefoneContato ?? null,
    site: entrada.site || null,
    esfera: entrada.esfera ?? null,
  };

  const instituicao = instituicaoId
    ? await prisma.instituicao.update({ where: { id: instituicaoId }, data: valores })
    : await prisma.instituicao.create({ data: valores });

  await registrarAto({
    autorId: sessao.usuarioId,
    autorNome: sessao.nome,
    acao: instituicaoId ? "instituicao.editada" : "instituicao.criada",
    alvoTipo: "instituicao",
    alvoId: instituicao.id,
    alvoNome: instituicao.nome,
  });

  atualizarTelas();
  return { ok: true };
}

export async function alternarSuspensaoDeInstituicao(
  instituicaoId: string,
  motivo: string,
): Promise<EstadoAdmin> {
  const sessao = await exigirMaster();

  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { nome: true, suspensaEm: true },
  });
  if (!instituicao) return { erro: "Instituição não encontrada." };

  const suspendendo = instituicao.suspensaEm == null;
  await prisma.instituicao.update({
    where: { id: instituicaoId },
    data: {
      suspensaEm: suspendendo ? new Date() : null,
      motivoSuspensao: suspendendo ? motivo.trim() || null : null,
    },
  });

  await registrarAto({
    autorId: sessao.usuarioId,
    autorNome: sessao.nome,
    acao: suspendendo ? "instituicao.suspensa" : "instituicao.reativada",
    alvoTipo: "instituicao",
    alvoId: instituicaoId,
    alvoNome: instituicao.nome,
    detalhe: suspendendo ? motivo : undefined,
  });

  atualizarTelas();
  return { ok: true };
}

/**
 * Apaga a instituição.
 *
 * Recusada quando ela já constou de algum evento: o nome dela está impresso em
 * certificado que circula, e a página do evento continua no ar. Suspender é o
 * caminho para tirá-la de circulação sem reescrever o passado.
 */
export async function excluirInstituicao(instituicaoId: string): Promise<EstadoAdmin> {
  const sessao = await exigirMaster();

  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { nome: true, _count: { select: { eventos: true } } },
  });
  if (!instituicao) return { erro: "Instituição não encontrada." };

  if (instituicao._count.eventos > 0) {
    return {
      erro: `Esta instituição consta de ${instituicao._count.eventos} evento(s) e do certificado deles. Suspenda-a em vez de excluir.`,
    };
  }

  await prisma.instituicao.delete({ where: { id: instituicaoId } });

  await registrarAto({
    autorId: sessao.usuarioId,
    autorNome: sessao.nome,
    acao: "instituicao.excluida",
    alvoTipo: "instituicao",
    alvoId: instituicaoId,
    alvoNome: instituicao.nome,
  });

  atualizarTelas();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Vínculo de gestor
// ---------------------------------------------------------------------------

/**
 * Vincula uma conta existente a uma instituição, tornando-a gestora.
 *
 * É esta ação que cria um organizador na PlanA. Ela busca a conta pelo e-mail
 * porque é o dado que o master tem em mãos ao receber o pedido, e porque
 * digitar identificador interno convida ao erro de vincular a pessoa errada.
 */
export async function vincularGestor(
  instituicaoId: string,
  emailBruto: string,
): Promise<EstadoAdmin> {
  const sessao = await exigirMaster();
  const email = emailBruto.trim().toLowerCase();

  const conta = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, nome: true, excluidoEm: true },
  });
  if (!conta || conta.excluidoEm) {
    return {
      erro: "Nenhuma conta com este e-mail. A pessoa precisa criar a conta antes de ser vinculada.",
    };
  }

  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { nome: true },
  });
  if (!instituicao) return { erro: "Instituição não encontrada." };

  const jaVinculado = await prisma.instituicaoGestor.findUnique({
    where: { instituicaoId_usuarioId: { instituicaoId, usuarioId: conta.id } },
  });
  if (jaVinculado) return { erro: "Esta conta já gere esta instituição." };

  await prisma.instituicaoGestor.create({
    data: { instituicaoId, usuarioId: conta.id, vinculadoPor: sessao.usuarioId },
  });
  await sincronizarPapel(conta.id);

  await notificar({
    usuarioId: conta.id,
    tipo: "SEGURANCA_CONTA",
    titulo: "Você agora gere uma organização na PlanA",
    corpo: `Sua conta foi vinculada a ${instituicao.nome}. O painel de organizador já está disponível, e os eventos que você criar sairão em nome dessa instituição.`,
    link: "/painel",
  });

  await registrarAto({
    autorId: sessao.usuarioId,
    autorNome: sessao.nome,
    acao: "gestor.vinculado",
    alvoTipo: "vinculo",
    alvoId: `${instituicaoId}:${conta.id}`,
    alvoNome: `${conta.nome} → ${instituicao.nome}`,
  });

  atualizarTelas();
  return { ok: true };
}

/**
 * Desfaz o vínculo. A conta volta a ser apenas de participante, sem perder
 * inscrição, presença ou certificado que tenha como participante — e sem que
 * os eventos que ela criou deixem de existir.
 */
export async function desvincularGestor(
  instituicaoId: string,
  usuarioId: string,
): Promise<EstadoAdmin> {
  const sessao = await exigirMaster();

  const vinculo = await prisma.instituicaoGestor.findUnique({
    where: { instituicaoId_usuarioId: { instituicaoId, usuarioId } },
    select: { instituicao: { select: { nome: true } }, usuario: { select: { nome: true } } },
  });
  if (!vinculo) return { erro: "Vínculo não encontrado." };

  await prisma.instituicaoGestor.delete({
    where: { instituicaoId_usuarioId: { instituicaoId, usuarioId } },
  });
  await sincronizarPapel(usuarioId);

  await notificar({
    usuarioId,
    tipo: "SEGURANCA_CONTA",
    titulo: "Vínculo com organização encerrado",
    corpo: `Sua conta deixou de gerir ${vinculo.instituicao.nome}. Suas inscrições, presenças e certificados como participante continuam intactos.`,
  });

  await registrarAto({
    autorId: sessao.usuarioId,
    autorNome: sessao.nome,
    acao: "gestor.desvinculado",
    alvoTipo: "vinculo",
    alvoId: `${instituicaoId}:${usuarioId}`,
    alvoNome: `${vinculo.usuario.nome} → ${vinculo.instituicao.nome}`,
  });

  atualizarTelas();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Contas
// ---------------------------------------------------------------------------

/** Bloqueia ou libera o login. Não apaga nada. */
export async function alternarSuspensaoDeConta(
  usuarioId: string,
  motivo: string,
): Promise<EstadoAdmin> {
  const sessao = await exigirMaster();
  if (usuarioId === sessao.usuarioId) return { erro: "Não é possível suspender a própria conta." };

  const conta = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nome: true, suspensoEm: true },
  });
  if (!conta) return { erro: "Conta não encontrada." };

  const suspendendo = conta.suspensoEm == null;
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      suspensoEm: suspendendo ? new Date() : null,
      motivoSuspensao: suspendendo ? motivo.trim() || null : null,
    },
  });

  await notificar({
    usuarioId,
    tipo: "SEGURANCA_CONTA",
    titulo: suspendendo ? "Conta suspensa" : "Conta reativada",
    corpo: suspendendo
      ? `O acesso à sua conta foi suspenso pela administração da plataforma.${motivo.trim() ? ` Motivo: ${motivo.trim()}` : ""}`
      : "O acesso à sua conta foi restabelecido.",
  });

  await registrarAto({
    autorId: sessao.usuarioId,
    autorNome: sessao.nome,
    acao: suspendendo ? "conta.suspensa" : "conta.reativada",
    alvoTipo: "conta",
    alvoId: usuarioId,
    alvoNome: conta.nome,
    detalhe: suspendendo ? motivo : undefined,
  });

  revalidatePath("/painel/configuracoes");
  return { ok: true };
}

export async function alterarPapel(
  usuarioId: string,
  novoPapel: "MASTER" | "PARTICIPANTE",
): Promise<EstadoAdmin> {
  const sessao = await exigirMaster();
  if (usuarioId === sessao.usuarioId) return { erro: "Não é possível alterar o próprio papel." };

  const conta = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nome: true, papel: true },
  });
  if (!conta) return { erro: "Conta não encontrada." };

  if (conta.papel === "MASTER" && novoPapel !== "MASTER") {
    const outros = await prisma.usuario.count({
      where: { papel: "MASTER", excluidoEm: null, id: { not: usuarioId } },
    });
    if (outros === 0) return { erro: "A plataforma precisa de pelo menos um gestor master." };
  }

  if (novoPapel === "MASTER") {
    await prisma.usuario.update({ where: { id: usuarioId }, data: { papel: "MASTER" } });
  } else {
    // Rebaixar não é escolher papel à mão: o papel volta a ser consequência dos
    // vínculos que a conta tiver.
    await prisma.usuario.update({ where: { id: usuarioId }, data: { papel: "PARTICIPANTE" } });
    await sincronizarPapel(usuarioId);
  }

  await notificar({
    usuarioId,
    tipo: "SEGURANCA_CONTA",
    titulo: "Papel alterado na plataforma",
    corpo:
      novoPapel === "MASTER"
        ? "Sua conta passou a ter papel de gestor master, com acesso à administração da plataforma."
        : "Sua conta deixou de ter papel de gestor master.",
  });

  await registrarAto({
    autorId: sessao.usuarioId,
    autorNome: sessao.nome,
    acao: novoPapel === "MASTER" ? "conta.promovida" : "conta.rebaixada",
    alvoTipo: "conta",
    alvoId: usuarioId,
    alvoNome: conta.nome,
  });

  revalidatePath("/painel/configuracoes");
  return { ok: true };
}

export async function redefinirSenha(
  usuarioId: string,
  novaSenha: string,
): Promise<EstadoAdmin> {
  const sessao = await exigirMaster();
  if (novaSenha.length < 10) {
    return { erro: "Senha curta demais.", campos: { senha: "Mínimo de dez caracteres." } };
  }

  const conta = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nome: true },
  });
  if (!conta) return { erro: "Conta não encontrada." };

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { senhaHash: await hashDeSenha(novaSenha) },
  });
  // Pedidos de redefinição pendentes deixam de valer: a senha já mudou.
  await prisma.redefinicaoSenha.deleteMany({ where: { usuarioId, usadoEm: null } });

  await notificar({
    usuarioId,
    tipo: "SEGURANCA_CONTA",
    titulo: "Senha redefinida pela administração",
    corpo:
      "A senha da sua conta foi redefinida pela administração da plataforma. Se você não solicitou, abra um chamado imediatamente.",
  });

  await registrarAto({
    autorId: sessao.usuarioId,
    autorNome: sessao.nome,
    acao: "conta.senha_redefinida",
    alvoTipo: "conta",
    alvoId: usuarioId,
    alvoNome: conta.nome,
  });

  return { ok: true };
}

/**
 * Exclui a conta de um titular a pedido dele ou por determinação.
 *
 * Reaproveita a mesma rotina da exclusão feita pelo próprio titular: apaga os
 * dados pessoais e preserva a validação dos certificados já emitidos, sem
 * guardar nome legível. Não existe caminho administrativo mais destrutivo que
 * o do titular — seria estranho o master poder destruir o que nem o dono pode.
 *
 * Exige o motivo por escrito, que fica na trilha. Exclusão de conta alheia sem
 * justificativa registrada é o tipo de ato que ninguém consegue explicar
 * depois.
 */
export async function excluirContaDeUsuario(
  usuarioId: string,
  motivo: string,
): Promise<EstadoAdmin> {
  const sessao = await exigirMaster();
  if (usuarioId === sessao.usuarioId) {
    return { erro: "Use a tela de exclusão da própria conta, em Meus dados." };
  }
  if (motivo.trim().length < 10) {
    return { erro: "Descreva o motivo da exclusão. Ele fica registrado na trilha administrativa." };
  }

  const conta = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nome: true, email: true },
  });
  if (!conta) return { erro: "Conta não encontrada." };

  try {
    await excluirConta(usuarioId);
  } catch (erro) {
    if (erro instanceof ExclusaoBloqueada) {
      return {
        erro:
          "Esta conta responde por eventos ou arquivos. Desvincule-a das instituições e defina a destinação dos eventos antes de excluí-la.",
      };
    }
    throw erro;
  }

  await registrarAto({
    autorId: sessao.usuarioId,
    autorNome: sessao.nome,
    acao: "conta.excluida",
    alvoTipo: "conta",
    alvoId: usuarioId,
    alvoNome: `${conta.nome} (${conta.email})`,
    detalhe: motivo,
  });

  revalidatePath("/painel/configuracoes");
  return { ok: true };
}
