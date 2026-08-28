"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Lê uma media query de forma reativa.
 *
 * `useSyncExternalStore` é a ferramenta certa aqui: a media query é estado que
 * vive fora do React e pode mudar sozinha. Fazer isso com `useEffect` mais
 * `setState` provoca uma renderização em cascata a cada montagem — e é o que o
 * React desaconselha explicitamente.
 *
 * O terceiro argumento é o valor no servidor, onde não existe `matchMedia`.
 */
export function useConsultaDeMidia(consulta: string, padraoNoServidor = false): boolean {
  const assinar = useCallback(
    (aoMudar: () => void) => {
      const mq = window.matchMedia(consulta);
      mq.addEventListener("change", aoMudar);
      return () => mq.removeEventListener("change", aoMudar);
    },
    [consulta],
  );

  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(consulta).matches,
    () => padraoNoServidor,
  );
}

/**
 * Acessibilidade: sob `prefers-reduced-motion`, o loop de check-in não roda —
 * o símbolo aparece completo com um fade único (manual, seção 11).
 */
export function useMovimentoReduzido(): boolean {
  return useConsultaDeMidia("(prefers-reduced-motion: reduce)");
}

/** Verdadeiro quando a página foi aberta a partir da tela de início. */
export function useInstaladoNaTelaDeInicio(): boolean {
  const emJanelaPropria = useConsultaDeMidia("(display-mode: standalone)");
  return useSyncExternalStore(
    () => () => {},
    () =>
      emJanelaPropria ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
}
