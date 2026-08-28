"use server";

/**
 * Ações de presença: lançamento manual pela organização e registro por QR Code
 * lido pelo participante.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { exigirOrganizador, exigirSessao } from "@/lib/sessao";
import {
  lancarPresencaManual,
  registrarPresencaPorQr,
  registrarPresencaRemota,
  type ResultadoCheckin,
} from "@/lib/checkin";

export async function lancarPresenca(inscricaoId: string): Promise<ResultadoCheckin> {
  const sessao = await exigirOrganizador();
  const resultado = await lancarPresencaManual({
    inscricaoId,
    lancadaPorId: sessao.usuarioId,
  });
  revalidatePath("/painel", "layout");
  return resultado;
}

export async function registrarPresenca(params: {
  tokenQr: string;
  latitude: number;
  longitude: number;
  precisao?: number;
}): Promise<ResultadoCheckin> {
  const sessao = await exigirSessao();
  const resultado = await registrarPresencaPorQr({
    tokenQr: params.tokenQr,
    usuarioId: sessao.usuarioId,
    leitura: {
      latitude: params.latitude,
      longitude: params.longitude,
      precisao: params.precisao,
    },
  });
  if (resultado.ok) revalidatePath("/conta", "layout");
  return resultado;
}

/**
 * Identificador da origem da requisição, para o limite de tentativas.
 *
 * Atrás do Caddy o endereço real vem em `X-Forwarded-For`; o primeiro item é o
 * cliente. Sem proxy, o cabeçalho não existe e a chave vira "desconhecido" —
 * o que ainda limita, só que de forma compartilhada.
 */
async function origemDaRequisicao(): Promise<string> {
  const cabecalhos = await headers();
  const encaminhado = cabecalhos.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return cabecalhos.get("x-real-ip") ?? "desconhecido";
}

/**
 * Registro de presença à distância. Não exige sessão: o participante costuma
 * assistir à transmissão num aparelho e registrar presença noutro, e é o
 * código pessoal que o identifica.
 */
export async function registrarPresencaADistancia(params: {
  token: string;
  codigo: string;
}): Promise<ResultadoCheckin> {
  const resultado = await registrarPresencaRemota({
    tokenRemoto: params.token,
    codigoDigitado: params.codigo,
    origem: await origemDaRequisicao(),
  });

  if (resultado.ok) revalidatePath("/conta", "layout");
  return resultado;
}
