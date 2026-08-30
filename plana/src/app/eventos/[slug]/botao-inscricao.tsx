"use client";

import { useState, useTransition } from "react";
import { inscrever } from "@/app/acoes-evento";
import { Aviso, Botao, BotaoLink } from "@/components/ui";
import { COMO_REGISTRAR_PRESENCA } from "@/lib/confirmacao-inscricao";
import {
  EXPLICACAO_MODALIDADE_INSCRICAO,
  ROTULO_MODALIDADE_INSCRICAO,
  rotuloDeVagas,
  type SituacaoDeVagas,
} from "@/lib/vagas";
import type { ModalidadeInscricao } from "@/generated/prisma/client";

/**
 * Dois caminhos, e essa é a exigência de desenho: evento sem campo
 * personalizado se inscreve no clique, como sempre foi; evento com campo leva
 * ao formulário. Nenhuma etapa nova aparece para quem não precisa dela.
 *
 * A escolha de modalidade é a exceção, e só existe no evento híbrido: lá as
 * vagas da sala e as da transmissão são contagens separadas, e não há como
 * reservar a vaga certa sem perguntar qual delas a pessoa quer.
 */
export function BotaoInscricao({
  eventoId,
  slug,
  temCampos,
  vagas,
  escolheModalidade,
}: {
  eventoId: string;
  slug: string;
  temCampos: boolean;
  vagas: SituacaoDeVagas;
  escolheModalidade: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  // Seção 7: mensagem automática de confirmação por popup no momento da
  // inscrição, além do registro na central de notificações da conta.
  const [confirmado, setConfirmado] = useState<ModalidadeInscricao | null>(null);

  // A primeira modalidade com vaga já vem marcada: se a sala lotou e a
  // transmissão não, insistir na sala seria oferecer o caminho fechado.
  const [modalidade, setModalidade] = useState<ModalidadeInscricao>(
    vagas.find((linha) => !linha.esgotado)?.modalidade ?? vagas[0]?.modalidade ?? "PRESENCIAL",
  );

  if (confirmado) {
    return (
      <Aviso tom="sucesso" titulo="Inscrição confirmada">
        Você também recebeu a confirmação na central de notificações da sua conta.{" "}
        {COMO_REGISTRAR_PRESENCA[confirmado]}
      </Aviso>
    );
  }

  const selecionada = vagas.find((linha) => linha.modalidade === modalidade);
  const bloqueado = Boolean(selecionada?.esgotado);

  const seletor = escolheModalidade ? (
    <fieldset className="rounded-2xl border border-linha bg-white p-5">
      <legend className="px-1 text-sm font-semibold text-tinta">Como você vai participar?</legend>
      <div className="mt-2 space-y-2">
        {vagas.map((linha) => (
          <label
            key={linha.modalidade}
            className={
              linha.esgotado
                ? "flex cursor-not-allowed items-start gap-3 rounded-xl border border-linha px-4 py-3 opacity-60"
                : "flex cursor-pointer items-start gap-3 rounded-xl border border-linha px-4 py-3 hover:border-violeta"
            }
          >
            <input
              type="radio"
              name="modalidadeInscricao"
              className="mt-1 size-4 shrink-0 accent-violeta"
              value={linha.modalidade}
              checked={modalidade === linha.modalidade}
              disabled={linha.esgotado}
              onChange={() => setModalidade(linha.modalidade)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-tinta">
                {ROTULO_MODALIDADE_INSCRICAO[linha.modalidade]}
              </span>
              <span className="mt-0.5 block text-xs text-texto-2">
                {EXPLICACAO_MODALIDADE_INSCRICAO[linha.modalidade]}
              </span>
              <span
                className={
                  linha.esgotado
                    ? "mt-1 block text-xs font-semibold text-erro"
                    : "mt-1 block text-xs text-texto-2"
                }
              >
                {rotuloDeVagas(linha)}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  ) : null;

  if (temCampos) {
    return (
      <div className="space-y-3">
        <BotaoLink href={`/eventos/${slug}/inscricao`}>Inscrever-se</BotaoLink>
        <p className="text-xs text-texto-2">
          A organização deste evento pede algumas informações antes de confirmar a inscrição.
          {escolheModalidade ? " Você escolhe lá se assiste no local ou pela transmissão." : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {seletor}
      <Botao
        disabled={pendente || bloqueado}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const resultado = await inscrever(eventoId, modalidade);
            if ("erro" in resultado && resultado.erro) setErro(resultado.erro);
            else setConfirmado(modalidade);
          })
        }
      >
        {pendente ? "Inscrevendo…" : bloqueado ? "Vagas esgotadas" : "Inscrever-se"}
      </Botao>
    </div>
  );
}
