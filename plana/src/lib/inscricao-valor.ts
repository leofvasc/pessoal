/**
 * Gratuidade da inscrição.
 *
 * A PlanA não trabalha com inscrição paga: não há campo de valor no cadastro
 * do evento, não há cobrança e não há registro de pagamento. Toda inscrição na
 * plataforma é gratuita, e é por isso que o rótulo abaixo é constante e não
 * coluna no banco — guardar um campo que só pode ter um valor é guardar dado
 * sem finalidade.
 *
 * O rótulo continua existindo, e aparecendo em cada evento da agenda pública,
 * porque dizer é diferente de não cobrar: quem chega na página precisa saber
 * de pronto que não vai pagar. Silêncio, aqui, é o que gera a dúvida.
 */

export const ROTULO_GRATUITO = "Gratuito";

/** Texto curto da etiqueta na vitrine, na página do evento e no relatório. */
export function rotuloDeGratuidade(): string {
  return ROTULO_GRATUITO;
}
