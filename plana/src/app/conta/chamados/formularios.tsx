"use client";

import { useActionState } from "react";
import {
  criarChamado,
  responderChamado,
  type EstadoChamado,
} from "@/app/acoes-chamados";
import { AreaTexto, Aviso, Botao, Campo, Entrada } from "@/components/ui";

const INICIAL: EstadoChamado = {};

export function FormularioNovoChamado() {
  const [estado, acao, pendente] = useActionState(criarChamado, INICIAL);
  return (
    <form action={acao} className="mt-6 space-y-4">
      {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      <Campo rotulo="Assunto" obrigatorio>
        <Entrada name="assunto" maxLength={160} required />
      </Campo>
      <Campo rotulo="Mensagem" obrigatorio>
        <AreaTexto name="mensagem" rows={6} maxLength={5000} required />
      </Campo>
      <Botao type="submit" disabled={pendente}>
        {pendente ? "Enviando…" : "Abrir chamado"}
      </Botao>
    </form>
  );
}

export function FormularioResposta({ chamadoId }: { chamadoId: string }) {
  const acaoServidor = responderChamado.bind(null, chamadoId);
  const [estado, acao, pendente] = useActionState(acaoServidor, INICIAL);
  return (
    <form action={acao} className="mt-6 space-y-3">
      {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      <Campo rotulo="Nova mensagem">
        <AreaTexto name="mensagem" rows={4} maxLength={5000} required />
      </Campo>
      <Botao type="submit" disabled={pendente}>
        {pendente ? "Enviando…" : "Enviar mensagem"}
      </Botao>
    </form>
  );
}
