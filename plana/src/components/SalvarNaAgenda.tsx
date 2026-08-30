"use client";

import { useState } from "react";

/**
 * Botão de salvar o evento na agenda pessoal do participante.
 *
 * Dois caminhos, porque são dois mundos:
 *
 *  - **Google Agenda** abre num endereço de "novo evento já preenchido". A
 *    pessoa revisa e confirma dentro da conta dela;
 *  - **Apple, Outlook e demais** recebem um arquivo .ics, que é o formato
 *    padrão de calendário. No iPhone e no Mac, abrir o arquivo já propõe
 *    adicionar ao Calendário.
 *
 * A PlanA não guarda nada disso. Não pede acesso à agenda de ninguém, não
 * mantém token de calendário e não registra que o evento foi salvo — nem
 * saberia dizer quem salvou. Integrar por API exigiria autorização e um token
 * guardado aqui: dado novo, de finalidade nova, para uma comodidade que o link
 * resolve sem criar dado nenhum.
 */
export function SalvarNaAgenda({
  urlGoogle,
  urlIcs,
}: {
  urlGoogle: string;
  urlIcs: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto}
        className="rounded-xl border border-linha bg-white px-4 py-2.5 text-sm font-semibold text-tinta transition-colors hover:border-violeta hover:text-violeta"
      >
        Salvar na minha agenda
      </button>

      {aberto ? (
        <div className="mt-3 rounded-xl border border-linha bg-white p-4">
          <ul className="space-y-3">
            <li>
              <a
                href={urlGoogle}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-violeta hover:text-profundo"
              >
                Google Agenda →
              </a>
              <p className="mt-1 text-xs text-texto-2">
                Abre o Google com o compromisso preenchido. Você confirma por lá.
              </p>
            </li>
            <li>
              <a
                href={urlIcs}
                className="text-sm font-semibold text-violeta hover:text-profundo"
              >
                Apple, Outlook e outros (.ics) →
              </a>
              <p className="mt-1 text-xs text-texto-2">
                Baixa o arquivo de calendário. No iPhone e no Mac, abri-lo já propõe adicionar ao
                Calendário.
              </p>
            </li>
          </ul>
          <p className="mt-4 border-t border-linha pt-3 text-xs text-texto-2">
            A PlanA não acessa nem guarda sua agenda: o compromisso é criado no seu aparelho, e a
            plataforma não registra que você o salvou.
          </p>
        </div>
      ) : null}
    </div>
  );
}
