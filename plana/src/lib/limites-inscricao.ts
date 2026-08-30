/**
 * Limites do formulário de inscrição.
 *
 * Módulo isomórfico de propósito: o número e a frase que o explica aparecem na
 * tela do organizador — que roda no navegador — e na validação do servidor.
 * Duas cópias divergiriam, e o organizador leria uma regra que a plataforma
 * não aplica.
 */

/**
 * Um campo personalizado por evento.
 *
 * Não é limitação técnica nem provisório: é decisão de projeto. Personalização
 * e coleta mínima puxam para lados opostos, e um campo é onde as duas coisas
 * se equilibram — o organizador consegue a pergunta que o evento dele exige, e
 * o participante não se depara com um questionário.
 */
export const LIMITE_DE_CAMPOS = 1;

export const LIMITE_DE_OPCOES = 30;

/** Frase única sobre o limite, para não divergir entre as telas. */
export const AVISO_LIMITE_DE_CAMPOS =
  "Um campo por evento, por decisão de projeto: é o ponto de equilíbrio entre a personalização de que o organizador precisa e o princípio da coleta mínima. Não é limitação técnica.";
