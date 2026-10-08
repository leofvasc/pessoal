document.addEventListener('click', function (e) {
  var b = e.target.closest('.menu-toggle');
  if (!b) return;
  var open = b.getAttribute('aria-expanded') === 'true';
  b.setAttribute('aria-expanded', String(!open));
  document.getElementById('menu-principal').classList.toggle('aberto', !open);
});
