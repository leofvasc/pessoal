/*
 * Service worker da PlanA.
 *
 * Existe por dois motivos, nesta ordem:
 *  1. é pré-requisito para o PWA ser instalável na tela de início — e, no
 *     iPhone e no iPad, a instalação é pré-requisito para o push funcionar
 *     (planejamento, seção 8.2);
 *  2. mantém o aplicativo abrível sem rede, com uma tela de fallback.
 *
 * O que NÃO faz: cachear resposta de rota autenticada. Um cache de página de
 * conta sobreviveria à saída do usuário e devolveria dado pessoal ao próximo
 * que abrisse o aplicativo no mesmo aparelho.
 */

const VERSAO = "plana-v2";
const ESTATICOS = [
  "/offline",
  "/manifest.webmanifest",
  "/icones/icone-192.png",
  "/icones/icone-512.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSAO).then((cache) => cache.addAll(ESTATICOS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== "GET") return;

  const url = new URL(requisicao.url);
  if (url.origin !== self.location.origin) return;

  // Rotas de conta, painel e API nunca entram em cache.
  const privada = /^\/(conta|painel|api|certificados)\b/.test(url.pathname);

  if (requisicao.mode === "navigate") {
    evento.respondWith(
      fetch(requisicao).catch(() =>
        caches.match("/offline").then((r) => r || new Response("", { status: 504 })),
      ),
    );
    return;
  }

  if (privada) return;

  // Estáticos: cache primeiro, rede como preenchimento.
  evento.respondWith(
    caches.match(requisicao).then(
      (guardado) =>
        guardado ||
        fetch(requisicao).then((resposta) => {
          if (resposta.ok && resposta.type === "basic") {
            const copia = resposta.clone();
            caches.open(VERSAO).then((cache) => cache.put(requisicao, copia));
          }
          return resposta;
        }),
    ),
  );
});

/* Notificações push (seção 8.2). */
self.addEventListener("push", (evento) => {
  if (!evento.data) return;
  let dados;
  try {
    dados = evento.data.json();
  } catch {
    dados = { titulo: "PlanA", corpo: evento.data.text() };
  }

  evento.waitUntil(
    self.registration.showNotification(dados.titulo || "PlanA", {
      body: dados.corpo || "",
      // Manual, seção 17: no push o ícone é monocromático branco do símbolo,
      // sem ficha e sem logotipo — o único contexto em que a marca vai sem cor.
      icon: "/icones/icone-192.png",
      badge: "/icones/push-badge.png",
      tag: dados.tipo || "plana",
      data: { link: dados.link || "/conta/notificacoes" },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.link) || "/conta";

  let urlDestino;
  try {
    const candidata = new URL(destino, self.location.origin);
    urlDestino =
      candidata.origin === self.location.origin && candidata.pathname !== "/"
        ? candidata.href
        : new URL("/conta/notificacoes", self.location.origin).href;
  } catch {
    urlDestino = new URL("/conta/notificacoes", self.location.origin).href;
  }

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (janelas) => {
      for (const janela of janelas) {
        if (janela.url === urlDestino && "focus" in janela) return janela.focus();
      }

      for (const janela of janelas) {
        if ("navigate" in janela && "focus" in janela) {
          const navegada = await janela.navigate(urlDestino);
          return navegada ? navegada.focus() : janela.focus();
        }
      }

      return self.clients.openWindow(urlDestino);
    }),
  );
});
