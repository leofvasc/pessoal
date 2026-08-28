import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { sessaoAtual } from "@/lib/sessao";
import { Aviso, BotaoLink, Cartao, Etiqueta, Titulo } from "@/components/ui";
import { Logotipo } from "@/components/marca/Logotipo";
import { dataLongaAcre, etiquetaDoisFusos, formatarCargaHoraria } from "@/lib/fuso";
import { BotaoInscricao } from "./botao-inscricao";

const MODALIDADES = { PRESENCIAL: "Presencial", ONLINE: "Online", HIBRIDO: "Híbrido" } as const;

async function buscar(slug: string) {
  return prisma.evento.findFirst({
    where: { slug, publicado: true },
    include: {
      palestrantes: { orderBy: { ordem: "asc" } },
      instituicoes: { include: { instituicao: true }, orderBy: { ordem: "asc" } },
      materiais: true,
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
  return { title: evento.nome, description: evento.descricao.slice(0, 160) };
}

export default async function PaginaPublicaEvento({ params }: PageProps<"/eventos/[slug]">) {
  const { slug } = await params;
  const [evento, sessao] = await Promise.all([buscar(slug), sessaoAtual()]);
  if (!evento) notFound();

  const inscricao = sessao
    ? await prisma.inscricao.findUnique({
        where: { eventoId_usuarioId: { eventoId: evento.id, usuarioId: sessao.usuarioId } },
        select: { canceladaEm: true },
      })
    : null;

  const inscrito = Boolean(inscricao && !inscricao.canceladaEm);
  const encerrado = await jaEncerrado(evento.fimEm);

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
        <Etiqueta>
          {MODALIDADES[evento.modalidade]} · {formatarCargaHoraria(evento.cargaHorariaMinutos)}
        </Etiqueta>
        <Titulo className="mt-3">{evento.nome}</Titulo>

        <p className="mt-4 text-sm text-tinta">{dataLongaAcre(evento.inicioEm)}</p>
        <p className="mt-1 font-mono text-xs text-texto-2">{etiquetaDoisFusos(evento.inicioEm)}</p>

        {/* Seção 10 do manual: em peça de evento quem lidera visualmente é a
            instituição organizadora; a PlanA assina como plataforma no rodapé. */}
        {evento.instituicoes.length > 0 ? (
          <p className="mt-6 text-sm text-texto-2">
            Promovido por{" "}
            <span className="font-semibold text-tinta">
              {evento.instituicoes.map((i) => i.instituicao.nome).join(", ")}
            </span>
          </p>
        ) : null}

        <div className="mt-8 whitespace-pre-line text-sm text-tinta">{evento.descricao}</div>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          {evento.modalidade !== "ONLINE" ? (
            <Cartao>
              <Etiqueta>local</Etiqueta>
              <p className="mt-2 text-sm font-semibold">{evento.localNome}</p>
              {evento.localEndereco ? (
                <p className="mt-1 text-sm text-texto-2">{evento.localEndereco}</p>
              ) : null}
            </Cartao>
          ) : null}

          {evento.modalidade !== "PRESENCIAL" && evento.meioTransmissao ? (
            <Cartao>
              <Etiqueta>transmissão</Etiqueta>
              <p className="mt-2 break-all text-sm">{evento.meioTransmissao}</p>
            </Cartao>
          ) : null}

          {evento.palestrantes.map((palestrante) => (
            <Cartao key={palestrante.id}>
              <Etiqueta>palestrante</Etiqueta>
              <p className="mt-2 text-sm font-semibold">{palestrante.nome}</p>
              <p className="mt-1 text-sm text-texto-2">{palestrante.qualificacao}</p>
            </Cartao>
          ))}

          {/* Seção 3: quando não preenchido, o campo é omitido da visualização. */}
          {evento.tutorVirtualUrl ? (
            <Cartao>
              <Etiqueta>tutor virtual</Etiqueta>
              <a
                href={evento.tutorVirtualUrl}
                className="mt-2 block break-all text-sm font-semibold text-violeta hover:text-profundo"
                rel="noopener noreferrer"
                target="_blank"
              >
                Abrir tutor do evento
              </a>
            </Cartao>
          ) : null}
        </section>

        <div className="mt-10">
          {encerrado ? (
            <Aviso>Este evento já foi encerrado.</Aviso>
          ) : inscrito ? (
            <Aviso tom="sucesso" titulo="Inscrição confirmada">
              No dia do evento, abra a PlanA e leia o QR Code projetado na sala para registrar
              presença. O certificado é liberado automaticamente depois disso.
            </Aviso>
          ) : sessao ? (
            <BotaoInscricao eventoId={evento.id} />
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
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-6">
          <span className="text-xs text-texto-2">inscrições e certificados por</span>
          <Logotipo altura={18} />
        </div>
      </footer>
    </>
  );
}
