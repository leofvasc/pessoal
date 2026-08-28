import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: {
    default: "PlanA — gestão de eventos",
    template: "%s · PlanA",
  },
  description:
    "Inscrição, registro de presença por QR Code e emissão automática de certificado.",
  applicationName: "PlanA",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PlanA",
    statusBarStyle: "default",
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
