"use client";

import { useMemo, useState } from "react";
import { Campo, Cartao, Entrada, Selecao, Titulo } from "@/components/ui";

type EventoListado = {
  id: string;
  nome: string;
  codigo: string;
  inicioEm: string;
  organizador: string;
};

/**
 * Monta a query da rota de download.
 *
 * Os filtros vivem no cliente porque são só recorte de consulta — quem decide
 * o que a pessoa pode ver é o servidor, e nenhum parâmetro daqui amplia
 * alcance. Um organizador que edite a URL continua recebendo apenas os
 * próprios eventos.
 */
export function EmissorDeRelatorio({
  master,
  eventos,
  organizadores,
}: {
  master: boolean;
  eventos: EventoListado[];
  organizadores: Array<{ id: string; nome: string }>;
}) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [organizador, setOrganizador] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [cancelados, setCancelados] = useState(false);
  const [rascunhos, setRascunhos] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return eventos.filter((evento) => {
      if (organizador && evento.organizador && master) {
        const alvo = organizadores.find((o) => o.id === organizador)?.nome;
        if (alvo && evento.organizador !== alvo) return false;
      }
      if (!termo) return true;
      return `${evento.nome} ${evento.codigo} ${evento.organizador}`.toLowerCase().includes(termo);
    });
  }, [eventos, busca, organizador, organizadores, master]);

  const endereco = useMemo(() => {
    const parametros = new URLSearchParams();
    if (de) parametros.set("de", de);
    if (ate) parametros.set("ate", ate);
    if (organizador) parametros.set("organizador", organizador);
    if (modalidade) parametros.set("modalidade", modalidade);
    if (cancelados) parametros.set("cancelados", "1");
    if (rascunhos) parametros.set("rascunhos", "1");
    for (const id of selecionados) parametros.append("evento", id);
    const consulta = parametros.toString();
    return `/painel/relatorios/planilha${consulta ? `?${consulta}` : ""}`;
  }, [de, ate, organizador, modalidade, cancelados, rascunhos, selecionados]);

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  return (
    <div className="mt-8 space-y-6">
      <Cartao className="space-y-4">
        <Titulo nivel={3}>Recorte</Titulo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="De" dica="Data de início do evento, horário do Acre.">
            <Entrada type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </Campo>
          <Campo rotulo="Até">
            <Entrada type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </Campo>
        </div>

        {master ? (
          <Campo rotulo="Organizador" dica="Vazio inclui todos.">
            <Selecao value={organizador} onChange={(e) => setOrganizador(e.target.value)}>
              <option value="">Todos os organizadores</option>
              {organizadores.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.nome}
                </option>
              ))}
            </Selecao>
          </Campo>
        ) : null}

        <Campo rotulo="Modalidade">
          <Selecao value={modalidade} onChange={(e) => setModalidade(e.target.value)}>
            <option value="">Todas</option>
            <option value="PRESENCIAL">Presencial</option>
            <option value="ONLINE">Online</option>
            <option value="HIBRIDO">Híbrido</option>
          </Selecao>
        </Campo>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={cancelados}
            onChange={(e) => setCancelados(e.target.checked)}
            className="size-4 accent-violeta"
          />
          <span className="text-sm text-tinta">Incluir eventos cancelados</span>
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={rascunhos}
            onChange={(e) => setRascunhos(e.target.checked)}
            className="size-4 accent-violeta"
          />
          <span className="text-sm text-tinta">Incluir rascunhos não publicados</span>
        </label>
      </Cartao>

      <Cartao className="space-y-4">
        <Titulo nivel={3}>Seleção manual de eventos</Titulo>
        <p className="text-xs text-texto-2">
          Opcional. Marcando eventos aqui, o relatório passa a considerar apenas eles, e os filtros
          de período e modalidade ainda se aplicam sobre essa seleção. Sem nada marcado, valem só os
          filtros.
        </p>

        <Entrada
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, código ou organizador"
        />

        <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-linha p-2">
          {visiveis.length === 0 ? (
            <p className="px-2 py-3 text-sm text-texto-2">Nenhum evento no filtro.</p>
          ) : (
            visiveis.map((evento) => (
              <label
                key={evento.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-superficie"
              >
                <input
                  type="checkbox"
                  checked={selecionados.has(evento.id)}
                  onChange={() => alternar(evento.id)}
                  className="mt-0.5 size-4 accent-violeta"
                />
                <span className="min-w-0">
                  <span className="quebra-texto block text-sm font-semibold text-tinta">
                    {evento.nome}
                  </span>
                  <span className="block text-xs text-texto-2">
                    {evento.codigo} ·{" "}
                    {new Date(evento.inicioEm).toLocaleDateString("pt-BR", {
                      timeZone: "America/Rio_Branco",
                    })}
                    {master ? ` · ${evento.organizador}` : ""}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>

        {selecionados.size > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-texto-2">{selecionados.size} evento(s) selecionado(s)</span>
            <button
              type="button"
              onClick={() => setSelecionados(new Set())}
              className="text-sm font-semibold text-violeta hover:text-profundo"
            >
              Limpar seleção
            </button>
          </div>
        ) : null}
      </Cartao>

      <div className="flex flex-wrap items-center gap-4">
        {/* Âncora simples, e não Link: a rota devolve um arquivo, e a
            navegação do cliente não sabe o que fazer com um anexo. */}
        <a
          href={endereco}
          className="inline-flex items-center justify-center rounded-xl bg-violeta px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-profundo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
        >
          Baixar planilha consolidada
        </a>
        <span className="text-xs text-texto-2">
          Abas de eventos, resumo{master ? " e consolidado por organizador" : ""}.
        </span>
      </div>
    </div>
  );
}
