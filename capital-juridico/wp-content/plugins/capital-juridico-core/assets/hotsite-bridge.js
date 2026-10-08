/*
 * Ponte entre o hotsite e o backend do chatbot no WordPress.
 * Substitui o "código da página" e o popup VerificacaoChatbot que existiam no Wix.
 *
 * Protocolo (o mesmo do Wix, para que os hotsites funcionem sem alteração):
 *  - o hotsite dispara o evento "chat-question" com {id, pergunta, historico};
 *  - a ponte responde gravando no elemento os atributos
 *    "chat-verification" ({id, fase: 'verificando' | 'respondendo'}) e
 *    "chat-response" ({id, ok, resposta | codigo, mensagem}).
 */
(function () {
  'use strict';
  var cfg = window.CJ_HOTSITE || {};
  var emAndamento = false;
  var sessao = null;
  var sessaoExpira = 0;
  var turnstilePromise = null;

  function responder(el, dados) {
    el.setAttribute('chat-response', JSON.stringify(dados));
  }

  function fase(el, id, nome) {
    el.setAttribute('chat-verification', JSON.stringify({ id: id, fase: nome }));
  }

  function carregarTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (turnstilePromise) return turnstilePromise;
    turnstilePromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = function () { window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')); };
      s.onerror = function () { turnstilePromise = null; reject(new Error('turnstile')); };
      document.head.appendChild(s);
    });
    return turnstilePromise;
  }

  /* Janela de verificação: resolve com {token} ou {codigo}. */
  function verificar() {
    return new Promise(function (resolve) {
      var dlg = document.createElement('dialog');
      dlg.setAttribute('aria-labelledby', 'cj-verif-titulo');
      dlg.style.cssText = 'border:0;border-radius:14px;padding:24px;max-width:360px;width:calc(100vw - 32px);font:15px/1.5 system-ui,Arial,sans-serif;color:#1c1916;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.4)';
      dlg.innerHTML = '<h2 id="cj-verif-titulo" style="font-size:18px;margin:0 0 6px">Verificação de segurança</h2>' +
        '<p style="margin:0 0 16px;color:#555">Confirme que você não é um robô para conversar com o assistente.</p>' +
        '<div class="cj-verif-widget" style="min-height:65px"></div>' +
        '<p style="text-align:right;margin:16px 0 0"><button type="button" class="cj-verif-cancelar" style="font:inherit;padding:10px 14px;border:1px solid #ccc;border-radius:8px;background:#fff;cursor:pointer">Cancelar</button></p>';
      document.body.appendChild(dlg);
      var terminou = false;
      function fim(valor) {
        if (terminou) return;
        terminou = true;
        try { dlg.close(); } catch (e) {}
        dlg.remove();
        resolve(valor);
      }
      dlg.querySelector('.cj-verif-cancelar').addEventListener('click', function () { fim({ codigo: 'CAPTCHA_CANCELADO' }); });
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); fim({ codigo: 'CAPTCHA_CANCELADO' }); });
      dlg.showModal();
      carregarTurnstile().then(function (ts) {
        ts.render(dlg.querySelector('.cj-verif-widget'), {
          sitekey: cfg.turnstile,
          language: 'pt-br',
          callback: function (token) { fim({ token: token }); },
          'error-callback': function () { fim({ codigo: 'CAPTCHA_ERRO' }); },
          'expired-callback': function () {}
        });
      }).catch(function () { fim({ codigo: 'CAPTCHA_ERRO' }); });
    });
  }

  function chamar(dados, credencial) {
    return fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify({ hotsite: cfg.id, pergunta: dados.pergunta, historico: dados.historico, credencial: credencial })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  document.addEventListener('chat-question', function (event) {
    var el = event.target;
    var dados = event.detail;
    if (!el || !el.setAttribute || !dados || typeof dados.id !== 'string') return;
    var id = dados.id;
    if (!cfg.chat) { responder(el, { id: id, ok: false, codigo: 'CHAT_INDISPONIVEL' }); return; }
    if (emAndamento) { responder(el, { id: id, ok: false, codigo: 'AGUARDE_RESPOSTA' }); return; }
    emAndamento = true;

    (async function () {
      try {
        for (var tentativa = 0; tentativa < 2; tentativa++) {
          var credencial;
          if (sessao && Date.now() < sessaoExpira) {
            credencial = { sessao: sessao };
          } else {
            sessao = null; sessaoExpira = 0;
            if (cfg.turnstile) {
              fase(el, id, 'verificando');
              var v = await verificar();
              if (!v || typeof v.token !== 'string' || !v.token.trim()) {
                responder(el, { id: id, ok: false, codigo: v && v.codigo === 'CAPTCHA_ERRO' ? 'CAPTCHA_ERRO' : 'CAPTCHA_CANCELADO' });
                return;
              }
              credencial = { tokenCaptcha: v.token };
            } else {
              credencial = {};
            }
          }
          fase(el, id, 'respondendo');
          var retorno = await chamar(dados, credencial);
          if (retorno.codigo === 'CAPTCHA_NECESSARIO' && credencial.sessao && tentativa === 0) {
            sessao = null; sessaoExpira = 0; continue;
          }
          if (typeof retorno.sessao === 'string' && isFinite(retorno.sessaoExpira)) {
            sessao = retorno.sessao; sessaoExpira = retorno.sessaoExpira;
          }
          // A credencial fica só na ponte: não entra nos atributos do elemento.
          var resposta = { id: id };
          Object.keys(retorno).forEach(function (k) { if (k !== 'sessao' && k !== 'sessaoExpira') resposta[k] = retorno[k]; });
          responder(el, resposta);
          return;
        }
      } catch (erro) {
        if (window.console) console.error('Chatbot Capital Jurídico: falha na chamada ao site.');
        responder(el, { id: id, ok: false, codigo: 'CHAMADA_SITE' });
      } finally {
        emAndamento = false;
      }
    })();
  });
})();
