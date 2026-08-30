"use client";

import { useActionState, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { criarEvento, editarEvento, type EstadoEvento } from "@/app/acoes-evento";
import {
  Aviso,
  AreaTexto,
  Botao,
  Campo,
  Cartao,
  Entrada,
  Etiqueta,
  Selecao,
  Titulo,
} from "@/components/ui";
import {
  FUSO_BRASILIA,
  formatarCargaHoraria,
  formatarEm,
  doAcreParaUtc,
} from "@/lib/fuso";
import { formatarValor } from "@/lib/inscricao-valor";

// O mapa só existe no cliente: o Leaflet toca em `window` ao ser importado.
const MapaPino = dynamic(() => import("@/components/MapaPino").then((m) => m.MapaPino), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-xl bg-linha" />,
});

const INICIAL: EstadoEvento = {};

const MODALIDADES = [
  { valor: "PRESENCIAL", rotulo: "Presencial" },
  { valor: "ONLINE", rotulo: "Online" },
  { valor: "HIBRIDO", rotulo: "Híbrido" },
] as const;

/**
 * Converte para o fuso de Brasília, devolvendo null enquanto o campo ainda
 * tem uma data incompleta — o `datetime-local` emite valores parciais durante
 * a digitação.
 */
function emBrasilia(valorLocal: string): string | null {
  if (!valorLocal) return null;
  try {
    return formatarEm(doAcreParaUtc(valorLocal), FUSO_BRASILIA, "dd/MM 'às' HH'h'mm");
  } catch {
    return null;
  }
}

/**
 * Duração corrida entre início e término, em minutos.
 *
 * Serve apenas de sugestão para a carga horária: as duas raramente coincidem em
 * evento com intervalo, almoço ou dias parciais, e é a carga horária — não a
 * duração — que sai impressa no certificado.
 */
function duracaoEmMinutos(inicioLocal: string, fimLocal: string): number | null {
  if (!inicioLocal || !fimLocal) return null;
  try {
    const minutos = Math.round(
      (doAcreParaUtc(fimLocal).getTime() - doAcreParaUtc(inicioLocal).getTime()) / 60000,
    );
    return minutos > 0 ? minutos : null;
  } catch {
    return null;
  }
}

/** Espelho do horário de Brasília, calculado enquanto o organizador digita. */
function EspelhoBrasilia({ valorLocal }: { valorLocal: string }) {
  const horario = emBrasilia(valorLocal);
  if (!horario) return null;

  return (
    <span className="mt-1 block text-xs text-texto-2">
      <Etiqueta>brasília</Etiqueta> <span className="font-mono">{horario}</span>
    </span>
  );
}

export type DadosIniciaisEvento = {
  id: string;
  nome: string;
  descricao: string;
  modalidade: "PRESENCIAL" | "ONLINE" | "HIBRIDO";
  inicioLocal: string;
  fimLocal: string;
  localNome: string;
  localEndereco: string;
  meioTransmissao: string;
  latitude: number | null;
  longitude: number | null;
  cargaHorariaMinutos: number;
  gratuito: boolean;
  valorReais: string;
  instrucoesPagamento: string;
  tutorVirtualUrl: string;
  palestrantes: Array<{
    nome: string;
    qualificacao: string;
  }>;
};

type PalestranteFormulario = {
  chave: string;
  nome: string;
  qualificacao: string;
};

export function FormularioEvento({ evento }: { evento?: DadosIniciaisEvento }) {
  const acaoServidor = evento ? editarEvento.bind(null, evento.id) : criarEvento;
  const [estado, acao, pendente] = useActionState(acaoServidor, INICIAL);
  const [modalidade, setModalidade] = useState<string>(evento?.modalidade ?? "PRESENCIAL");
  const [inicio, setInicio] = useState(evento?.inicioLocal ?? "");
  const [fim, setFim] = useState(evento?.fimLocal ?? "");
  const [cargaHoraria, setCargaHoraria] = useState(
    String(evento?.cargaHorariaMinutos ?? 240),
  );
  // Evento novo nasce gratuito: é a regra da casa, e o padrão deve ser o caso
  // comum, não o excepcional.
  const [gratuidade, setGratuidade] = useState<"GRATUITO" | "PAGO">(
    evento && !evento.gratuito ? "PAGO" : "GRATUITO",
  );
  const [valorReais, setValorReais] = useState(evento?.valorReais ?? "");
  const proximaChave = useRef(evento?.palestrantes.length ?? 1);
  const [palestrantes, setPalestrantes] = useState<PalestranteFormulario[]>(
    evento?.palestrantes.length
      ? evento.palestrantes.map((palestrante, indice) => ({
          chave: `existente-${indice}`,
          ...palestrante,
        }))
      : [{ chave: "novo-0", nome: "", qualificacao: "" }],
  );

  const duracao = duracaoEmMinutos(inicio, fim);
  const cargaEmMinutos = Number(cargaHoraria);
  const cargaValida = Number.isFinite(cargaEmMinutos) && cargaEmMinutos >= 15;

  const temLocal = modalidade !== "ONLINE";
  const temTransmissao = modalidade !== "PRESENCIAL";
  const pago = gratuidade === "PAGO";
  const valorEmCentavos = Math.round(Number(valorReais.replace(",", ".")) * 100);
  const valorValido = Number.isFinite(valorEmCentavos) && valorEmCentavos > 0;

  function alterarPalestrante(
    indice: number,
    campo: "nome" | "qualificacao",
    valor: string,
  ) {
    setPalestrantes((atuais) =>
      atuais.map((palestrante, posicao) =>
        posicao === indice ? { ...palestrante, [campo]: valor } : palestrante,
      ),
    );
  }

  function adicionarPalestrante() {
    if (palestrantes.length >= 20) return;
    const chave = `novo-${proximaChave.current++}`;
    setPalestrantes((atuais) => [...atuais, { chave, nome: "", qualificacao: "" }]);
  }

  function removerPalestrante(indice: number) {
    setPalestrantes((atuais) => atuais.filter((_, posicao) => posicao !== indice));
  }

  return (
    <form action={acao} className="mt-8 max-w-2xl space-y-6">
      {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}

      <Cartao className="space-y-4">
        <Titulo nivel={3}>Identificação</Titulo>
        <Campo rotulo="Nome do evento" erro={estado.campos?.nome} obrigatorio>
          <Entrada name="nome" defaultValue={evento?.nome} required />
        </Campo>
        <Campo rotulo="Descrição" erro={estado.campos?.descricao} obrigatorio>
          <AreaTexto name="descricao" defaultValue={evento?.descricao} required />
        </Campo>
      </Cartao>

      <Cartao className="space-y-4">
        <Titulo nivel={3}>Data e horário</Titulo>
        <p className="text-xs text-texto-2">
          Digite no horário do Acre. O horário de Brasília aparece abaixo de cada campo.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Campo rotulo="Início (Acre)" erro={estado.campos?.inicioLocal} obrigatorio>
              <Entrada
                name="inicioLocal"
                type="datetime-local"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                required
              />
            </Campo>
            <EspelhoBrasilia valorLocal={inicio} />
          </div>
          <div>
            <Campo rotulo="Término (Acre)" erro={estado.campos?.fimLocal} obrigatorio>
              <Entrada
                name="fimLocal"
                type="datetime-local"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                required
              />
            </Campo>
            <EspelhoBrasilia valorLocal={fim} />
          </div>
        </div>
        <Campo
          rotulo="Carga horária (minutos)"
          dica="É o valor que sai impresso no certificado — e não precisa coincidir com a duração corrida do evento, que inclui intervalos."
          erro={estado.campos?.cargaHorariaMinutos}
          obrigatorio
        >
          <Entrada
            name="cargaHorariaMinutos"
            type="number"
            min={15}
            step={15}
            value={cargaHoraria}
            onChange={(e) => setCargaHoraria(e.target.value)}
            required
          />
        </Campo>
        <p className="-mt-2 text-xs text-texto-2">
          {cargaValida ? (
            <>
              No certificado: <span className="font-mono">{formatarCargaHoraria(cargaEmMinutos)}</span>.{" "}
            </>
          ) : null}
          {duracao !== null ? (
            <>
              Entre início e término há{" "}
              <span className="font-mono">{formatarCargaHoraria(duracao)}</span>.{" "}
              {duracao !== cargaEmMinutos ? (
                <button
                  type="button"
                  onClick={() => setCargaHoraria(String(duracao))}
                  className="font-semibold text-violeta hover:underline"
                >
                  Usar esse valor
                </button>
              ) : null}
            </>
          ) : null}
        </p>
      </Cartao>

      <Cartao className="space-y-4">
        <Titulo nivel={3}>Inscrição</Titulo>
        <p className="text-xs text-texto-2">
          A PlanA não processa pagamento. O que se define aqui é a informação que o participante lê
          antes de se inscrever — e o evento gratuito passa a dizer isso de forma expressa na
          página e na vitrine.
        </p>
        <Campo rotulo="Tipo de inscrição" obrigatorio>
          <Selecao
            name="gratuidade"
            value={gratuidade}
            onChange={(e) => setGratuidade(e.target.value === "PAGO" ? "PAGO" : "GRATUITO")}
          >
            <option value="GRATUITO">Gratuita</option>
            <option value="PAGO">Paga</option>
          </Selecao>
        </Campo>

        {pago ? (
          <>
            <Campo
              rotulo="Valor da inscrição (R$)"
              dica="Somente informativo: a cobrança acontece fora da plataforma."
              erro={estado.campos?.valorReais}
              obrigatorio
            >
              <Entrada
                name="valorReais"
                inputMode="decimal"
                value={valorReais}
                onChange={(e) => setValorReais(e.target.value)}
                placeholder="0,00"
                required
              />
            </Campo>
            {valorValido ? (
              <p className="-mt-2 text-xs text-texto-2">
                Na página do evento: <span className="font-mono">{formatarValor(valorEmCentavos)}</span>.
              </p>
            ) : null}
            <Campo
              rotulo="Como pagar"
              dica="Sem essa informação o participante não tem como concluir o pagamento, já que ele ocorre fora da PlanA."
              erro={estado.campos?.instrucoesPagamento}
              obrigatorio
            >
              <AreaTexto
                name="instrucoesPagamento"
                rows={4}
                maxLength={2000}
                defaultValue={evento?.instrucoesPagamento}
                required
              />
            </Campo>
          </>
        ) : null}
      </Cartao>

      <Cartao className="space-y-4">
        <Titulo nivel={3}>Modalidade e local</Titulo>
        <Campo rotulo="Modalidade" obrigatorio>
          <Selecao
            name="modalidade"
            value={modalidade}
            onChange={(e) => setModalidade(e.target.value)}
          >
            {MODALIDADES.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.rotulo}
              </option>
            ))}
          </Selecao>
        </Campo>

        {temLocal ? (
          <>
            <Campo rotulo="Nome do local" erro={estado.campos?.localNome} obrigatorio>
              <Entrada name="localNome" defaultValue={evento?.localNome} />
            </Campo>
            <Campo rotulo="Endereço" erro={estado.campos?.localEndereco}>
              <Entrada name="localEndereco" defaultValue={evento?.localEndereco} />
            </Campo>
            <Campo
              rotulo="Ponto no mapa"
              dica="Marcado manualmente — é o que valida a presença dos participantes, com tolerância de 70 metros."
              erro={estado.campos?.latitude}
              obrigatorio
            >
              <MapaPino
                latitudeInicial={evento?.latitude}
                longitudeInicial={evento?.longitude}
              />
            </Campo>
          </>
        ) : null}

        {temTransmissao ? (
          <Campo
            rotulo="Meio de transmissão"
            dica="Plataforma e link de acesso."
            erro={estado.campos?.meioTransmissao}
            obrigatorio
          >
            <Entrada name="meioTransmissao" defaultValue={evento?.meioTransmissao} />
          </Campo>
        ) : null}
      </Cartao>

      <Cartao className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Titulo nivel={3}>Palestrantes</Titulo>
            <p className="mt-1 text-xs text-texto-2">Inclua as pessoas na ordem de exibição.</p>
          </div>
          <Botao
            type="button"
            tom="secundario"
            onClick={adicionarPalestrante}
            disabled={palestrantes.length >= 20}
          >
            Adicionar palestrante
          </Botao>
        </div>
        {estado.campos?.palestrantes ? (
          <Aviso tom="erro">{estado.campos.palestrantes}</Aviso>
        ) : null}
        <div className="space-y-4">
          {palestrantes.map((palestrante, indice) => (
            <div key={palestrante.chave} className="rounded-xl border border-linha bg-superficie p-4">
              <div className="flex items-center justify-between gap-3">
                <Etiqueta>palestrante {indice + 1}</Etiqueta>
                {palestrantes.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removerPalestrante(indice)}
                    className="text-xs font-semibold text-erro hover:underline"
                  >
                    Remover
                  </button>
                ) : null}
              </div>
              <div className="mt-4 space-y-4">
                <Campo
                  rotulo="Nome"
                  erro={estado.campos?.[`palestranteNome.${indice}`]}
                  obrigatorio
                >
                  <Entrada
                    name="palestranteNome"
                    value={palestrante.nome}
                    onChange={(e) => alterarPalestrante(indice, "nome", e.target.value)}
                    required
                  />
                </Campo>
                <Campo
                  rotulo="Qualificação"
                  erro={estado.campos?.[`palestranteQualificacao.${indice}`]}
                  obrigatorio
                >
                  <AreaTexto
                    name="palestranteQualificacao"
                    rows={3}
                    value={palestrante.qualificacao}
                    onChange={(e) => alterarPalestrante(indice, "qualificacao", e.target.value)}
                    required
                  />
                </Campo>
              </div>
            </div>
          ))}
        </div>
        <Campo
          rotulo="Tutor virtual (opcional)"
          dica="Link de um tutor baseado em IA. Fica oculto para os participantes quando vazio."
          erro={estado.campos?.tutorVirtualUrl}
        >
          <Entrada
            name="tutorVirtualUrl"
            type="url"
            placeholder="https://"
            defaultValue={evento?.tutorVirtualUrl}
          />
        </Campo>
      </Cartao>

      <Botao type="submit" disabled={pendente}>
        {pendente ? "Salvando…" : evento ? "Salvar alterações" : "Criar evento"}
      </Botao>
    </form>
  );
}
