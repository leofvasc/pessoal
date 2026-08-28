import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/sessao";
import { Cartao, Etiqueta, Titulo } from "@/components/ui";
import { formatarEm, FUSO_ACRE } from "@/lib/fuso";
import { GerenciarPush } from "./gerenciar-push";
import { marcarTodasComoLidas } from "@/app/acoes-notificacoes";

export const metadata = { title: "Notificações" };

const ROTULOS = {
  SEGURANCA_CONTA: "sua conta",
  INSCRICAO_CONFIRMADA: "inscrição",
  PRESENCA_REGISTRADA: "presença",
  CERTIFICADO_DISPONIVEL: "certificado",
  AVISO_EVENTO: "aviso",
  SUPORTE: "suporte",
} as const;

/**
 * Central de notificações — o canal de referência da plataforma (seção 7).
 * O push é camada complementar, e parte dos participantes nunca o receberá.
 */
export default async function PaginaNotificacoes() {
  const sessao = await exigirSessao();

  const notificacoes = await prisma.notificacao.findMany({
    where: { usuarioId: sessao.usuarioId },
    orderBy: { criadaEm: "desc" },
    take: 100,
  });

  const naoLidas = notificacoes.filter((n) => !n.lidaEm).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Titulo>Notificações</Titulo>
        {naoLidas > 0 ? (
          <form action={marcarTodasComoLidas}>
            <button className="text-sm font-semibold text-violeta hover:text-profundo">
              Marcar todas como lidas
            </button>
          </form>
        ) : null}
      </div>

      <GerenciarPush chavePublica={process.env.VAPID_PUBLIC_KEY ?? null} />

      {notificacoes.length === 0 ? (
        <Cartao className="mt-8">
          <p className="text-sm text-texto-2">Nenhuma mensagem por enquanto.</p>
        </Cartao>
      ) : (
        <ul className="mt-8 space-y-3">
          {notificacoes.map((notificacao) => (
            <li
              key={notificacao.id}
              className={`rounded-2xl border bg-white p-5 ${
                notificacao.lidaEm ? "border-linha" : "border-violeta/40"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <Etiqueta>{ROTULOS[notificacao.tipo]}</Etiqueta>
                <span className="font-mono text-xs text-texto-2">
                  {formatarEm(notificacao.criadaEm, FUSO_ACRE, "dd/MM 'às' HH'h'mm")}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold">{notificacao.titulo}</p>
              <p className="mt-1 text-sm text-texto-2">{notificacao.corpo}</p>
              {notificacao.link ? (
                <a
                  href={notificacao.link}
                  className="mt-3 inline-block text-sm font-semibold text-violeta hover:text-profundo"
                >
                  Abrir →
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
