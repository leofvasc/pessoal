import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirOrganizador , escopoDeEventos } from "@/lib/sessao";
import { paraCampoAcre } from "@/lib/fuso";
import { Titulo } from "@/components/ui";
import {
  FormularioEvento,
  type DadosIniciaisEvento,
} from "@/app/painel/eventos/novo/formulario";

export const metadata = { title: "Editar evento" };

export default async function PaginaEditarEvento({
  params,
}: PageProps<"/painel/eventos/[id]/editar">) {
  const { id } = await params;
  const sessao = await exigirOrganizador();
  const evento = await prisma.evento.findFirst({
    where: { id, ...escopoDeEventos(sessao), excluidoEm: null },
    include: { palestrantes: { orderBy: { ordem: "asc" } } },
  });
  if (!evento) notFound();

  const dados: DadosIniciaisEvento = {
    id: evento.id,
    nome: evento.nome,
    descricao: evento.descricao,
    modalidade: evento.modalidade,
    inicioLocal: paraCampoAcre(evento.inicioEm),
    fimLocal: paraCampoAcre(evento.fimEm),
    localNome: evento.localNome ?? "",
    localEndereco: evento.localEndereco ?? "",
    meioTransmissao: evento.meioTransmissao ?? "",
    latitude: evento.latitude,
    longitude: evento.longitude,
    cargaHorariaMinutos: evento.cargaHorariaMinutos,
    gratuito: evento.gratuito,
    // O formulário digita em reais; o banco guarda centavos.
    valorReais:
      evento.valorCentavos !== null ? (evento.valorCentavos / 100).toFixed(2).replace(".", ",") : "",
    instrucoesPagamento: evento.instrucoesPagamento ?? "",
    tutorVirtualUrl: evento.tutorVirtualUrl ?? "",
    palestrantes: evento.palestrantes.map(({ nome, qualificacao }) => ({
      nome,
      qualificacao,
    })),
  };

  return (
    <>
      <Link href={`/painel/eventos/${evento.id}`} className="text-sm text-texto-2 hover:text-violeta">
        ← Voltar ao evento
      </Link>
      <Titulo className="mt-4">Editar evento</Titulo>
      <p className="mt-2 text-sm text-texto-2">
        Altere os dados principais. O código, os links e os QR Codes existentes permanecem os mesmos.
      </p>
      <FormularioEvento evento={dados} />
    </>
  );
}
