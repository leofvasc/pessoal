"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Simbolo } from "@/components/marca/Simbolo";

export type EventoDaVitrine = {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  data: string;
  horario: string;
  modalidade: "Presencial" | "Online" | "Híbrido";
  local: string | null;
  bannerArquivoId: string | null;
  organizadoras: string[];
  palestrantes: string[];
  /** Etiqueta de gratuidade. Toda inscrição na PlanA é gratuita. */
  inscricao: string;
  /** Todas as modalidades do evento estão lotadas. */
  esgotado: boolean;
  estado: "ABERTO" | "ENCERRADO" | "CANCELADO";
};

type Filtro = "TODOS" | "ABERTOS" | "ENCERRADOS";

const FILTROS: Array<{ valor: Filtro; rotulo: string }> = [
  { valor: "TODOS", rotulo: "Todos" },
  { valor: "ABERTOS", rotulo: "Inscrições abertas" },
  { valor: "ENCERRADOS", rotulo: "Encerrados" },
];

const ROTULOS_ESTADO = {
  ABERTO: "inscrições abertas",
  ENCERRADO: "encerrado",
  CANCELADO: "cancelado",
} as const;

export function VitrineEventos({ eventos }: { eventos: EventoDaVitrine[] }) {
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return eventos.filter((evento) => {
      // Evento lotado não entra em "inscrições abertas" — não há o que abrir —
      // nem em "encerrados", que é o histórico. Ele aparece em "todos", com a
      // etiqueta de esgotado, que é o que descreve a situação dele.
      const passaFiltro =
        filtro === "TODOS" ||
        (filtro === "ABERTOS" && evento.estado === "ABERTO" && !evento.esgotado) ||
        (filtro === "ENCERRADOS" && evento.estado !== "ABERTO");
      if (!passaFiltro) return false;
      if (!termo) return true;
      const texto = [
        evento.nome,
        evento.descricao,
        evento.modalidade,
        evento.inscricao,
        evento.local ?? "",
        ...evento.organizadoras,
        ...evento.palestrantes,
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return texto.includes(termo);
    });
  }, [busca, eventos, filtro]);

  return (
    <>
      <div className="mt-7 rounded-2xl border border-linha bg-white p-3 shadow-sm shadow-profundo/5">
        <label className="block">
          <span className="sr-only">Buscar eventos</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por evento, palestrante ou instituição"
            className="w-full rounded-xl bg-superficie px-4 py-3 text-sm text-tinta outline-none ring-violeta/30 placeholder:text-texto-2/70 focus:ring-2"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Filtrar eventos">
          {FILTROS.map((item) => {
            const ativo = filtro === item.valor;
            return (
              <button
                key={item.valor}
                type="button"
                onClick={() => setFiltro(item.valor)}
                aria-pressed={ativo}
                className={
                  ativo
                    ? "rounded-full bg-violeta px-4 py-2 text-xs font-semibold text-white"
                    : "rounded-full border border-linha px-4 py-2 text-xs font-semibold text-texto-2 hover:border-violeta hover:text-violeta"
                }
              >
                {item.rotulo}
              </button>
            );
          })}
        </div>
      </div>

      {visiveis.length > 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visiveis.map((evento) => (
            <Link
              key={evento.id}
              href={`/eventos/${evento.slug}`}
              className="group overflow-hidden rounded-2xl border border-linha bg-white shadow-sm shadow-profundo/5 transition hover:-translate-y-1 hover:border-violeta/40 hover:shadow-lg hover:shadow-profundo/10"
            >
              <div className="relative aspect-[1200/630] overflow-hidden bg-lilas">
                {evento.bannerArquivoId ? (
                  <Image
                    src={`/arquivos/${evento.bannerArquivoId}`}
                    alt={`Banner de ${evento.nome}`}
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="padrao-modulos flex h-full items-center justify-center">
                    <Simbolo tamanho={70} variante="negativo" />
                  </div>
                )}
                <span
                  className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] shadow-sm ${
                    evento.estado === "ABERTO"
                      ? evento.esgotado
                        ? "bg-white text-erro"
                        : "bg-white text-sucesso"
                      : evento.estado === "CANCELADO"
                        ? "bg-erro text-white"
                        : "bg-tinta text-white"
                  }`}
                >
                  {evento.estado === "ABERTO" && evento.esgotado
                    ? "vagas esgotadas"
                    : ROTULOS_ESTADO[evento.estado]}
                </span>
              </div>

              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="etiqueta text-violeta">{evento.modalidade}</span>
                  {/* Gratuidade dita em cada cartão: quem varre a agenda
                      precisa saber, sem abrir o evento, que não vai pagar. */}
                  <span className="rounded-full bg-sucesso/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-sucesso">
                    {evento.inscricao}
                  </span>
                  {evento.organizadoras[0] ? (
                    <span className="truncate text-xs text-texto-2">{evento.organizadoras[0]}</span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-lg font-bold leading-snug tracking-[-0.02em] text-tinta group-hover:text-profundo">
                  {evento.nome}
                </h3>
                <p className="mt-3 text-sm font-semibold text-tinta">{evento.data}</p>
                <p className="mt-1 font-mono text-xs text-texto-2">{evento.horario}</p>
                {evento.local ? (
                  <p className="mt-3 line-clamp-1 text-xs text-texto-2">{evento.local}</p>
                ) : null}
                {evento.palestrantes.length > 0 ? (
                  <p className="mt-4 line-clamp-2 border-t border-linha pt-4 text-xs text-texto-2">
                    Com {evento.palestrantes.join(", ")}
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-linha bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-tinta">Nenhum evento encontrado.</p>
          <p className="mt-1 text-xs text-texto-2">Tente outro termo ou altere o filtro.</p>
        </div>
      )}
    </>
  );
}
