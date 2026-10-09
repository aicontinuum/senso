// Senso marketing site: the mobile menu. Everything else on the pages is
// plain HTML and CSS; the inquiry buttons are links to WhatsApp.
(function () {
  'use strict';

  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.nav-mobile');
  if (!toggle || !menu) return;

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  }
  toggle.addEventListener('click', function () {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });
  menu.addEventListener('click', function (event) {
    if (event.target.closest('a')) setMenu(false);
  });
})();
