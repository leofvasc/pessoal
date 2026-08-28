import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirOrganizador } from "@/lib/sessao";
import { BotaoLink, Cartao, Dado, Etiqueta, Titulo } from "@/components/ui";
import { dataCurtaAcre, etiquetaDoisFusos, formatarCargaHoraria } from "@/lib/fuso";

export const metadata = { title: "Painel" };

const MODALIDADES = {
  PRESENCIAL: "Presencial",
  ONLINE: "Online",
  HIBRIDO: "Híbrido",
} as const;

export default async function PaginaPainel() {
  const sessao = await exigirOrganizador();

  const eventos = await prisma.evento.findMany({
    where: { organizadorId: sessao.usuarioId },
    orderBy: { inicioEm: "desc" },
    select: {
      id: true,
      nome: true,
      inicioEm: true,
      modalidade: true,
      publicado: true,
      codigoEvento: true,
      cargaHorariaMinutos: true,
      _count: { select: { inscricoes: true } },
    },
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Titulo>Seus eventos</Titulo>
          <p className="mt-2 text-sm text-texto-2">
            {eventos.length === 0
              ? "Nenhum evento ainda."
              : `${eventos.length} evento${eventos.length > 1 ? "s" : ""}.`}
          </p>
        </div>
        <BotaoLink href="/painel/eventos/novo">Novo evento</BotaoLink>
      </div>

      {eventos.length === 0 ? (
        <Cartao className="mt-8">
          <p className="text-sm text-texto-2">
            Crie o primeiro evento para gerar o QR Code de presença e o link de divulgação.
          </p>
        </Cartao>
      ) : (
        <ul className="mt-8 space-y-3">
          {eventos.map((evento) => (
            <li key={evento.id}>
              <Link
                href={`/painel/eventos/${evento.id}`}
                className="block rounded-2xl border border-linha bg-white p-5 transition-colors hover:border-violeta"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <Etiqueta>
                      {dataCurtaAcre(evento.inicioEm)} · {MODALIDADES[evento.modalidade]}
                    </Etiqueta>
                    <h2 className="mt-1 text-lg font-bold tracking-[-0.01em]">{evento.nome}</h2>
                  </div>
                  {evento.publicado ? null : (
                    <span className="rounded-full bg-lilas px-3 py-1 text-xs font-semibold text-profundo">
                      rascunho
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xs text-texto-2">
                  <Dado>{evento.codigoEvento}</Dado> · {etiquetaDoisFusos(evento.inicioEm)} ·{" "}
                  {formatarCargaHoraria(evento.cargaHorariaMinutos)} · {evento._count.inscricoes}{" "}
                  {evento._count.inscricoes === 1 ? "inscrito" : "inscritos"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
