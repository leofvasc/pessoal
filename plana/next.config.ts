import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` monta uma pasta com só o que a aplicação precisa para rodar,
  // o que deixa a imagem Docker pequena o bastante para uma VPS de entrada.
  output: "standalone",

  experimental: {
    serverActions: {
      // O padrão de 1 MB não comporta os envios do gestor: a imagem-base do
      // certificado vai até 10 MB e o material de apoio, até 50 MB. Os limites
      // por categoria, que são os que valem, estão em `src/lib/armazenamento.ts`.
      bodySizeLimit: "55mb",
    },
  },

  async headers() {
    return [
      {
        source: "/:caminho*",
        headers: [
          // A plataforma não é embutível em iframe de terceiros: um evento
          // dentro de um iframe alheio é o cenário clássico de clickjacking
          // sobre o botão de registrar presença.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // A geolocalização é usada pela própria página, nunca por conteúdo
            // de terceiros; câmera e microfone não são usados em lugar nenhum.
            key: "Permissions-Policy",
            value: "geolocation=(self), camera=(), microphone=(), payment=()",
          },
        ],
      },
      {
        // O service worker precisa poder controlar toda a origem, e não pode
        // ficar preso em cache: é ele que atualiza o resto.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
