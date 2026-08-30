"use client";

/**
 * Loop de check-in — animação oficial da marca.
 * Manual de identidade visual, seção 11 (Movimento).
 *
 * Os módulos entram da base para o topo e resolvem no símbolo: é o mesmo
 * movimento do registro de presença. Antes de aparecer, cada módulo já existe
 * como marcação reduzida — a malha nunca some, ela se preenche.
 *
 * Onde usar: splash do PWA (um ciclo, depois estabiliza), leitura do QR Code
 * (loop contínuo enquanto a câmera busca) e emissão do certificado (indicador
 * de progresso, no lugar de qualquer spinner genérico).
 */
import { useEffect, useState } from "react";
import { MALHA, MODULO, RAIO, PAPEIS, VARIANTES, posicaoModulo, type Variante } from "./Simbolo";
import { useMovimentoReduzido } from "@/hooks/consultaDeMidia";

/** Especificação de movimento — valores fixos do manual. */
export const PASSO_MS = 260;
export const CICLO_PASSOS = 12;
export const TRANSICAO_OPACIDADE_MS = 240;
export const TRANSICAO_ESCALA_MS = 320;
export const CURVA_ESCALA = "cubic-bezier(.2,.9,.3,1.2)";
export const REPOUSO_ALPHA = 0.12;
export const REPOUSO_ESCALA = 0.55;
/** Acessibilidade: sob prefers-reduced-motion, fade único de 200 ms. */
export const FADE_REDUZIDO_MS = 200;

/**
 * Ordem de entrada fixa: primeiro a base, da esquerda para a direita; depois as
 * diagonais, de baixo para cima alternando os lados; por último os vazios, que
 * assentam a leitura de código. É ela que dá o ritmo reconhecível.
 */
export const ORDEM_ENTRADA = [6, 7, 8, 3, 5, 1, 0, 2, 4] as const;

const RANQUE: Record<number, number> = {};
ORDEM_ENTRADA.forEach((indice, ranque) => {
  RANQUE[indice] = ranque;
});

type Props = {
  tamanho?: number;
  variante?: Variante;
  /** `continuo` repete indefinidamente; `umCiclo` roda uma vez e estabiliza. */
  modo?: "continuo" | "umCiclo";
  /** Pulsa a base uma vez em verde de sucesso — usado ao validar a presença. */
  confirmado?: boolean;
  rotulo?: string;
  className?: string;
};

export function LoopCheckin({
  tamanho = 96,
  variante = "principal",
  modo = "continuo",
  confirmado = false,
  rotulo = "Registrando presença",
  className,
}: Props) {
  const reduzido = useMovimentoReduzido();
  const [passo, setPasso] = useState(0);

  // Parado — por movimento reduzido ou porque a presença já foi confirmada — o
  // símbolo aparece completo. É estado derivado, não algo a escrever no estado
  // de dentro de um efeito.
  const parado = reduzido || confirmado;
  const passoExibido = parado ? CICLO_PASSOS - 1 : passo;

  useEffect(() => {
    if (parado) return;

    const id = setInterval(() => {
      setPasso((atual) => {
        const proximo = atual + 1;
        if (proximo < CICLO_PASSOS) return proximo;
        if (modo === "umCiclo") {
          clearInterval(id);
          return CICLO_PASSOS - 1;
        }
        return 0;
      });
    }, PASSO_MS);

    return () => clearInterval(id);
  }, [parado, modo]);

  const cores = VARIANTES[variante];

  return (
    <svg
      viewBox={`0 0 ${MALHA} ${MALHA}`}
      width={tamanho}
      height={tamanho}
      className={className}
      role="img"
      aria-label={rotulo}
      style={{ overflow: "visible" }}
    >
      {PAPEIS.map((papel, i) => {
        const ativo = passoExibido > RANQUE[i];
        const { x, y } = posicaoModulo(i);
        const cor = confirmado && papel === "base" ? "#1F9D6E" : cores[papel];
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={MODULO}
            height={MODULO}
            rx={RAIO}
            fill={cor}
            style={{
              opacity: ativo ? 1 : REPOUSO_ALPHA,
              // fill-box faz a escala partir do centro do próprio módulo,
              // independentemente do viewBox.
              transformBox: "fill-box",
              transformOrigin: "center",
              transform: ativo ? "scale(1)" : `scale(${REPOUSO_ESCALA})`,
              transition: reduzido
                ? `opacity ${FADE_REDUZIDO_MS}ms ease`
                : `opacity ${TRANSICAO_OPACIDADE_MS}ms ease, transform ${TRANSICAO_ESCALA_MS}ms ${CURVA_ESCALA}`,
            }}
          />
        );
      })}
    </svg>
  );
}
