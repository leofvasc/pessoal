"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Popup de bloqueio da autoexclusão de conta de organizador.
 *
 * Abre sozinho ao carregar a página, e não atrás de um clique: quem chegou até
 * aqui já decidiu excluir, e a informação de que a conta não pode ser excluída
 * por esta via precisa interromper o fluxo antes de o formulário ser lido.
 *
 * Usa o `<dialog>` nativo com `showModal()` — foco preso, `Esc` fechando e
 * fundo inerte vêm do navegador, sem biblioteca e sem armadilha de
 * acessibilidade escrita à mão. O `Esc` é interceptado apenas para levar de
 * volta ao painel, para que fechar não deixe o organizador parado numa tela
 * que não vai servir para nada.
 */
export function PopupOrganizador({ motivo }: { motivo: "ORGANIZADOR" | "OUTROS" }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const roteador = useRouter();

  useEffect(() => {
    const elemento = dialogo.current;
    if (elemento && !elemento.open) elemento.showModal();
  }, []);

  return (
    <dialog
      ref={dialogo}
      onCancel={(evento) => {
        evento.preventDefault();
        roteador.push("/painel");
      }}
      aria-labelledby="titulo-bloqueio-exclusao"
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-linha bg-white p-0 text-tinta backdrop:bg-tinta/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-6 sm:p-7">
        <span className="etiqueta text-erro">exclusão bloqueada</span>
        <h2
          id="titulo-bloqueio-exclusao"
          className="mt-2 text-2xl font-bold tracking-[-0.02em]"
        >
          Esta conta não pode ser excluída por aqui
        </h2>

        {motivo === "ORGANIZADOR" ? (
          <>
            <p className="mt-4 text-sm leading-relaxed text-texto-2">
              Contas de organizador não são apenas os dados de uma pessoa. Elas respondem pelos
              eventos publicados, pelos arquivos enviados e pelos lançamentos de presença de outros
              participantes.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-texto-2">
              Excluí-la derrubaria páginas públicas de eventos e comprometeria certificados de
              terceiros, que não participaram desta decisão. A exclusão só pode vir depois de
              definida a destinação desses eventos — transferência para outro organizador ou
              encerramento.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-texto-2">
            Há eventos ou arquivos sob a responsabilidade desta conta. A exclusão só pode vir depois
            de definida a destinação deles, porque outras pessoas dependem desse conteúdo.
          </p>
        )}

        <p className="mt-4 text-sm leading-relaxed text-texto-2">
          Abra um chamado para que o pedido seja tratado junto com essa definição. O direito à
          exclusão não está sendo negado: está sendo ordenado com o que depende dele.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => roteador.push("/conta/chamados/novo")}
            className="inline-flex items-center justify-center rounded-xl bg-violeta px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-profundo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
          >
            Abrir chamado
          </button>
          <button
            type="button"
            onClick={() => roteador.push("/painel")}
            className="inline-flex items-center justify-center rounded-xl border border-linha bg-white px-5 py-3 text-sm font-semibold text-tinta transition-colors hover:border-violeta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
          >
            Voltar ao painel
          </button>
        </div>
      </div>
    </dialog>
  );
}
