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

export function MapaPino({ latitudeInicial, longitudeInicial, aoMudar }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const pino = useRef<Marker | null>(null);
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

      function marcar(latitude: number, longitude: number) {
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
      instancia.on("click", (evento) => marcar(evento.latlng.lat, evento.latlng.lng));

      mapa.current = instancia;
    })();

    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
      pino.current = null;
    };
    // Montagem única: o mapa gerencia o próprio estado depois disso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
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
          "Clique no mapa para marcar onde o evento acontece. É esse ponto que valida a presença dos participantes."
        )}
      </p>
    </div>
  );
}
