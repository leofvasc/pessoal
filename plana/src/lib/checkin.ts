import "server-only";

/**
 * Registro de presença e liberação do certificado.
 *
 * Planejamento, seção 7: a plataforma é pensada para ter o máximo de automação
 * possível, com foco especial na automação entre o registro de presença pela
 * leitura do QR Code e a emissão do certificado. Esta função é esse foco: uma
 * leitura válida grava a presença, libera o certificado e avisa o participante,
 * numa transação só.
 */
import { prisma } from "./prisma";
import { validarPresenca, explicarFalha, type Ponto } from "./geo";
import { codigoValidacao, normalizarCodigoUsuario } from "./codigos";
import { notificar } from "./notificacoes";
import { temConsentimento } from "./consentimento";
import { registrarTentativa, liberar } from "./limite-tentativas";

export type ResultadoCheckin =
  | { ok: true; jaRegistrada: boolean; certificadoLiberado: boolean; distancia: number | null }
  | { ok: false; codigo: string; mensagem: string };

function recusar(codigo: string, mensagem: string): ResultadoCheckin {
  return { ok: false, codigo, mensagem };
}

/**
 * Janela em que a leitura do QR é aceita: de uma hora antes do início até uma
 * hora depois do término. Antes disso o QR já está projetado durante a
 * montagem; depois, a sala já se esvaziou.
 */
const FOLGA_MS = 60 * 60 * 1000;

export async function registrarPresencaPorQr(params: {
  tokenQr: string;
  usuarioId: string;
  leitura: Ponto & { precisao?: number };
}): Promise<ResultadoCheckin> {
  const { tokenQr, usuarioId, leitura } = params;

  const evento = await prisma.evento.findFirst({
    where: { tokenQr, excluidoEm: null },
    select: {
      id: true,
      nome: true,
      inicioEm: true,
      fimEm: true,
      latitude: true,
      longitude: true,
      codigoEvento: true,
      modalidade: true,
      canceladoEm: true,
    },
  });

  if (!evento) {
    return recusar("qr_desconhecido", "Este QR Code não corresponde a nenhum evento.");
  }
  if (evento.canceladoEm) {
    return recusar("evento_cancelado", "Este evento foi cancelado pela organização.");
  }

  const agora = Date.now();
  if (agora < evento.inicioEm.getTime() - FOLGA_MS) {
    return recusar("cedo_demais", "O registro de presença ainda não está aberto para este evento.");
  }
  if (agora > evento.fimEm.getTime() + FOLGA_MS) {
    return recusar(
      "tarde_demais",
      "O registro de presença deste evento já foi encerrado. Peça o lançamento manual à organização.",
    );
  }

  const inscricao = await prisma.inscricao.findUnique({
    where: { eventoId_usuarioId: { eventoId: evento.id, usuarioId } },
    select: { id: true, canceladaEm: true, presenca: { select: { id: true } } },
  });

  if (!inscricao) {
    return recusar("sem_inscricao", "Você não está inscrito neste evento.");
  }
  if (inscricao.canceladaEm) {
    return recusar("inscricao_cancelada", "Sua inscrição neste evento foi cancelada.");
  }
  if (inscricao.presenca) {
    return { ok: true, jaRegistrada: true, certificadoLiberado: true, distancia: null };
  }

  // A geolocalização só é lida com consentimento específico (seção 9). Sem ele
  // resta o lançamento manual, que o planejamento mantém sempre disponível.
  if (!(await temConsentimento(usuarioId, "GEOLOCALIZACAO_CHECKIN"))) {
    return recusar(
      "sem_consentimento_geo",
      "Para registrar presença pelo QR Code é preciso autorizar a leitura da localização. Você pode autorizar na sua conta ou pedir o lançamento manual à organização.",
    );
  }

  // Evento online não tem ponto no mapa: não há o que validar geograficamente.
  const exigeGeolocalizacao = evento.modalidade !== "ONLINE";
  let distancia: number | null = null;

  if (exigeGeolocalizacao) {
    const validacao = validarPresenca(
      { latitude: evento.latitude ?? undefined, longitude: evento.longitude ?? undefined },
      leitura,
    );
    if (!validacao.valido) {
      return recusar(validacao.motivo, explicarFalha(validacao.motivo));
    }
    distancia = validacao.distancia;
  }

  const { certificado } = await prisma.$transaction(async (tx) => {
    await tx.presenca.create({
      data: {
        inscricaoId: inscricao.id,
        metodo: "QR_GEOLOCALIZACAO",
        latitude: exigeGeolocalizacao ? leitura.latitude : null,
        longitude: exigeGeolocalizacao ? leitura.longitude : null,
        distanciaMetros: distancia,
        precisaoMetros: leitura.precisao ?? null,
      },
    });

    // Certificado automático: liberado no mesmo instante da confirmação.
    // O PDF só é montado quando o participante pedir (seção 6).
    const certificado = await tx.certificado.create({
      data: {
        inscricaoId: inscricao.id,
        codigoValidacao: codigoValidacao(evento.codigoEvento),
      },
    });

    return { certificado };
  });

  await notificar({
    usuarioId,
    tipo: "PRESENCA_REGISTRADA",
    titulo: "Presença confirmada",
    corpo: `Sua presença em ${evento.nome} foi registrada. O certificado fica disponível ao fim do evento.`,
    link: "/conta/certificados",
  });

  return {
    ok: true,
    jaRegistrada: false,
    certificadoLiberado: Boolean(certificado),
    distancia,
  };
}

/**
 * Lançamento manual pela organização — alternativa subsidiária ao QR Code
 * (seção 7), sempre disponível porque a precisão do GPS de smartphones varia e
 * piora em ambiente fechado (seção 8.1).
 */
export async function lancarPresencaManual(params: {
  inscricaoId: string;
  lancadaPorId: string;
}): Promise<ResultadoCheckin> {
  const inscricao = await prisma.inscricao.findUnique({
    where: { id: params.inscricaoId },
    select: {
      id: true,
      usuarioId: true,
      canceladaEm: true,
      presenca: { select: { id: true } },
      evento: { select: { id: true, nome: true, codigoEvento: true, organizadorId: true, canceladoEm: true, excluidoEm: true } },
    },
  });

  if (!inscricao) return recusar("sem_inscricao", "Inscrição não encontrada.");
  if (inscricao.evento.organizadorId !== params.lancadaPorId) {
    return recusar("nao_autorizado", "Você não organiza este evento.");
  }
  if (inscricao.evento.canceladoEm || inscricao.evento.excluidoEm) {
    return recusar("evento_indisponivel", "Este evento foi cancelado ou excluído.");
  }
  if (inscricao.canceladaEm) {
    return recusar("inscricao_cancelada", "Esta inscrição foi cancelada.");
  }
  if (inscricao.presenca) {
    return { ok: true, jaRegistrada: true, certificadoLiberado: true, distancia: null };
  }

  await prisma.$transaction(async (tx) => {
    await tx.presenca.create({
      data: {
        inscricaoId: inscricao.id,
        metodo: "MANUAL",
        lancadaPorId: params.lancadaPorId,
      },
    });
    await tx.certificado.create({
      data: {
        inscricaoId: inscricao.id,
        codigoValidacao: codigoValidacao(inscricao.evento.codigoEvento),
      },
    });
  });

  await notificar({
    usuarioId: inscricao.usuarioId,
    tipo: "PRESENCA_REGISTRADA",
    titulo: "Presença confirmada",
    corpo: `A organização registrou sua presença em ${inscricao.evento.nome}.`,
    link: "/conta/certificados",
  });

  return { ok: true, jaRegistrada: false, certificadoLiberado: true, distancia: null };
}

/**
 * Registro de presença à distância, para evento online ou híbrido.
 *
 * Quem assiste a distância não tem QR projetado para ler nem local físico
 * contra o qual conferir posição. O caminho aqui é outro: cada evento online ou
 * híbrido ganha uma página própria, de endereço secreto, que a organização
 * envia aos participantes remotos; nela a pessoa digita o código pessoal da sua
 * conta.
 *
 * A segurança não vem do código sozinho, que é curto para poder ser digitado.
 * Vem da soma de quatro coisas:
 *   1. o endereço da página é secreto e vale só para aquele evento;
 *   2. só registra presença de quem já está inscrito no evento;
 *   3. a janela de registro é a do evento, não vale antes nem muito depois;
 *   4. há limite de tentativas por origem, o que inviabiliza varrer códigos.
 */
export async function registrarPresencaRemota(params: {
  tokenRemoto: string;
  codigoDigitado: string;
  /** Identificador da origem da requisição, para o limite de tentativas. */
  origem: string;
}): Promise<ResultadoCheckin> {
  const chaveDeLimite = `remoto:${params.tokenRemoto}:${params.origem}`;
  const limite = registrarTentativa(chaveDeLimite, { maximo: 8, janelaSegundos: 600 });

  if (!limite.permitido) {
    const minutos = Math.ceil(limite.segundosParaLiberar / 60);
    return recusar(
      "limite_de_tentativas",
      `Muitas tentativas seguidas. Tente de novo em ${minutos} minuto${minutos > 1 ? "s" : ""}, ou peça o lançamento manual à organização.`,
    );
  }

  const evento = await prisma.evento.findFirst({
    where: { tokenRemoto: params.tokenRemoto, excluidoEm: null },
    select: {
      id: true,
      nome: true,
      inicioEm: true,
      fimEm: true,
      modalidade: true,
      codigoEvento: true,
      canceladoEm: true,
    },
  });

  if (!evento) {
    return recusar("pagina_desconhecida", "Esta página de presença não corresponde a nenhum evento.");
  }
  if (evento.canceladoEm) {
    return recusar("evento_cancelado", "Este evento foi cancelado pela organização.");
  }
  if (evento.modalidade === "PRESENCIAL") {
    return recusar(
      "evento_presencial",
      "Este evento é presencial: a presença se registra lendo o QR Code projetado na sala.",
    );
  }

  const agora = Date.now();
  if (agora < evento.inicioEm.getTime() - FOLGA_MS) {
    return recusar("cedo_demais", "O registro de presença ainda não está aberto para este evento.");
  }
  if (agora > evento.fimEm.getTime() + FOLGA_MS) {
    return recusar(
      "tarde_demais",
      "O registro de presença deste evento já foi encerrado. Peça o lançamento manual à organização.",
    );
  }

  const codigo = normalizarCodigoUsuario(params.codigoDigitado);
  const usuario = await prisma.usuario.findUnique({
    where: { codigoUsuario: codigo },
    select: { id: true, excluidoEm: true },
  });

  // Mensagem única para código inexistente e para código de quem não está
  // inscrito: distinguir os dois diria a quem tenta adivinhar que um código
  // existe, o que é justamente o que o limite de tentativas tenta impedir.
  const naoConfere = recusar(
    "codigo_nao_confere",
    "Código não encontrado entre os inscritos deste evento. Confira em “Seu código de usuário”, na sua conta.",
  );

  if (!usuario || usuario.excluidoEm) return naoConfere;

  const inscricao = await prisma.inscricao.findUnique({
    where: { eventoId_usuarioId: { eventoId: evento.id, usuarioId: usuario.id } },
    select: { id: true, canceladaEm: true, presenca: { select: { id: true } } },
  });

  if (!inscricao || inscricao.canceladaEm) return naoConfere;

  // Código certo: a contagem de tentativas some, para não punir quem vai
  // registrar a presença de várias pessoas do mesmo escritório ou laboratório.
  liberar(chaveDeLimite);

  if (inscricao.presenca) {
    return { ok: true, jaRegistrada: true, certificadoLiberado: true, distancia: null };
  }

  await prisma.$transaction(async (tx) => {
    await tx.presenca.create({
      data: { inscricaoId: inscricao.id, metodo: "CODIGO_REMOTO" },
    });
    await tx.certificado.create({
      data: {
        inscricaoId: inscricao.id,
        codigoValidacao: codigoValidacao(evento.codigoEvento),
      },
    });
  });

  await notificar({
    usuarioId: usuario.id,
    tipo: "PRESENCA_REGISTRADA",
    titulo: "Presença confirmada",
    corpo: `Sua presença a distância em ${evento.nome} foi registrada. O certificado fica disponível ao fim do evento.`,
    link: "/conta/certificados",
  });

  return { ok: true, jaRegistrada: false, certificadoLiberado: true, distancia: null };
}
