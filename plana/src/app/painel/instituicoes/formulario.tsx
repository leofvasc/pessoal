"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enviarLogotipoDaInstituicao } from "@/app/acoes-arquivos";

/**
 * Envio e troca do logotipo.
 *
 * O cadastro da instituição é do master, mas o logotipo continua sendo enviado
 * por quem a gere: é arte, não identidade, e quem tem o arquivo em boa
 * resolução é a própria organização. Como ele sai impresso no certificado, o
 * gestor precisa conseguir corrigi-lo sem depender de terceiro.
 */
export function LogotipoDaInstituicao({
  instituicaoId,
  logoArquivoId,
}: {
  instituicaoId: string;
  logoArquivoId: string | null;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const roteador = useRouter();

  function enviar(arquivo: File) {
    setErro(null);
    const dados = new FormData();
    dados.set("instituicaoId", instituicaoId);
    dados.set("logo", arquivo);
    iniciar(async () => {
      const resultado = await enviarLogotipoDaInstituicao(dados);
      if (resultado?.erro) setErro(resultado.erro);
      roteador.refresh();
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-3">
      {logoArquivoId ? (
        <Image
          src={`/arquivos/${logoArquivoId}`}
          alt=""
          width={48}
          height={48}
          unoptimized
          className="size-12 rounded-lg border border-linha object-contain p-1"
        />
      ) : (
        <span className="flex size-12 items-center justify-center rounded-lg border border-dashed border-linha text-[10px] text-texto-2">
          sem logo
        </span>
      )}

      <div>
        <button
          type="button"
          disabled={enviando}
          onClick={() => campo.current?.click()}
          className="text-xs font-semibold text-violeta hover:text-profundo disabled:opacity-50"
        >
          {enviando ? "Enviando…" : logoArquivoId ? "Trocar" : "Enviar logotipo"}
        </button>
        {erro ? <p className="mt-1 max-w-40 text-xs text-erro">{erro}</p> : null}
        <input
          ref={campo}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) enviar(arquivo);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
