import "server-only";

/**
 * Limite de tentativas por origem.
 *
 * Existe por causa da página de registro de presença à distância: ali o
 * participante digita um código de oito caracteres, e sem limite alguém com o
 * link do evento poderia varrer o espaço de códigos até acertar o de outra
 * pessoa. Com o limite, a varredura deixa de ser viável muito antes de valer a
 * pena.
 *
 * A contagem é em memória, no processo. É o suficiente para esta plataforma,
 * que roda como um processo só numa VPS — e é honesto sobre isso: se um dia
 * houver mais de uma instância, cada uma contará por si, e o limite terá de
 * migrar para o Postgres ou para um Redis.
 */

type Janela = { tentativas: number; expiraEm: number };

const janelas = new Map<string, Janela>();

/** Remove janelas vencidas. Roda junto com as consultas, sem timer próprio. */
function limpar(agora: number) {
  if (janelas.size < 500) return;
  for (const [chave, janela] of janelas) {
    if (janela.expiraEm <= agora) janelas.delete(chave);
  }
}

export type ResultadoLimite =
  | { permitido: true; restantes: number }
  | { permitido: false; segundosParaLiberar: number };

export function registrarTentativa(
  chave: string,
  { maximo, janelaSegundos }: { maximo: number; janelaSegundos: number },
): ResultadoLimite {
  const agora = Date.now();
  limpar(agora);

  const atual = janelas.get(chave);

  if (!atual || atual.expiraEm <= agora) {
    janelas.set(chave, { tentativas: 1, expiraEm: agora + janelaSegundos * 1000 });
    return { permitido: true, restantes: maximo - 1 };
  }

  if (atual.tentativas >= maximo) {
    return {
      permitido: false,
      segundosParaLiberar: Math.ceil((atual.expiraEm - agora) / 1000),
    };
  }

  atual.tentativas += 1;
  return { permitido: true, restantes: maximo - atual.tentativas };
}

/** Zera a contagem — chamado quando a tentativa dá certo. */
export function liberar(chave: string) {
  janelas.delete(chave);
}
