import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirOrganizador } from "@/lib/sessao";
import { Aviso, Cartao, Dado, Etiqueta, Titulo } from "@/components/ui";
import { dataLongaAcre, etiquetaDoisFusos, formatarCargaHoraria } from "@/lib/fuso";
import { qrSvg, urlCurta, urlDePresenca, urlLonga } from "@/lib/qr";
import { origemPublica } from "@/lib/origem";
import { TOLERANCIA_METROS } from "@/lib/geo";
import { ListaPresenca } from "./lista-presenca";
import { BotaoPublicar } from "./acoes-cliente";

export const metadata = { title: "Evento" };

const MODALIDADES = { PRESENCIAL: "Presencial", ONLINE: "Online", HIBRIDO: "Híbrido" } as const;

export default async function PaginaEvento({ params }: PageProps<"/painel/eventos/[id]">) {
  const { id } = await params;
  const sessao = await exigirOrganizador();

  const evento = await prisma.evento.findFirst({
    where: { id, organizadorId: sessao.usuarioId },
    include: {
      palestrantes: { orderBy: { ordem: "asc" } },
      inscricoes: {
        where: { canceladaEm: null },
        orderBy: { criadaEm: "asc" },
        include: {
          usuario: { select: { nome: true, email: true, perfil: true } },
          presenca: { select: { registradaEm: true, metodo: true } },
          certificado: { select: { codigoValidacao: true, primeiraEmissaoEm: true } },
        },
      },
    },
  });

  if (!evento) notFound();

  const origem = await origemPublica();

  // Dois QRs com finalidades que não se misturam: o de presença carrega o token
  // secreto e é projetado na sala; o de divulgação aponta para o link curto.
  const [qrPresenca, qrDivulgacao] = await Promise.all([
    qrSvg(urlDePresenca(origem, evento.tokenQr)),
    qrSvg(urlCurta(origem, evento.codigoCurto)),
  ]);

  const presentes = evento.inscricoes.filter((i) => i.presenca).length;

  return (
    <>
      <Link href="/painel" className="text-sm text-texto-2 hover:text-violeta">
        ← Painel
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Etiqueta>
            {MODALIDADES[evento.modalidade]} · <Dado>{evento.codigoEvento}</Dado>
          </Etiqueta>
          <Titulo className="mt-2">{evento.nome}</Titulo>
          <p className="mt-2 text-sm text-texto-2">
            {dataLongaAcre(evento.inicioEm)} · {formatarCargaHoraria(evento.cargaHorariaMinutos)}
          </p>
          <p className="mt-1 font-mono text-xs text-texto-2">{etiquetaDoisFusos(evento.inicioEm)}</p>
        </div>
        {evento.publicado ? (
          <span className="rounded-full bg-sucesso/10 px-3 py-1 text-xs font-semibold text-sucesso">
            publicado
          </span>
        ) : (
          <BotaoPublicar eventoId={evento.id} />
        )}
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Cartao>
          <Titulo nivel={3}>QR Code de presença</Titulo>
          <p className="mt-2 text-xs text-texto-2">
            Projete no ambiente. Fundo transparente, correção de erro máxima. Na projeção, use área
            branca ou lilás de no mínimo 120 mm e mantenha o símbolo PlanA a pelo menos 15 mm dele.
          </p>
          <div
            className="mx-auto mt-4 w-full max-w-[220px] [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrPresenca }}
          />
          <a
            href={`/painel/eventos/${evento.id}/qr/presenca.png`}
            className="mt-4 block text-center text-sm font-semibold text-violeta hover:text-profundo"
          >
            Baixar PNG para projeção
          </a>
        </Cartao>

        <Cartao>
          <Titulo nivel={3}>Divulgação</Titulo>
          <p className="mt-2 text-xs text-texto-2">
            QR gerado a partir do link curto, para peças gráficas. Ler este não registra presença.
          </p>
          <div
            className="mx-auto mt-4 w-full max-w-[220px] [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrDivulgacao }}
          />
          <dl className="mt-4 space-y-2 text-xs">
            <div>
              <dt className="etiqueta text-texto-2">link curto</dt>
              <dd className="font-mono break-all">{urlCurta(origem, evento.codigoCurto)}</dd>
            </div>
            <div>
              <dt className="etiqueta text-texto-2">link longo</dt>
              <dd className="font-mono break-all">{urlLonga(origem, evento.slug)}</dd>
            </div>
          </dl>
        </Cartao>
      </section>

      {evento.modalidade !== "ONLINE" && evento.latitude === null ? (
        <div className="mt-6">
          <Aviso tom="erro" titulo="Sem ponto no mapa">
            Este evento não tem coordenada definida, então a presença por QR Code não pode ser
            validada. Só restará o lançamento manual.
          </Aviso>
        </div>
      ) : null}

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Titulo nivel={2}>Inscritos</Titulo>
          <p className="text-sm text-texto-2">
            {presentes} de {evento.inscricoes.length} com presença registrada
          </p>
        </div>
        <p className="mt-2 text-xs text-texto-2">
          A presença por QR Code aceita até {TOLERANCIA_METROS} m de diferença do ponto do evento.
          O lançamento manual continua disponível — a precisão do GPS piora em ambiente fechado.
        </p>

        <ListaPresenca
          inscricoes={evento.inscricoes.map((i) => ({
            id: i.id,
            nome: i.usuario.nome,
            email: i.usuario.email,
            presencaEm: i.presenca?.registradaEm.toISOString() ?? null,
            metodo: i.presenca?.metodo ?? null,
            codigoValidacao: i.certificado?.codigoValidacao ?? null,
          }))}
        />
      </section>
    </>
  );
}
