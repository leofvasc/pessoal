"use client";

import { useState, useTransition } from "react";
import { lancarPresenca } from "@/app/acoes-presenca";
import { Aviso, Botao, Dado, Etiqueta } from "@/components/ui";

type Inscricao = {
  id: string;
  nome: string;
  email: string;
  presencaEm: string | null;
  metodo: "QR_GEOLOCALIZACAO" | "CODIGO_REMOTO" | "MANUAL" | null;
  codigoValidacao: string | null;
};

const METODOS = {
  QR_GEOLOCALIZACAO: "QR Code",
  CODIGO_REMOTO: "a distância",
  MANUAL: "manual",
} as const;

export function ListaPresenca({ inscricoes }: { inscricoes: Inscricao[] }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [emCurso, setEmCurso] = useState<string | null>(null);

  if (inscricoes.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border border-linha bg-white p-6 text-sm text-texto-2">
        Nenhum inscrito ainda. Divulgue o link curto do evento.
      </p>
    );
  }

  function lancar(inscricaoId: string) {
    setErro(null);
    setEmCurso(inscricaoId);
    iniciar(async () => {
      const resultado = await lancarPresenca(inscricaoId);
      if (!resultado.ok) setErro(resultado.mensagem);
      setEmCurso(null);
    });
  }

  return (
    <div className="mt-6 space-y-3">
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <ul className="divide-y divide-linha overflow-hidden rounded-2xl border border-linha bg-white">
        {inscricoes.map((inscricao) => (
          <li key={inscricao.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{inscricao.nome}</p>
              <p className="truncate text-xs text-texto-2">{inscricao.email}</p>
            </div>

            {inscricao.presencaEm ? (
              <div className="text-right">
                <Etiqueta className="!text-sucesso">
                  presente · {inscricao.metodo ? METODOS[inscricao.metodo] : ""}
                </Etiqueta>
                {inscricao.codigoValidacao ? (
                  <p className="mt-1">
                    <Dado className="text-texto-2">{inscricao.codigoValidacao}</Dado>
                  </p>
                ) : null}
              </div>
            ) : (
              <Botao
                tom="secundario"
                className="!px-4 !py-2 !text-xs"
                onClick={() => lancar(inscricao.id)}
                disabled={pendente && emCurso === inscricao.id}
              >
                {pendente && emCurso === inscricao.id ? "Lançando…" : "Lançar presença"}
              </Botao>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
