import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/sessao";
import { BotaoLink, Cartao, Etiqueta, Titulo } from "@/components/ui";
import { formatarEm, FUSO_ACRE } from "@/lib/fuso";

export const metadata = { title: "Chamados" };

const STATUS = {
  ABERTO: "aberto",
  EM_ANDAMENTO: "em andamento",
  RESOLVIDO: "resolvido",
} as const;

export default async function PaginaChamados() {
  const sessao = await exigirSessao();
  const chamados = await prisma.chamado.findMany({
    where: { usuarioId: sessao.usuarioId },
    orderBy: { atualizadoEm: "desc" },
    include: { _count: { select: { mensagens: true } } },
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Titulo>Chamados</Titulo>
          <p className="mt-2 text-sm text-texto-2">Solicitações de suporte e de exercício dos seus direitos.</p>
        </div>
        <BotaoLink href="/conta/chamados/novo">Novo chamado</BotaoLink>
      </div>

      {chamados.length === 0 ? (
        <Cartao className="mt-8">
          <p className="text-sm text-texto-2">Você ainda não abriu nenhum chamado.</p>
        </Cartao>
      ) : (
        <ul className="mt-8 space-y-3">
          {chamados.map((chamado) => (
            <li key={chamado.id}>
              <Link
                href={`/conta/chamados/${chamado.id}`}
                className="block rounded-2xl border border-linha bg-white p-5 hover:border-violeta"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-bold">{chamado.assunto}</h2>
                  <Etiqueta>{STATUS[chamado.status]}</Etiqueta>
                </div>
                <p className="mt-2 text-xs text-texto-2">
                  Atualizado em {formatarEm(chamado.atualizadoEm, FUSO_ACRE, "dd/MM/yyyy 'às' HH:mm")} · {chamado._count.mensagens} mensagem{chamado._count.mensagens === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
