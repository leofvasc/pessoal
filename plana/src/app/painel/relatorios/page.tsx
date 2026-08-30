import { prisma } from "@/lib/prisma";
import { ehMaster, escopoDeEventos, exigirOrganizador } from "@/lib/sessao";
import { nomeDeExibicao } from "@/lib/organizadores";
import { Etiqueta, Titulo } from "@/components/ui";
import { EmissorDeRelatorio } from "./emissor";

export const metadata = { title: "Relatórios" };

export default async function PaginaRelatorios() {
  const sessao = await exigirOrganizador();
  const master = ehMaster(sessao);

  const eventos = await prisma.evento.findMany({
    where: { ...escopoDeEventos(sessao), excluidoEm: null },
    orderBy: { inicioEm: "desc" },
    take: 300,
    select: {
      id: true,
      nome: true,
      inicioEm: true,
      codigoEvento: true,
      organizador: { select: { nome: true } },
      instituicoes: {
        orderBy: { ordem: "asc" },
        select: { instituicao: { select: { nome: true, nomeCurto: true } } },
      },
    },
  });

  // Filtro por conta responsável. O agrupamento do relatório é por instituição
  // assinante, mas o recorte precisa ser por conta, que é o que Evento guarda.
  const organizadores = master
    ? await prisma.usuario.findMany({
        where: { papel: { in: ["ORGANIZADOR", "MASTER"] }, excluidoEm: null },
        orderBy: { nome: "asc" },
        select: {
          id: true,
          nome: true,
          instituicoesGeridas: {
            select: { instituicao: { select: { nome: true, nomeCurto: true } } },
          },
        },
      })
    : [];

  return (
    <>
      <Etiqueta>planilhas</Etiqueta>
      <Titulo className="mt-1">Relatórios</Titulo>
      <p className="mt-2 text-sm text-texto-2">
        {master
          ? "Você emite sobre toda a plataforma e pode recortar por organizador, período, modalidade e seleção de eventos."
          : "Você emite sobre os eventos da sua organização. O recorte por período e por seleção de eventos está disponível abaixo."}
      </p>

      <EmissorDeRelatorio
        master={master}
        eventos={eventos.map((evento) => ({
          id: evento.id,
          nome: evento.nome,
          codigo: evento.codigoEvento,
          inicioEm: evento.inicioEm.toISOString(),
          organizador:
            evento.instituicoes.map((i) => nomeDeExibicao(i.instituicao)).join(", ") ||
            evento.organizador.nome,
        }))}
        organizadores={organizadores.map((conta) => {
          const instituicoes = conta.instituicoesGeridas
            .map(({ instituicao }) => nomeDeExibicao(instituicao))
            .join(", ");
          return {
            id: conta.id,
            nome: instituicoes ? `${conta.nome} — ${instituicoes}` : conta.nome,
          };
        })}
      />
    </>
  );
}
