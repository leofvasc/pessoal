/**
 * Frase que o titular digita para confirmar a exclusão da conta.
 *
 * Fica num módulo isomórfico — sem `server-only` — porque o formulário precisa
 * mostrá-la e a ação do servidor precisa conferi-la. Duas cópias da mesma frase
 * acabariam divergindo, e a divergência apareceria como "frase incorreta" para
 * quem digitou exatamente o que a tela pediu.
 *
 * Digitar não é um obstáculo decorativo: é o que separa o clique distraído da
 * decisão, numa operação que não tem desfazer.
 */
export const FRASE_DE_CONFIRMACAO = "EXCLUIR MINHA CONTA";
