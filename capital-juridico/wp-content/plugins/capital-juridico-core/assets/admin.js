/* Seletor de mídia dos campos "arquivo/imagem" e teste de conexão do chatbot. */
jQuery(function ($) {
  $(document).on('click', '.cj-media-pick', function (e) {
    e.preventDefault();
    var box = $(this).closest('.cj-media');
    var frame = wp.media({ title: 'Escolher arquivo', button: { text: 'Usar este arquivo' }, multiple: false });
    frame.on('select', function () {
      var a = frame.state().get('selection').first().toJSON();
      box.find('input[type=hidden]').val(a.id);
      box.find('.cj-media-url').val(a.url);
    });
    frame.open();
  });
  $(document).on('click', '.cj-media-clear', function (e) {
    e.preventDefault();
    var box = $(this).closest('.cj-media');
    box.find('input[type=hidden]').val('');
    box.find('.cj-media-url').val('');
  });
  $('#cj-chat-teste').on('click', function () {
    var b = $(this), out = $('#cj-chat-teste-resultado');
    b.prop('disabled', true); out.text('Testando…');
    fetch(b.data('url'), {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': b.data('nonce') },
      body: JSON.stringify({ hotsite: b.data('id') })
    }).then(function (r) { return r.json(); }).then(function (d) {
      out.text(d.ok ? 'Conexão funcionando (' + d.modelo + '): ' + d.resposta : 'Falha: ' + (d.codigo || '') + ' — ' + (d.mensagem || d.message || ''));
    }).catch(function () { out.text('Falha na chamada ao site.'); }).finally(function () { b.prop('disabled', false); });
  });
});
