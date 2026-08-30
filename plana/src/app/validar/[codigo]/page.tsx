import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Aviso, Cartao, Dado, Etiqueta, Titulo } from "@/components/ui";
import { Logotipo } from "@/components/marca/Logotipo";
import { dataLongaAcre, formatarCargaHoraria } from "@/lib/fuso";
import { ConferenciaDeNome } from "./conferencia-de-nome";
import type { MetodoPresenca } from "@/generated/prisma/client";

export const metadata = { title: "Validação de certificado" };

/** Como cada presença foi confirmada. Quem confere o certificado tem direito a
 *  saber por qual caminho, já que eles têm rigores diferentes. */
const DESCRICAO_DO_METODO: Record<MetodoPresenca, string> = {
  QR_GEOLOCALIZACAO: "por leitura de QR Code no local, com conferência de geolocalização.",
  CODIGO_REMOTO:
    "a distância, em evento online ou híbrido, pelo código pessoal do participante.",
  MANUAL: "por lançamento da organização do evento.",
};

/** O que a consulta pública precisa mostrar, venha de conta viva ou de registro
 *  arquivado — a tela é a mesma porque o documento conferido é o mesmo. */
type Ficha = {
  /** Nulo quando o titular excluiu a conta: ali o nome não é guardado legível. */
  nome: string | null;
  eventoNome: string;
  eventoInicioEm: Date;
  cargaHorariaMinutos: number;
  organizacoes: string[];
  metodo: MetodoPresenca;
  contaExcluida: boolean;
};

/**
 * Consulta pública de autenticidade — o destino do QR do bloco de validação.
 *
 * Mostra o mínimo necessário para confirmar que o documento é verdadeiro: quem
 * participou, de quê e com que carga horária. Não expõe e-mail, telefone, perfil
 * nem qualquer dado do check-in: a finalidade aqui é conferir um certificado,
 * não consultar uma pessoa.
 *
 * A busca tem duas fontes. A primeira é o certificado ligado à inscrição. A
 * segunda é o registro arquivado de quem excluiu a conta mantendo a validação:
 * o documento continua em poder de terceiros, e negar autenticidade a um
 * certificado verdadeiro seria pior do que guardar o pouco que ele já imprime.
 */
async function buscarFicha(codigo: string): Promise<Ficha | null> {
  const [certificado, arquivado] = await Promise.all([
    prisma.certificado.findUnique({
      where: { codigoValidacao: codigo },
      select: {
        inscricao: {
          select: {
            usuario: { select: { nome: true } },
            presenca: { select: { metodo: true } },
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
    }),
    // Sem `nomeHash` no select: o hash serve à conferência digitada, feita por
    // ação própria, e não tem por que trafegar até a renderização da página.
    prisma.certificadoArquivado.findUnique({
      where: { codigoValidacao: codigo },
      select: {
        eventoNome: true,
        eventoInicioEm: true,
        cargaHorariaMinutos: true,
        organizacoes: true,
        metodoPresenca: true,
      },
    }),
  ]);

  if (certificado?.inscricao.presenca) {
    const { inscricao } = certificado;
    return {
      nome: inscricao.usuario.nome,
      eventoNome: inscricao.evento.nome,
      eventoInicioEm: inscricao.evento.inicioEm,
      cargaHorariaMinutos: inscricao.evento.cargaHorariaMinutos,
      organizacoes: inscricao.evento.instituicoes.map((i) => i.instituicao.nome),
      metodo: inscricao.presenca!.metodo,
      contaExcluida: false,
    };
  }

  if (arquivado) {
    return {
      nome: null,
      eventoNome: arquivado.eventoNome,
      eventoInicioEm: arquivado.eventoInicioEm,
      cargaHorariaMinutos: arquivado.cargaHorariaMinutos,
      organizacoes: arquivado.organizacoes ? arquivado.organizacoes.split(", ") : [],
      metodo: arquivado.metodoPresenca,
      contaExcluida: true,
    };
  }

  return null;
}

export default async function PaginaValidacao({ params }: PageProps<"/validar/[codigo]">) {
  const { codigo } = await params;
  const codigoNormalizado = decodeURIComponent(codigo).trim().toUpperCase();
  const ficha = await buscarFicha(codigoNormalizado);

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

        {!ficha ? (
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
                Emitido pela PlanA com presença registrada {DESCRICAO_DO_METODO[ficha.metodo]}
              </Aviso>
            </div>

            <Cartao className="mt-6">
              {ficha.nome !== null ? (
                <>
                  <Etiqueta>participante</Etiqueta>
                  <Titulo nivel={2} className="mt-1">
                    {ficha.nome}
                  </Titulo>
                </>
              ) : (
                <>
                  <Etiqueta>participante</Etiqueta>
                  <p className="mt-1 text-base font-semibold text-texto-2">
                    Não divulgado — conta excluída pelo titular
                  </p>
                </>
              )}

              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="etiqueta text-texto-2">evento</dt>
                  <dd className="mt-1 font-semibold">{ficha.eventoNome}</dd>
                </div>
                <div>
                  <dt className="etiqueta text-texto-2">realizado em</dt>
                  <dd className="mt-1">{dataLongaAcre(ficha.eventoInicioEm)}</dd>
                </div>
                <div>
                  <dt className="etiqueta text-texto-2">carga horária</dt>
                  <dd className="mt-1">{formatarCargaHoraria(ficha.cargaHorariaMinutos)}</dd>
                </div>
                {ficha.organizacoes.length > 0 ? (
                  <div>
                    <dt className="etiqueta text-texto-2">organização</dt>
                    <dd className="mt-1">{ficha.organizacoes.join(", ")}</dd>
                  </div>
                ) : null}
              </dl>
            </Cartao>

            {ficha.contaExcluida ? (
              <>
                <Cartao className="mt-6">
                  <Titulo nivel={3}>Conferir o nome do participante</Titulo>
                  <p className="mt-2 text-sm text-texto-2">
                    O participante excluiu a conta na PlanA. O certificado continua válido, mas o
                    nome não fica guardado de forma legível: a plataforma não tem como exibi-lo, e
                    ninguém consegue partir deste código para descobrir de quem é o documento.
                  </p>
                  <p className="mt-2 text-sm text-texto-2">
                    Se você tem o certificado em mãos, digite abaixo o nome impresso nele. A
                    resposta é apenas se confere ou não.
                  </p>
                  <ConferenciaDeNome codigo={codigoNormalizado} />
                </Cartao>
                <p className="mt-4 text-sm text-texto-2">
                  Não há mais conta, contato, perfil ou histórico associados a este registro.
                </p>
              </>
            ) : null}
          </>
        )}

        <Link href="/validar" className="mt-8 inline-block text-sm text-texto-2 hover:text-violeta">
          ← Consultar outro código
        </Link>
      </main>
    </>
  );
}
