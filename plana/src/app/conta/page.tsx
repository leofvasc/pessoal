import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/sessao";
import { Cartao, Etiqueta, Titulo } from "@/components/ui";
import { dataLongaAcre, etiquetaDoisFusos } from "@/lib/fuso";
import { AvisoInstalacaoIOS } from "@/components/AvisoInstalacaoIOS";
import { CodigoDeUsuario } from "@/components/CodigoDeUsuario";

export const metadata = { title: "Minha conta" };

/**
 * Carrega e já separa as inscrições em curso das encerradas.
 *
 * O corte por "agora" mora aqui, e não no componente: o instante é uma entrada
 * da requisição, não algo derivado da renderização.
 */
async function carregarInscricoes(usuarioId: string) {
  const inscricoes = await prisma.inscricao.findMany({
    where: { usuarioId, canceladaEm: null },
    orderBy: { evento: { inicioEm: "desc" } },
    include: {
      evento: {
        select: { nome: true, slug: true, inicioEm: true, fimEm: true, modalidade: true },
      },
      presenca: { select: { registradaEm: true } },
    },
  });

  const agora = Date.now();
  return {
    proximos: inscricoes.filter((i) => i.evento.fimEm.getTime() >= agora),
    passados: inscricoes.filter((i) => i.evento.fimEm.getTime() < agora),
  };
}

export default async function PaginaConta() {
  const sessao = await exigirSessao();
  const [conta, { proximos, passados }] = await Promise.all([
    prisma.usuario.findUniqueOrThrow({
      where: { id: sessao.usuarioId },
      select: { codigoUsuario: true },
    }),
    carregarInscricoes(sessao.usuarioId),
  ]);

  return (
    <>
      <Titulo>Olá, {sessao.nome.split(" ")[0]}</Titulo>

      <CodigoDeUsuario codigo={conta.codigoUsuario} />

      <AvisoInstalacaoIOS />

      <section className="mt-8">
        <Titulo nivel={2}>Próximos eventos</Titulo>
        {proximos.length === 0 ? (
          <Cartao className="mt-4">
            <p className="text-sm text-texto-2">
              Nenhuma inscrição ativa. Abra o link de um evento para se inscrever.
            </p>
          </Cartao>
        ) : (
          <ul className="mt-4 space-y-3">
            {proximos.map((inscricao) => (
              <li key={inscricao.id}>
                <Link
                  href={`/eventos/${inscricao.evento.slug}`}
                  className="block rounded-2xl border border-linha bg-white p-5 hover:border-violeta"
                >
                  <h3 className="text-base font-bold tracking-[-0.01em]">{inscricao.evento.nome}</h3>
                  <p className="mt-1 text-sm text-texto-2">
                    {dataLongaAcre(inscricao.evento.inicioEm)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-texto-2">
                    {etiquetaDoisFusos(inscricao.evento.inicioEm)}
                  </p>
                  {inscricao.presenca ? (
                    <Etiqueta className="mt-3 block !text-sucesso">presença registrada</Etiqueta>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Seção 6: acompanhamento das inscrições em eventos já realizados. */}
      {passados.length > 0 ? (
        <section className="mt-10">
          <Titulo nivel={2}>Eventos já realizados</Titulo>
          <ul className="mt-4 space-y-3">
            {passados.map((inscricao) => (
              <li
                key={inscricao.id}
                className="rounded-2xl border border-linha bg-white p-5 opacity-90"
              >
                <h3 className="text-base font-semibold">{inscricao.evento.nome}</h3>
                <p className="mt-1 text-sm text-texto-2">
                  {dataLongaAcre(inscricao.evento.inicioEm)}
                </p>
                {inscricao.presenca ? (
                  <Link
                    href="/conta/certificados"
                    className="mt-3 inline-block text-sm font-semibold text-violeta hover:text-profundo"
                  >
                    Ver certificado →
                  </Link>
                ) : (
                  <Etiqueta className="mt-3 block">sem presença registrada</Etiqueta>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
