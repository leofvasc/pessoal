"use client";

import { useState, useTransition } from "react";
import {
  cancelarEvento,
  despublicarEvento,
  excluirEvento,
  publicarEvento,
} from "@/app/acoes-evento";
import { Aviso, Botao } from "@/components/ui";

type Resultado = { erro?: string } | void;

export function AcoesDoEvento({
  eventoId,
  publicado,
  cancelado,
}: {
  eventoId: string;
  publicado: boolean;
  cancelado: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function executar(acao: () => Promise<Resultado>) {
    setErro(null);
    iniciar(async () => {
      const resultado = await acao();
      if (resultado && "erro" in resultado && resultado.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {!cancelado && !publicado ? (
        <Botao onClick={() => executar(() => publicarEvento(eventoId))} disabled={pendente}>
          {pendente ? "Publicando…" : "Publicar"}
        </Botao>
      ) : null}
      {!cancelado && publicado ? (
        <Botao
          tom="secundario"
          onClick={() => executar(() => despublicarEvento(eventoId))}
          disabled={pendente}
        >
          {pendente ? "Salvando…" : "Despublicar"}
        </Botao>
      ) : null}
      {!cancelado ? (
        <Botao
          tom="secundario"
          onClick={() => {
            if (window.confirm("Cancelar o evento e avisar todos os inscritos?")) {
              executar(() => cancelarEvento(eventoId));
            }
          }}
          disabled={pendente}
        >
          Cancelar evento
        </Botao>
      ) : null}
      <Botao
        tom="perigo"
        onClick={() => {
          if (
            window.confirm(
              "Excluir este evento do painel? O histórico será preservado, mas o evento deixará de ficar acessível.",
            )
          ) {
            executar(() => excluirEvento(eventoId));
          }
        }}
        disabled={pendente}
      >
        Excluir
      </Botao>
    </div>
  );
}
