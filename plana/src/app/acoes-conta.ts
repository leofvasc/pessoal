"use server";

/**
 * Ações de conta: criação, entrada e saída.
 *
 * Planejamento, seções 4, 5 e 9. Cada campo coletado tem finalidade declarada
 * no formulário, e telefone e e-mail para comunicação urgente dependem de
 * consentimento específico, gravado com o texto exato que o titular leu.
 */
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  abrirSessao,
  encerrarSessao,
  hashDeSenha,
  conferirSenha,
  temPainel,
  AVISO_DE_SUSPENSAO,
} from "@/lib/sessao";
import { registrarConsentimento } from "@/lib/consentimento";
import { sortearCodigoLivre } from "@/lib/codigo-de-usuario";
import { registrarTentativa, liberar } from "@/lib/limite-tentativas";

/**
 * Identificador da origem da requisição de login, para o limite de tentativas.
 *
 * Atrás do Caddy o endereço real vem em `X-Forwarded-For`; o primeiro item é
 * o cliente. Sem proxy, a chave vira "desconhecido" — ainda limita, só que
 * de forma compartilhada.
 */
async function origemDaRequisicao(): Promise<string> {
  const cab = await headers();
  const encaminhado = cab.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return cab.get("x-real-ip") ?? "desconhecido";
}

export type EstadoFormulario = { erro?: string; campos?: Record<string, string> };

const PERFIS = [
  "ACADEMICO",
  "PROFISSIONAL_JURIDICO",
  "PROFISSIONAL_NAO_JURIDICO",
  "PROFESSOR",
  "OUTROS",
] as const;

const esquemaCriacao = z
  .object({
    nome: z.string().trim().min(3, "Informe seu nome completo.").max(120),
    email: z.email("E-mail inválido.").toLowerCase(),
    senha: z.string().min(10, "Use ao menos 10 caracteres."),
    perfil: z.enum(PERFIS),
    perfilDetalhe: z.string().trim().max(160).optional(),
    telefone: z.string().trim().max(20).optional(),
    aceitaEmail: z.boolean(),
    aceitaWhatsapp: z.boolean(),
    aceitaGeo: z.boolean(),
  })
  .refine(
    // Seção 4: os perfis que pedem complemento não podem ficar sem ele — é o
    // campo que dá sentido à própria classificação em relatório.
    (d) =>
      !["PROFISSIONAL_JURIDICO", "PROFISSIONAL_NAO_JURIDICO", "OUTROS"].includes(d.perfil) ||
      Boolean(d.perfilDetalhe),
    { path: ["perfilDetalhe"], message: "Este perfil pede um complemento." },
  )
  .refine((d) => !d.aceitaWhatsapp || Boolean(d.telefone), {
    path: ["telefone"],
    message: "Informe o telefone para autorizar avisos por WhatsApp.",
  });

/**
 * Só aceita destino interno começando por uma única barra.
 * "//outrodominio.com" e "https://…" são endereços absolutos e levariam o
 * usuário para fora da plataforma logo depois de autenticar — é assim que se
 * monta um redirecionamento aberto.
 */
function destinoSeguro(valor: string): string | null {
  if (!valor.startsWith("/") || valor.startsWith("//")) return null;
  return valor;
}

function texto(dados: FormData, chave: string): string {
  const valor = dados.get(chave);
  return typeof valor === "string" ? valor : "";
}

export async function criarConta(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const bruto = {
    nome: texto(dados, "nome"),
    email: texto(dados, "email"),
    senha: texto(dados, "senha"),
    perfil: texto(dados, "perfil"),
    perfilDetalhe: texto(dados, "perfilDetalhe") || undefined,
    telefone: texto(dados, "telefone") || undefined,
    aceitaEmail: dados.get("aceitaEmail") === "on",
    aceitaWhatsapp: dados.get("aceitaWhatsapp") === "on",
    aceitaGeo: dados.get("aceitaGeo") === "on",
  };

  const analise = esquemaCriacao.safeParse(bruto);
  if (!analise.success) {
    const campos: Record<string, string> = {};
    for (const problema of analise.error.issues) {
      const chave = String(problema.path[0] ?? "");
      if (chave && !campos[chave]) campos[chave] = problema.message;
    }
    return { erro: "Confira os campos destacados.", campos };
  }

  const entrada = analise.data;

  // Sem consentimento para WhatsApp, o telefone não tem finalidade — e sem
  // finalidade não se coleta (seção 9).
  const telefone = entrada.aceitaWhatsapp ? entrada.telefone : null;

  const jaExiste = await prisma.usuario.findUnique({
    where: { email: entrada.email },
    select: { id: true },
  });
  if (jaExiste) {
    return { erro: "Já existe uma conta com este e-mail.", campos: { email: "E-mail já cadastrado." } };
  }

  const usuario = await prisma.usuario.create({
    data: {
      nome: entrada.nome,
      email: entrada.email,
      senhaHash: await hashDeSenha(entrada.senha),
      perfil: entrada.perfil,
      perfilDetalhe: entrada.perfilDetalhe ?? null,
      telefone,
      // Código pessoal, usado para registrar presença a distância em evento
      // online ou híbrido. Fica visível na área da conta.
      codigoUsuario: await sortearCodigoLivre(),
    },
    select: { id: true, nome: true, papel: true },
  });

  if (entrada.aceitaEmail) await registrarConsentimento(usuario.id, "COMUNICACAO_URGENTE_EMAIL");
  if (entrada.aceitaWhatsapp)
    await registrarConsentimento(usuario.id, "COMUNICACAO_URGENTE_WHATSAPP");
  if (entrada.aceitaGeo) await registrarConsentimento(usuario.id, "GEOLOCALIZACAO_CHECKIN");

  await abrirSessao({ usuarioId: usuario.id, nome: usuario.nome, papel: usuario.papel });
  redirect("/conta");
}

export async function entrar(
  _anterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const email = texto(dados, "email").trim().toLowerCase();
  const senha = texto(dados, "senha");
  const destino = destinoSeguro(texto(dados, "destino"));

  if (!email || !senha) return { erro: "Informe e-mail e senha." };

  // Limite de tentativas por IP: máximo de 10 tentativas em 10 minutos.
  // Evita ataques de força-bruta por varredura de senhas.
  const origem = await origemDaRequisicao();
  const chaveIp = `login:ip:${origem}`;
  const limiteIp = registrarTentativa(chaveIp, { maximo: 10, janelaSegundos: 600 });
  if (!limiteIp.permitido) {
    const minutos = Math.ceil(limiteIp.segundosParaLiberar / 60);
    return {
      erro: `Muitas tentativas de login. Aguarde ${minutos} minuto${minutos > 1 ? "s" : ""} e tente novamente.`,
    };
  }

  // Limite adicional por e-mail: máximo de 10 tentativas em 10 minutos.
  // Protege contas específicas contra ataques distribuídos (IPs diferentes,
  // mesmo alvo), sem revelar se o e-mail existe — o retorno é genérico.
  const chaveEmail = `login:email:${email}`;
  const limiteEmail = registrarTentativa(chaveEmail, { maximo: 10, janelaSegundos: 600 });
  if (!limiteEmail.permitido) {
    const minutos = Math.ceil(limiteEmail.segundosParaLiberar / 60);
    return {
      erro: `Muitas tentativas de login. Aguarde ${minutos} minuto${minutos > 1 ? "s" : ""} e tente novamente.`,
    };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: {
      id: true,
      nome: true,
      papel: true,
      senhaHash: true,
      excluidoEm: true,
      suspensoEm: true,
      motivoSuspensao: true,
    },
  });

  // Mensagem única para e-mail inexistente e senha errada: dizer qual dos dois
  // falhou entregaria a quem tenta adivinhar a informação de que a conta existe.
  const generico = { erro: "E-mail ou senha incorretos." };
  // Conta suspensa: a senha pode até estar certa, mas o acesso está bloqueado.
  // A conferência vem depois da senha de propósito — dizer "esta conta está
  // suspensa" antes de conferir a senha entregaria, a quem só tem o e-mail, a
  // informação de que a conta existe.
  if (!usuario || usuario.excluidoEm) {
    // Gasta o mesmo tempo do caminho válido, para o erro não vazar pela latência.
    await conferirSenha(senha, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin");
    return generico;
  }
  if (!(await conferirSenha(senha, usuario.senhaHash))) return generico;

  if (usuario.suspensoEm) {
    return {
      erro: `${AVISO_DE_SUSPENSAO}${usuario.motivoSuspensao ? ` Motivo informado: ${usuario.motivoSuspensao}` : ""}`,
    };
  }

  // Login bem-sucedido: zera os contadores de tentativas para não punir o
  // titular legítimo na próxima entrada caso o limite ainda não tenha expirado.
  liberar(chaveIp);
  liberar(chaveEmail);

  await abrirSessao({ usuarioId: usuario.id, nome: usuario.nome, papel: usuario.papel });
  redirect(destino ?? (temPainel(usuario.papel) ? "/painel" : "/conta"));
}

export async function sair() {
  await encerrarSessao();
  redirect("/");
}
