import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { origemDeMetadados } from "@/lib/origem";

/**
 * Seção 07 do manual: duas famílias.
 * Plus Jakarta Sans em títulos, logotipo, interface e corpo de texto.
 * JetBrains Mono só em dados — códigos, horários com fuso, carga horária.
 */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const DESCRICAO =
  "Inscrição, registro de presença por QR Code e emissão automática de certificado.";

export const metadata: Metadata = {
  /**
   * Base absoluta dos metadados. WhatsApp, Telegram e clientes de e-mail não
   * resolvem caminho relativo em og:image — sem isto a miniatura simplesmente
   * não carrega. Vem de PUBLIC_ORIGIN, e não dos cabeçalhos da requisição,
   * porque ler cabeçalho no layout raiz tornaria dinâmica toda página do site.
   */
  metadataBase: new URL(origemDeMetadados()),
  title: {
    default: "PlanA — gestão de eventos",
    template: "%s · PlanA",
  },
  description: DESCRICAO,
  applicationName: "PlanA",
  manifest: "/manifest.webmanifest",
  /**
   * Miniatura de compartilhamento declarada de forma expressa. Sem ela, o
   * raspador escolhe sozinho a primeira imagem grande da página — na vitrine,
   * o banner de um evento qualquer —, e a plataforma passa a se anunciar com
   * arte de terceiros. Páginas de evento sobrescrevem isto com o próprio
   * banner, que ali é o conteúdo correto.
   */
  openGraph: {
    type: "website",
    siteName: "PlanA",
    locale: "pt_BR",
    title: "PlanA — gestão de eventos",
    description: DESCRICAO,
    images: [
      {
        url: "/og/plana.png",
        width: 1200,
        height: 630,
        alt: "PlanA — gestão de eventos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PlanA — gestão de eventos",
    description: DESCRICAO,
    images: ["/og/plana.png"],
  },
  appleWebApp: {
    capable: true,
    title: "PlanA",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icones/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icones/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/icones/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#6B4CF6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${jakarta.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-superficie text-tinta">{children}</body>
    </html>
  );
}
