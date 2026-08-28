import "server-only";

import { headers } from "next/headers";

/**
 * Endereço público da plataforma — usado nos QR Codes, no link curto e no bloco
 * de validação do certificado.
 *
 * Vem de PUBLIC_ORIGIN quando definida. Sem ela, deriva dos cabeçalhos da
 * requisição: em desenvolvimento isso evita ter de configurar a variável, e na
 * VPS o proxy reverso repassa o host real.
 */
export async function origemPublica(): Promise<string> {
  const configurada = process.env.PUBLIC_ORIGIN;
  if (configurada) return configurada.replace(/\/$/, "");

  const cabecalhos = await headers();
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host") ?? "localhost:3000";
  const protocolo = cabecalhos.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}
