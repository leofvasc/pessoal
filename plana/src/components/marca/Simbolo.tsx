/**
 * Símbolo PlanA — módulo QR.
 * Manual de identidade visual, seção 03 (Símbolo) e 08 (Fundos permitidos).
 *
 * Construção fixa: malha 11u × 11u, módulo 3u, calha 1u, raio do módulo 1u.
 * Três módulos por linha (3 × 3u = 9u) mais duas calhas (2 × 1u) = 11u.
 *
 * Hierarquia de cor dos nove módulos — é uma das três coisas que nunca mudam:
 *   índices 6, 7, 8 (linha de base) → base sólida, violeta profundo
 *   índices 1, 3, 5               → diagonais, violeta primário, formam o "A"
 *   índices 0, 2, 4               → vazios, lilás. Nunca brancos.
 */

export const MALHA = 11;
export const MODULO = 3;
export const CALHA = 1;
export const RAIO = 1;
/** Seção 05: área de respiro equivale a um módulo (3u) em todos os lados. */
export const RESPIRO = 3;

/** Papel de cada um dos nove módulos na malha, em ordem row-major. */
export const PAPEIS = [
  "vazio",
  "diagonal",
  "vazio",
  "diagonal",
  "vazio",
  "diagonal",
  "base",
  "base",
  "base",
] as const;

export type Papel = (typeof PAPEIS)[number];

/**
 * Fundos permitidos (seção 08). Cada variante define a cor dos três papéis.
 * `principal` e `tinta` estão escritas no manual; `negativo` e `mono` derivam
 * dele preservando a hierarquia base > diagonais > vazios.
 */
export const VARIANTES = {
  /** Branco e off-white — versão principal. */
  principal: { base: "#3D22B8", diagonal: "#6B4CF6", vazio: "#EAE5FF" },
  /**
   * Violeta chapado — versão em negativo, como na miniatura oficial do manual:
   * base e diagonais em branco cheio, vazios a 40%. Sobre violeta o lilás e o
   * branco ficam próximos demais em claridade e o "A" deixa de ler.
   */
  negativo: { base: "#FFFFFF", diagonal: "#FFFFFF", vazio: "rgba(255,255,255,0.40)" },
  /** Tinta — diagonais em violeta claro 8E72FF (escrito no manual). */
  tinta: { base: "#FFFFFF", diagonal: "#8E72FF", vazio: "#EAE5FF" },
  /** Monocromia branca — gravação, bordado, uma cor. Vazios a 30% da mesma tinta. */
  mono: { base: "#FFFFFF", diagonal: "#FFFFFF", vazio: "rgba(255,255,255,0.30)" },
  /** Monocromia em tinta, para uma cor sobre papel claro. */
  monoTinta: { base: "#191632", diagonal: "#191632", vazio: "rgba(25,22,50,0.30)" },
} as const;

export type Variante = keyof typeof VARIANTES;

/** Posição em unidades (u) do canto superior esquerdo de cada módulo. */
export function posicaoModulo(indice: number) {
  const coluna = indice % 3;
  const linha = Math.floor(indice / 3);
  return {
    x: coluna * (MODULO + CALHA),
    y: linha * (MODULO + CALHA),
  };
}

type Props = {
  /** Lado do símbolo em px. Reduções mínimas: 44 px em tela e papel (seção 05). */
  tamanho?: number;
  variante?: Variante;
  /**
   * Seção 17: no favicon de 16 px ficam apenas a base sólida e as duas
   * diagonais, sem os módulos vazios.
   */
  semVazios?: boolean;
  /** Inclui a área de respiro de 3u no viewBox, para encostar em outros elementos. */
  comRespiro?: boolean;
  title?: string;
  className?: string;
};

export function Simbolo({
  tamanho = 44,
  variante = "principal",
  semVazios = false,
  comRespiro = false,
  title,
  className,
}: Props) {
  const cores = VARIANTES[variante];
  const margem = comRespiro ? RESPIRO : 0;
  const lado = MALHA + margem * 2;
  const escala = tamanho / MALHA;

  return (
    <svg
      viewBox={`0 0 ${lado} ${lado}`}
      width={tamanho + margem * 2 * escala}
      height={tamanho + margem * 2 * escala}
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      shapeRendering="geometricPrecision"
    >
      {title ? <title>{title}</title> : null}
      {PAPEIS.map((papel, i) => {
        if (semVazios && papel === "vazio") return null;
        const { x, y } = posicaoModulo(i);
        return (
          <rect
            key={i}
            x={x + margem}
            y={y + margem}
            width={MODULO}
            height={MODULO}
            rx={RAIO}
            fill={cores[papel]}
          />
        );
      })}
    </svg>
  );
}

/**
 * Símbolo dentro da ficha violeta oficial (seção 06 e 17).
 * A ficha é a única forma em que o símbolo pode ser encaixado; garante a área
 * de contraste quando a marca precisa ficar abaixo de 30 px / 8 mm.
 */
export function SimboloFicha({
  tamanho = 64,
  raio,
  semVazios = false,
  className,
  title,
}: {
  tamanho?: number;
  raio?: number;
  semVazios?: boolean;
  className?: string;
  title?: string;
}) {
  // Seção 17: o símbolo ocupa 76% da área segura do ícone.
  const interno = Math.round(tamanho * 0.76);
  return (
    <span
      className={`ficha-violeta inline-flex items-center justify-center ${className ?? ""}`}
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: raio ?? Math.round(tamanho * 0.22),
      }}
    >
      <Simbolo tamanho={interno} variante="negativo" semVazios={semVazios} title={title} />
    </span>
  );
}
