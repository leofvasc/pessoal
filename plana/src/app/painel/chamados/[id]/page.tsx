import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirOrganizador } from "@/lib/sessao";
import { Cartao, Etiqueta, Titulo } from "@/components/ui";
import { formatarEm, FUSO_ACRE } from "@/lib/fuso";
import { ControlesChamado } from "./controles";

const STATUS = { ABERTO: "aberto", EM_ANDAMENTO: "em andamento", RESOLVIDO: "resolvido" } as const;

export default async function PaginaChamadoPainel({ params }: PageProps<"/painel/chamados/[id]">) {
  const { id } = await params;
  await exigirOrganizador();
  const chamado = await prisma.chamado.findUnique({
    where: { id },
    include: { usuario: { select: { nome: true, email: true } }, mensagens: { orderBy: { criadaEm: "asc" } } },
  });
  if (!chamado) notFound();

  return (
    <>
      <Link href="/painel/chamados" className="text-sm text-texto-2 hover:text-violeta">← Chamados</Link>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Titulo>{chamado.assunto}</Titulo>
          <p className="mt-2 text-sm text-texto-2">{chamado.usuario.nome} · {chamado.usuario.email}</p>
        </div>
        <Etiqueta>{STATUS[chamado.status]}</Etiqueta>
      </div>
      <div className="mt-8 space-y-3">
        {chamado.mensagens.map((mensagem) => {
          const participante = mensagem.autorId === chamado.usuarioId;
          return (
            <Cartao key={mensagem.id} className={participante ? "mr-6 bg-superficie" : "ml-6 border-violeta/30"}>
              <Etiqueta>{participante ? chamado.usuario.nome : "equipe PlanA"}</Etiqueta>
              <p className="mt-2 whitespace-pre-line text-sm">{mensagem.corpo}</p>
              <p className="mt-3 text-xs text-texto-2">{formatarEm(mensagem.criadaEm, FUSO_ACRE, "dd/MM/yyyy 'às' HH:mm")}</p>
            </Cartao>
          );
        })}
      </div>
      <ControlesChamado chamadoId={chamado.id} status={chamado.status} />
    </>
  );
}
