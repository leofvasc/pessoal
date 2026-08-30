import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/sessao";
import { TEXTOS_CONSENTIMENTO } from "@/lib/consentimento";
import { Cartao, Titulo } from "@/components/ui";
import { formatarEm, FUSO_ACRE } from "@/lib/fuso";
import { InterruptorConsentimento } from "./interruptor";
import { FormularioAlteracaoSenha, FormularioDadosDeContato } from "./formularios-conta";
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
  const registroWhatsapp = porFinalidade.get("COMUNICACAO_URGENTE_WHATSAPP");
  const whatsappAtivo = Boolean(registroWhatsapp && registroWhatsapp.revogadoEm === null);

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
        <Titulo nivel={2}>Dados de contato</Titulo>
        <Cartao className="mt-4">
          <p className="text-sm text-texto-2">
            Atualize o e-mail usado para entrar e, quando houver autorização de WhatsApp, o telefone usado nos avisos.
          </p>
          {usuario ? (
            <FormularioDadosDeContato
              email={usuario.email}
              telefone={usuario.telefone}
              whatsappAtivo={whatsappAtivo}
            />
          ) : null}
        </Cartao>
      </section>

      <section className="mt-10">
        <Titulo nivel={2}>Segurança da conta</Titulo>
        <Cartao className="mt-4">
          <p className="text-sm text-texto-2">Troque sua senha informando a senha atual e uma nova senha com ao menos 10 caracteres.</p>
          <FormularioAlteracaoSenha />
        </Cartao>
      </section>

      <section className="mt-10">
        <Titulo nivel={2}>Identificação e direitos</Titulo>
        <Cartao className="mt-4">
          <dl className="text-sm">
            <dt className="etiqueta text-texto-2">nome</dt>
            <dd className="mt-1">{usuario?.nome}</dd>
          </dl>
        </Cartao>
        <p className="mt-4 text-sm text-texto-2">
          Para solicitar acesso ou correção dos seus dados, abra um{" "}
          <Link href="/conta/chamados/novo" className="font-semibold text-violeta">
            chamado
          </Link>
          . A página de transparência continua disponível em{" "}
          <Link href="/privacidade" className="font-semibold text-violeta">privacidade</Link>.
        </p>
      </section>

      <section className="mt-10">
        <Titulo nivel={2}>Excluir minha conta</Titulo>
        <Cartao className="mt-4">
          <p className="text-sm text-texto-2">
            A exclusão apaga do banco a sua conta e os dados ligados a ela — inscrições, presenças,
            notificações, chamados, consentimentos e assinaturas de notificação. Não é marcação de
            conta inativa: as linhas saem, e não há recuperação depois.
          </p>
          <p className="mt-3 text-sm text-texto-2">
            Os certificados já emitidos continuam validáveis, e o seu nome não fica guardado: a
            consulta pública passa a confirmar o nome que quem confere digitar, sem exibi-lo. A tela
            seguinte explica isso em detalhe antes de apagar qualquer coisa.
          </p>
          <p className="mt-5">
            <Link
              href="/conta/excluir"
              className="text-sm font-semibold text-erro hover:brightness-90"
            >
              Ir para a exclusão da conta →
            </Link>
          </p>
        </Cartao>
      </section>
    </>
  );
}
