"use client";

import { useActionState } from "react";
import { inscreverComRespostas, type EstadoCampo } from "@/app/acoes-campos-inscricao";
import { Aviso, AreaTexto, Botao, Campo, Cartao, Entrada, Selecao } from "@/components/ui";
import type { TipoCampoInscricao } from "@/generated/prisma/client";

const INICIAL: EstadoCampo = {};

type CampoDoFormulario = {
  id: string;
  rotulo: string;
  ajuda: string | null;
  tipo: TipoCampoInscricao;
  obrigatorio: boolean;
  opcoes: string[];
};

/**
 * Renderiza os campos que o organizador definiu.
 *
 * Os valores já respondidos voltam preenchidos: quem cancelou e se inscreveu
 * de novo, ou quem recarregou a página depois de um erro de validação, não
 * deve redigitar o que já informou.
 */
export function FormularioDeInscricao({
  eventoId,
  campos,
  respostas,
  jaInscrito,
}: {
  eventoId: string;
  campos: CampoDoFormulario[];
  respostas: Record<string, string>;
  jaInscrito: boolean;
}) {
  const acaoServidor = inscreverComRespostas.bind(null, eventoId);
  const [estado, acao, pendente] = useActionState(acaoServidor, INICIAL);

  return (
    <form action={acao} className="mt-8 space-y-5">
      {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}

      {jaInscrito ? (
        <Aviso titulo="Você já está inscrito">
          Enviar de novo atualiza as respostas abaixo, sem duplicar a inscrição.
        </Aviso>
      ) : null}

      <Cartao className="space-y-5">
        {campos.map((campo) => {
          const nome = `campo:${campo.id}`;
          const atual = respostas[campo.id] ?? "";
          const erro = estado.campos?.[campo.id];

          if (campo.tipo === "SELECAO_MULTIPLA") {
            const marcadas = new Set(atual ? atual.split("; ") : []);
            return (
              <fieldset key={campo.id}>
                <legend className="text-sm font-semibold text-tinta">
                  {campo.rotulo}
                  {campo.obrigatorio ? <span className="text-erro"> *</span> : null}
                </legend>
                {campo.ajuda ? (
                  <p className="mt-1 text-xs text-texto-2">{campo.ajuda}</p>
                ) : null}
                <div className="mt-2 space-y-2">
                  {campo.opcoes.map((opcao) => (
                    <label key={opcao} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        name={nome}
                        value={opcao}
                        defaultChecked={marcadas.has(opcao)}
                        className="size-4 accent-violeta"
                      />
                      <span className="text-sm text-tinta">{opcao}</span>
                    </label>
                  ))}
                </div>
                {erro ? <p className="mt-1 text-xs text-erro">{erro}</p> : null}
              </fieldset>
            );
          }

          return (
            <Campo
              key={campo.id}
              rotulo={campo.rotulo}
              dica={campo.ajuda ?? undefined}
              erro={erro}
              obrigatorio={campo.obrigatorio}
            >
              {campo.tipo === "TEXTO_LONGO" ? (
                <AreaTexto
                  name={nome}
                  rows={4}
                  maxLength={2000}
                  defaultValue={atual}
                  required={campo.obrigatorio}
                />
              ) : campo.tipo === "SELECAO_UNICA" ? (
                <Selecao name={nome} defaultValue={atual} required={campo.obrigatorio}>
                  <option value="">Selecione…</option>
                  {campo.opcoes.map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {opcao}
                    </option>
                  ))}
                </Selecao>
              ) : campo.tipo === "SIM_NAO" ? (
                <Selecao name={nome} defaultValue={atual} required={campo.obrigatorio}>
                  <option value="">Selecione…</option>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </Selecao>
              ) : (
                <Entrada
                  name={nome}
                  type={campo.tipo === "DATA" ? "date" : "text"}
                  inputMode={campo.tipo === "NUMERO" ? "decimal" : undefined}
                  maxLength={campo.tipo === "TEXTO_CURTO" ? 200 : undefined}
                  defaultValue={atual}
                  required={campo.obrigatorio}
                />
              )}
            </Campo>
          );
        })}
      </Cartao>

      <Botao type="submit" disabled={pendente}>
        {pendente ? "Enviando…" : jaInscrito ? "Atualizar respostas" : "Confirmar inscrição"}
      </Botao>
    </form>
  );
}
