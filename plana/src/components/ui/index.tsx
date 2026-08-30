/**
 * Primitivas de interface.
 * Todas as cores e tamanhos saem dos tokens de globals.css — nenhum valor
 * hexadecimal solto aqui. Manual, seção 07: alinhamento sempre à esquerda,
 * sem justificar; corpo de texto em 400 com entrelinha 1,6.
 */
import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

type Tom = "primario" | "secundario" | "discreto" | "perigo";

const TONS: Record<Tom, string> = {
  primario: "bg-violeta text-white hover:bg-profundo",
  secundario: "bg-white text-tinta border border-linha hover:border-violeta",
  discreto: "bg-transparent text-texto-2 hover:text-violeta",
  perigo: "bg-erro text-white hover:brightness-95",
};

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 py-3 text-sm font-semibold " +
  "transition-colors disabled:opacity-50 disabled:pointer-events-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta";

export function Botao({
  tom = "primario",
  className = "",
  ...props
}: ComponentProps<"button"> & { tom?: Tom }) {
  return <button className={`${BASE} ${TONS[tom]} ${className}`} {...props} />;
}

export function BotaoLink({
  tom = "primario",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { tom?: Tom }) {
  return <Link className={`${BASE} ${TONS[tom]} ${className}`} {...props} />;
}

export function Cartao({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border border-linha bg-white p-6 ${className}`}>
      {children}
    </div>
  );
}

/** Etiqueta técnica em JetBrains Mono — códigos, horários com fuso, rótulos. */
export function Etiqueta({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`etiqueta text-texto-2 ${className}`}>{children}</span>;
}

/** Dado técnico em mono, sem caixa alta forçada — códigos de evento e validação. */
export function Dado({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-sm tracking-tight ${className}`}>{children}</span>;
}

export function Campo({
  rotulo,
  dica,
  erro,
  children,
  obrigatorio,
}: {
  rotulo: string;
  dica?: string;
  erro?: string;
  children: ReactNode;
  obrigatorio?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-tinta">
        {rotulo}
        {obrigatorio ? <span className="text-erro"> *</span> : null}
      </span>
      {dica ? <span className="mt-1 block text-xs text-texto-2">{dica}</span> : null}
      <div className="mt-2">{children}</div>
      {erro ? <span className="mt-1 block text-xs text-erro">{erro}</span> : null}
    </label>
  );
}

const CONTROLE =
  "w-full rounded-xl border border-linha bg-white px-4 py-3 text-sm text-tinta " +
  "placeholder:text-texto-2/60 focus:border-violeta focus:outline-2 focus:outline-offset-0 " +
  "focus:outline-violeta/30";

export function Entrada({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${CONTROLE} ${className}`} {...props} />;
}

export function AreaTexto({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${CONTROLE} ${className}`} rows={4} {...props} />;
}

export function Selecao({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${CONTROLE} ${className}`} {...props} />;
}

type TomAviso = "informacao" | "sucesso" | "erro";

const AVISOS: Record<TomAviso, string> = {
  informacao: "border-linha bg-lilas/40 text-tinta",
  sucesso: "border-sucesso/30 bg-sucesso/10 text-tinta",
  erro: "border-erro/30 bg-erro/10 text-tinta",
};

export function Aviso({
  tom = "informacao",
  titulo,
  children,
}: {
  tom?: TomAviso;
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${AVISOS[tom]}`} role="status">
      {titulo ? <p className="font-semibold">{titulo}</p> : null}
      <div className={titulo ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

export function Titulo({
  children,
  nivel = 1,
  className = "",
}: {
  children: ReactNode;
  nivel?: 1 | 2 | 3;
  className?: string;
}) {
  const tamanhos = {
    1: "text-3xl sm:text-4xl font-extrabold tracking-[-0.03em]",
    2: "text-2xl font-bold tracking-[-0.02em]",
    3: "text-lg font-bold tracking-[-0.01em]",
  } as const;
  const Tag = (`h${nivel}` as const) satisfies keyof React.JSX.IntrinsicElements;
  return <Tag className={`${tamanhos[nivel]} text-tinta ${className}`}>{children}</Tag>;
}
