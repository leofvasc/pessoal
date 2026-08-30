"use client";

import { useState } from "react";
import { Cartao, Etiqueta, Titulo } from "@/components/ui";

/**
 * Link da página de registro de presença à distância.
 *
 * É o endereço que a organização envia aos participantes online. Vale como
 * segredo do evento: quem o tem alcança o formulário — por isso o aviso.
 */
export function LinkPresencaRemota({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência: o endereço segue na tela.
    }
  }

  return (
    <Cartao>
      <Titulo nivel={3}>Presença a distância</Titulo>
      <p className="mt-2 text-sm text-texto-2">
        Envie este endereço aos participantes que vão assistir a distância. Nele, cada um digita o
        próprio código de usuário para registrar presença — não há QR Code para eles lerem.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <code className="min-w-0 flex-1 break-all rounded-xl border border-linha bg-superficie px-4 py-3 font-mono text-xs">
          {url}
        </code>
        <button
          onClick={copiar}
          className="rounded-xl bg-violeta px-4 py-3 text-sm font-semibold text-white hover:bg-profundo"
        >
          {copiado ? "Copiado" : "Copiar link"}
        </button>
      </div>

      <p className="mt-3 text-xs text-texto-2">
        <Etiqueta>atenção</Etiqueta> Este endereço é o segredo do evento: quem o receber chega ao
        formulário. Envie apenas aos inscritos — só eles conseguem registrar presença, mas evite
        publicá-lo em peça de divulgação.
      </p>
    </Cartao>
  );
}
