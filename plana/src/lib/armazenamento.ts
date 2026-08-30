import "server-only";

/**
 * Armazenamento dos arquivos enviados pelo gestor.
 *
 * Os arquivos ficam no disco da VPS, num volume próprio montado fora da imagem
 * da aplicação (`arquivos` no docker-compose), para sobreviverem ao próximo
 * deploy. Não vão para `public/`: material de apoio só pode ser baixado por
 * quem está inscrito no evento, e o que está em `public/` é servido a qualquer
 * um que descubra o endereço.
 *
 * Regras que valem para todo envio:
 *  - o tipo é apurado pelos bytes iniciais do arquivo, nunca pela extensão nem
 *    pelo `Content-Type` que o navegador declara — os dois são escolhidos por
 *    quem envia;
 *  - o nome original é guardado só como rótulo; o nome em disco é gerado aqui,
 *    o que remove qualquer possibilidade de travessia de caminho;
 *  - há limite de tamanho por categoria de uso.
 */
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";

/**
 * Raiz do armazenamento. No container é o volume montado em /app/arquivos.
 * A variável vazia conta como não definida: no `.env` é comum deixar a chave
 * com aspas vazias, e `??` sozinho aceitaria isso como caminho válido.
 */
export const RAIZ_ARQUIVOS =
  process.env.DIRETORIO_ARQUIVOS?.trim() || path.join(process.cwd(), "arquivos");

export const MB = 1024 * 1024;

/**
 * Categorias de envio. Cada uma diz o que aceita e até que tamanho — não há
 * "upload genérico", porque um limite único seria frouxo demais para um logo e
 * apertado demais para uma apostila.
 */
export const CATEGORIAS = {
  /** Imagem-base do certificado: A4 paisagem, usada como fundo do PDF. */
  imagemBase: {
    pasta: "certificados",
    limiteBytes: 10 * MB,
    tipos: ["image/png", "image/jpeg"],
    rotulo: "imagem PNG ou JPG de até 10 MB",
  },
  /** Logotipo de instituição organizadora. */
  logo: {
    pasta: "logos",
    limiteBytes: 4 * MB,
    tipos: ["image/png", "image/jpeg", "image/svg+xml"],
    rotulo: "imagem PNG, JPG ou SVG de até 4 MB",
  },
  /** Banner de divulgação do evento. */
  banner: {
    pasta: "banners",
    limiteBytes: 8 * MB,
    tipos: ["image/png", "image/jpeg", "image/webp"],
    rotulo: "imagem PNG, JPG ou WebP de até 8 MB",
  },
  /** Material de apoio baixado pelos inscritos. */
  material: {
    pasta: "materiais",
    limiteBytes: 50 * MB,
    tipos: [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "application/zip",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    rotulo: "PDF, imagem, ZIP ou documento do Office de até 50 MB",
  },
} as const;

export type Categoria = keyof typeof CATEGORIAS;

/**
 * Assinaturas de bytes iniciais. Reconhecer o tipo pelo conteúdo é o que
 * impede que um executável renomeado para `.pdf` entre no acervo.
 */
const ASSINATURAS: Array<{ tipo: string; bytes: number[]; deslocamento?: number }> = [
  { tipo: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { tipo: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { tipo: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { tipo: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], deslocamento: 8 }, // "WEBP" no RIFF
  { tipo: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK — também os do Office
];

/** Os formatos do Office e o ZIP compartilham o mesmo contêiner. */
const BASEADOS_EM_ZIP = new Set([
  "application/zip",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function combina(dados: Uint8Array, assinatura: (typeof ASSINATURAS)[number]): boolean {
  const inicio = assinatura.deslocamento ?? 0;
  if (dados.length < inicio + assinatura.bytes.length) return false;
  return assinatura.bytes.every((b, i) => dados[inicio + i] === b);
}

/** Tipo real do arquivo, ou null quando os bytes não correspondem a nada conhecido. */
export function tipoPelosBytes(dados: Uint8Array): string | null {
  for (const assinatura of ASSINATURAS) {
    if (combina(dados, assinatura)) return assinatura.tipo;
  }
  // SVG é texto: não tem assinatura binária. Reconhecido pela abertura da marcação.
  const inicio = new TextDecoder().decode(dados.slice(0, 512)).trimStart().toLowerCase();
  if (inicio.startsWith("<?xml") || inicio.startsWith("<svg")) {
    return inicio.includes("<svg") ? "image/svg+xml" : null;
  }
  return null;
}

export type ResultadoEnvio =
  | { ok: true; arquivoId: string }
  | { ok: false; erro: string };

const EXTENSOES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "application/zip": ".zip",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

export async function guardarArquivo(params: {
  arquivo: File;
  categoria: Categoria;
  enviadoPorId: string;
}): Promise<ResultadoEnvio> {
  const { arquivo, categoria, enviadoPorId } = params;
  const regras = CATEGORIAS[categoria];

  if (arquivo.size === 0) return { ok: false, erro: "O arquivo está vazio." };
  if (arquivo.size > regras.limiteBytes) {
    return {
      ok: false,
      erro: `Arquivo grande demais. O limite aqui é ${regras.rotulo}.`,
    };
  }

  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const tipoReal = tipoPelosBytes(dados);

  if (!tipoReal) {
    return { ok: false, erro: `Formato não reconhecido. Envie ${regras.rotulo}.` };
  }

  // Os formatos do Office são ZIP por dentro: os bytes só dizem "é um ZIP", e
  // qual deles é vem do tipo declarado — que aqui já está restrito à lista da
  // categoria, então o pior caso é um .docx rotulado como .xlsx.
  const aceitos = regras.tipos as readonly string[];
  const declarado = arquivo.type;
  const tipoFinal =
    tipoReal === "application/zip" &&
    BASEADOS_EM_ZIP.has(declarado) &&
    aceitos.includes(declarado)
      ? declarado
      : tipoReal;

  if (!aceitos.includes(tipoFinal)) {
    return { ok: false, erro: `Formato não aceito aqui. Envie ${regras.rotulo}.` };
  }

  // O nome em disco é gerado aqui: nada do que o usuário digitou vira caminho.
  const nomeEmDisco = `${randomUUID()}${EXTENSOES[tipoFinal] ?? ""}`;
  const caminhoRelativo = path.posix.join(regras.pasta, nomeEmDisco);
  const destino = path.join(RAIZ_ARQUIVOS, regras.pasta, nomeEmDisco);

  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, dados);

  const registro = await prisma.arquivo.create({
    data: {
      nomeOriginal: arquivo.name.slice(0, 200),
      tipoMime: tipoFinal,
      tamanhoBytes: arquivo.size,
      caminho: caminhoRelativo,
      enviadoPorId,
    },
    select: { id: true },
  });

  return { ok: true, arquivoId: registro.id };
}

/** Caminho absoluto de um arquivo guardado, para leitura pelo servidor. */
export function caminhoAbsoluto(caminhoRelativo: string): string {
  // O caminho vem do banco, gerado por `guardarArquivo`, mas a checagem fica
  // aqui de qualquer forma: é barata e fecha a única porta que sobraria.
  const destino = path.resolve(RAIZ_ARQUIVOS, caminhoRelativo);
  if (!destino.startsWith(path.resolve(RAIZ_ARQUIVOS) + path.sep)) {
    throw new Error("Caminho de arquivo fora do armazenamento.");
  }
  return destino;
}

export async function lerArquivo(caminhoRelativo: string): Promise<Buffer> {
  return readFile(caminhoAbsoluto(caminhoRelativo));
}

/** Remove o arquivo do disco e o registro do banco. */
export async function apagarArquivo(arquivoId: string): Promise<void> {
  const registro = await prisma.arquivo.findUnique({
    where: { id: arquivoId },
    select: { caminho: true },
  });
  if (!registro) return;

  await prisma.arquivo.delete({ where: { id: arquivoId } });
  // O registro sai primeiro: um arquivo órfão em disco é desperdício, uma
  // linha apontando para arquivo inexistente é erro na cara do usuário.
  await unlink(caminhoAbsoluto(registro.caminho)).catch(() => {});
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / MB).toFixed(1).replace(".", ",")} MB`;
}
