import "server-only";

/**
 * Central de notificações e push do navegador.
 * Planejamento, seção 7 e 8.2.
 *
 * A central interna é o canal de referência; o push é camada complementar de
 * alcance. Toda notificação é gravada na central primeiro e só então tenta o
 * push — se o push falhar, o usuário ainda a encontra ao abrir o aplicativo.
 * Isso importa porque parte dos participantes de iPhone não instalará o PWA na
 * tela de início e, sem isso, o Safari não entrega push nenhum.
 */
import webpush from "web-push";
import type { TipoNotificacao } from "@/generated/prisma/client";
import { prisma } from "./prisma";

let configurado = false;

/** Configura as chaves VAPID. Devolve false quando não há chaves no ambiente. */
function configurarWebPush(): boolean {
  if (configurado) return true;
  const publica = process.env.VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const contato = process.env.VAPID_SUBJECT;
  if (!publica || !privada || !contato) return false;
  webpush.setVapidDetails(contato, publica, privada);
  configurado = true;
  return true;
}

export type NovaNotificacao = {
  usuarioId: string;
  tipo: TipoNotificacao;
  titulo: string;
  corpo: string;
  link?: string;
};

export async function notificar(dados: NovaNotificacao) {
  const notificacao = await prisma.notificacao.create({
    data: {
      usuarioId: dados.usuarioId,
      tipo: dados.tipo,
      titulo: dados.titulo,
      corpo: dados.corpo,
      link: dados.link,
    },
  });

  await enviarPush(dados);
  return notificacao;
}

async function enviarPush(dados: NovaNotificacao) {
  if (!configurarWebPush()) return;

  const assinaturas = await prisma.assinaturaPush.findMany({
    where: { usuarioId: dados.usuarioId },
  });
  if (assinaturas.length === 0) return;

  const carga = JSON.stringify({
    titulo: dados.titulo,
    corpo: dados.corpo,
    link: dados.link ?? "/conta/notificacoes",
    tipo: dados.tipo,
  });

  await Promise.all(
    assinaturas.map(async (assinatura) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: assinatura.endpoint,
            keys: { p256dh: assinatura.p256dh, auth: assinatura.auth },
          },
          carga,
        );
        await prisma.assinaturaPush.update({
          where: { id: assinatura.id },
          data: { ultimoEnvoEm: new Date() },
        });
      } catch (erro: unknown) {
        // 404 e 410 significam que o navegador descartou a inscrição: o usuário
        // desinstalou o PWA, revogou a permissão ou limpou os dados do site.
        // Guardar o registro só geraria falha em todo envio seguinte.
        const status = (erro as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.assinaturaPush.delete({ where: { id: assinatura.id } }).catch(() => {});
        }
      }
    }),
  );
}

export async function marcarComoLida(usuarioId: string, notificacaoId: string) {
  await prisma.notificacao.updateMany({
    where: { id: notificacaoId, usuarioId, lidaEm: null },
    data: { lidaEm: new Date() },
  });
}

export async function contarNaoLidas(usuarioId: string): Promise<number> {
  return prisma.notificacao.count({ where: { usuarioId, lidaEm: null } });
}
