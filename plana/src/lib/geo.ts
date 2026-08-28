/**
 * Validação de presença por geolocalização.
 * Planejamento, seção 8.1: a presença é validada cruzando a leitura do QR Code,
 * o login do participante e a geolocalização do dispositivo, comparada ao ponto
 * definido manualmente pelo organizador no cadastro do evento. É admitida uma
 * tolerância de até 70 metros.
 */

/** Tolerância fixada no planejamento. */
export const TOLERANCIA_METROS = 70;

/**
 * Precisão acima da qual a leitura do GPS não serve para decidir nada: uma
 * medição com ±300 m de incerteza "dentro" do raio de 70 m é coincidência, não
 * prova. Nesses casos o participante é orientado a pedir lançamento manual
 * (seção 7), que o planejamento mantém sempre disponível justamente porque a
 * precisão do GPS piora em ambiente fechado.
 */
export const PRECISAO_MAXIMA_ACEITA_METROS = 200;

const RAIO_TERRA_METROS = 6_371_008.8;

export type Ponto = { latitude: number; longitude: number };

/** Distância em metros entre dois pontos pela fórmula de haversine. */
export function distanciaMetros(a: Ponto, b: Ponto): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const lat1 = a.latitude * rad;
  const lat2 = b.latitude * rad;

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_METROS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type ResultadoValidacao =
  | { valido: true; distancia: number }
  | { valido: false; motivo: "sem_ponto_do_evento" | "precisao_insuficiente" | "fora_do_raio"; distancia: number | null };

/**
 * Decide se a coordenada informada pelo dispositivo confirma a presença.
 * `precisao` é o `coords.accuracy` devolvido pela Geolocation API, em metros.
 */
export function validarPresenca(
  pontoDoEvento: Partial<Ponto> | null,
  leitura: Ponto & { precisao?: number },
): ResultadoValidacao {
  if (
    !pontoDoEvento ||
    typeof pontoDoEvento.latitude !== "number" ||
    typeof pontoDoEvento.longitude !== "number"
  ) {
    return { valido: false, motivo: "sem_ponto_do_evento", distancia: null };
  }

  const distancia = distanciaMetros(pontoDoEvento as Ponto, leitura);

  if (typeof leitura.precisao === "number" && leitura.precisao > PRECISAO_MAXIMA_ACEITA_METROS) {
    return { valido: false, motivo: "precisao_insuficiente", distancia };
  }

  if (distancia > TOLERANCIA_METROS) {
    return { valido: false, motivo: "fora_do_raio", distancia };
  }

  return { valido: true, distancia };
}

export function explicarFalha(motivo: Exclude<ResultadoValidacao, { valido: true }>["motivo"]): string {
  switch (motivo) {
    case "sem_ponto_do_evento":
      return "Este evento não tem ponto de localização definido. Peça o lançamento manual da presença à organização.";
    case "precisao_insuficiente":
      return "O sinal de GPS do seu aparelho está impreciso demais para confirmar a presença. Tente perto de uma janela ou peça o lançamento manual à organização.";
    case "fora_do_raio":
      return "Você está fora do raio do local do evento. Se estiver no local, o sinal pode estar impreciso — peça o lançamento manual à organização.";
  }
}
