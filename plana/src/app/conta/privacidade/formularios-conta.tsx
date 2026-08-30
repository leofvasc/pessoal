"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  alterarSenha,
  atualizarDadosDeContato,
  type EstadoDadosConta,
} from "@/app/acoes-conta-privacidade";
import { Aviso, Botao, Campo, Entrada } from "@/components/ui";

const INICIAL: EstadoDadosConta = {};

export function FormularioDadosDeContato({
  email,
  telefone,
  whatsappAtivo,
}: {
  email: string;
  telefone: string | null;
  whatsappAtivo: boolean;
}) {
  const [estado, acao, pendente] = useActionState(atualizarDadosDeContato, INICIAL);
  return (
    <form action={acao} className="mt-5 space-y-4">
      {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tom="sucesso">{estado.ok}</Aviso> : null}
      <Campo rotulo="E-mail" erro={estado.campos?.email} obrigatorio>
        <Entrada name="email" type="email" autoComplete="email" defaultValue={email} required />
      </Campo>
      <Campo
        rotulo="Telefone"
        dica={
          whatsappAtivo
            ? "Usado somente para os avisos por WhatsApp autorizados acima."
            : "Para cadastrar telefone, ative primeiro os avisos urgentes por WhatsApp."
        }
        erro={estado.campos?.telefone}
        obrigatorio={whatsappAtivo}
      >
        <Entrada
          name="telefone"
          type="tel"
          autoComplete="tel"
          defaultValue={telefone ?? ""}
          disabled={!whatsappAtivo}
          required={whatsappAtivo}
        />
      </Campo>
      <Campo
        rotulo="Senha atual"
        dica="Confirma que a alteração está sendo feita pelo titular da conta."
        erro={estado.campos?.senhaAtual}
        obrigatorio
      >
        <Entrada name="senhaAtual" type="password" autoComplete="current-password" required />
      </Campo>
      <Botao type="submit" disabled={pendente}>{pendente ? "Salvando…" : "Salvar dados"}</Botao>
    </form>
  );
}

export function FormularioAlteracaoSenha() {
  const [estado, acao, pendente] = useActionState(alterarSenha, INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado.ok]);

  return (
    <form ref={formulario} action={acao} className="mt-5 space-y-4">
      {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tom="sucesso">{estado.ok}</Aviso> : null}
      <Campo rotulo="Senha atual" erro={estado.campos?.senhaAtual} obrigatorio>
        <Entrada name="senhaAtual" type="password" autoComplete="current-password" required />
      </Campo>
      <Campo rotulo="Nova senha" dica="Use ao menos 10 caracteres." erro={estado.campos?.novaSenha} obrigatorio>
        <Entrada name="novaSenha" type="password" autoComplete="new-password" minLength={10} required />
      </Campo>
      <Campo rotulo="Confirmar nova senha" erro={estado.campos?.confirmarSenha} obrigatorio>
        <Entrada name="confirmarSenha" type="password" autoComplete="new-password" minLength={10} required />
      </Campo>
      <Botao type="submit" disabled={pendente}>{pendente ? "Alterando…" : "Alterar senha"}</Botao>
    </form>
  );
}
