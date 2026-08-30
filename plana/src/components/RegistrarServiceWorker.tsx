"use client";

import { useEffect } from "react";

/**
 * Registra o service worker.
 *
 * Planejamento, seção 10.1: a plataforma é um PWA instalável — manifesto mais
 * service worker. Sem o registro, o navegador não oferece a instalação, e sem
 * instalação o iPhone não entrega notificação push nenhuma (seção 8.2).
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registro) => registro.update())
      .catch(() => {
        // Falha no registro degrada o push e a instalação, mas não impede usar a
        // plataforma pelo navegador. Não vale interromper o usuário por isso.
      });
  }, []);
  return null;
}
