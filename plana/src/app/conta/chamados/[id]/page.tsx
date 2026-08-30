import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/sessao";
import { Cartao, Etiqueta, Titulo } from "@/components/ui";
import { formatarEm, FUSO_ACRE } from "@/lib/fuso";
import { FormularioResposta } from "../formularios";

const STATUS = { ABERTO: "aberto", EM_ANDAMENTO: "em andamento", RESOLVIDO: "resolvido" } as const;

export default async function PaginaChamado({ params }: PageProps<"/conta/chamados/[id]">) {
  const { id } = await params;
  const sessao = await exigirSessao();
  const chamado = await prisma.chamado.findFirst({
    where: { id, usuarioId: sessao.usuarioId },
    include: { mensagens: { orderBy: { criadaEm: "asc" } } },
  });
  if (!chamado) notFound();

  return (
    <>
      <Link href="/conta/chamados" className="text-sm text-texto-2 hover:text-violeta">← Chamados</Link>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <Titulo>{chamado.assunto}</Titulo>
        <Etiqueta>{STATUS[chamado.status]}</Etiqueta>
      </div>
      <div className="mt-8 space-y-3">
        {chamado.mensagens.map((mensagem) => {
          const propria = mensagem.autorId === sessao.usuarioId;
          return (
            <Cartao key={mensagem.id} className={propria ? "ml-6 border-violeta/30" : "mr-6 bg-superficie"}>
              <Etiqueta>{propria ? "você" : "suporte PlanA"}</Etiqueta>
              <p className="mt-2 whitespace-pre-line text-sm">{mensagem.corpo}</p>
              <p className="mt-3 text-xs text-texto-2">
                {formatarEm(mensagem.criadaEm, FUSO_ACRE, "dd/MM/yyyy 'às' HH:mm")}
              </p>
            </Cartao>
          );
        })}
      </div>
      <FormularioResposta chamadoId={chamado.id} />
    </>
  );
}
