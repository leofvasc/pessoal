import "server-only";

/**
 * Geração dos QR Codes do evento (planejamento, seção 7).
 *
 * São dois QRs diferentes, com finalidades que não se misturam:
 *
 *  - o **QR de presença**, projetado no ambiente, carrega o token secreto do
 *    evento. É ele que o participante lê para registrar presença;
 *  - o **QR de divulgação**, gerado a partir do link curto, entra em peça
 *    gráfica. Ler esse não registra presença nenhuma.
 *
 * Ambos saem com fundo transparente, como pede o planejamento.
 *
 * Manual de identidade visual, seção 15: nunca colorir os módulos do QR em
 * violeta — correção de erro e contraste vêm primeiro. Os módulos saem na cor
 * tinta, que é a mais escura da paleta.
 */
import QRCode from "qrcode";

/** Cor tinta da paleta. Não trocar por violeta: contraste vem primeiro. */
const COR_MODULOS = "#191632ff";
const FUNDO_TRANSPARENTE = "#00000000";

/**
 * Nível H (30% de recuperação). O QR de presença é projetado e lido a vários
 * metros, muitas vezes com reflexo na tela — sobra de correção de erro é o que
 * mantém a leitura possível.
 */
const CORRECAO = "H" as const;

export function urlDePresenca(base: string, tokenQr: string): string {
  return `${base.replace(/\/$/, "")}/presenca/${tokenQr}`;
}

/** Página de registro de presença à distância, para evento online ou híbrido. */
export function urlPresencaRemota(base: string, tokenRemoto: string): string {
  return `${base.replace(/\/$/, "")}/presenca-remota/${tokenRemoto}`;
}

export function urlCurta(base: string, codigoCurto: string): string {
  return `${base.replace(/\/$/, "")}/e/${codigoCurto}`;
}

export function urlLonga(base: string, slug: string): string {
  return `${base.replace(/\/$/, "")}/eventos/${slug}`;
}

type Opcoes = {
  /** Lado da imagem em px. Para projeção, use pelo menos 1024. */
  tamanho?: number;
  /**
   * Margem em módulos do próprio QR. O manual pede margem de silêncio de
   * quatro módulos na projeção; o padrão da especificação é 4.
   */
  margem?: number;
};

/** QR em SVG — o formato certo para peça gráfica e para projeção. */
export async function qrSvg(conteudo: string, { margem = 4 }: Opcoes = {}): Promise<string> {
  return QRCode.toString(conteudo, {
    type: "svg",
    errorCorrectionLevel: CORRECAO,
    margin: margem,
    color: { dark: COR_MODULOS, light: FUNDO_TRANSPARENTE },
  });
}

/** QR em PNG com canal alfa, como data URL — para uso direto em <img>. */
export async function qrPngDataUrl(
  conteudo: string,
  { tamanho = 1024, margem = 4 }: Opcoes = {},
): Promise<string> {
  return QRCode.toDataURL(conteudo, {
    errorCorrectionLevel: CORRECAO,
    margin: margem,
    width: tamanho,
    color: { dark: COR_MODULOS, light: FUNDO_TRANSPARENTE },
  });
}

/** QR em PNG como bytes, para download do arquivo pelo organizador. */
export async function qrPngBytes(
  conteudo: string,
  { tamanho = 1024, margem = 4 }: Opcoes = {},
): Promise<Buffer> {
  return QRCode.toBuffer(conteudo, {
    errorCorrectionLevel: CORRECAO,
    margin: margem,
    width: tamanho,
    color: { dark: COR_MODULOS, light: FUNDO_TRANSPARENTE },
  });
}
