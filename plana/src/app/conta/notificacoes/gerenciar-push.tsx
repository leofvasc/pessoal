"use client";

/**
 * Ativação das notificações push (seção 8.2).
 *
 * Em Android e em navegadores de desktop o push funciona bastando a permissão.
 * No iPhone e no iPad é preciso que a aplicação esteja instalada na tela de
 * início — por isso a tela detecta esse caso e explica, em vez de pedir uma
 * permissão que o Safari vai conceder e depois ignorar.
 */
import { useEffect, useState } from "react";
import { salvarAssinaturaPush, removerAssinaturaPush } from "@/app/acoes-notificacoes";
import { ehIOS } from "@/components/AvisoInstalacaoIOS";
import { useInstaladoNaTelaDeInicio } from "@/hooks/consultaDeMidia";
import { Aviso, Botao } from "@/components/ui";

type Estado = "carregando" | "indisponivel" | "precisa_instalar" | "desativado" | "ativado" | "negado";

/**
 * A chave VAPID vem em base64url; o PushManager quer os bytes crus.
 * O retorno é tipado como ArrayBuffer porque o `Uint8Array` genérico do
 * TypeScript 5.7 não satisfaz mais `BufferSource`.
 */
function base64ParaBytes(base64: string): ArrayBuffer {
  const preenchimento = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalizado = (base64 + preenchimento).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(normalizado);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes.buffer;
}

export function GerenciarPush({ chavePublica }: { chavePublica: string | null }) {
  const instalado = useInstaladoNaTelaDeInicio();
  const [estado, setEstado] = useState<Estado>("carregando");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    // Consulta assíncrona ao PushManager: é leitura de estado externo, e o
    // resultado só existe depois de a promessa resolver.
    let vivo = true;

    (async () => {
      if (!chavePublica || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (vivo) setEstado("indisponivel");
        return;
      }

      // No iPhone e no iPad, pedir permissão fora da aplicação instalada é
      // pior do que não pedir: o Safari concede e nunca entrega nada.
      if (ehIOS() && !instalado) {
        if (vivo) setEstado("precisa_instalar");
        return;
      }

      if (Notification.permission === "denied") {
        if (vivo) setEstado("negado");
        return;
      }

      const registro = await navigator.serviceWorker.ready;
      const existente = await registro.pushManager.getSubscription();
      if (vivo) setEstado(existente ? "ativado" : "desativado");
    })().catch(() => {
      if (vivo) setEstado("indisponivel");
    });

    return () => {
      vivo = false;
    };
  }, [chavePublica, instalado]);

  async function ativar() {
    setErro(null);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "negado" : "desativado");
        return;
      }

      const registro = await navigator.serviceWorker.ready;
      const assinatura = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ParaBytes(chavePublica!),
      });

      const dados = assinatura.toJSON();
      await salvarAssinaturaPush({
        endpoint: assinatura.endpoint,
        p256dh: dados.keys?.p256dh ?? "",
        auth: dados.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      setEstado("ativado");
    } catch {
      setErro("Não foi possível ativar as notificações neste navegador.");
    }
  }

  async function desativar() {
    const registro = await navigator.serviceWorker.ready;
    const assinatura = await registro.pushManager.getSubscription();
    if (assinatura) {
      await removerAssinaturaPush(assinatura.endpoint);
      await assinatura.unsubscribe();
    }
    setEstado("desativado");
  }

  if (estado === "carregando" || estado === "indisponivel") return null;

  return (
    <div className="mt-6">
      {estado === "precisa_instalar" ? (
        <Aviso titulo="Instale para receber avisos">
          No iPhone e no iPad, o Safari só entrega notificação para aplicações instaladas na tela de
          início. Toque em Compartilhar → Adicionar à Tela de Início e volte aqui.
        </Aviso>
      ) : estado === "negado" ? (
        <Aviso titulo="Notificações bloqueadas">
          Você bloqueou as notificações para este site. Libere nas configurações do navegador — as
          mensagens continuam aqui nesta central de qualquer forma.
        </Aviso>
      ) : estado === "ativado" ? (
        <div className="rounded-2xl border border-linha bg-white p-5">
          <p className="text-sm font-semibold">Notificações do navegador ativas</p>
          <p className="mt-1 text-sm text-texto-2">
            Você recebe um aviso quando sua presença é registrada e quando o certificado fica
            disponível.
          </p>
          <button onClick={desativar} className="mt-3 text-sm font-semibold text-texto-2 hover:text-erro">
            Desativar
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-linha bg-white p-5">
          <p className="text-sm font-semibold">Ativar notificações do navegador</p>
          <p className="mt-1 text-sm text-texto-2">
            Complementa esta central: o aviso chega mesmo com a PlanA fechada.
          </p>
          {erro ? <p className="mt-2 text-sm text-erro">{erro}</p> : null}
          <Botao className="mt-4" onClick={ativar}>
            Ativar
          </Botao>
        </div>
      )}
    </div>
  );
}
