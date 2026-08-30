import "server-only";

/**
 * Busca de endereços para posicionar o mapa.
 *
 * A decisão original — pino manual, sem geocodificação — continua de pé, e o
 * motivo dela também: o ponto que valida a presença é o que o organizador
 * marca, não o que um serviço devolve. O centroide de "Rua Benjamin Constant,
 * Rio Branco" pode cair a trezentos metros da porta do auditório, e a
 * tolerância do check-in é de setenta.
 *
 * O que faltava era outra coisa: um jeito de chegar perto sem arrastar o mapa
 * do Acre até Manaus. É isso que esta rota faz. Ela move a câmera; quem marca
 * o ponto continua sendo o organizador.
 *
 * A consulta passa pelo servidor, e não pelo navegador, por três razões. A
 * política de uso do Nominatim exige User-Agent identificável e no máximo uma
 * requisição por segundo, coisas que não se garantem em código de cliente. O
 * navegador do organizador não precisa expor o próprio IP a um terceiro. E o
 * cache aqui atende a todos os organizadores, não a um só.
 */
import { NextResponse } from "next/server";
import { exigirOrganizador } from "@/lib/sessao";
import { registrarTentativa } from "@/lib/limite-tentativas";

type ResultadoNominatim = {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  address?: Record<string, string>;
};

export type LocalEncontrado = {
  titulo: string;
  detalhe: string;
  latitude: number;
  longitude: number;
};

/**
 * Cache em memória do processo. Some no reinício, e tudo bem: ele existe para
 * não repetir a mesma busca durante uma sessão de cadastro, não para ser
 * fonte de verdade.
 */
const cache = new Map<string, { em: number; dados: LocalEncontrado[] }>();
const VALIDADE_MS = 30 * 60 * 1000;
const LIMITE_DO_CACHE = 200;

/** Última chamada ao serviço, para respeitar o intervalo de um segundo. */
let ultimaChamada = 0;

async function esperarAVez() {
  const espera = Math.max(0, 1100 - (Date.now() - ultimaChamada));
  if (espera > 0) await new Promise((resolver) => setTimeout(resolver, espera));
  ultimaChamada = Date.now();
}

/** Monta título curto e detalhe longo a partir do endereço estruturado. */
function resumir(item: ResultadoNominatim): LocalEncontrado {
  const endereco = item.address ?? {};
  const titulo =
    endereco.amenity ||
    endereco.building ||
    endereco.university ||
    endereco.college ||
    endereco.school ||
    endereco.office ||
    [endereco.road, endereco.house_number].filter(Boolean).join(", ") ||
    endereco.suburb ||
    endereco.city ||
    endereco.town ||
    endereco.municipality ||
    item.display_name.split(",")[0];

  const detalhe = [
    endereco.road && endereco.amenity ? endereco.road : null,
    endereco.suburb || endereco.neighbourhood,
    endereco.city || endereco.town || endereco.municipality || endereco.village,
    endereco.state,
    endereco.postcode,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    titulo,
    detalhe: detalhe || item.display_name,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
  };
}

export async function GET(requisicao: Request) {
  // Só quem cadastra evento busca endereço. Rota aberta viraria proxy de
  // geocodificação de graça para qualquer um, em nome da PlanA.
  const sessao = await exigirOrganizador().catch(() => null);
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 403 });

  const consulta = new URL(requisicao.url).searchParams.get("q")?.trim() ?? "";
  if (consulta.length < 3) return NextResponse.json({ locais: [] });

  const chave = consulta.toLowerCase();
  const guardado = cache.get(chave);
  if (guardado && Date.now() - guardado.em < VALIDADE_MS) {
    return NextResponse.json({ locais: guardado.dados });
  }

  const limite = registrarTentativa(`busca-local:${sessao.usuarioId}`, {
    maximo: 40,
    janelaSegundos: 10 * 60,
  });
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: "Muitas buscas seguidas. Aguarde um instante." },
      { status: 429 },
    );
  }

  const endereco = new URL("https://nominatim.openstreetmap.org/search");
  endereco.searchParams.set("q", consulta);
  endereco.searchParams.set("format", "jsonv2");
  endereco.searchParams.set("addressdetails", "1");
  endereco.searchParams.set("limit", "6");
  // Restrito ao Brasil: a plataforma organiza eventos aqui, e limitar o
  // universo melhora muito a pontaria de buscas curtas como "centro".
  endereco.searchParams.set("countrycodes", "br");
  endereco.searchParams.set("accept-language", "pt-BR");

  try {
    await esperarAVez();
    const resposta = await fetch(endereco, {
      headers: {
        // Exigido pela política de uso do Nominatim: serviço identificável e
        // com contato alcançável.
        "User-Agent": "PlanA/1.0 (plataforma de eventos; suporte via eventosplana.app)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resposta.ok) {
      return NextResponse.json({ erro: "Serviço de busca indisponível." }, { status: 502 });
    }

    const bruto = (await resposta.json()) as ResultadoNominatim[];
    const locais = bruto
      .map(resumir)
      .filter((local) => Number.isFinite(local.latitude) && Number.isFinite(local.longitude));

    if (cache.size > LIMITE_DO_CACHE) cache.clear();
    cache.set(chave, { em: Date.now(), dados: locais });

    return NextResponse.json({ locais });
  } catch {
    return NextResponse.json({ erro: "Não foi possível buscar agora." }, { status: 502 });
  }
}
