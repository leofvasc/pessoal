"use client";

import { useActionState } from "react";
import { redefinirSenha, type EstadoRedefinicao } from "@/app/acoes-redefinicao-senha";
import { Aviso, Botao, Campo, Entrada } from "@/components/ui";

const INICIAL: EstadoRedefinicao = {};

export function FormularioNovaSenha({ token }: { token: string }) {
  const acaoServidor = redefinirSenha.bind(null, token);
  const [estado, acao, pendente] = useActionState(acaoServidor, INICIAL);
  return (
    <form action={acao} className="mt-8 space-y-4">
      {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      <Campo rotulo="Nova senha" dica="Use ao menos 10 caracteres." erro={estado.campos?.novaSenha} obrigatorio>
        <Entrada name="novaSenha" type="password" autoComplete="new-password" minLength={10} required />
      </Campo>
      <Campo rotulo="Confirmar nova senha" erro={estado.campos?.confirmarSenha} obrigatorio>
        <Entrada name="confirmarSenha" type="password" autoComplete="new-password" minLength={10} required />
      </Campo>
      <Botao type="submit" className="w-full" disabled={pendente}>
        {pendente ? "Salvando…" : "Criar nova senha"}
      </Botao>
    </form>
  );
}
