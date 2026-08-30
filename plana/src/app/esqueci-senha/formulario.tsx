"use client";

import { useActionState } from "react";
import Link from "next/link";
import { solicitarRedefinicaoSenha, type EstadoRedefinicao } from "@/app/acoes-redefinicao-senha";
import { Aviso, Botao, Campo, Entrada } from "@/components/ui";

const INICIAL: EstadoRedefinicao = {};

export function FormularioEsqueciSenha() {
  const [estado, acao, pendente] = useActionState(solicitarRedefinicaoSenha, INICIAL);
  return (
    <form action={acao} className="mt-8 space-y-4">
      {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tom="sucesso">{estado.ok}</Aviso> : null}
      <Campo rotulo="E-mail da conta" erro={estado.campos?.email} obrigatorio>
        <Entrada name="email" type="email" autoComplete="email" required />
      </Campo>
      <Botao type="submit" className="w-full" disabled={pendente}>
        {pendente ? "Enviando…" : "Enviar link de redefinição"}
      </Botao>
      <p className="text-center text-xs text-texto-2">
        Se o e-mail não chegar, abra um <Link href="/conta/chamados/novo" className="font-semibold text-violeta">chamado</Link> depois de entrar por outro dispositivo.
      </p>
    </form>
  );
}
