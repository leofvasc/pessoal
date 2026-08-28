"use client";

import { useActionState } from "react";
import { entrar, type EstadoFormulario } from "@/app/acoes-conta";
import { Aviso, Botao, Campo, Entrada } from "@/components/ui";

const INICIAL: EstadoFormulario = {};

export function FormularioEntrada({ destino }: { destino?: string }) {
  const [estado, acao, pendente] = useActionState(entrar, INICIAL);

  return (
    <form action={acao} className="mt-8 space-y-4">
      {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}

      {/* Quem chega aqui a partir do QR Code de presença volta para lá depois
          de entrar, em vez de cair na conta e ter de ler o QR de novo. */}
      {destino ? <input type="hidden" name="destino" value={destino} /> : null}

      <Campo rotulo="E-mail" obrigatorio>
        <Entrada name="email" type="email" autoComplete="email" required />
      </Campo>

      <Campo rotulo="Senha" obrigatorio>
        <Entrada name="senha" type="password" autoComplete="current-password" required />
      </Campo>

      <Botao type="submit" className="w-full" disabled={pendente}>
        {pendente ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  );
}
