import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirOrganizador } from "@/lib/sessao";
import { Cartao, Etiqueta, Titulo } from "@/components/ui";
import { formatarEm, FUSO_ACRE } from "@/lib/fuso";

export const metadata = { title: "Chamados de suporte" };

const STATUS = { ABERTO: "aberto", EM_ANDAMENTO: "em andamento", RESOLVIDO: "resolvido" } as const;

export default async function PaginaChamadosPainel() {
  await exigirOrganizador();
  const chamados = await prisma.chamado.findMany({
    orderBy: [{ status: "asc" }, { atualizadoEm: "desc" }],
    include: { usuario: { select: { nome: true, email: true } }, _count: { select: { mensagens: true } } },
  });

  return (
    <>
      <Titulo>Chamados de suporte</Titulo>
      <p className="mt-2 text-sm text-texto-2">Atendimento aos participantes e pedidos relativos a dados pessoais.</p>
      {chamados.length === 0 ? (
        <Cartao className="mt-8"><p className="text-sm text-texto-2">Nenhum chamado aberto.</p></Cartao>
      ) : (
        <ul className="mt-8 space-y-3">
          {chamados.map((chamado) => (
            <li key={chamado.id}>
              <Link href={`/painel/chamados/${chamado.id}`} className="block rounded-2xl border border-linha bg-white p-5 hover:border-violeta">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <h2 className="font-bold">{chamado.assunto}</h2>
                    <p className="mt-1 text-xs text-texto-2">{chamado.usuario.nome} · {chamado.usuario.email}</p>
                  </div>
                  <Etiqueta>{STATUS[chamado.status]}</Etiqueta>
                </div>
                <p className="mt-3 text-xs text-texto-2">
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
