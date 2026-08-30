"use client";

import { useActionState } from "react";
import { excluirMinhaConta, type EstadoExclusao } from "@/app/acoes-exclusao-conta";
import { FRASE_DE_CONFIRMACAO } from "@/lib/textos-exclusao";
import { Aviso, Botao, Campo, Cartao, Entrada } from "@/components/ui";

const INICIAL: EstadoExclusao = {};

/**
 * Duas conferências, e nenhuma escolha.
 *
 * A escolha sobre o destino dos certificados deixou de existir quando o
 * registro de validação passou a não guardar nome legível: sem dado pessoal a
 * eliminar, não há decisão a transferir ao titular — só haveria o risco de ele
 * destruir, sem ganho nenhum de privacidade, a prova de terceiros.
 *
 * Ficam a senha, que confirma ser o titular, e a frase digitada, que separa a
 * decisão do clique distraído numa operação sem desfazer.
 */
export function FormularioExclusao() {
  const [estado, acao, pendente] = useActionState(excluirMinhaConta, INICIAL);

  return (
    <form action={acao} className="mt-4 space-y-5">
      {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}

      <Cartao className="space-y-4">
        <Campo
          rotulo="Senha atual"
          dica="Confirma que quem está excluindo é o titular da conta."
          erro={estado.campos?.senha}
          obrigatorio
        >
          <Entrada name="senha" type="password" autoComplete="current-password" required />
        </Campo>

        <Campo
          rotulo={`Digite ${FRASE_DE_CONFIRMACAO}`}
          dica="A exclusão não tem desfazer nem prazo de arrependimento: ao confirmar, os dados saem do banco imediatamente."
          erro={estado.campos?.frase}
          obrigatorio
        >
          <Entrada
            name="frase"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={FRASE_DE_CONFIRMACAO}
            required
          />
        </Campo>

        <Botao type="submit" tom="perigo" disabled={pendente}>
          {pendente ? "Excluindo…" : "Excluir minha conta definitivamente"}
        </Botao>
      </Cartao>
    </form>
  );
}
