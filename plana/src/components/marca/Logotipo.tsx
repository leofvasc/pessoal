/**
 * Logotipo e lockups PlanA — Manual de identidade visual, seção 04.
 *
 * O logotipo é Plus Jakarta Sans ExtraBold, entrelinha 1, tracking −3,8%.
 * O "P" e o "A" são maiúsculos; nada mais — a grafia é sempre "PlanA".
 * A altura do símbolo iguala a altura de maiúscula do logotipo.
 *
 * Reduções mínimas (seção 05):
 *   símbolo isolado ......... 44 px
 *   lockup horizontal ....... 90 px de largura
 *   abaixo de 30 px ......... símbolo na ficha violeta
 */
import { Simbolo, type Variante } from "./Simbolo";

/** Altura de maiúscula da Plus Jakarta Sans, em em. Usada para casar símbolo e texto. */
const ALTURA_MAIUSCULA = 0.73;

/** Seção 09: alterar a distância entre símbolo e logotipo é uso proibido.
 *  Fixada em um módulo (3u) da malha de 11u do símbolo. */
const PROPORCAO_INTERVALO = 3 / 11;

type CorTexto = "tinta" | "branco" | "violeta";

const CORES_TEXTO: Record<CorTexto, string> = {
  tinta: "#191632",
  branco: "#FFFFFF",
  violeta: "#6B4CF6",
};

function Palavra({ altura, cor }: { altura: number; cor: CorTexto }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-jakarta), Helvetica, sans-serif",
        fontWeight: 800,
        fontSize: altura / ALTURA_MAIUSCULA,
        lineHeight: 1,
        letterSpacing: "-0.038em",
        color: CORES_TEXTO[cor],
        whiteSpace: "nowrap",
      }}
    >
      PlanA
    </span>
  );
}

type Props = {
  /** Altura do símbolo em px — define toda a escala do lockup. */
  altura?: number;
  variante?: Variante;
  corTexto?: CorTexto;
  /**
   * Seção 04: o descritor acompanha o logotipo apenas em materiais de primeiro
   * contato. Dentro do produto o lockup vai sem descritor.
   */
  descritor?: boolean;
  className?: string;
};

/** Lockup horizontal — uso padrão. */
export function Logotipo({
  altura = 28,
  variante = "principal",
  corTexto = "tinta",
  descritor = false,
  className,
}: Props) {
  const intervalo = altura * PROPORCAO_INTERVALO;
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: intervalo }}
      role="img"
      aria-label={descritor ? "PlanA — gestão de eventos" : "PlanA"}
    >
      <Simbolo tamanho={altura} variante={variante} />
      <span style={{ display: "flex", flexDirection: "column", gap: altura * 0.14 }}>
        <Palavra altura={altura} cor={corTexto} />
        {descritor ? (
          <span
            className="etiqueta descritor"
            style={{
              fontSize: Math.max(8, altura * 0.26),
              letterSpacing: "0.18em",
              color: corTexto === "branco" ? "rgba(255,255,255,0.72)" : "#6E6990",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            gestão de eventos
          </span>
        ) : null}
      </span>
    </span>
  );
}

/** Lockup vertical — peças estreitas. */
export function LogotipoVertical({
  altura = 40,
  variante = "principal",
  corTexto = "tinta",
  descritor = false,
  className,
}: Props) {
  const intervalo = altura * PROPORCAO_INTERVALO;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: intervalo,
      }}
      role="img"
      aria-label="PlanA"
    >
      <Simbolo tamanho={altura} variante={variante} />
      <Palavra altura={altura * 0.62} cor={corTexto} />
      {descritor ? (
        <span
          className="etiqueta descritor"
          style={{
            fontSize: Math.max(8, altura * 0.18),
            color: corTexto === "branco" ? "rgba(255,255,255,0.72)" : "#6E6990",
            whiteSpace: "nowrap",
          }}
        >
          gestão de eventos
        </span>
      ) : null}
    </span>
  );
}

/**
 * Assinatura de rodapé para peças de evento — seção 10 (Convivência).
 * Em peça de evento quem lidera visualmente é a instituição organizadora; a
 * PlanA assina como plataforma, sempre com o rótulo de função e nunca em bloco
 * igual ao das organizadoras.
 */
export function AssinaturaPlataforma({
  altura = 20,
  corTexto = "tinta",
  className,
}: {
  altura?: number;
  corTexto?: CorTexto;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <span
        aria-hidden
        style={{
          width: 1,
          height: altura * 1.6,
          background: corTexto === "branco" ? "rgba(255,255,255,0.28)" : "#E1DEEE",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-jakarta), Helvetica, sans-serif",
          fontSize: Math.max(9, altura * 0.42),
          lineHeight: 1.25,
          color: corTexto === "branco" ? "rgba(255,255,255,0.72)" : "#6E6990",
        }}
      >
        inscrições e
        <br />
        certificados por
      </span>
      <Logotipo altura={altura} corTexto={corTexto} />
    </span>
  );
}
