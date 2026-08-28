"use client";

import { useTransition } from "react";
import { publicarEvento } from "@/app/acoes-evento";
import { Botao } from "@/components/ui";

export function BotaoPublicar({ eventoId }: { eventoId: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Botao onClick={() => iniciar(() => publicarEvento(eventoId))} disabled={pendente}>
      {pendente ? "Publicando…" : "Publicar evento"}
    </Botao>
  );
}
