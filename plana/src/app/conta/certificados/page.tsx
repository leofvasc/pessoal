import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/sessao";
import { Cartao, Dado, Etiqueta, Titulo } from "@/components/ui";
import { dataLongaAcre, formatarCargaHoraria } from "@/lib/fuso";

export const metadata = { title: "Meus certificados" };

/**
 * Seção 6 do planejamento: para otimizar o consumo do armazenamento contratado,
 * o certificado é gerado sob demanda. O que fica armazenado é apenas a lista de
 * eventos para os quais o participante já está apto a emitir.
 */
/**
 * Carrega os certificados já marcando quais podem ser baixados.
 *
 * Seção 7: o certificado só sai ao término do horário previsto do evento. Esse
 * corte depende do instante da requisição, então é resolvido aqui e não no
 * corpo do componente.
 */
async function carregarCertificados(usuarioId: string) {
  const certificados = await prisma.certificado.findMany({
    where: { inscricao: { usuarioId } },
    orderBy: { liberadoEm: "desc" },
    select: {
      id: true,
      codigoValidacao: true,
      totalEmissoes: true,
      inscricao: {
        select: {
          evento: {
            select: { nome: true, inicioEm: true, fimEm: true, cargaHorariaMinutos: true },
          },
        },
      },
    },
  });

  const agora = Date.now();
  return certificados.map((certificado) => ({
    ...certificado,
    evento: certificado.inscricao.evento,
    liberado: certificado.inscricao.evento.fimEm.getTime() <= agora,
  }));
}

export default async function PaginaCertificados() {
  const sessao = await exigirSessao();
  const certificados = await carregarCertificados(sessao.usuarioId);

  return (
    <>
      <Titulo>Certificados</Titulo>
      <p className="mt-2 text-sm text-texto-2">
        O arquivo é montado na hora do download — por isso o botão pode levar um instante.
      </p>

      {certificados.length === 0 ? (
        <Cartao className="mt-8">
          <p className="text-sm text-texto-2">
            Nenhum certificado ainda. Eles são liberados assim que sua presença é confirmada no
            evento.
          </p>
        </Cartao>
      ) : (
        <ul className="mt-8 space-y-3">
          {certificados.map(({ evento, liberado, ...certificado }) => {
            return (
              <li key={certificado.id}>
                <Cartao>
                  <h2 className="text-base font-bold tracking-[-0.01em]">{evento.nome}</h2>
                  <p className="mt-1 text-sm text-texto-2">
                    {dataLongaAcre(evento.inicioEm)} ·{" "}
                    {formatarCargaHoraria(evento.cargaHorariaMinutos)}
                  </p>
                  <p className="mt-3">
                    <Etiqueta>validação</Etiqueta>{" "}
                    <Dado>{certificado.codigoValidacao}</Dado>
                  </p>

                  {liberado ? (
                    <a
                      href={`/certificados/${certificado.id}`}
                      className="mt-4 inline-flex rounded-xl bg-violeta px-5 py-3 text-sm font-semibold text-white hover:bg-profundo"
                    >
                      Baixar certificado (PDF)
                    </a>
                  ) : (
                    <p className="mt-4 text-sm text-texto-2">
                      Disponível para download ao término do evento.
                    </p>
                  )}
                </Cartao>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
