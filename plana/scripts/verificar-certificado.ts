/**
 * Verificação do gerador de certificado: monta um PDF de exemplo e grava em
 * `saida/certificado-exemplo.pdf` para conferência visual.
 *
 * Rodar com:
 *     npm run verificar:certificado
 *
 * A condição `react-server` é necessária porque os módulos do servidor importam
 * `server-only`, que só se resolve para um módulo vazio sob essa condição.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { gerarCertificado } from "../src/lib/certificado";

async function principal() {
  const bytes = await gerarCertificado({
    nomeParticipante: "Maria Nogueira de Albuquerque",
    nomeEvento: "III Seminário de Direito Digital",
    inicioEm: new Date("2026-09-14T17:00:00Z"),
    cargaHorariaMinutos: 270,
    instituicoes: ["Instituto Lovelace", "CEAF/MPAC"],
    codigoValidacao: "CERT-2026-0184-7F3ADX",
    origem: "https://eventosplana.app",
    metodoPresenca: "QR_GEOLOCALIZACAO",
  });

  await mkdir("saida", { recursive: true });
  await writeFile("saida/certificado-exemplo.pdf", bytes);
  console.log(`certificado de exemplo gravado (${bytes.length} bytes)`);
}

principal();
