"use server";

/**
 * Ações de presença: lançamento manual pela organização e registro por QR Code
 * lido pelo participante.
 */
import { revalidatePath } from "next/cache";
import { exigirOrganizador, exigirSessao } from "@/lib/sessao";
import { lancarPresencaManual, registrarPresencaPorQr, type ResultadoCheckin } from "@/lib/checkin";

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
