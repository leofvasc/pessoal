"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import {
  enviarImagemBase,
  enviarBanner,
  enviarMaterial,
  removerBanner,
  removerImagemBase,
  removerMaterial,
  definirOrganizadoras,
  type EstadoArquivo,
} from "@/app/acoes-arquivos";
import { Aviso, Botao, Campo, Cartao, Entrada, Etiqueta, Titulo } from "@/components/ui";

const INICIAL: EstadoArquivo = {};

const CLASSE_ARQUIVO =
  "block w-full text-sm text-texto-2 file:mr-4 file:rounded-lg file:border-0 " +
  "file:bg-lilas file:px-4 file:py-2 file:text-sm file:font-semibold file:text-profundo " +
  "hover:file:bg-lilas/70";

export function BannerDoEvento({
  eventoId,
  arquivoId,
}: {
  eventoId: string;
  arquivoId: string | null;
}) {
  const [estado, acao, pendente] = useActionState(enviarBanner, INICIAL);
  const [removendo, iniciar] = useTransition();

  return (
    <Cartao>
      <Titulo nivel={3}>Banner do evento</Titulo>
      <p className="mt-2 text-xs text-texto-2">
        Imagem de divulgação exibida no topo da página pública do evento. Use PNG ou JPG de até
        8 MB, preferencialmente em formato horizontal.
      </p>

      {arquivoId ? (
        <div className="mt-4">
          <Image
            src={`/arquivos/${arquivoId}`}
            alt="Banner atual do evento"
            width={1200}
            height={675}
            unoptimized
            className="aspect-video w-full rounded-xl border border-linha object-cover"
          />
          <button
            onClick={() => iniciar(() => removerBanner(eventoId))}
            disabled={removendo}
            className="mt-3 text-xs font-semibold text-texto-2 hover:text-erro disabled:opacity-50"
          >
            {removendo ? "Removendo…" : "Remover banner"}
          </button>
        </div>
      ) : null}

      <form action={acao} className="mt-4 space-y-3">
        <input type="hidden" name="eventoId" value={eventoId} />
        {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
        {estado.ok ? <Aviso tom="sucesso">{estado.ok}</Aviso> : null}
        <Campo rotulo={arquivoId ? "Substituir banner" : "Enviar banner"}>
          <input
            type="file"
            name="arquivo"
            accept="image/png,image/jpeg,image/webp"
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

/**
 * Imagem-base do certificado.
 * Planejamento, seção 3: imagem-base usada na geração automática do
 * certificado, em tamanho A4, apenas frente. A PlanA desenha por cima dela
 * apenas o nome, os dados do evento e o bloco de validação.
 */
export function ImagemBaseDoCertificado({
  eventoId,
  arquivoId,
  noPadrao,
  temModeloPadrao,
  gabaritoArquivoId,
}: {
  eventoId: string;
  arquivoId: string | null;
  /** A imagem em uso é o modelo padrão da plataforma, não arte deste evento. */
  noPadrao: boolean;
  /** Existe modelo padrão configurado para o qual voltar ao remover a arte. */
  temModeloPadrao: boolean;
  /**
   * Gabarito de medidas publicado pela administração, quando houver. É o
   * arquivo que o organizador baixa antes de desenhar a própria arte.
   */
  gabaritoArquivoId: string | null;
}) {
  const [estado, acao, pendente] = useActionState(enviarImagemBase, INICIAL);
  const [removendo, iniciar] = useTransition();

  return (
    <Cartao>
      <Titulo nivel={3}>Imagem-base do certificado</Titulo>
      <p className="mt-2 text-xs text-texto-2">
        A4 paisagem, apenas frente — 297 × 210 mm, ou 3508 × 2480 px a 300 dpi. É o fundo sobre o
        qual o certificado é montado: a PlanA não redesenha essa arte, só escreve por cima o nome
        do participante, os dados do evento e o bloco de validação no rodapé. Sem imagem, o
        certificado sai sobre fundo branco.
      </p>

      {/* O gabarito fica junto do envio, e não numa página de ajuda: é aqui,
          na hora de mandar a imagem, que o organizador descobre que precisa
          saber onde a automação vai escrever. */}
      {gabaritoArquivoId ? (
        <div className="mt-3 rounded-xl border border-linha bg-superficie p-3">
          <a
            href={`/arquivos/${gabaritoArquivoId}`}
            className="text-sm font-semibold text-violeta hover:text-profundo"
          >
            Baixar gabarito do certificado ↓
          </a>
          <p className="mt-1 text-xs text-texto-2">
            Arquivo com as medidas e as áreas reservadas à automação. Produza sua arte sobre ele
            para que nada importante fique embaixo do que a plataforma escreve.
          </p>
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-linha p-3 text-xs text-texto-2">
          A administração da plataforma ainda não publicou o gabarito de medidas. Enquanto isso,
          use A4 paisagem e deixe livres o miolo, onde entram o nome e os dados do evento, e a
          faixa do rodapé, onde entra o bloco de validação com QR Code.
        </p>
      )}

      {arquivoId ? (
        <p className="mt-3">
          <Etiqueta>
            {noPadrao ? "modelo padrão da plataforma" : "arte própria deste evento"}
          </Etiqueta>
        </p>
      ) : null}

      {noPadrao ? (
        <p className="mt-2 text-xs text-texto-2">
          Este evento está usando o modelo mantido pela plataforma. Envie uma imagem aqui para
          substituí-lo apenas neste evento — os demais continuam no padrão.
        </p>
      ) : null}

      {arquivoId ? (
        <div className="mt-4">
          <Image
            src={`/arquivos/${arquivoId}`}
            alt="Imagem-base do certificado deste evento"
            width={840}
            height={594}
            unoptimized
            className="w-full rounded-xl border border-linha"
          />
          <button
            onClick={() => iniciar(() => removerImagemBase(eventoId))}
            disabled={removendo}
            className="mt-3 text-xs font-semibold text-texto-2 hover:text-erro disabled:opacity-50"
          >
            {removendo
              ? "Removendo…"
              : noPadrao
                ? "Não usar imagem neste evento"
                : temModeloPadrao
                  ? "Remover e voltar ao modelo padrão"
                  : "Remover imagem"}
          </button>
        </div>
      ) : null}

      <form action={acao} className="mt-4 space-y-3">
        <input type="hidden" name="eventoId" value={eventoId} />
        {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
        {estado.ok ? <Aviso tom="sucesso">{estado.ok}</Aviso> : null}

        <Campo rotulo={arquivoId ? "Substituir imagem" : "Enviar imagem"} dica="PNG ou JPG de até 10 MB.">
          <input type="file" name="arquivo" accept="image/png,image/jpeg" className={CLASSE_ARQUIVO} required />
        </Campo>

        <Botao type="submit" tom="secundario" disabled={pendente}>
          {pendente ? "Enviando…" : "Enviar"}
        </Botao>
      </form>
    </Cartao>
  );
}

type Material = {
  id: string;
  nome: string;
  tamanho: string;
  arquivoId: string;
};

/**
 * Material de apoio.
 * Planejamento, seção 3: upload de material disponibilizado para download dos
 * inscritos. Só quem está inscrito baixa — a checagem está na rota do arquivo.
 */
export function MaterialDeApoio({
  eventoId,
  materiais,
}: {
  eventoId: string;
  materiais: Material[];
}) {
  const [estado, acao, pendente] = useActionState(enviarMaterial, INICIAL);
  const [removendo, iniciar] = useTransition();

  return (
    <Cartao>
      <Titulo nivel={3}>Material de apoio</Titulo>
      <p className="mt-2 text-xs text-texto-2">
        Slides, apostilas e anexos. Ficam disponíveis para download na página do evento, apenas
        para quem está inscrito.
      </p>

      {materiais.length > 0 ? (
        <ul className="mt-4 divide-y divide-linha rounded-xl border border-linha">
          {materiais.map((material) => (
            <li key={material.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <a
                  href={`/arquivos/${material.arquivoId}`}
                  className="block truncate text-sm font-semibold text-violeta hover:text-profundo"
                >
                  {material.nome}
                </a>
                <Etiqueta>{material.tamanho}</Etiqueta>
              </div>
              <button
                onClick={() => iniciar(() => removerMaterial(material.id))}
                disabled={removendo}
                className="text-xs font-semibold text-texto-2 hover:text-erro disabled:opacity-50"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={acao} className="mt-4 space-y-3">
        <input type="hidden" name="eventoId" value={eventoId} />
        {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
        {estado.ok ? <Aviso tom="sucesso">{estado.ok}</Aviso> : null}

        <Campo rotulo="Arquivo" dica="PDF, imagem, ZIP ou documento do Office de até 50 MB.">
          <input type="file" name="arquivo" className={CLASSE_ARQUIVO} required />
        </Campo>

        <Campo rotulo="Como aparece na lista (opcional)" dica="Sem isto, vale o nome do arquivo.">
          <Entrada name="nome" maxLength={160} placeholder="Slides da palestra" />
        </Campo>

        <Botao type="submit" tom="secundario" disabled={pendente}>
          {pendente ? "Enviando…" : "Adicionar material"}
        </Botao>
      </form>
    </Cartao>
  );
}

type OpcaoInstituicao = { id: string; nome: string };

/** Associa uma ou mais instituições organizadoras ao evento (seção 3). */
export function Organizadoras({
  eventoId,
  disponiveis,
  selecionadasIniciais,
}: {
  eventoId: string;
  disponiveis: OpcaoInstituicao[];
  selecionadasIniciais: string[];
}) {
  const [selecionadas, setSelecionadas] = useState<string[]>(selecionadasIniciais);
  const [pendente, iniciar] = useTransition();
  const [salvo, setSalvo] = useState(false);

  function alternar(id: string) {
    setSalvo(false);
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((i) => i !== id) : [...atual, id],
    );
  }

  return (
    <Cartao>
      <Titulo nivel={3}>Instituições organizadoras</Titulo>
      <p className="mt-2 text-xs text-texto-2">
        Aparecem na página do evento e no texto do certificado, na ordem em que forem marcadas.
      </p>

      {disponiveis.length === 0 ? (
        <p className="mt-4 text-sm text-texto-2">
          Nenhuma instituição cadastrada ainda. Cadastre em{" "}
          <a href="/painel/instituicoes" className="font-semibold text-violeta">
            Instituições
          </a>
          .
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {disponiveis.map((instituicao) => (
              <li key={instituicao.id}>
                <label className="flex items-center gap-3 rounded-xl border border-linha px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selecionadas.includes(instituicao.id)}
                    onChange={() => alternar(instituicao.id)}
                    className="size-4 shrink-0 accent-[var(--color-violeta)]"
                  />
                  <span className="text-sm">{instituicao.nome}</span>
                </label>
              </li>
            ))}
          </ul>

          <Botao
            tom="secundario"
            className="mt-4"
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                await definirOrganizadoras(eventoId, selecionadas);
                setSalvo(true);
              })
            }
          >
            {pendente ? "Salvando…" : salvo ? "Salvo" : "Salvar organizadoras"}
          </Botao>
        </>
      )}
    </Cartao>
  );
}
