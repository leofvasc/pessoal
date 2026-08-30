import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sessaoAtual } from "@/lib/sessao";
import { temConsentimento } from "@/lib/consentimento";
import { Logotipo } from "@/components/marca/Logotipo";
import { TelaCheckin } from "./tela";

export const metadata = { title: "Registrar presença" };

/**
 * Destino do QR Code projetado na sala.
 *
 * O endereço carrega o token secreto do evento — quem apenas conhece o link
 * público não chega aqui. Quem cai nesta página sem estar autenticado é levado
 * ao login e volta para cá em seguida.
 */
export default async function PaginaPresenca({ params }: PageProps<"/presenca/[token]">) {
  const { token } = await params;

  const evento = await prisma.evento.findFirst({
    where: { tokenQr: token, excluidoEm: null, canceladoEm: null },
    select: { id: true, nome: true, modalidade: true, inicioEm: true, fimEm: true },
  });
  if (!evento) notFound();

  const sessao = await sessaoAtual();
  if (!sessao) redirect(`/entrar?destino=${encodeURIComponent(`/presenca/${token}`)}`);

  const [inscricao, autorizouGeo] = await Promise.all([
    prisma.inscricao.findUnique({
      where: { eventoId_usuarioId: { eventoId: evento.id, usuarioId: sessao.usuarioId } },
      select: { canceladaEm: true, presenca: { select: { registradaEm: true } } },
    }),
    temConsentimento(sessao.usuarioId, "GEOLOCALIZACAO_CHECKIN"),
  ]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <Logotipo altura={24} />
      <TelaCheckin
        token={token}
        nomeEvento={evento.nome}
        exigeGeolocalizacao={evento.modalidade !== "ONLINE"}
        autorizouGeolocalizacao={autorizouGeo}
        inscrito={Boolean(inscricao && !inscricao.canceladaEm)}
        jaPresente={Boolean(inscricao?.presenca)}
      />
    </main>
  );
}
