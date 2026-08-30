/**
 * Apresentação do valor da inscrição.
 *
 * Módulo isomórfico de propósito: o mesmo texto tem de sair igual no formulário
 * do organizador, na vitrine, na página pública e no painel. Duas formatações
 * paralelas divergiriam justamente no caso que importa — o centavo.
 *
 * A PlanA não processa pagamento. O valor aqui é informação ao participante
 * antes da inscrição, não cobrança.
 */

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarValor(centavos: number): string {
  return MOEDA.format(centavos / 100);
}

/**
 * Rótulo curto para etiqueta e cartão da vitrine. O evento gratuito diz que é
 * gratuito de forma expressa: silêncio, aqui, é o que gera dúvida na inscrição.
 */
export function rotuloDeGratuidade(gratuito: boolean, valorCentavos: number | null): string {
  if (gratuito) return "Gratuito";
  return valorCentavos !== null ? formatarValor(valorCentavos) : "Pago";
}
