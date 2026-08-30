import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { sessaoAtual } from "@/lib/sessao";
import { Aviso, BotaoLink, Cartao, Etiqueta, Titulo } from "@/components/ui";
import { Logotipo } from "@/components/marca/Logotipo";
import { dataLongaAcre, etiquetaDoisFusos, formatarCargaHoraria } from "@/lib/fuso";
import { formatarTamanho } from "@/lib/armazenamento";
import { ROTULO_GRATUITO } from "@/lib/inscricao-valor";
import { COMO_REGISTRAR_PRESENCA } from "@/lib/confirmacao-inscricao";
import { BotaoInscricao } from "./botao-inscricao";
import { SalvarNaAgenda } from "@/components/SalvarNaAgenda";
import { eventoTemCampos } from "@/lib/campos-inscricao";
import { vagasDoEvento } from "@/lib/lotacao";
import {
  ROTULO_MODALIDADE_INSCRICAO,
  exigeEscolhaDeModalidade,
  rotuloDeVagas,
  totalmenteEsgotado,
} from "@/lib/vagas";
import { localParaAgenda } from "@/lib/agenda-evento";
import { urlGoogleAgenda } from "@/lib/agenda";
import { origemPublica } from "@/lib/origem";

const MODALIDADES = { PRESENCIAL: "Presencial", ONLINE: "Online", HIBRIDO: "Híbrido" } as const;

async function buscar(slug: string) {
  return prisma.evento.findFirst({
    where: { slug, publicado: true, excluidoEm: null },
    include: {
      palestrantes: { orderBy: { ordem: "asc" } },
      instituicoes: { include: { instituicao: true }, orderBy: { ordem: "asc" } },
      materiais: {
        orderBy: { ordem: "asc" },
        include: { arquivo: { select: { id: true, tamanhoBytes: true } } },
      },
    },
  });
}

/** O instante da requisição é entrada, não algo derivado da renderização. */
async function jaEncerrado(fimEm: Date) {
  return fimEm.getTime() < Date.now();
}

export async function generateMetadata({
  params,
}: PageProps<"/eventos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const evento = await buscar(slug);
  if (!evento) return { title: "Evento não encontrado" };

  const descricao = evento.descricao.slice(0, 160);
  // Aqui o banner é o conteúdo certo da miniatura: quem compartilha o link de
  // um evento está compartilhando aquele evento. A imagem da marca fica para o
  // endereço da plataforma, definido no layout raiz.
  const imagem = evento.bannerArquivoId
    ? [{ url: `/arquivos/${evento.bannerArquivoId}`, width: 1200, height: 630, alt: evento.nome }]
    : [{ url: "/og/plana.png", width: 1200, height: 630, alt: "PlanA — gestão de eventos" }];

  return {
    title: evento.nome,
    description: descricao,
    openGraph: {
      type: "article",
      siteName: "PlanA",
      locale: "pt_BR",
      title: evento.nome,
      description: descricao,
      images: imagem,
    },
    twitter: {
      card: "summary_large_image",
      title: evento.nome,
      description: descricao,
      images: imagem.map((i) => i.url),
    },
  };
}

export default async function PaginaPublicaEvento({ params }: PageProps<"/eventos/[slug]">) {
  const { slug } = await params;
  const [evento, sessao] = await Promise.all([buscar(slug), sessaoAtual()]);
  if (!evento) notFound();

  const inscricao = sessao
    ? await prisma.inscricao.findUnique({
        where: { eventoId_usuarioId: { eventoId: evento.id, usuarioId: sessao.usuarioId } },
        select: { canceladaEm: true, modalidade: true },
      })
    : null;

  const inscrito = Boolean(inscricao && !inscricao.canceladaEm);
  const temCampos = await eventoTemCampos(evento.id);
  const encerrado = await jaEncerrado(evento.fimEm);
  const vagas = await vagasDoEvento(evento.id, evento);
  const esgotado = totalmenteEsgotado(vagas);
  const escolheModalidade = exigeEscolhaDeModalidade(evento.modalidade);

  // Salvar na agenda é comodidade de quem já se inscreveu, e por isso os
  // endereços só são montados nesse caso. Nada disso guarda dado: o Google
  // recebe o compromisso pela própria URL clicada, e o .ics é gerado na hora.
  const origem = inscrito && !evento.canceladoEm ? await origemPublica() : null;
  const agenda = origem
    ? {
        google: urlGoogleAgenda({
          nome: evento.nome,
          descricao: evento.descricao,
          inicioEm: evento.inicioEm,
          fimEm: evento.fimEm,
          local: localParaAgenda(evento),
          url: `${origem}/eventos/${evento.slug}`,
          codigoEvento: evento.codigoEvento,
        }),
        ics: `/eventos/${evento.slug}/agenda.ics`,
      }
    : null;

  return (
    <>
      <header className="border-b border-linha bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/">
            <Logotipo altura={24} />
          </Link>
          {sessao ? (
            <BotaoLink href="/conta" tom="discreto">
              Minha conta
            </BotaoLink>
          ) : (
            <BotaoLink href="/entrar" tom="discreto">
              Entrar
            </BotaoLink>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        {evento.bannerArquivoId ? (
          <Image
            src={`/arquivos/${evento.bannerArquivoId}`}
            alt={`Banner de ${evento.nome}`}
            width={1200}
            height={675}
            priority
            unoptimized
            className="mb-8 aspect-video w-full rounded-2xl border border-linha object-cover"
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Etiqueta>
            {MODALIDADES[evento.modalidade]} · {formatarCargaHoraria(evento.cargaHorariaMinutos)}
          </Etiqueta>
          {/* Dito de forma expressa, e não por omissão: quem chega na página
              precisa saber que não paga antes de decidir se se inscreve. */}
          <span className="rounded-full bg-sucesso/10 px-3 py-1 text-xs font-bold text-sucesso">
            {ROTULO_GRATUITO}
          </span>
          {esgotado ? (
            <span className="rounded-full bg-erro/10 px-3 py-1 text-xs font-bold text-erro">
              Vagas esgotadas
            </span>
          ) : null}
        </div>
        <Titulo className="mt-3 quebra-texto">{evento.nome}</Titulo>

        <p className="mt-4 text-sm text-tinta">{dataLongaAcre(evento.inicioEm)}</p>
        <p className="mt-1 font-mono text-xs text-texto-2">{etiquetaDoisFusos(evento.inicioEm)}</p>

        {/* Seção 10 do manual: em peça de evento quem lidera visualmente é a
            instituição organizadora; a PlanA assina como plataforma no rodapé. */}
        {evento.instituicoes.length > 0 ? (
          <div className="mt-6">
            <Etiqueta>promovido por</Etiqueta>
            <ul className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
              {evento.instituicoes.map(({ instituicao }) => (
                <li key={instituicao.id} className="flex items-center gap-3">
                  {instituicao.logoArquivoId ? (
                    <Image
                      src={`/arquivos/${instituicao.logoArquivoId}`}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="size-10 object-contain"
                    />
                  ) : null}
                  <span className="quebra-texto text-sm font-semibold text-tinta">{instituicao.nome}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="quebra-texto mt-8 whitespace-pre-line text-sm text-tinta">{evento.descricao}</div>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          {evento.modalidade !== "ONLINE" ? (
            <Cartao>
              <Etiqueta>local</Etiqueta>
              <p className="quebra-texto mt-2 text-sm font-semibold">{evento.localNome}</p>
              {evento.localEndereco ? (
                <p className="quebra-texto mt-1 text-sm text-texto-2">{evento.localEndereco}</p>
              ) : null}
            </Cartao>
          ) : null}

          {evento.modalidade !== "PRESENCIAL" && evento.meioTransmissao ? (
            <Cartao>
              <Etiqueta>transmissão</Etiqueta>
              <p className="quebra-texto mt-2 text-sm">{evento.meioTransmissao}</p>
            </Cartao>
          ) : null}

          {/* Vagas ditas antes da inscrição: descobrir que o evento lotou
              depois de preencher o formulário é a pior hora de descobrir. */}
          <Cartao>
            <Etiqueta>inscrição</Etiqueta>
            <p className="mt-2 text-sm font-semibold text-sucesso">{ROTULO_GRATUITO}</p>
            <ul className="mt-3 space-y-1">
              {vagas.map((linha) => (
                <li key={linha.modalidade} className="text-sm text-texto-2">
                  {escolheModalidade ? (
                    <span className="font-semibold text-tinta">
                      {ROTULO_MODALIDADE_INSCRICAO[linha.modalidade]}:{" "}
                    </span>
                  ) : null}
                  <span className={linha.esgotado ? "font-semibold text-erro" : undefined}>
                    {rotuloDeVagas(linha)}
                  </span>
                </li>
              ))}
            </ul>
            {escolheModalidade ? (
              <p className="mt-3 text-xs text-texto-2">
                Evento híbrido: você escolhe, na inscrição, se assiste no local ou pela
                transmissão. Cada modalidade tem suas próprias vagas.
              </p>
            ) : null}
          </Cartao>

          {evento.palestrantes.map((palestrante) => (
            <Cartao key={palestrante.id}>
              <Etiqueta>palestrante</Etiqueta>
              <p className="quebra-texto mt-2 text-sm font-semibold">{palestrante.nome}</p>
              <p className="quebra-texto mt-1 text-sm text-texto-2">{palestrante.qualificacao}</p>
            </Cartao>
          ))}

            {/* Seção 3: quando não preenchido, o campo é omitido da visualização. */}
          {evento.tutorVirtualUrl ? (
            <Cartao>
              <Etiqueta>tutor virtual</Etiqueta>
              <a
                href={evento.tutorVirtualUrl}
                className="quebra-texto mt-2 block text-sm font-semibold text-violeta hover:text-profundo"
                rel="noopener noreferrer"
                target="_blank"
              >
                Abrir tutor do evento
              </a>
            </Cartao>
          ) : null}
        </section>

        {/* Seção 3: material de apoio disponibilizado para download dos
            inscritos — e só deles. A rota do arquivo confere a inscrição; aqui
            a lista nem aparece para quem não está inscrito. */}
        {inscrito && evento.materiais.length > 0 ? (
          <section className="mt-10">
            <Titulo nivel={2}>Material de apoio</Titulo>
            <ul className="mt-4 divide-y divide-linha overflow-hidden rounded-2xl border border-linha bg-white">
              {evento.materiais.map((material) => (
                <li key={material.id} className="px-5 py-4">
                  <a
                    href={`/arquivos/${material.arquivo.id}`}
                    className="quebra-texto text-sm font-semibold text-violeta hover:text-profundo"
                  >
                    {material.nome}
                  </a>
                  <p>
                    <Etiqueta>{formatarTamanho(material.arquivo.tamanhoBytes)}</Etiqueta>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-10">
          {evento.canceladoEm ? (
            <Aviso tom="erro" titulo="Evento cancelado">
              A organização cancelou este evento. Não são aceitas novas inscrições nem registros de presença.
            </Aviso>
          ) : encerrado ? (
            <Aviso>Este evento já foi encerrado.</Aviso>
          ) : inscrito ? (
            <>
              <Aviso tom="sucesso" titulo="Inscrição confirmada">
                {inscricao?.modalidade === "ONLINE"
                  ? COMO_REGISTRAR_PRESENCA.ONLINE
                  : COMO_REGISTRAR_PRESENCA.PRESENCIAL}{" "}
                O certificado é liberado automaticamente depois disso.
                {escolheModalidade && inscricao ? (
                  <>
                    {" "}
                    Sua inscrição é na modalidade{" "}
                    <strong>
                      {ROTULO_MODALIDADE_INSCRICAO[inscricao.modalidade].toLocaleLowerCase("pt-BR")}
                    </strong>
                    .
                  </>
                ) : null}
              </Aviso>
              {agenda ? <SalvarNaAgenda urlGoogle={agenda.google} urlIcs={agenda.ics} /> : null}
            </>
          ) : esgotado ? (
            <Aviso tom="erro" titulo="Vagas esgotadas">
              Todas as vagas deste evento foram preenchidas. A organização pode ampliar o limite;
              acompanhe esta página.
            </Aviso>
          ) : sessao ? (
            <BotaoInscricao
              eventoId={evento.id}
              slug={evento.slug}
              temCampos={temCampos}
              vagas={vagas}
              escolheModalidade={escolheModalidade}
            />
          ) : (
            <Cartao>
              <p className="text-sm text-texto-2">
                É preciso ter conta para se inscrever — é ela que liga a leitura do QR Code ao seu
                nome no certificado.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <BotaoLink href={`/criar-conta?evento=${evento.slug}`}>Criar conta</BotaoLink>
                <BotaoLink href="/entrar" tom="secundario">
                  Entrar
                </BotaoLink>
              </div>
            </Cartao>
          )}
        </div>
      </main>

      <footer className="border-t border-linha bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <div className="flex items-center gap-3">
            <span className="text-xs text-texto-2">inscrições e certificados por</span>
            <Logotipo altura={18} />
          </div>
          <nav className="flex gap-4 text-xs text-texto-2">
            <Link href="/privacidade" className="hover:text-violeta">Privacidade</Link>
            <Link href="/cookies" className="hover:text-violeta">Cookies</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
