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
import { codigoValidacao } from "./codigos";
import { notificar } from "./notificacoes";
import { temConsentimento } from "./consentimento";

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

  const evento = await prisma.evento.findUnique({
    where: { tokenQr },
    select: {
      id: true,
      nome: true,
      inicioEm: true,
      fimEm: true,
      latitude: true,
      longitude: true,
      codigoEvento: true,
      modalidade: true,
    },
  });

  if (!evento) {
    return recusar("qr_desconhecido", "Este QR Code não corresponde a nenhum evento.");
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
      evento: { select: { id: true, nome: true, codigoEvento: true, organizadorId: true } },
    },
  });

  if (!inscricao) return recusar("sem_inscricao", "Inscrição não encontrada.");
  if (inscricao.evento.organizadorId !== params.lancadaPorId) {
    return recusar("nao_autorizado", "Você não organiza este evento.");
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
