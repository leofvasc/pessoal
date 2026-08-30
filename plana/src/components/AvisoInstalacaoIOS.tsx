"use client";

/**
 * Onboarding de instalação para iOS.
 *
 * Planejamento, seção 8.2: no iPhone e no iPad o Safari só entrega push para
 * aplicações instaladas na tela de início, a partir do iOS 16.4 — uma aba
 * aberta normalmente no navegador, mesmo com a permissão concedida, não recebe
 * notificação alguma. Por isso o fluxo orienta explicitamente esses usuários a
 * instalar; e por isso a central de notificações interna continua sendo o canal
 * de referência para quem não instalar.
 */
import { useState } from "react";
import { useInstaladoNaTelaDeInicio } from "@/hooks/consultaDeMidia";

const CHAVE_DISPENSA = "plana:aviso-instalacao-ios";

/**
 * iPadOS recente se apresenta como Macintosh; o suporte a toque é o que o
 * distingue de um Mac de verdade.
 */
export function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function jaDispensou(): boolean {
  try {
    return localStorage.getItem(CHAVE_DISPENSA) === "1";
  } catch {
    // Navegação privada pode recusar o acesso ao armazenamento. Nesse caso o
    // aviso reaparece, o que é melhor do que sumir.
    return false;
  }
}

export function AvisoInstalacaoIOS() {
  const instalado = useInstaladoNaTelaDeInicio();
  // O estado inicial é uma função: roda uma vez, na primeira renderização do
  // cliente, sem provocar a renderização em cascata de um efeito.
  const [dispensado, setDispensado] = useState(jaDispensou);

  if (instalado || dispensado || !ehIOS()) return null;

  function dispensar() {
    try {
      localStorage.setItem(CHAVE_DISPENSA, "1");
    } catch {
      // Sem armazenamento, o aviso volta na próxima visita.
    }
    setDispensado(true);
  }

  return (
    <div className="mt-6 rounded-2xl border border-linha bg-lilas/50 p-5">
      <p className="text-sm font-semibold text-tinta">Instale a PlanA na tela de início</p>
      <p className="mt-2 text-sm text-texto-2">
        No iPhone e no iPad, os avisos do evento — presença registrada, certificado disponível — só
        chegam se a PlanA estiver instalada. Toque em{" "}
        <span className="font-semibold text-tinta">Compartilhar</span> e depois em{" "}
        <span className="font-semibold text-tinta">Adicionar à Tela de Início</span>.
      </p>
      <p className="mt-2 text-xs text-texto-2">
        Sem instalar você continua usando tudo normalmente — só precisa abrir a central de
        notificações para ver os avisos.
      </p>
      <button onClick={dispensar} className="mt-3 text-xs font-semibold text-violeta">
        Já entendi
      </button>
    </div>
  );
}
