import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sessaoAtual } from "@/lib/sessao";
import { camposAtivosDoEvento } from "@/lib/campos-inscricao";
import { Etiqueta, Titulo } from "@/components/ui";
import { Logotipo } from "@/components/marca/Logotipo";
import { dataLongaAcre, formatarCargaHoraria } from "@/lib/fuso";
import { FormularioDeInscricao } from "./formulario";
import { vagasDoEvento } from "@/lib/lotacao";
import { exigeEscolhaDeModalidade, totalmenteEsgotado } from "@/lib/vagas";

export const metadata = { title: "Inscrição" };

/**
 * Formulário de inscrição, exibido apenas quando o evento tem campos
 * personalizados ativos. Sem campos, esta rota devolve o participante à página
 * do evento, onde a inscrição se efetiva no clique.
 */
export default async function PaginaInscricao({
  params,
}: PageProps<"/eventos/[slug]/inscricao">) {
  const { slug } = await params;
  const sessao = await sessaoAtual();
  // Lido uma vez, fora da expressão de render: a regra de pureza do React
  // recusa Date.now() dentro do corpo do componente.
  const agora = new Date();

  const evento = await prisma.evento.findFirst({
    where: { slug, publicado: true, excluidoEm: null },
    select: {
      id: true,
      nome: true,
      slug: true,
      inicioEm: true,
      cargaHorariaMinutos: true,
      modalidade: true,
      canceladoEm: true,
      fimEm: true,
      vagasPresencial: true,
      vagasOnline: true,
      instituicoes: {
        orderBy: { ordem: "asc" },
        select: { instituicao: { select: { nome: true } } },
      },
    },
  });
  if (!evento) notFound();

  if (!sessao) redirect(`/entrar?alvo=/eventos/${slug}/inscricao`);
  if (evento.canceladoEm || evento.fimEm.getTime() < agora.getTime()) {
    redirect(`/eventos/${slug}`);
  }

  const campos = await camposAtivosDoEvento(evento.id);
  if (campos.length === 0) redirect(`/eventos/${slug}`);

  const inscricao = await prisma.inscricao.findUnique({
    where: { eventoId_usuarioId: { eventoId: evento.id, usuarioId: sessao.usuarioId } },
    select: {
      canceladaEm: true,
      modalidade: true,
      respostas: { select: { campoId: true, valor: true } },
    },
  });
  const respostasAtuais = Object.fromEntries(
    (inscricao?.respostas ?? []).map((r) => [r.campoId, r.valor]),
  );

  const vagas = await vagasDoEvento(evento.id, evento);
  const jaInscrito = inscricao != null && inscricao.canceladaEm == null;

  // Quem já está inscrito continua entrando para atualizar as respostas mesmo
  // com o evento lotado: a vaga dele já está reservada, e fechar a porta aqui
  // impediria a correção de um dado que a organização precisa ter certo.
  if (!jaInscrito && totalmenteEsgotado(vagas)) redirect(`/eventos/${slug}`);

  return (
    <>
      <header className="border-b border-linha bg-white">
        <div className="mx-auto max-w-2xl px-6 py-5">
          <Link href="/">
            <Logotipo altura={24} />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <Link href={`/eventos/${slug}`} className="text-sm text-texto-2 hover:text-violeta">
          ← {evento.nome}
        </Link>

        <Etiqueta className="mt-4 block">inscrição</Etiqueta>
        <Titulo className="mt-1">{evento.nome}</Titulo>
        <p className="mt-2 text-sm text-texto-2">
          {dataLongaAcre(evento.inicioEm)} · {formatarCargaHoraria(evento.cargaHorariaMinutos)} ·{" "}
          {evento.modalidade}
        </p>

        <p className="mt-6 text-sm text-texto-2">
          A organização deste evento pede as informações abaixo para concluir sua inscrição. Elas
          ficam disponíveis a quem organiza — {evento.instituicoes.map((i) => i.instituicao.nome).join(", ") || "a organização do evento"} — e
          saem do banco junto com a sua conta, se você a excluir.
        </p>

        <FormularioDeInscricao
          eventoId={evento.id}
          campos={campos}
          respostas={respostasAtuais}
          jaInscrito={jaInscrito}
          vagas={vagas}
          escolheModalidade={exigeEscolhaDeModalidade(evento.modalidade)}
          modalidadeAtual={inscricao?.modalidade ?? null}
        />
      </main>
    </>
  );
}
