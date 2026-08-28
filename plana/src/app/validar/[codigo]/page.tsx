import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Aviso, Cartao, Dado, Etiqueta, Titulo } from "@/components/ui";
import { Logotipo } from "@/components/marca/Logotipo";
import { dataLongaAcre, formatarCargaHoraria } from "@/lib/fuso";

export const metadata = { title: "Validação de certificado" };

/** Como cada presença foi confirmada. Quem confere o certificado tem direito a
 *  saber por qual caminho, já que eles têm rigores diferentes. */
const DESCRICAO_DO_METODO = {
  QR_GEOLOCALIZACAO: "por leitura de QR Code no local, com conferência de geolocalização.",
  CODIGO_REMOTO:
    "a distância, em evento online ou híbrido, pelo código pessoal do participante.",
  MANUAL: "por lançamento da organização do evento.",
} as const;

/**
 * Consulta pública de autenticidade — o destino do QR do bloco de validação.
 *
 * Mostra o mínimo necessário para confirmar que o documento é verdadeiro: quem
 * participou, de quê e com que carga horária. Não expõe e-mail, telefone, perfil
 * nem qualquer dado do check-in: a finalidade aqui é conferir um certificado,
 * não consultar uma pessoa.
 */
export default async function PaginaValidacao({ params }: PageProps<"/validar/[codigo]">) {
  const { codigo } = await params;
  const codigoNormalizado = decodeURIComponent(codigo).trim().toUpperCase();

  const certificado = await prisma.certificado.findUnique({
    where: { codigoValidacao: codigoNormalizado },
    select: {
      liberadoEm: true,
      inscricao: {
        select: {
          usuario: { select: { nome: true } },
          presenca: { select: { registradaEm: true, metodo: true } },
          evento: {
            select: {
              nome: true,
              inicioEm: true,
              cargaHorariaMinutos: true,
              instituicoes: {
                orderBy: { ordem: "asc" },
                select: { instituicao: { select: { nome: true } } },
              },
            },
          },
        },
      },
    },
  });

  return (
    <>
      <header className="border-b border-linha bg-white">
        <div className="mx-auto max-w-2xl px-6 py-5">
          <Link href="/">
            <Logotipo altura={24} />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <Etiqueta>validação</Etiqueta>
        <p className="mt-2">
          <Dado className="text-lg">{codigoNormalizado}</Dado>
        </p>

        {!certificado || !certificado.inscricao.presenca ? (
          <div className="mt-8">
            <Aviso tom="erro" titulo="Código não encontrado">
              Nenhum certificado da PlanA corresponde a este código. Confira a digitação — o código
              não usa as letras B, I, L, O, S, Z nem os algarismos 0, 1, 2, 5 e 8.
            </Aviso>
          </div>
        ) : (
          <>
            <div className="mt-8">
              <Aviso tom="sucesso" titulo="Certificado autêntico">
                Emitido pela PlanA com presença registrada{" "}
                {DESCRICAO_DO_METODO[certificado.inscricao.presenca.metodo]}
              </Aviso>
            </div>

            <Cartao className="mt-6">
              <Etiqueta>participante</Etiqueta>
              <Titulo nivel={2} className="mt-1">
                {certificado.inscricao.usuario.nome}
              </Titulo>

              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="etiqueta text-texto-2">evento</dt>
                  <dd className="mt-1 font-semibold">{certificado.inscricao.evento.nome}</dd>
                </div>
                <div>
                  <dt className="etiqueta text-texto-2">realizado em</dt>
                  <dd className="mt-1">{dataLongaAcre(certificado.inscricao.evento.inicioEm)}</dd>
                </div>
                <div>
                  <dt className="etiqueta text-texto-2">carga horária</dt>
                  <dd className="mt-1">
                    {formatarCargaHoraria(certificado.inscricao.evento.cargaHorariaMinutos)}
                  </dd>
                </div>
                {certificado.inscricao.evento.instituicoes.length > 0 ? (
                  <div>
                    <dt className="etiqueta text-texto-2">organização</dt>
                    <dd className="mt-1">
                      {certificado.inscricao.evento.instituicoes
                        .map((i) => i.instituicao.nome)
                        .join(", ")}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </Cartao>
          </>
        )}

        <Link href="/validar" className="mt-8 inline-block text-sm text-texto-2 hover:text-violeta">
          ← Consultar outro código
        </Link>
      </main>
    </>
  );
}
