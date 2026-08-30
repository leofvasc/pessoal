import "server-only";

import { headers } from "next/headers";

/**
 * Endereço público da plataforma — usado nos QR Codes, no link curto, no bloco
 * de validação do certificado e nos metadados de compartilhamento.
 *
 * O que este módulo produz vai parar em papel e em peça gráfica. Um QR de
 * divulgação impresso com um endereço errado não é um defeito que se corrige
 * com um deploy: é um cartaz inútil. Por isso a escolha da origem não confia num
 * único valor — ela descarta o que sabidamente não funciona fora do servidor.
 *
 * Casos concretos já vistos em produção:
 *
 *  - `http://0.0.0.0:3000` — endereço de escuta do processo, não endereço de
 *    destino. O Firefox recusa conectar; o Safari recusa a porta;
 *  - `http://localhost:3000` e `127.0.0.1` — resolvem no aparelho de quem lê o
 *    QR, e não no servidor;
 *  - IP de rede interna do Docker ou da VPS, que não sai da máquina.
 *
 * Em todos eles o valor configurado é ignorado em favor do host real da
 * requisição, repassado pelo Caddy em X-Forwarded-Host.
 */

/** Hosts que nunca servem como endereço público de destino. */
function hostNaoPublico(host: string): boolean {
  const semPorta = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  if (!semPorta) return true;

  if (semPorta === "0.0.0.0" || semPorta === "::" || semPorta === "::0") return true;
  if (semPorta === "localhost" || semPorta.endsWith(".localhost")) return true;
  if (semPorta === "::1") return true;
  if (/^127\./.test(semPorta)) return true;
  // Faixas privadas da RFC 1918 e link-local: alcançáveis dentro da rede, nunca
  // pela internet — e é a internet que vai ler o QR.
  if (/^10\./.test(semPorta)) return true;
  if (/^192\.168\./.test(semPorta)) return true;
  if (/^169\.254\./.test(semPorta)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(semPorta)) return true;
  // Nome de serviço do Compose, sem ponto: "app", "banco", "proxy".
  if (!semPorta.includes(".")) return true;

  return false;
}

function normalizar(valor: string): string | null {
  const limpo = valor.trim().replace(/\/+$/, "");
  if (!limpo) return null;
  try {
    const url = new URL(limpo.includes("://") ? limpo : `https://${limpo}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export type FonteDaOrigem = "PUBLIC_ORIGIN" | "cabecalho" | "padrao";

export type DiagnosticoDeOrigem = {
  origem: string;
  fonte: FonteDaOrigem;
  /** Preenchido quando PUBLIC_ORIGIN existe mas não serve como endereço público. */
  alerta: string | null;
};

/**
 * Resolve a origem e explica de onde ela veio. É o que a tela do evento usa
 * para avisar o organizador antes de ele imprimir um QR que não abre.
 */
export async function diagnosticoDeOrigem(): Promise<DiagnosticoDeOrigem> {
  const configurada = normalizar(process.env.PUBLIC_ORIGIN ?? "");

  const cabecalhos = await headers();
  const hostCabecalho =
    cabecalhos.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    cabecalhos.get("host")?.trim() ??
    "";
  const protocoloCabecalho =
    cabecalhos.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (hostNaoPublico(hostCabecalho) ? "http" : "https");
  const doCabecalho = hostCabecalho ? normalizar(`${protocoloCabecalho}://${hostCabecalho}`) : null;

  const configuradaServe = configurada !== null && !hostNaoPublico(new URL(configurada).host);
  const cabecalhoServe = doCabecalho !== null && !hostNaoPublico(new URL(doCabecalho).host);

  if (configuradaServe) {
    return { origem: configurada as string, fonte: "PUBLIC_ORIGIN", alerta: null };
  }

  if (cabecalhoServe) {
    return {
      origem: doCabecalho as string,
      fonte: "cabecalho",
      alerta: configurada
        ? `PUBLIC_ORIGIN está definida como ${configurada}, que não é um endereço acessível de fora do servidor. ` +
          `Os links estão sendo montados com ${doCabecalho}, obtido da própria requisição. ` +
          `Corrija a variável no .env da VPS e refaça o deploy.`
        : null,
    };
  }

  // Desenvolvimento local: aqui localhost é o endereço certo.
  const padrao = configurada ?? doCabecalho ?? "http://localhost:3000";
  return {
    origem: padrao,
    fonte: configurada ? "PUBLIC_ORIGIN" : doCabecalho ? "cabecalho" : "padrao",
    alerta: null,
  };
}

export async function origemPublica(): Promise<string> {
  const { origem } = await diagnosticoDeOrigem();
  return origem;
}

/**
 * Origem para `metadataBase`, resolvida sem tocar em `headers()`.
 *
 * Os metadados de compartilhamento precisam de URL absoluta, e ler cabeçalhos
 * no layout raiz tornaria dinâmica toda página do site. Aqui, portanto, vale só
 * a variável de ambiente — mais uma razão para ela estar certa na VPS.
 */
export function origemDeMetadados(): string {
  return normalizar(process.env.PUBLIC_ORIGIN ?? "") ?? "http://localhost:3000";
}
