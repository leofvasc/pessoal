/**
 * Códigos legíveis da plataforma.
 * O manual (seção 07) reserva a JetBrains Mono para dados: códigos de evento,
 * códigos de validação de certificado, horários com fuso e carga horária. Os
 * formatos abaixo são os que aparecem nas peças — crachá, certificado e pasta.
 */
import { customAlphabet } from "nanoid";

/**
 * Alfabeto sem os caracteres que se confundem quando alguém digita um código
 * lido de um crachá impresso ou de um certificado: 0/O, 1/I/L, 2/Z, 5/S, 8/B.
 */
const ALFABETO_LEGIVEL = "ACDEFGHJKMNPQRTUVWXY34679";

const sufixo = customAlphabet(ALFABETO_LEGIVEL, 6);
const sufixoCurto = customAlphabet(ALFABETO_LEGIVEL, 7);
const grupoDeQuatro = customAlphabet(ALFABETO_LEGIVEL, 4);
const segredo = customAlphabet(
  "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  32,
);

/**
 * USR-XXXX-XXXX — código pessoal do participante.
 *
 * É o que ele digita na página de registro de presença à distância, em evento
 * online ou híbrido. Vem em dois grupos de quatro porque é lido da tela de um
 * aparelho e digitado noutro: agrupar reduz o erro de transcrição, e o
 * alfabeto legível remove os caracteres que se confundem.
 *
 * São 25^8 ≈ 1,5 × 10^11 combinações. Sozinho isso não bastaria como segredo;
 * o que sustenta a segurança do registro remoto é a soma de três coisas — o
 * link da página é secreto por evento, só registra presença de quem já está
 * inscrito, e há limite de tentativas por origem.
 */
export function codigoUsuario(): string {
  return `USR-${grupoDeQuatro()}-${grupoDeQuatro()}`;
}

/** EVT-2026-0184 — o formato usado no verso do crachá. */
export function codigoEvento(ano: number, sequencial: number): string {
  return `EVT-${ano}-${String(sequencial).padStart(4, "0")}`;
}

/** CERT-2026-0184-7F3AD9 — o formato do bloco de validação do certificado. */
export function codigoValidacao(codigoDoEvento: string): string {
  const nucleo = codigoDoEvento.replace(/^EVT-/, "");
  return `CERT-${nucleo}-${sufixo()}`;
}

/** Trecho do link curto de divulgação: planaeventos.app/e/XXXXXXX */
export function codigoCurto(): string {
  return sufixoCurto();
}

/**
 * Segredo embutido no QR Code projetado no ambiente. Não deriva do slug nem do
 * código do evento: quem conhece o endereço público do evento não pode, por
 * isso, registrar presença sem estar na sala vendo a projeção.
 */
export function tokenQr(): string {
  return segredo();
}

/**
 * Segredo da página de registro de presença à distância, para evento online ou
 * híbrido. É gerado separado do `tokenQr` porque circula de outro jeito: o link
 * remoto vai por e-mail para os participantes a distância, enquanto o QR fica
 * projetado só na sala. Se um vazar, o outro continua valendo.
 */
export function tokenRemoto(): string {
  return segredo();
}

/** Normaliza o código digitado: caixa alta, sem espaços, com os hífens no lugar. */
export function normalizarCodigoUsuario(digitado: string): string {
  const limpo = digitado.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const semPrefixo = limpo.startsWith("USR") ? limpo.slice(3) : limpo;
  if (semPrefixo.length !== 8) return `USR-${semPrefixo}`;
  return `USR-${semPrefixo.slice(0, 4)}-${semPrefixo.slice(4)}`;
}

/** Transforma o nome do evento em slug de URL. */
export function paraSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}
