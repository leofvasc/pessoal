/**
 * Fusos horários da plataforma.
 * Planejamento, seção 3: o fuso do Acre é a referência principal; a plataforma
 * calcula automaticamente o horário correspondente em Brasília, sem conversão
 * manual pelo organizador.
 *
 * Todo instante é persistido em UTC. Estas funções só cuidam da apresentação e
 * da leitura de campos de formulário digitados em horário do Acre.
 */
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

export const FUSO_ACRE = "America/Rio_Branco";
export const FUSO_BRASILIA = "America/Sao_Paulo";

/** Converte um valor de `<input type="datetime-local">` (horário do Acre) em UTC. */
export function doAcreParaUtc(valorLocal: string): Date {
  return fromZonedTime(valorLocal, FUSO_ACRE);
}

/** Formata um instante UTC no valor esperado por `<input type="datetime-local">`. */
export function paraCampoAcre(instante: Date): string {
  return formatInTimeZone(instante, FUSO_ACRE, "yyyy-MM-dd'T'HH:mm");
}

export function formatarEm(instante: Date, fuso: string, formato: string): string {
  return formatInTimeZone(instante, fuso, formato, { locale: ptBR });
}

/** "14 de setembro de 2026, 14h00" no fuso do Acre. */
export function dataLongaAcre(instante: Date): string {
  return formatarEm(instante, FUSO_ACRE, "d 'de' MMMM 'de' yyyy', às' HH'h'mm");
}

/** "14 SET" — usado em crachá e cartões de evento. */
export function dataCurtaAcre(instante: Date): string {
  return formatarEm(instante, FUSO_ACRE, "dd MMM").toUpperCase();
}

/**
 * Par de horários para exibição lado a lado.
 * O manual manda escrever dados em JetBrains Mono caixa alta — daí o formato
 * "ACRE 14H00 · BRASÍLIA 16H00".
 */
export function horariosNosDoisFusos(instante: Date) {
  return {
    acre: formatarEm(instante, FUSO_ACRE, "HH'h'mm"),
    brasilia: formatarEm(instante, FUSO_BRASILIA, "HH'h'mm"),
  };
}

export function etiquetaDoisFusos(instante: Date): string {
  const { acre, brasilia } = horariosNosDoisFusos(instante);
  return `ACRE ${acre.toUpperCase()} · BRASÍLIA ${brasilia.toUpperCase()}`;
}

/**
 * Diferença em horas entre os dois fusos no instante dado. Calculada, e não
 * fixada em 2, porque o horário de verão pode ser reintroduzido em Brasília e
 * o Acre não o adota.
 */
export function diferencaHoras(instante: Date): number {
  const emAcre = toZonedTime(instante, FUSO_ACRE);
  const emBrasilia = toZonedTime(instante, FUSO_BRASILIA);
  return Math.round((emBrasilia.getTime() - emAcre.getTime()) / 3_600_000);
}

/** Carga horária em minutos formatada como "4h30" ou "3h". */
export function formatarCargaHoraria(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}
