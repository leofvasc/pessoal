/**
 * Como o evento se descreve para uma agenda pessoal.
 *
 * O campo LOCATION de um calendário serve para uma coisa só: o aparelho abrir
 * o mapa ou a pessoa saber para onde ir. Por isso o presencial manda endereço,
 * o online manda o meio de transmissão, e o híbrido manda os dois — quem se
 * inscreveu na sala e quem se inscreveu na transmissão leem o mesmo
 * compromisso, e cada um precisa achar o seu caminho ali.
 *
 * Isomórfico: o mesmo texto compõe o .ics e o endereço do Google Agenda.
 */
import type { Modalidade } from "@/generated/prisma/client";

export function localParaAgenda(evento: {
  modalidade: Modalidade;
  localNome: string | null;
  localEndereco: string | null;
  meioTransmissao: string | null;
}): string | null {
  const presencial = [evento.localNome, evento.localEndereco].filter(Boolean).join(" — ");

  switch (evento.modalidade) {
    case "PRESENCIAL":
      return presencial || null;
    case "ONLINE":
      return evento.meioTransmissao || null;
    case "HIBRIDO":
      return [presencial, evento.meioTransmissao].filter(Boolean).join(" · ") || null;
  }
}
