"use client";

/**
 * "Seu código de usuário" — exibido em destaque na área da conta.
 *
 * É o código que o participante digita na página de registro de presença à
 * distância, em evento online ou híbrido. Como ele quase sempre é lido na tela
 * de um aparelho e digitado noutro, o botão de copiar existe para o caso em que
 * os dois são o mesmo, e o código sai grande e agrupado para o caso em que não
 * são.
 *
 * A troca fica aqui, junto do código, porque é aqui que a pessoa está quando
 * percebe que ele pode ter vazado.
 */
import { useState, useTransition } from "react";
import { trocarCodigoDeUsuario } from "@/app/acoes-codigo";
import { Aviso, Botao, Etiqueta } from "@/components/ui";

type Passo = "parado" | "confirmando" | "trocado";

export function CodigoDeUsuario({
  codigo: codigoInicial,
  trocadoEm,
}: {
  codigo: string;
  trocadoEm: string | null;
}) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [copiado, setCopiado] = useState(false);
  const [passo, setPasso] = useState<Passo>("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [trocando, iniciar] = useTransition();

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência — o código continua na tela
      // para ser digitado, que é o uso principal de qualquer forma.
    }
  }

  function trocar() {
    setErro(null);
    iniciar(async () => {
      const resultado = await trocarCodigoDeUsuario();
      if (resultado.ok) {
        setCodigo(resultado.codigo);
        setPasso("trocado");
      } else {
        setErro(resultado.mensagem);
        setPasso("parado");
      }
    });
  }

  return (
    <div className="mt-6 rounded-2xl border border-linha bg-white p-5">
      <Etiqueta>seu código de usuário</Etiqueta>

      <div className="mt-2 flex flex-wrap items-center gap-4">
        <p className="font-mono text-2xl font-medium tracking-[0.08em] text-tinta">{codigo}</p>
        <button
          onClick={copiar}
          className="rounded-lg border border-linha px-3 py-1.5 text-xs font-semibold text-texto-2 hover:border-violeta hover:text-violeta"
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>

      <p className="mt-3 text-sm text-texto-2">
        Use este código para registrar presença nos eventos online e híbridos, na página de
        presença à distância que a organização enviar. Ele é só seu — não compartilhe.
      </p>

      {passo === "trocado" ? (
        <div className="mt-4">
          <Aviso tom="sucesso" titulo="Código trocado">
            O código anterior deixou de valer para registrar presença. Suas inscrições, presenças já
            registradas e certificados continuam como estavam.
          </Aviso>
        </div>
      ) : null}

      {erro ? (
        <div className="mt-4">
          <Aviso tom="erro">{erro}</Aviso>
        </div>
      ) : null}

      <div className="mt-5 border-t border-linha pt-4">
        {passo === "confirmando" ? (
          <div className="rounded-xl border border-linha bg-superficie p-4">
            <p className="text-sm font-semibold text-tinta">Trocar o código agora?</p>
            <p className="mt-2 text-sm text-texto-2">
              O código atual para de funcionar na hora. Se você estiver no meio de um evento e ainda
              não tiver registrado presença, use o novo código — o antigo não será mais aceito.
            </p>
            <p className="mt-2 text-sm text-texto-2">
              Nada do que já foi registrado se perde: inscrições, presenças e certificados não
              dependem do código.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Botao onClick={trocar} disabled={trocando}>
                {trocando ? "Trocando…" : "Trocar código"}
              </Botao>
              <Botao tom="discreto" onClick={() => setPasso("parado")} disabled={trocando}>
                Cancelar
              </Botao>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-texto-2">
              Acha que alguém viu seu código? Gere outro — leva um instante.
              {trocadoEm ? (
                <span className="mt-1 block font-mono text-[11px]">
                  última troca em {trocadoEm}
                </span>
              ) : null}
            </p>
            <button
              onClick={() => {
                setErro(null);
                setPasso("confirmando");
              }}
              className="text-sm font-semibold text-violeta hover:text-profundo"
            >
              Gerar novo código
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
