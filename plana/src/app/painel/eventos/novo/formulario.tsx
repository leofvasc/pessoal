"use client";

import { useActionState, useState } from "react";
import dynamic from "next/dynamic";
import { criarEvento, type EstadoEvento } from "@/app/acoes-evento";
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
import { FUSO_BRASILIA, formatarEm, doAcreParaUtc } from "@/lib/fuso";

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

export function FormularioEvento() {
  const [estado, acao, pendente] = useActionState(criarEvento, INICIAL);
  const [modalidade, setModalidade] = useState<string>("PRESENCIAL");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  const temLocal = modalidade !== "ONLINE";
  const temTransmissao = modalidade !== "PRESENCIAL";

  return (
    <form action={acao} className="mt-8 max-w-2xl space-y-6">
      {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}

      <Cartao className="space-y-4">
        <Titulo nivel={3}>Identificação</Titulo>
        <Campo rotulo="Nome do evento" erro={estado.campos?.nome} obrigatorio>
          <Entrada name="nome" required />
        </Campo>
        <Campo rotulo="Descrição" erro={estado.campos?.descricao} obrigatorio>
          <AreaTexto name="descricao" required />
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
          dica="É o valor que sai impresso no certificado."
          erro={estado.campos?.cargaHorariaMinutos}
          obrigatorio
        >
          <Entrada name="cargaHorariaMinutos" type="number" min={15} step={15} defaultValue={240} required />
        </Campo>
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
              <Entrada name="localNome" />
            </Campo>
            <Campo rotulo="Endereço" erro={estado.campos?.localEndereco}>
              <Entrada name="localEndereco" />
            </Campo>
            <Campo
              rotulo="Ponto no mapa"
              dica="Marcado manualmente — é o que valida a presença dos participantes, com tolerância de 70 metros."
              erro={estado.campos?.latitude}
              obrigatorio
            >
              <MapaPino />
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
            <Entrada name="meioTransmissao" />
          </Campo>
        ) : null}
      </Cartao>

      <Cartao className="space-y-4">
        <Titulo nivel={3}>Palestrante</Titulo>
        <Campo rotulo="Nome" erro={estado.campos?.palestranteNome} obrigatorio>
          <Entrada name="palestranteNome" required />
        </Campo>
        <Campo rotulo="Qualificação" erro={estado.campos?.palestranteQualificacao} obrigatorio>
          <AreaTexto name="palestranteQualificacao" rows={3} required />
        </Campo>
        <Campo
          rotulo="Tutor virtual (opcional)"
          dica="Link de um tutor baseado em IA. Fica oculto para os participantes quando vazio."
          erro={estado.campos?.tutorVirtualUrl}
        >
          <Entrada name="tutorVirtualUrl" type="url" placeholder="https://" />
        </Campo>
      </Cartao>

      <Botao type="submit" disabled={pendente}>
        {pendente ? "Criando…" : "Criar evento"}
      </Botao>
    </form>
  );
}
