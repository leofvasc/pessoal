import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/sessao";
import { TEXTOS_CONSENTIMENTO } from "@/lib/consentimento";
import { Cartao, Titulo } from "@/components/ui";
import { formatarEm, FUSO_ACRE } from "@/lib/fuso";
import { InterruptorConsentimento } from "./interruptor";
import type { FinalidadeConsentimento } from "@/generated/prisma/client";

export const metadata = { title: "Meus dados" };

const ORDEM: FinalidadeConsentimento[] = [
  "COMUNICACAO_URGENTE_EMAIL",
  "COMUNICACAO_URGENTE_WHATSAPP",
  "GEOLOCALIZACAO_CHECKIN",
];

const TITULOS: Record<FinalidadeConsentimento, string> = {
  COMUNICACAO_URGENTE_EMAIL: "Avisos urgentes por e-mail",
  COMUNICACAO_URGENTE_WHATSAPP: "Avisos urgentes por WhatsApp",
  GEOLOCALIZACAO_CHECKIN: "Leitura da localização no check-in",
};

export default async function PaginaMeusDados() {
  const sessao = await exigirSessao();

  const [usuario, consentimentos] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: sessao.usuarioId },
      select: { nome: true, email: true, telefone: true, perfil: true, perfilDetalhe: true },
    }),
    prisma.consentimento.findMany({ where: { usuarioId: sessao.usuarioId } }),
  ]);

  const porFinalidade = new Map(consentimentos.map((c) => [c.finalidade, c]));

  return (
    <>
      <Titulo>Meus dados</Titulo>
      <p className="mt-2 text-sm text-texto-2">
        Cada autorização abaixo pode ser ligada ou desligada quando você quiser. Nenhuma delas é
        condição para se inscrever em eventos ou emitir certificados já liberados.
      </p>

      <section className="mt-8 space-y-3">
        {ORDEM.map((finalidade) => {
          const registro = porFinalidade.get(finalidade);
          const ativo = Boolean(registro && registro.revogadoEm === null);
          return (
            <Cartao key={finalidade}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold tracking-[-0.01em]">{TITULOS[finalidade]}</h2>
                  <p className="mt-2 text-xs leading-relaxed text-texto-2">
                    {TEXTOS_CONSENTIMENTO[finalidade]}
                  </p>
                  {registro ? (
                    <p className="mt-2 font-mono text-[11px] text-texto-2">
                      {ativo
                        ? `autorizado em ${formatarEm(registro.concedidoEm, FUSO_ACRE, "dd/MM/yyyy 'às' HH'h'mm")}`
                        : `revogado em ${formatarEm(registro.revogadoEm!, FUSO_ACRE, "dd/MM/yyyy 'às' HH'h'mm")}`}
                    </p>
                  ) : null}
                </div>
                <InterruptorConsentimento
                  finalidade={finalidade}
                  ativo={ativo}
                  exigeTelefone={finalidade === "COMUNICACAO_URGENTE_WHATSAPP"}
                  temTelefone={Boolean(usuario?.telefone)}
                />
              </div>
            </Cartao>
          );
        })}
      </section>

      <section className="mt-10">
        <Titulo nivel={2}>Dados na sua conta</Titulo>
        <Cartao className="mt-4">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="etiqueta text-texto-2">nome</dt>
              <dd className="mt-1">{usuario?.nome}</dd>
            </div>
            <div>
              <dt className="etiqueta text-texto-2">e-mail</dt>
              <dd className="mt-1">{usuario?.email}</dd>
            </div>
            <div>
              <dt className="etiqueta text-texto-2">telefone</dt>
              <dd className="mt-1">
                {usuario?.telefone ?? (
                  <span className="text-texto-2">
                    não coletado — depende da autorização de WhatsApp
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </Cartao>
        <p className="mt-4 text-sm text-texto-2">
          Para corrigir ou excluir seus dados, veja a{" "}
          <Link href="/privacidade" className="font-semibold text-violeta">
            página de transparência
          </Link>
          .
        </p>
      </section>
    </>
  );
}
