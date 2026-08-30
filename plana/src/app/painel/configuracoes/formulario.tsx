"use client";

import Image from "next/image";
import { useActionState, useTransition } from "react";
import {
  enviarGabaritoCertificado,
  enviarModeloPadraoCertificado,
  removerGabaritoCertificado,
  removerModeloPadraoCertificado,
  type EstadoConfiguracao,
} from "@/app/acoes-configuracao";
import { Aviso, Botao, Campo, Cartao, Etiqueta, Titulo } from "@/components/ui";

const INICIAL: EstadoConfiguracao = {};

const CLASSE_ARQUIVO =
  "block w-full text-sm text-texto-2 file:mr-4 file:rounded-lg file:border-0 " +
  "file:bg-lilas file:px-4 file:py-2 file:text-sm file:font-semibold file:text-profundo " +
  "hover:file:bg-lilas/70";

export type ModeloAtual = {
  arquivoId: string;
  nomeOriginal: string;
  tamanho: string;
  enviadoEm: string;
  eventosNoPadrao: number;
};

/**
 * Modelo-base padrão de certificado.
 *
 * É enviado uma única vez, aqui, e passa a valer para todo evento criado
 * depois. Dentro de cada evento o organizador pode substituí-lo por arte
 * própria, sem que isso altere o padrão dos demais.
 */
export function ModeloPadraoDeCertificado({ modelo }: { modelo: ModeloAtual | null }) {
  const [estado, acao, pendente] = useActionState(enviarModeloPadraoCertificado, INICIAL);
  const [removendo, iniciar] = useTransition();

  return (
    <Cartao>
      <Titulo nivel={3}>Modelo padrão de certificado</Titulo>
      <p className="mt-2 text-sm text-texto-2">
        A4 paisagem, apenas frente, PNG ou JPG de até 10 MB. É o fundo sobre o qual a plataforma
        monta o certificado quando o evento não tem arte própria. A PlanA não redesenha essa
        imagem: escreve por cima o nome do participante, os dados do evento e o bloco de validação
        no rodapé, sempre na mesma posição.
      </p>
      <p className="mt-2 text-sm text-texto-2">
        Todo evento criado a partir daqui já nasce com este modelo. Para usar outra arte em um
        evento específico, basta enviá-la na página daquele evento — o padrão continua o mesmo para
        os demais.
      </p>

      {modelo ? (
        <div className="mt-6">
          <Image
            src={`/arquivos/${modelo.arquivoId}`}
            alt="Modelo padrão de certificado em uso"
            width={840}
            height={594}
            unoptimized
            className="w-full rounded-xl border border-linha"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-texto-2">
              <Etiqueta>em uso</Etiqueta> {modelo.nomeOriginal} · {modelo.tamanho} · enviado em{" "}
              {modelo.enviadoEm} ·{" "}
              {modelo.eventosNoPadrao === 1
                ? "1 evento usa este modelo"
                : `${modelo.eventosNoPadrao} eventos usam este modelo`}
            </p>
            <button
              onClick={() => iniciar(() => removerModeloPadraoCertificado())}
              disabled={removendo}
              className="text-xs font-semibold text-texto-2 hover:text-erro disabled:opacity-50"
            >
              {removendo ? "Removendo…" : "Remover modelo padrão"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <Aviso tom="informacao" titulo="Sem modelo padrão">
            Enquanto nenhum modelo for enviado, os certificados de eventos sem arte própria saem
            sobre fundo branco — legíveis e válidos, mas sem identidade visual.
          </Aviso>
        </div>
      )}

      <form action={acao} className="mt-6 space-y-3">
        {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
        {estado.ok ? <Aviso tom="sucesso">{estado.ok}</Aviso> : null}
        <Campo
          rotulo={modelo ? "Substituir modelo padrão" : "Enviar modelo padrão"}
          dica="Trocar o modelo atualiza também os eventos que ainda estavam no padrão."
        >
          <input
            type="file"
            name="arquivo"
            accept="image/png,image/jpeg"
            className={CLASSE_ARQUIVO}
            required
          />
        </Campo>
        <Botao type="submit" tom="secundario" disabled={pendente}>
          {pendente ? "Enviando…" : "Enviar"}
        </Botao>
      </form>
    </Cartao>
  );
}

export type GabaritoAtual = {
  arquivoId: string;
  nomeOriginal: string;
  tamanho: string;
  enviadoEm: string;
  /** Imagem se abre na tela; PDF, não — e o cartão precisa saber a diferença. */
  ehImagem: boolean;
};

/**
 * Gabarito de medidas do certificado.
 *
 * A automação escreve o nome do participante, os dados do evento e o bloco de
 * validação sempre nas mesmas posições. Um organizador que não saiba onde
 * ficam essas áreas desenha por cima delas, e descobre o problema quando o
 * primeiro certificado sai ilegível — com o evento já encerrado.
 *
 * O gabarito é a resposta a isso, e mora aqui e não no código justamente para
 * que a administração possa trocá-lo sozinha quando o desenho do certificado
 * mudar. Enquanto não houver gabarito, o botão de baixar não aparece na
 * configuração dos eventos.
 */
export function GabaritoDoCertificado({ gabarito }: { gabarito: GabaritoAtual | null }) {
  const [estado, acao, pendente] = useActionState(enviarGabaritoCertificado, INICIAL);
  const [removendo, iniciar] = useTransition();

  return (
    <Cartao>
      <Titulo nivel={3}>Gabarito do certificado</Titulo>
      <p className="mt-2 text-sm text-texto-2">
        É o arquivo que o organizador baixa, ao lado do envio da imagem-base, para produzir a arte
        do certificado nas medidas certas. Envie o gabarito em A4 paisagem — 297 × 210 mm, ou
        3508 × 2480 px a 300 dpi —, com as áreas que a plataforma escreve por cima marcadas:
        o nome do participante e os dados do evento no miolo, e o bloco de validação com QR Code no
        rodapé.
      </p>
      <p className="mt-2 text-sm text-texto-2">
        PNG, JPG ou PDF de até 10 MB. Sempre que o desenho do certificado mudar, substitua o
        arquivo aqui: o download dos organizadores passa a ser o novo, sem nenhuma implantação.
      </p>

      {gabarito ? (
        <div className="mt-6">
          {gabarito.ehImagem ? (
            <Image
              src={`/arquivos/${gabarito.arquivoId}`}
              alt="Gabarito de medidas do certificado em uso"
              width={840}
              height={594}
              unoptimized
              className="w-full rounded-xl border border-linha"
            />
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-texto-2">
              <Etiqueta>em uso</Etiqueta> {gabarito.nomeOriginal} · {gabarito.tamanho} · enviado em{" "}
              {gabarito.enviadoEm} ·{" "}
              <a
                href={`/arquivos/${gabarito.arquivoId}`}
                className="font-semibold text-violeta hover:text-profundo"
              >
                baixar
              </a>
            </p>
            <button
              onClick={() => iniciar(() => removerGabaritoCertificado())}
              disabled={removendo}
              className="text-xs font-semibold text-texto-2 hover:text-erro disabled:opacity-50"
            >
              {removendo ? "Removendo…" : "Remover gabarito"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <Aviso tom="informacao" titulo="Sem gabarito publicado">
            Enquanto nenhum gabarito for enviado, o botão de download não aparece na configuração
            dos eventos, e os organizadores produzem a imagem-base sem referência de medidas.
          </Aviso>
        </div>
      )}

      <form action={acao} className="mt-6 space-y-3">
        {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
        {estado.ok ? <Aviso tom="sucesso">{estado.ok}</Aviso> : null}
        <Campo
          rotulo={gabarito ? "Substituir gabarito" : "Enviar gabarito"}
          dica="O arquivo anterior é apagado: quem baixar a partir daqui recebe este."
        >
          <input
            type="file"
            name="arquivo"
            accept="image/png,image/jpeg,application/pdf"
            className={CLASSE_ARQUIVO}
            required
          />
        </Campo>
        <Botao type="submit" tom="secundario" disabled={pendente}>
          {pendente ? "Enviando…" : "Enviar"}
        </Botao>
      </form>
    </Cartao>
  );
}
