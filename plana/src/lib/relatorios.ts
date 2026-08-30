import "server-only";

/**
 * Relatórios em planilha.
 *
 * Dois relatórios, com propósitos distintos:
 *
 *  - **por evento**: a lista nominal de inscritos, com presença, certificado e
 *    as respostas aos campos personalizados. É o documento que a organização
 *    entrega à instituição para comprovar quem esteve e quem não esteve;
 *
 *  - **consolidado**: um panorama de vários eventos, filtrável por período,
 *    organizador e situação. É o que responde "quantas horas de capacitação
 *    foram entregues no semestre" sem abrir evento por evento.
 *
 * Quem emite define o alcance, e o alcance é decidido no servidor: organizador
 * alcança os próprios eventos, master alcança tudo. O filtro por organizador
 * existe só para o master, e mesmo assim passa pelo mesmo recorte — um
 * organizador que forjasse o parâmetro continuaria vendo apenas o que é dele.
 *
 * As colunas com dado pessoal só aparecem no relatório por evento, que é
 * operacional e nominal por natureza. O consolidado trabalha com totais: não
 * há razão para uma visão gerencial de doze meses carregar nome e e-mail de
 * cada participante.
 */
import ExcelJS from "exceljs";
import { prisma } from "./prisma";
import { escopoDeEventos, type Sessao } from "./sessao";
import { formatarCargaHoraria, formatarEm, FUSO_ACRE } from "./fuso";
import { nomeDeExibicao } from "./organizadores";
import { rotuloDeGratuidade } from "./inscricao-valor";
import type { MetodoPresenca } from "@/generated/prisma/client";

const METODO: Record<MetodoPresenca, string> = {
  QR_GEOLOCALIZACAO: "QR Code no local",
  CODIGO_REMOTO: "Código pessoal (remoto)",
  MANUAL: "Lançamento manual",
};

const VIOLETA = "FF6B4EF0";
const LILAS = "FFEDE9FE";

function dataHora(valor: Date | null | undefined): string {
  return valor ? formatarEm(valor, FUSO_ACRE, "dd/MM/yyyy HH:mm") : "";
}

function data(valor: Date | null | undefined): string {
  return valor ? formatarEm(valor, FUSO_ACRE, "dd/MM/yyyy") : "";
}

/** Cabeçalho com a identidade da plataforma, repetido nas duas planilhas. */
function montarCabecalho(
  planilha: ExcelJS.Worksheet,
  titulo: string,
  linhas: string[],
  colunas: number,
) {
  planilha.mergeCells(1, 1, 1, colunas);
  const celulaTitulo = planilha.getCell(1, 1);
  celulaTitulo.value = titulo;
  celulaTitulo.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  celulaTitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VIOLETA } };
  celulaTitulo.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  planilha.getRow(1).height = 26;

  linhas.forEach((linha, indice) => {
    const numero = indice + 2;
    planilha.mergeCells(numero, 1, numero, colunas);
    const celula = planilha.getCell(numero, 1);
    celula.value = linha;
    celula.font = { size: 10, color: { argb: "FF4B5563" } };
    celula.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  });

  return linhas.length + 3;
}

function estilizarLinhaDeTitulos(planilha: ExcelJS.Worksheet, numero: number) {
  const linha = planilha.getRow(numero);
  linha.font = { bold: true, size: 10 };
  linha.alignment = { vertical: "middle", wrapText: true };
  linha.height = 30;
  linha.eachCell((celula) => {
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LILAS } };
    celula.border = { bottom: { style: "thin", color: { argb: "FFD1D5DB" } } };
  });
}

function ajustarLarguras(planilha: ExcelJS.Worksheet, linhaDeTitulos: number) {
  planilha.columns.forEach((coluna, indice) => {
    let maior = 12;
    planilha.eachRow((linha, numero) => {
      if (numero < linhaDeTitulos) return;
      const valor = linha.getCell(indice + 1).value;
      const texto = valor == null ? "" : String(valor);
      maior = Math.max(maior, Math.min(texto.length + 2, 48));
    });
    coluna.width = maior;
  });
}

// ---------------------------------------------------------------------------
// Relatório por evento
// ---------------------------------------------------------------------------

export type ResultadoDeRelatorio = { nomeArquivo: string; conteudo: Buffer };

export async function relatorioDoEvento(
  sessao: Sessao,
  eventoId: string,
): Promise<ResultadoDeRelatorio | null> {
  const evento = await prisma.evento.findFirst({
    where: { id: eventoId, ...escopoDeEventos(sessao) },
    select: {
      id: true,
      nome: true,
      codigoEvento: true,
      inicioEm: true,
      fimEm: true,
      modalidade: true,
      localNome: true,
      meioTransmissao: true,
      cargaHorariaMinutos: true,
      gratuito: true,
      valorCentavos: true,
      inscricoesDeContasExcluidas: true,
      presencasDeContasExcluidas: true,
      organizador: { select: { nome: true, email: true } },
      instituicoes: {
        orderBy: { ordem: "asc" },
        select: { instituicao: { select: { nome: true, nomeCurto: true } } },
      },
      camposInscricao: {
        orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
        select: { id: true, rotulo: true, arquivadoEm: true },
      },
      inscricoes: {
        orderBy: { criadaEm: "asc" },
        select: {
          criadaEm: true,
          canceladaEm: true,
          usuario: {
            select: { nome: true, email: true, telefone: true, perfil: true, perfilDetalhe: true },
          },
          presenca: { select: { registradaEm: true, metodo: true, distanciaMetros: true } },
          certificado: { select: { codigoValidacao: true, liberadoEm: true, primeiraEmissaoEm: true } },
          respostas: { select: { campoId: true, valor: true } },
        },
      },
    },
  });

  if (!evento) return null;

  const livro = new ExcelJS.Workbook();
  livro.creator = "PlanA";
  livro.created = new Date();

  const planilha = livro.addWorksheet("Inscrições e presenças", {
    views: [{ state: "frozen", ySplit: 0 }],
  });

  // Campos arquivados entram como coluna também: a resposta já dada integra o
  // registro da inscrição, e omiti-la esconderia dado que existe.
  const campos = evento.camposInscricao;

  const titulos = [
    "Nº",
    "Participante",
    "E-mail",
    "Telefone",
    "Perfil",
    "Detalhe do perfil",
    "Inscrição em",
    "Situação da inscrição",
    "Presença",
    "Presença registrada em",
    "Forma de registro",
    "Distância do local (m)",
    "Certificado",
    "Código de validação",
    ...campos.map((campo) => (campo.arquivadoEm ? `${campo.rotulo} (arquivado)` : campo.rotulo)),
  ];

  // A organização é a instituição que assina o evento — a mesma que sai no
  // certificado. A conta que administra aparece à parte, como responsável.
  const organizadorNome =
    evento.instituicoes.map((i) => nomeDeExibicao(i.instituicao)).join(", ") ||
    evento.organizador.nome;

  const ativas = evento.inscricoes.filter((i) => !i.canceladaEm);
  const presentes = ativas.filter((i) => i.presenca).length;

  const proximaLinha = montarCabecalho(
    planilha,
    `Inscrições e presenças — ${evento.nome}`,
    [
      `Código do evento: ${evento.codigoEvento} · Organização: ${organizadorNome}`,
      `Conta responsável: ${evento.organizador.nome} (${evento.organizador.email})`,
      `Realização: ${dataHora(evento.inicioEm)} a ${dataHora(evento.fimEm)} (horário do Acre) · Carga horária: ${formatarCargaHoraria(evento.cargaHorariaMinutos)}`,
      `${evento.modalidade} · ${evento.localNome ?? evento.meioTransmissao ?? "—"} · Inscrição: ${rotuloDeGratuidade(evento.gratuito, evento.valorCentavos)}`,
      `Instituições: ${evento.instituicoes.map((i) => i.instituicao.nome).join(", ") || "—"}`,
      `Inscrições ativas: ${ativas.length} · Presenças registradas: ${presentes} · Contas excluídas pelos titulares: ${evento.inscricoesDeContasExcluidas} inscrição(ões), ${evento.presencasDeContasExcluidas} presença(s)`,
      `Emitido em ${dataHora(new Date())} por ${sessao.nome}.`,
    ],
    titulos.length,
  );

  planilha.getRow(proximaLinha).values = titulos;
  estilizarLinhaDeTitulos(planilha, proximaLinha);

  evento.inscricoes.forEach((inscricao, indice) => {
    const porCampo = new Map(inscricao.respostas.map((r) => [r.campoId, r.valor]));
    planilha.addRow([
      indice + 1,
      inscricao.usuario.nome,
      inscricao.usuario.email,
      inscricao.usuario.telefone ?? "",
      inscricao.usuario.perfil,
      inscricao.usuario.perfilDetalhe ?? "",
      dataHora(inscricao.criadaEm),
      inscricao.canceladaEm ? `Cancelada em ${data(inscricao.canceladaEm)}` : "Ativa",
      inscricao.presenca ? "Sim" : "Não",
      dataHora(inscricao.presenca?.registradaEm),
      inscricao.presenca ? METODO[inscricao.presenca.metodo] : "",
      inscricao.presenca?.distanciaMetros ?? "",
      inscricao.certificado
        ? inscricao.certificado.primeiraEmissaoEm
          ? `Emitido em ${data(inscricao.certificado.primeiraEmissaoEm)}`
          : "Disponível, ainda não emitido"
        : "",
      inscricao.certificado?.codigoValidacao ?? "",
      ...campos.map((campo) => porCampo.get(campo.id) ?? ""),
    ]);
  });

  if (evento.inscricoesDeContasExcluidas > 0) {
    const linha = planilha.addRow([
      "",
      `+ ${evento.inscricoesDeContasExcluidas} inscrição(ões) e ${evento.presencasDeContasExcluidas} presença(s) de participantes que excluíram a conta. Os dados pessoais foram apagados e não constam desta lista.`,
    ]);
    linha.font = { italic: true, size: 9, color: { argb: "FF6B7280" } };
  }

  planilha.autoFilter = {
    from: { row: proximaLinha, column: 1 },
    to: { row: proximaLinha, column: titulos.length },
  };
  ajustarLarguras(planilha, proximaLinha);

  const conteudo = Buffer.from(await livro.xlsx.writeBuffer());
  return { nomeArquivo: `plana-${evento.codigoEvento}-inscricoes.xlsx`, conteudo };
}

// ---------------------------------------------------------------------------
// Relatório consolidado
// ---------------------------------------------------------------------------

export type FiltrosConsolidado = {
  de?: Date;
  ate?: Date;
  organizadorId?: string;
  eventoIds?: string[];
  modalidade?: "PRESENCIAL" | "ONLINE" | "HIBRIDO";
  incluirCancelados: boolean;
  incluirNaoPublicados: boolean;
};

export async function relatorioConsolidado(
  sessao: Sessao,
  filtros: FiltrosConsolidado,
): Promise<ResultadoDeRelatorio> {
  const escopo = escopoDeEventos(sessao);

  const eventos = await prisma.evento.findMany({
    where: {
      ...escopo,
      excluidoEm: null,
      // O filtro por organizador é do master. Para o organizador comum, o
      // escopo acima já fixou organizadorId, e o spread abaixo não o
      // sobrescreve porque só entra quando o campo vem preenchido.
      ...(escopo.organizadorId ? {} : filtros.organizadorId ? { organizadorId: filtros.organizadorId } : {}),
      ...(filtros.eventoIds?.length ? { id: { in: filtros.eventoIds } } : {}),
      ...(filtros.modalidade ? { modalidade: filtros.modalidade } : {}),
      ...(filtros.incluirCancelados ? {} : { canceladoEm: null }),
      ...(filtros.incluirNaoPublicados ? {} : { publicado: true }),
      ...(filtros.de || filtros.ate
        ? {
            inicioEm: {
              ...(filtros.de ? { gte: filtros.de } : {}),
              ...(filtros.ate ? { lte: filtros.ate } : {}),
            },
          }
        : {}),
    },
    orderBy: { inicioEm: "desc" },
    select: {
      id: true,
      nome: true,
      codigoEvento: true,
      slug: true,
      inicioEm: true,
      fimEm: true,
      modalidade: true,
      localNome: true,
      meioTransmissao: true,
      cargaHorariaMinutos: true,
      gratuito: true,
      valorCentavos: true,
      publicado: true,
      canceladoEm: true,
      criadoEm: true,
      inscricoesDeContasExcluidas: true,
      presencasDeContasExcluidas: true,
      organizador: { select: { id: true, nome: true, email: true } },
      instituicoes: {
        orderBy: { ordem: "asc" },
        select: { instituicao: { select: { nome: true, nomeCurto: true, tipo: true } } },
      },
      palestrantes: { orderBy: { ordem: "asc" }, select: { nome: true } },
      camposInscricao: { where: { arquivadoEm: null }, select: { id: true } },
      inscricoes: {
        select: {
          canceladaEm: true,
          presenca: { select: { metodo: true } },
          certificado: { select: { primeiraEmissaoEm: true } },
        },
      },
    },
  });

  const livro = new ExcelJS.Workbook();
  livro.creator = "PlanA";
  livro.created = new Date();

  const descricaoDoPeriodo =
    filtros.de || filtros.ate
      ? `Período: ${filtros.de ? data(filtros.de) : "início"} a ${filtros.ate ? data(filtros.ate) : "hoje"}`
      : "Período: todos os eventos";

  let nomeDoOrganizadorFiltrado = "";
  if (filtros.organizadorId && !escopo.organizadorId) {
    const alvo = await prisma.usuario.findUnique({
      where: { id: filtros.organizadorId },
      select: { nome: true },
    });
    nomeDoOrganizadorFiltrado = alvo?.nome ?? "";
  }

  const linhasDeContexto = [
    descricaoDoPeriodo,
    `Alcance: ${escopo.organizadorId ? "eventos da própria organização" : nomeDoOrganizadorFiltrado ? `eventos de ${nomeDoOrganizadorFiltrado}` : "todos os eventos da plataforma"}`,
    `Filtros: ${[
      filtros.modalidade ?? "todas as modalidades",
      filtros.incluirCancelados ? "incluindo cancelados" : "sem cancelados",
      filtros.incluirNaoPublicados ? "incluindo não publicados" : "somente publicados",
      filtros.eventoIds?.length ? `${filtros.eventoIds.length} evento(s) selecionado(s)` : "sem seleção manual",
    ].join(" · ")}`,
    `Emitido em ${dataHora(new Date())} por ${sessao.nome}.`,
  ];

  // ----- Aba 1: eventos, uma linha por evento -----
  const abaEventos = livro.addWorksheet("Eventos");
  const titulosEventos = [
    "Código",
    "Evento",
    "Organização",
    "Natureza",
    "Instituições",
    "Palestrantes",
    "Início",
    "Término",
    "Modalidade",
    "Local ou transmissão",
    "Carga horária",
    "Inscrição",
    "Situação",
    "Inscritos",
    "Cancelamentos",
    "Presentes",
    "Ausentes",
    "Taxa de presença",
    "Certificados emitidos",
    "Presença por QR",
    "Presença por código",
    "Presença manual",
    "Campos personalizados",
    "Inscrições de contas excluídas",
    "Presenças de contas excluídas",
    "Horas-participante",
  ];

  const inicioEventos = montarCabecalho(
    abaEventos,
    "Relatório consolidado de eventos — PlanA",
    linhasDeContexto,
    titulosEventos.length,
  );
  abaEventos.getRow(inicioEventos).values = titulosEventos;
  estilizarLinhaDeTitulos(abaEventos, inicioEventos);

  let totalInscritos = 0;
  let totalPresentes = 0;
  let totalCertificados = 0;
  let totalHorasParticipante = 0;

  for (const evento of eventos) {
    const ativas = evento.inscricoes.filter((i) => !i.canceladaEm);
    const canceladas = evento.inscricoes.length - ativas.length;
    const comPresenca = ativas.filter((i) => i.presenca);
    const inscritos = ativas.length + evento.inscricoesDeContasExcluidas;
    const presentes = comPresenca.length + evento.presencasDeContasExcluidas;
    const certificados = ativas.filter((i) => i.certificado?.primeiraEmissaoEm).length;
    const horas = (presentes * evento.cargaHorariaMinutos) / 60;

    totalInscritos += inscritos;
    totalPresentes += presentes;
    totalCertificados += certificados;
    totalHorasParticipante += horas;

    abaEventos.addRow([
      evento.codigoEvento,
      evento.nome,
      evento.instituicoes.map((i) => nomeDeExibicao(i.instituicao)).join(", ") ||
        evento.organizador.nome,
      evento.instituicoes[0]?.instituicao.tipo ?? "",
      evento.instituicoes.map((i) => i.instituicao.nome).join(", "),
      evento.palestrantes.map((p) => p.nome).join(", "),
      dataHora(evento.inicioEm),
      dataHora(evento.fimEm),
      evento.modalidade,
      evento.localNome ?? evento.meioTransmissao ?? "",
      formatarCargaHoraria(evento.cargaHorariaMinutos),
      rotuloDeGratuidade(evento.gratuito, evento.valorCentavos),
      evento.canceladoEm ? "Cancelado" : evento.publicado ? "Publicado" : "Rascunho",
      inscritos,
      canceladas,
      presentes,
      Math.max(inscritos - presentes, 0),
      inscritos > 0 ? presentes / inscritos : 0,
      certificados,
      comPresenca.filter((i) => i.presenca?.metodo === "QR_GEOLOCALIZACAO").length,
      comPresenca.filter((i) => i.presenca?.metodo === "CODIGO_REMOTO").length,
      comPresenca.filter((i) => i.presenca?.metodo === "MANUAL").length,
      evento.camposInscricao.length,
      evento.inscricoesDeContasExcluidas,
      evento.presencasDeContasExcluidas,
      Number(horas.toFixed(2)),
    ]);
  }

  abaEventos.getColumn(18).numFmt = "0.0%";
  abaEventos.autoFilter = {
    from: { row: inicioEventos, column: 1 },
    to: { row: inicioEventos, column: titulosEventos.length },
  };
  ajustarLarguras(abaEventos, inicioEventos);

  // ----- Aba 2: resumo -----
  const abaResumo = livro.addWorksheet("Resumo");
  const inicioResumo = montarCabecalho(abaResumo, "Resumo do período", linhasDeContexto, 2);
  abaResumo.getRow(inicioResumo).values = ["Indicador", "Valor"];
  estilizarLinhaDeTitulos(abaResumo, inicioResumo);

  const porModalidade = (modalidade: string) =>
    eventos.filter((e) => e.modalidade === modalidade).length;

  const linhasResumo: Array<[string, string | number]> = [
    ["Eventos no recorte", eventos.length],
    ["Eventos presenciais", porModalidade("PRESENCIAL")],
    ["Eventos online", porModalidade("ONLINE")],
    ["Eventos híbridos", porModalidade("HIBRIDO")],
    ["Eventos cancelados", eventos.filter((e) => e.canceladoEm).length],
    ["Eventos gratuitos", eventos.filter((e) => e.gratuito).length],
    ["Total de inscritos", totalInscritos],
    ["Total de presentes", totalPresentes],
    [
      "Taxa média de presença",
      totalInscritos > 0 ? `${((totalPresentes / totalInscritos) * 100).toFixed(1)}%` : "—",
    ],
    ["Certificados emitidos", totalCertificados],
    ["Horas-participante entregues", Number(totalHorasParticipante.toFixed(2))],
    [
      "Carga horária somada dos eventos",
      formatarCargaHoraria(eventos.reduce((soma, e) => soma + e.cargaHorariaMinutos, 0)),
    ],
  ];

  for (const [indicador, valor] of linhasResumo) abaResumo.addRow([indicador, valor]);
  ajustarLarguras(abaResumo, inicioResumo);

  // ----- Aba 3: organizadores, só para quem vê a plataforma inteira -----
  if (!escopo.organizadorId) {
    const abaOrganizadores = livro.addWorksheet("Por organização");
    const titulos = [
      "Organização",
      "Natureza",
      "Responsável pela conta",
      "E-mail de acesso",
      "Eventos",
      "Inscritos",
      "Presentes",
      "Taxa de presença",
      "Horas-participante",
    ];
    const inicio = montarCabecalho(
      abaOrganizadores,
      "Consolidado por organizador",
      linhasDeContexto,
      titulos.length,
    );
    abaOrganizadores.getRow(inicio).values = titulos;
    estilizarLinhaDeTitulos(abaOrganizadores, inicio);

    type Acumulado = {
      nome: string;
      tipo: string;
      responsavel: string;
      email: string;
      eventos: number;
      inscritos: number;
      presentes: number;
      horas: number;
    };
    const porOrganizador = new Map<string, Acumulado>();

    for (const evento of eventos) {
      // Agrupa por instituição assinante, e não por conta: duas pessoas do
      // mesmo centro de estudos entregam um número só.
      const chave =
        evento.instituicoes.map((i) => i.instituicao.nome).join(", ") || evento.organizador.email;
      const atual =
        porOrganizador.get(chave) ??
        {
          nome:
            evento.instituicoes.map((i) => nomeDeExibicao(i.instituicao)).join(", ") ||
            evento.organizador.nome,
          tipo: evento.instituicoes[0]?.instituicao.tipo ?? "",
          responsavel: evento.organizador.nome,
          email: evento.organizador.email,
          eventos: 0,
          inscritos: 0,
          presentes: 0,
          horas: 0,
        };

      const ativas = evento.inscricoes.filter((i) => !i.canceladaEm);
      const presentes = ativas.filter((i) => i.presenca).length + evento.presencasDeContasExcluidas;
      atual.eventos += 1;
      atual.inscritos += ativas.length + evento.inscricoesDeContasExcluidas;
      atual.presentes += presentes;
      atual.horas += (presentes * evento.cargaHorariaMinutos) / 60;
      porOrganizador.set(chave, atual);
    }

    for (const dado of [...porOrganizador.values()].sort((a, b) => b.eventos - a.eventos)) {
      abaOrganizadores.addRow([
        dado.nome,
        dado.tipo,
        dado.responsavel,
        dado.email,
        dado.eventos,
        dado.inscritos,
        dado.presentes,
        dado.inscritos > 0 ? dado.presentes / dado.inscritos : 0,
        Number(dado.horas.toFixed(2)),
      ]);
    }
    abaOrganizadores.getColumn(8).numFmt = "0.0%";
    ajustarLarguras(abaOrganizadores, inicio);
  }

  const carimbo = formatarEm(new Date(), FUSO_ACRE, "yyyy-MM-dd");
  const conteudo = Buffer.from(await livro.xlsx.writeBuffer());
  return { nomeArquivo: `plana-consolidado-${carimbo}.xlsx`, conteudo };
}
