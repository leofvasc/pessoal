import { prisma } from "@/lib/prisma";
import { exigirOrganizador } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { FormularioInstituicao, ListaInstituicoes } from "./formulario";

export const metadata = { title: "Instituições organizadoras" };

/**
 * Planejamento, seção 3: cada instituição é cadastrada como entidade própria,
 * com nome e, quando aplicável, logotipo, em relação de muitos para muitos com
 * os eventos — o que permite exibi-la no certificado e usá-la como filtro em
 * relatórios.
 */
export default async function PaginaInstituicoes() {
  await exigirOrganizador();

  const instituicoes = await prisma.instituicao.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      logoArquivoId: true,
      _count: { select: { eventos: true } },
    },
  });

  return (
    <>
      <Titulo>Instituições organizadoras</Titulo>
      <p className="mt-2 max-w-2xl text-sm text-texto-2">
        Cadastre aqui as instituições que promovem seus eventos. Elas aparecem na página do evento
        e no certificado, e servem de filtro nos relatórios. Uma vez cadastradas, ficam disponíveis
        para todos os seus eventos.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <Cartao className="h-fit">
          <Titulo nivel={3}>Nova instituição</Titulo>
          <FormularioInstituicao />
        </Cartao>

        <div>
          <Titulo nivel={3}>Cadastradas</Titulo>
          <ListaInstituicoes instituicoes={instituicoes} />
        </div>
      </div>
    </>
  );
}
