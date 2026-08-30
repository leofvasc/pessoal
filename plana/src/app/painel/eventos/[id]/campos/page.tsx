import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { escopoDeEventos, exigirOrganizador } from "@/lib/sessao";
import { Aviso, Etiqueta, Titulo } from "@/components/ui";
import { GestaoDeCampos } from "./gestao";

export const metadata = { title: "Campos da inscrição" };

export default async function PaginaCampos({
  params,
}: PageProps<"/painel/eventos/[id]/campos">) {
  const sessao = await exigirOrganizador();
  const { id } = await params;

  const evento = await prisma.evento.findFirst({
    where: { id, ...escopoDeEventos(sessao), excluidoEm: null },
    select: {
      id: true,
      nome: true,
      slug: true,
      camposInscricao: {
        orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
        select: {
          id: true,
          rotulo: true,
          ajuda: true,
          tipo: true,
          obrigatorio: true,
          opcoes: true,
          arquivadoEm: true,
          _count: { select: { respostas: true } },
        },
      },
      _count: { select: { inscricoes: true } },
    },
  });
  if (!evento) notFound();

  const ativos = evento.camposInscricao.filter((c) => !c.arquivadoEm);

  return (
    <>
      <Link href={`/painel/eventos/${evento.id}`} className="text-sm text-texto-2 hover:text-violeta">
        ← {evento.nome}
      </Link>

      <Etiqueta className="mt-4 block">inscrição</Etiqueta>
      <Titulo className="mt-1">Campos da inscrição</Titulo>
      <p className="mt-3 text-sm text-texto-2">
        Perguntas que o participante responde ao se inscrever neste evento. Sem nenhum campo ativo,
        a inscrição se efetiva no clique, como sempre foi — nenhuma tela nova aparece para quem não
        precisa dela. Com um campo ou mais, o participante passa por um formulário antes de a
        inscrição ser confirmada.
      </p>

      <div className="mt-6 space-y-4">
        <Aviso titulo="O que se pergunta aqui é responsabilidade de quem organiza">
          A PlanA não sabe de antemão o que estes campos coletam, mas responde como controladora
          pelo que for coletado. Pergunte apenas o que a organização do evento realmente vai usar, e
          escreva no texto de apoio para que serve o dado. Não peça dado sensível — origem racial,
          convicção religiosa, opinião política, filiação sindical, saúde, vida sexual, dado
          genético ou biométrico —, cujo tratamento tem regime próprio e mais rígido.
        </Aviso>

        {evento._count.inscricoes > 0 && ativos.length > 0 ? (
          <Aviso tom="erro" titulo="Já há inscritos neste evento">
            Quem se inscreveu antes de um campo existir não respondeu a ele, e a plataforma não
            pergunta depois. A coluna desse campo virá vazia no relatório para essas pessoas.
          </Aviso>
        ) : null}
      </div>

      <div className="mt-8">
        <GestaoDeCampos eventoId={evento.id} campos={evento.camposInscricao} />
      </div>
    </>
  );
}
