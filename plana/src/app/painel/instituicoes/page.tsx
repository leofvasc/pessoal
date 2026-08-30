import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ehMaster, exigirOrganizador } from "@/lib/sessao";
import { nomeDeExibicao, ROTULO_DO_TIPO } from "@/lib/organizadores";
import { Aviso, Cartao, Titulo } from "@/components/ui";
import { LogotipoDaInstituicao } from "./formulario";

export const metadata = { title: "Instituições organizadoras" };

/**
 * Lista das instituições cadastradas.
 *
 * O cadastro em si mora em Configurações e é alimentado somente pelo master.
 * Esta tela é a consulta: o organizador precisa saber quais instituições
 * existem e quais delas pode usar ao criar um evento. O logotipo continua
 * podendo ser enviado por quem gere a instituição, porque é arte, não
 * identidade — e quem tem o arquivo é a própria organização.
 */
export default async function PaginaInstituicoes() {
  const sessao = await exigirOrganizador();
  const master = ehMaster(sessao);

  const geridas = await prisma.instituicaoGestor.findMany({
    where: { usuarioId: sessao.usuarioId },
    select: { instituicaoId: true },
  });
  const idsGeridos = new Set(geridas.map((g) => g.instituicaoId));

  const instituicoes = await prisma.instituicao.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      nomeCurto: true,
      tipo: true,
      logoArquivoId: true,
      emailContato: true,
      site: true,
      suspensaEm: true,
      _count: { select: { eventos: true } },
    },
  });

  return (
    <>
      <Titulo>Instituições organizadoras</Titulo>
      <p className="mt-2 max-w-2xl text-sm text-texto-2">
        São elas que assinam o evento e saem impressas no certificado. Um mesmo evento pode ter
        várias.
      </p>

      <div className="mt-6 max-w-2xl">
        {master ? (
          <Aviso>
            O cadastro fica em{" "}
            <Link href="/painel/configuracoes" className="font-semibold text-violeta">
              Configurações
            </Link>
            , junto com o vínculo dos gestores.
          </Aviso>
        ) : (
          <Aviso titulo="Lista fechada">
            A relação é mantida pela administração da plataforma. Ao criar um evento, você escolhe
            entre as instituições que gere. Para incluir outra, fale com a administração.
          </Aviso>
        )}
      </div>

      <div className="mt-8 space-y-3">
        {instituicoes.length === 0 ? (
          <Cartao>
            <p className="text-sm text-texto-2">Nenhuma instituição cadastrada.</p>
          </Cartao>
        ) : (
          instituicoes.map((instituicao) => (
            <Cartao key={instituicao.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="quebra-texto font-bold text-tinta">
                      {nomeDeExibicao(instituicao)}
                    </span>
                    {idsGeridos.has(instituicao.id) ? (
                      <span className="rounded-full bg-lilas px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-profundo">
                        você gere
                      </span>
                    ) : null}
                    {instituicao.suspensaEm ? (
                      <span className="rounded-full bg-erro/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-erro">
                        suspensa
                      </span>
                    ) : null}
                  </div>
                  <p className="quebra-texto mt-1 text-xs text-texto-2">
                    {ROTULO_DO_TIPO[instituicao.tipo]} · {instituicao._count.eventos} evento(s)
                    {instituicao.emailContato ? ` · ${instituicao.emailContato}` : ""}
                  </p>
                </div>

                {idsGeridos.has(instituicao.id) || master ? (
                  <LogotipoDaInstituicao
                    instituicaoId={instituicao.id}
                    logoArquivoId={instituicao.logoArquivoId}
                  />
                ) : instituicao.logoArquivoId ? (
                  <span className="text-xs text-texto-2">com logotipo</span>
                ) : null}
              </div>
            </Cartao>
          ))
        )}
      </div>
    </>
  );
}
