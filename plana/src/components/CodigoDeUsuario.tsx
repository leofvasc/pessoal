"use client";

/**
 * "Seu código de usuário" — exibido em destaque na área da conta.
 *
 * É o código que o participante digita na página de registro de presença à
 * distância, em evento online ou híbrido. Como ele quase sempre é lido na tela
 * de um aparelho e digitado noutro, o botão de copiar existe para o caso em que
 * os dois são o mesmo, e o código sai grande e agrupado para o caso em que não
 * são.
 */
import { useState } from "react";
import { Etiqueta } from "@/components/ui";

export function CodigoDeUsuario({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência — o código continua na tela
      // para ser digitado, que é o uso principal de qualquer forma.
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-linha bg-white p-5">
      <Etiqueta>seu código de usuário</Etiqueta>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <p className="font-mono text-2xl font-medium tracking-[0.08em] text-tinta">{codigo}</p>
        <button
          onClick={copiar}
          className="rounded-lg border border-linha px-3 py-1.5 text-xs font-semibold text-texto-2 hover:border-violeta hover:text-violeta"
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="mt-3 text-sm text-texto-2">
        Use este código para registrar presença nos eventos online e híbridos, na página de
        presença à distância que a organização enviar. Ele é só seu — não compartilhe.
      </p>
    </div>
  );
}
