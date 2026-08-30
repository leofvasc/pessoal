import { prisma } from "@/lib/prisma";
import { ehMaster, exigirOrganizador } from "@/lib/sessao";
import { modeloPadraoDeCertificado } from "@/lib/configuracao";
import { formatarTamanho } from "@/lib/armazenamento";
import { dataCurtaAcre } from "@/lib/fuso";
import { Aviso, Etiqueta, Titulo } from "@/components/ui";
import { ModeloPadraoDeCertificado } from "./formulario";
import { AdministracaoDeInstituicoes } from "./instituicoes";
import { AdministracaoDeContas } from "./contas";
import { TrilhaAdministrativa } from "./trilha";

export const metadata = { title: "Configurações" };

/**
 * Configurações que valem para toda a plataforma.
 *
 * O modelo padrão de certificado é visível a qualquer gestor. As instituições
 * organizadoras e as contas são administradas apenas pelo master: é aqui que
 * ele cadastra a instituição, vincula a ela uma conta existente — ato que cria
 * um organizador na PlanA — e opera as contas.
 */
export default async function PaginaConfiguracoes() {
  const sessao = await exigirOrganizador();
  const master = ehMaster(sessao);

  const modelo = await modeloPadraoDeCertificado();
  const eventosNoPadrao = modelo
    ? await prisma.evento.count({
        where: { certificadoBaseArquivoId: modelo.arquivoId, excluidoEm: null },
      })
    : 0;

  const instituicoes = master
    ? await prisma.instituicao.findMany({
        orderBy: { nome: "asc" },
        select: {
          id: true,
          nome: true,
          nomeCurto: true,
          tipo: true,
          documento: true,
          emailContato: true,
          telefoneContato: true,
          site: true,
          esfera: true,
          anotacaoInterna: true,
          suspensaEm: true,
          motivoSuspensao: true,
          _count: { select: { eventos: true } },
          gestores: {
            orderBy: { vinculadoEm: "asc" },
            select: {
              vinculadoEm: true,
              usuario: { select: { id: true, nome: true, email: true, suspensoEm: true } },
            },
          },
        },
      })
    : [];

  return (
    <>
      <Titulo>Configurações</Titulo>
      <p className="mt-2 max-w-2xl text-sm text-texto-2">
        O que vale para toda a plataforma, independentemente do evento.
      </p>

      <section className="mt-10 max-w-3xl">
        <Titulo nivel={2}>Modelo padrão de certificado</Titulo>
        <div className="mt-4">
          <ModeloPadraoDeCertificado
            modelo={
              modelo
                ? {
                    arquivoId: modelo.arquivoId,
                    nomeOriginal: modelo.nomeOriginal,
                    tamanho: formatarTamanho(modelo.tamanhoBytes),
                    enviadoEm: dataCurtaAcre(modelo.criadoEm),
                    eventosNoPadrao,
                  }
                : null
            }
          />
        </div>
      </section>

      {master ? (
        <>
          <section className="mt-14">
            <Etiqueta>administração</Etiqueta>
            <Titulo nivel={2} className="mt-1">
              Instituições organizadoras
            </Titulo>
            <p className="mt-2 max-w-3xl text-sm text-texto-2">
              A lista é alimentada só por aqui. Vincular uma conta existente a uma instituição é o
              que a torna organizadora na PlanA: a partir daí ela tem painel, cria eventos em nome
              da instituição e emite certificado assinado por ela. Desfazer o vínculo devolve a
              pessoa à condição de participante, sem lhe tirar inscrição, presença ou certificado
              nenhum.
            </p>
            <div className="mt-4">
              <Aviso titulo="Por que a lista é fechada">
                A página pública de validação declara o certificado autêntico. Se qualquer pessoa
                pudesse cadastrar a própria organização e emitir, bastaria usar o nome de uma
                universidade para que a plataforma passasse a avalizar credencial fabricada — e
                esses documentos circulam para horas complementares, educação continuada e
                progressão funcional.
              </Aviso>
            </div>
            <div className="mt-6">
              <AdministracaoDeInstituicoes
                instituicoes={instituicoes.map((i) => ({
                  ...i,
                  suspensaEm: i.suspensaEm?.toISOString() ?? null,
                  gestores: i.gestores.map((g) => ({
                    ...g.usuario,
                    vinculadoEm: g.vinculadoEm.toISOString(),
                  })),
                }))}
              />
            </div>
          </section>

          <section className="mt-14">
            <Etiqueta>administração</Etiqueta>
            <Titulo nivel={2} className="mt-1">
              Contas de usuário
            </Titulo>
            <p className="mt-2 max-w-3xl text-sm text-texto-2">
              Busque pelo nome ou pelo e-mail para operar uma conta. A lista não é exibida inteira
              de propósito: navegar por cadastro de participante sem motivo é tratamento sem
              finalidade, e a busca cobre o que a administração precisa fazer.
            </p>
            <div className="mt-6">
              <AdministracaoDeContas />
            </div>
          </section>

          <section className="mt-14">
            <Etiqueta>administração</Etiqueta>
            <Titulo nivel={2} className="mt-1">
              Trilha administrativa
            </Titulo>
            <p className="mt-2 max-w-3xl text-sm text-texto-2">
              Tudo que a administração faz sobre contas e instituições fica registrado. Poder
              administrativo sem trilha é o que costuma dar errado: depois de uma suspensão
              contestada, ninguém consegue reconstruir quem fez o quê.
            </p>
            <div className="mt-6">
              <TrilhaAdministrativa />
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
