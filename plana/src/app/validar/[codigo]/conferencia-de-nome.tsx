"use client";

import { useActionState } from "react";
import {
  conferirNomeDoCertificado,
  type EstadoConferencia,
} from "@/app/acoes-conferencia-nome";
import { Aviso, Botao, Campo, Entrada } from "@/components/ui";

const INICIAL: EstadoConferencia = {};

/**
 * Conferência do nome quando o titular excluiu a conta.
 *
 * O campo pede o nome que a pessoa está lendo no documento em mãos. A
 * plataforma não o exibe nem o completa: ela apenas confirma. Acento e caixa
 * não importam — quem copia de um papel impresso digita como consegue.
 */
export function ConferenciaDeNome({ codigo }: { codigo: string }) {
  const acaoServidor = conferirNomeDoCertificado.bind(null, codigo);
  const [estado, acao, pendente] = useActionState(acaoServidor, INICIAL);

  return (
    <form action={acao} className="mt-4 space-y-4">
      {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}

      {estado.resultado === "CONFERE" ? (
        <Aviso tom="sucesso" titulo="O nome confere">
          O nome digitado corresponde ao participante deste certificado.
        </Aviso>
      ) : null}

      {estado.resultado === "NAO_CONFERE" ? (
        <Aviso tom="erro" titulo="O nome não confere">
          O código existe e o certificado é autêntico, mas o nome digitado não é o do participante
          registrado. Confira a grafia completa, como está impressa no documento. Persistindo a
          divergência, o documento pode ter sido alterado depois de emitido.
        </Aviso>
      ) : null}

      <Campo
        rotulo="Nome do participante"
        dica="Digite o nome como consta no certificado. Acentuação e maiúsculas não afetam a conferência."
      >
        <Entrada name="nome" autoComplete="off" spellCheck={false} required />
      </Campo>

      <Botao type="submit" tom="secundario" disabled={pendente}>
        {pendente ? "Conferindo…" : "Conferir nome"}
      </Botao>
    </form>
  );
}
