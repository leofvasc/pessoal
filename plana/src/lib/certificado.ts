import "server-only";

/**
 * Geração do certificado em PDF.
 *
 * Planejamento, seção 6: o certificado é gerado sob demanda, no momento da
 * solicitação. O que fica armazenado é apenas a lista de eventos para os quais
 * o participante já está apto a emitir — nunca o arquivo, para não consumir o
 * armazenamento contratado da VPS.
 *
 * Manual de identidade visual, seção 15: o certificado é gerado sobre a
 * imagem-base definida no cadastro do evento — A4 paisagem, apenas frente. A
 * PlanA não redesenha essa imagem: ela insere o bloco de validação no rodapé,
 * sempre na mesma posição. A marca aparece apenas nesse bloco.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { dataLongaAcre, formatarCargaHoraria } from "./fuso";

/** A4 paisagem em pontos. */
const LARGURA = 841.89;
const ALTURA = 595.28;

const TINTA = rgb(0x19 / 255, 0x16 / 255, 0x32 / 255);
const TEXTO_2 = rgb(0x6e / 255, 0x69 / 255, 0x90 / 255);
const LINHA = rgb(0xe1 / 255, 0xde / 255, 0xee / 255);

/** Tracking das etiquetas em caixa alta, em em (seção 07: de 0,16 a 0,22). */
const TRACKING_ETIQUETA = 0.18;

const DIR_FONTES = path.join(process.cwd(), "src", "assets", "fontes");

async function carregarFonte(doc: PDFDocument, arquivo: string): Promise<PDFFont> {
  return doc.embedFont(await readFile(path.join(DIR_FONTES, arquivo)), { subset: true });
}

/**
 * Desenha texto com tracking (espaçamento entre letras).
 * O pdf-lib não expõe o parâmetro Tc do PDF, então cada caractere é posicionado
 * individualmente. O manual (seção 07) exige tracking de 0,16 a 0,22 em nas
 * etiquetas em caixa alta, e é isso que distingue a voz técnica da marca de um
 * texto qualquer em monoespaçada.
 */
function larguraComTracking(
  texto: string,
  fonte: PDFFont,
  tamanho: number,
  tracking: number,
): number {
  if (texto.length === 0) return 0;
  return fonte.widthOfTextAtSize(texto, tamanho) + tracking * tamanho * (texto.length - 1);
}

function desenharComTracking(
  pagina: PDFPage,
  texto: string,
  opcoes: { x: number; y: number; size: number; font: PDFFont; color: RGB; tracking: number },
) {
  const { x, y, size, font, color, tracking } = opcoes;
  let cursor = x;
  for (const caractere of texto) {
    pagina.drawText(caractere, { x: cursor, y, size, font, color });
    cursor += font.widthOfTextAtSize(caractere, size) + tracking * size;
  }
}

export type DadosCertificado = {
  nomeParticipante: string;
  nomeEvento: string;
  inicioEm: Date;
  cargaHorariaMinutos: number;
  instituicoes: string[];
  codigoValidacao: string;
  /** Caminho no disco da imagem-base enviada no cadastro do evento, se houver. */
  caminhoImagemBase?: string | null;
  /** Origem pública da plataforma, p. ex. https://planaeventos.app */
  origem: string;
};

/** Quebra um texto no número de linhas que couber na largura dada. */
function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) > largura && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Reduz o corpo até o texto caber em uma linha, respeitando um piso. */
function tamanhoQueCabe(
  texto: string,
  fonte: PDFFont,
  largura: number,
  inicial: number,
  minimo: number,
): number {
  let tamanho = inicial;
  while (tamanho > minimo && fonte.widthOfTextAtSize(texto, tamanho) > largura) tamanho -= 1;
  return tamanho;
}

function centralizar(texto: string, fonte: PDFFont, tamanho: number): number {
  return (LARGURA - fonte.widthOfTextAtSize(texto, tamanho)) / 2;
}

export async function gerarCertificado(dados: DadosCertificado): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  doc.setTitle(`Certificado — ${dados.nomeEvento}`);
  doc.setAuthor("PlanA");
  doc.setCreator("PlanA — gestão de eventos");
  doc.setSubject(`Certificado de participação de ${dados.nomeParticipante}`);

  const pagina = doc.addPage([LARGURA, ALTURA]);

  let regular: PDFFont;
  let negrito: PDFFont;
  let extra: PDFFont;
  let mono: PDFFont;
  try {
    regular = await carregarFonte(doc, "PlusJakartaSans-Regular.ttf");
    negrito = await carregarFonte(doc, "PlusJakartaSans-Bold.ttf");
    extra = await carregarFonte(doc, "PlusJakartaSans-ExtraBold.ttf");
    mono = await carregarFonte(doc, "JetBrainsMono-Regular.ttf");
  } catch {
    // Seção 07 do manual: onde a Plus Jakarta Sans não estiver disponível,
    // usar Helvetica. Nunca uma serifada ou condensada.
    regular = await doc.embedFont(StandardFonts.Helvetica);
    negrito = await doc.embedFont(StandardFonts.HelveticaBold);
    extra = negrito;
    mono = await doc.embedFont(StandardFonts.Courier);
  }

  // ---- Imagem-base do evento -------------------------------------------
  // Pertence às organizadoras. É desenhada em sangria, sem recorte nem
  // reprocessamento: a PlanA não redesenha essa imagem.
  if (dados.caminhoImagemBase) {
    try {
      const bytes = await readFile(dados.caminhoImagemBase);
      const imagem: PDFImage = dados.caminhoImagemBase.toLowerCase().endsWith(".png")
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
      pagina.drawImage(imagem, { x: 0, y: 0, width: LARGURA, height: ALTURA });
    } catch {
      // Imagem ausente ou ilegível: o certificado sai sobre fundo branco em vez
      // de falhar. O participante não pode ficar sem o documento por causa de
      // um arquivo que a organização não enviou.
    }
  }

  // ---- Corpo do certificado --------------------------------------------
  const margem = 64;
  const larguraUtil = LARGURA - margem * 2;
  let y = ALTURA - 168;

  // Seção 07: etiquetas em caixa alta com tracking de 0,16 a 0,22 em.
  const rotulo = "CERTIFICADO DE PARTICIPAÇÃO";
  desenharComTracking(pagina, rotulo, {
    x: (LARGURA - larguraComTracking(rotulo, mono, 10, TRACKING_ETIQUETA)) / 2,
    y,
    size: 10,
    font: mono,
    color: TEXTO_2,
    tracking: TRACKING_ETIQUETA,
  });

  y -= 54;
  const corpoNome = tamanhoQueCabe(dados.nomeParticipante, extra, larguraUtil, 34, 18);
  pagina.drawText(dados.nomeParticipante, {
    x: centralizar(dados.nomeParticipante, extra, corpoNome),
    y,
    size: corpoNome,
    font: extra,
    color: TINTA,
  });

  y -= 40;
  const organizadoras =
    dados.instituicoes.length > 0
      ? ` promovido por ${dados.instituicoes.join(", ")},`
      : "";
  const texto =
    `participou do evento ${dados.nomeEvento},${organizadoras} ` +
    `realizado em ${dataLongaAcre(dados.inicioEm)} (horário do Acre), ` +
    `com carga horária de ${formatarCargaHoraria(dados.cargaHorariaMinutos)}.`;

  for (const linha of quebrar(texto, regular, 13, larguraUtil - 80)) {
    pagina.drawText(linha, {
      x: centralizar(linha, regular, 13),
      y,
      size: 13,
      font: regular,
      color: TINTA,
      lineHeight: 13 * 1.6,
    });
    y -= 13 * 1.6;
  }

  // ---- Bloco de validação ----------------------------------------------
  // Sempre na mesma posição do rodapé, qualquer que seja a imagem-base.
  await desenharBlocoValidacao(doc, pagina, { mono, regular, negrito }, dados, margem);

  return doc.save();
}

async function desenharBlocoValidacao(
  doc: PDFDocument,
  pagina: PDFPage,
  fontes: { mono: PDFFont; regular: PDFFont; negrito: PDFFont },
  dados: DadosCertificado,
  margem: number,
) {
  const base = 58;
  const alturaBloco = 76;
  const urlValidacao = `${dados.origem.replace(/\/$/, "")}/validar/${dados.codigoValidacao}`;

  pagina.drawLine({
    start: { x: margem, y: base + alturaBloco },
    end: { x: LARGURA - margem, y: base + alturaBloco },
    thickness: 0.75,
    color: LINHA,
  });

  desenharComTracking(pagina, "VALIDAÇÃO", {
    x: margem,
    y: base + alturaBloco - 22,
    size: 7,
    font: fontes.mono,
    color: TEXTO_2,
    tracking: TRACKING_ETIQUETA,
  });

  desenharComTracking(pagina, dados.codigoValidacao, {
    x: margem,
    y: base + alturaBloco - 42,
    size: 13,
    font: fontes.mono,
    color: TINTA,
    tracking: 0.04,
  });

  const nota =
    `Autenticidade verificável em ${dados.origem.replace(/^https?:\/\//, "")}/validar · ` +
    "presença registrada por leitura de QR Code com geolocalização.";
  for (const [i, linha] of quebrar(nota, fontes.regular, 8, LARGURA - margem * 2 - 200).entries()) {
    pagina.drawText(linha, {
      x: margem,
      y: base + alturaBloco - 60 - i * 11,
      size: 8,
      font: fontes.regular,
      color: TEXTO_2,
    });
  }

  // QR de verificação. Fundo transparente e módulos em tinta — nunca violeta.
  const qrBytes = await QRCode.toBuffer(urlValidacao, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#191632ff", light: "#00000000" },
  });
  const qr = await doc.embedPng(qrBytes);
  const ladoQr = 62;
  pagina.drawImage(qr, {
    x: LARGURA - margem - ladoQr,
    y: base + 4,
    width: ladoQr,
    height: ladoQr,
  });

  // Seção 10: a assinatura da plataforma vem sempre com o rótulo de função e
  // nunca em bloco igual ao das organizadoras.
  const assinaturaX = LARGURA - margem - ladoQr - 104;
  pagina.drawText("inscrições e certificados por", {
    x: assinaturaX,
    y: base + 38,
    size: 7,
    font: fontes.regular,
    color: TEXTO_2,
  });
  // Seção 04: o logotipo tem tracking de −3,8%.
  desenharComTracking(pagina, "PlanA", {
    x: assinaturaX,
    y: base + 20,
    size: 15,
    font: fontes.negrito,
    color: TINTA,
    tracking: -0.038,
  });
}
