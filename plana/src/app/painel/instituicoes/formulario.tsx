"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import {
  criarInstituicao,
  removerInstituicao,
  type EstadoArquivo,
} from "@/app/acoes-arquivos";
import { Aviso, Botao, Campo, Entrada } from "@/components/ui";

const INICIAL: EstadoArquivo = {};

export function FormularioInstituicao() {
  const [estado, acao, pendente] = useActionState(criarInstituicao, INICIAL);

  return (
    <form action={acao} className="mt-4 space-y-4">
      {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tom="sucesso">{estado.ok}</Aviso> : null}

      <Campo rotulo="Nome da instituição" obrigatorio>
        <Entrada name="nome" required maxLength={160} />
      </Campo>

      <Campo
        rotulo="Logotipo (opcional)"
        dica="PNG, JPG ou SVG de até 4 MB. Pode ser enviado depois."
      >
        <input
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/svg+xml"
          className="block w-full text-sm text-texto-2 file:mr-4 file:rounded-lg file:border-0 file:bg-lilas file:px-4 file:py-2 file:text-sm file:font-semibold file:text-profundo hover:file:bg-lilas/70"
        />
      </Campo>

      <Botao type="submit" disabled={pendente}>
        {pendente ? "Cadastrando…" : "Cadastrar"}
      </Botao>
    </form>
  );
}

type Instituicao = {
  id: string;
  nome: string;
  logoArquivoId: string | null;
  _count: { eventos: number };
};

export function ListaInstituicoes({ instituicoes }: { instituicoes: Instituicao[] }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  if (instituicoes.length === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-linha bg-white p-6 text-sm text-texto-2">
        Nenhuma instituição cadastrada ainda. Um evento pode ser criado sem nenhuma — elas só são
        necessárias quando o certificado precisa citá-las.
      </p>
    );
  }

  function remover(id: string, nome: string) {
    setErro(null);
    iniciar(async () => {
      try {
        await removerInstituicao(id);
      } catch {
        setErro(
          `“${nome}” não pode ser removida: ela organiza pelo menos um evento, e o nome dela consta dos certificados já emitidos.`,
        );
      }
    });
  }

  return (
    <div className="mt-4 space-y-3">
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <ul className="divide-y divide-linha overflow-hidden rounded-2xl border border-linha bg-white">
        {instituicoes.map((instituicao) => (
          <li key={instituicao.id} className="flex items-center gap-4 px-5 py-4">
            {instituicao.logoArquivoId ? (
              <Image
                src={`/arquivos/${instituicao.logoArquivoId}`}
                alt=""
                width={48}
                height={48}
                unoptimized
                className="size-12 shrink-0 rounded-lg border border-linha object-contain p-1"
              />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-linha text-[10px] text-texto-2">
                sem logo
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{instituicao.nome}</p>
              <p className="text-xs text-texto-2">
                {instituicao._count.eventos === 0
                  ? "nenhum evento"
                  : `${instituicao._count.eventos} evento${instituicao._count.eventos > 1 ? "s" : ""}`}
              </p>
            </div>

            {instituicao._count.eventos === 0 ? (
              <button
                onClick={() => remover(instituicao.id, instituicao.nome)}
                disabled={pendente}
                className="text-xs font-semibold text-texto-2 hover:text-erro disabled:opacity-50"
              >
                Remover
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
