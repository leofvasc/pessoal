"use client";

import { useActionState, useTransition } from "react";
import {
  alterarStatusChamado,
  responderChamadoComoOrganizador,
  type EstadoChamado,
} from "@/app/acoes-chamados";
import { AreaTexto, Aviso, Botao, Campo } from "@/components/ui";

const INICIAL: EstadoChamado = {};

export function ControlesChamado({
  chamadoId,
  status,
}: {
  chamadoId: string;
  status: "ABERTO" | "EM_ANDAMENTO" | "RESOLVIDO";
}) {
  const responder = responderChamadoComoOrganizador.bind(null, chamadoId);
  const [estado, acao, enviando] = useActionState(responder, INICIAL);
  const [alterando, iniciar] = useTransition();

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap gap-2">
        {status !== "EM_ANDAMENTO" ? (
          <Botao tom="secundario" disabled={alterando} onClick={() => iniciar(async () => { await alterarStatusChamado(chamadoId, "EM_ANDAMENTO"); })}>
            Marcar em andamento
          </Botao>
        ) : null}
        {status !== "RESOLVIDO" ? (
          <Botao tom="secundario" disabled={alterando} onClick={() => iniciar(async () => { await alterarStatusChamado(chamadoId, "RESOLVIDO"); })}>
            Marcar resolvido
          </Botao>
        ) : (
          <Botao tom="secundario" disabled={alterando} onClick={() => iniciar(async () => { await alterarStatusChamado(chamadoId, "ABERTO"); })}>
            Reabrir
          </Botao>
        )}
      </div>
      <form action={acao} className="space-y-3">
        {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
        <Campo rotulo="Responder ao participante">
          <AreaTexto name="mensagem" rows={5} maxLength={5000} required />
        </Campo>
        <Botao type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar resposta"}</Botao>
      </form>
    </div>
  );
}
