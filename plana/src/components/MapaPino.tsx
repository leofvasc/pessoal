"use client";

/**
 * Seleção manual do local do evento.
 *
 * Planejamento, seção 3: a localização é definida pelo organizador com um pino
 * inserido diretamente no mapa, dispensando qualquer geocodificação automática
 * a partir do endereço.
 *
 * Seção 10.3: implementado com Leaflet sobre camadas do OpenStreetMap, o que
 * dispensa custo e chave de API — seria incoerente eliminar a dependência de
 * serviço pago na geocodificação e reintroduzi-la na definição do mapa.
 *
 * A busca por endereço, acrescentada depois, não revoga a regra do pino
 * manual: ela move a câmera, e nada mais. O ponto que valida a presença
 * continua sendo o que o organizador marca, porque o centroide de uma rua
 * pode cair a centenas de metros da porta do auditório e a tolerância do
 * check-in é de setenta. Quando a busca acerta um prédio nomeado, o pino é
 * posto ali como sugestão a conferir, nunca como resposta final.
 */
import { useEffect, useRef, useState } from "react";
// O CSS vem do pacote instalado — sem CDN, coerente com a decisão de não
// depender de serviço externo para o mapa.
import "leaflet/dist/leaflet.css";
import type { Map as MapaLeaflet, Marker } from "leaflet";
import { Etiqueta } from "./ui";

/** Rio Branco/AC — ponto de partida coerente com o fuso de referência. */
const CENTRO_PADRAO: [number, number] = [-9.97499, -67.8243];

type Props = {
  latitudeInicial?: number | null;
  longitudeInicial?: number | null;
  aoMudar?: (ponto: { latitude: number; longitude: number }) => void;
};

type LocalEncontrado = {
  titulo: string;
  detalhe: string;
  latitude: number;
  longitude: number;
};

export function MapaPino({ latitudeInicial, longitudeInicial, aoMudar }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const pino = useRef<Marker | null>(null);
  /** Guarda a função de marcar do efeito, para a busca poder usá-la. */
  const marcarPonto = useRef<((lat: number, lon: number, zoom?: number) => void) | null>(null);

  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<LocalEncontrado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [sugerido, setSugerido] = useState(false);
  const [ponto, setPonto] = useState<{ latitude: number; longitude: number } | null>(
    typeof latitudeInicial === "number" && typeof longitudeInicial === "number"
      ? { latitude: latitudeInicial, longitude: longitudeInicial }
      : null,
  );

  useEffect(() => {
    let vivo = true;

    // O Leaflet toca em `window` no momento da importação, então só pode ser
    // carregado depois da montagem no cliente.
    (async () => {
      const L = await import("leaflet");
      if (!vivo || !container.current || mapa.current) return;

      const inicial: [number, number] = ponto
        ? [ponto.latitude, ponto.longitude]
        : CENTRO_PADRAO;

      const instancia = L.map(container.current).setView(inicial, ponto ? 17 : 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© colaboradores do OpenStreetMap",
      }).addTo(instancia);

      // Pino na cor violeta da marca, desenhado em SVG para não depender das
      // imagens padrão do Leaflet nem de mais um arquivo estático.
      const icone = L.divIcon({
        className: "",
        html:
          '<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M15 39C15 39 28 24.5 28 15A13 13 0 1 0 2 15c0 9.5 13 24 13 24z" fill="#6B4CF6"/>' +
          '<circle cx="15" cy="15" r="5" fill="#fff"/></svg>',
        iconSize: [30, 40],
        iconAnchor: [15, 39],
      });

      function marcar(latitude: number, longitude: number, zoom?: number) {
        if (zoom != null) instancia.setView([latitude, longitude], zoom);
        if (pino.current) {
          pino.current.setLatLng([latitude, longitude]);
        } else {
          pino.current = L.marker([latitude, longitude], { icon: icone, draggable: true }).addTo(
            instancia,
          );
          pino.current.on("dragend", () => {
            const p = pino.current!.getLatLng();
            const novo = { latitude: p.lat, longitude: p.lng };
            setPonto(novo);
            aoMudar?.(novo);
          });
        }
        const novo = { latitude, longitude };
        setPonto(novo);
        aoMudar?.(novo);
      }

      if (ponto) marcar(ponto.latitude, ponto.longitude);
      instancia.on("click", (evento) => {
        setSugerido(false);
        marcar(evento.latlng.lat, evento.latlng.lng);
      });

      marcarPonto.current = marcar;
      mapa.current = instancia;
    })();

    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
      pino.current = null;
      marcarPonto.current = null;
    };
    // Montagem única: o mapa gerencia o próprio estado depois disso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buscar() {
    const termo = consulta.trim();
    if (termo.length < 3) {
      setErroBusca("Escreva ao menos três letras.");
      return;
    }
    setBuscando(true);
    setErroBusca(null);
    try {
      const resposta = await fetch(`/api/locais?q=${encodeURIComponent(termo)}`);
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErroBusca(dados?.erro ?? "Não foi possível buscar agora.");
        setResultados(null);
        return;
      }
      setResultados(dados.locais as LocalEncontrado[]);
      if ((dados.locais as LocalEncontrado[]).length === 0) {
        setErroBusca("Nada encontrado. Tente incluir a cidade e o estado.");
      }
    } catch {
      setErroBusca("Não foi possível buscar agora.");
      setResultados(null);
    } finally {
      setBuscando(false);
    }
  }

  function escolher(local: LocalEncontrado) {
    // Zoom alto de propósito: o organizador precisa enxergar a quadra para
    // conferir se o ponto sugerido é mesmo a entrada certa.
    marcarPonto.current?.(local.latitude, local.longitude, 18);
    setSugerido(true);
    setResultados(null);
    setConsulta(`${local.titulo} — ${local.detalhe}`);
  }

  function usarMinhaLocalizacao() {
    if (!navigator.geolocation) {
      setErroBusca("Este navegador não informa a localização.");
      return;
    }
    setErroBusca(null);
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        marcarPonto.current?.(posicao.coords.latitude, posicao.coords.longitude, 18);
        setSugerido(false);
      },
      () => setErroBusca("Não foi possível obter sua localização."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div>
      <div className="mb-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={(e) => {
              // O mapa vive dentro do formulário do evento: Enter aqui não
              // pode disparar o cadastro inteiro.
              if (e.key === "Enter") {
                e.preventDefault();
                void buscar();
              }
            }}
            placeholder="Rua, número, bairro, cidade e estado"
            aria-label="Buscar endereço para posicionar o mapa"
            className="min-w-0 flex-1 rounded-xl border border-linha bg-white px-4 py-2.5 text-sm outline-none focus:border-violeta focus:ring-2 focus:ring-violeta/20"
          />
          <button
            type="button"
            onClick={() => void buscar()}
            disabled={buscando}
            className="rounded-xl bg-violeta px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-profundo disabled:opacity-60"
          >
            {buscando ? "Buscando…" : "Buscar"}
          </button>
          <button
            type="button"
            onClick={usarMinhaLocalizacao}
            title="Centralizar onde você está agora"
            className="rounded-xl border border-linha bg-white px-4 py-2.5 text-sm font-semibold text-tinta transition-colors hover:border-violeta"
          >
            Estou no local
          </button>
        </div>

        {erroBusca ? <p className="mt-2 text-xs text-erro">{erroBusca}</p> : null}

        {resultados && resultados.length > 0 ? (
          <ul className="mt-2 divide-y divide-linha overflow-hidden rounded-xl border border-linha bg-white">
            {resultados.map((local, indice) => (
              <li key={`${local.latitude}-${local.longitude}-${indice}`}>
                <button
                  type="button"
                  onClick={() => escolher(local)}
                  className="block w-full px-4 py-3 text-left text-sm hover:bg-superficie"
                >
                  <span className="font-semibold text-tinta">{local.titulo}</span>
                  <span className="mt-0.5 block text-xs text-texto-2">{local.detalhe}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div
        ref={container}
        className="h-72 w-full overflow-hidden rounded-xl border border-linha"
        role="application"
        aria-label="Mapa para marcar o local do evento"
      />
      <input type="hidden" name="latitude" value={ponto?.latitude ?? ""} />
      <input type="hidden" name="longitude" value={ponto?.longitude ?? ""} />
      <p className="mt-2 text-xs text-texto-2">
        {ponto ? (
          <>
            <Etiqueta>ponto marcado</Etiqueta>{" "}
            <span className="font-mono">
              {ponto.latitude.toFixed(6)}, {ponto.longitude.toFixed(6)}
            </span>{" "}
            — arraste o pino para ajustar.
          </>
        ) : (
          "Busque o endereço acima para aproximar o mapa e clique para marcar onde o evento acontece. É esse ponto que valida a presença dos participantes."
        )}
      </p>

      {sugerido ? (
        <p className="mt-2 rounded-lg bg-lilas px-3 py-2 text-xs text-texto-2">
          O pino foi posto no resultado da busca, que costuma cair no meio da via ou do terreno.
          Confira e arraste até a entrada onde os participantes estarão: a presença só é aceita a
          até 70 metros deste ponto.
        </p>
      ) : null}
    </div>
  );
}
