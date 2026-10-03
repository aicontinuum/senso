// Senso marketing site: the mobile menu, the booking dialog and its toast.
// Everything else on the pages is plain HTML and CSS.
(function () {
  'use strict';

  var TOAST_MS = 3600;

  // Mobile menu.
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.nav-mobile');
  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  }
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });
  }

  // Booking dialog. The form is a placeholder: it does not send the details
  // anywhere yet. Submitting closes the dialog and shows the toast, as the
  // design did.
  var dialog = document.querySelector('.dialog');
  var toast = document.querySelector('.toast');
  var toastTimer = null;

  function showToast() {
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, TOAST_MS);
  }

  if (dialog) {
    document.querySelectorAll('[data-open-dialog]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (menu) setMenu(false);
        dialog.showModal();
      });
    });
    dialog.querySelectorAll('[data-close-dialog]').forEach(function (button) {
      button.addEventListener('click', function () { dialog.close(); });
    });
    // A click on the backdrop lands on the dialog element itself.
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.querySelector('form').addEventListener('submit', function (event) {
      event.preventDefault();
      event.target.reset();
      dialog.close();
      showToast();
    });
  }
})();
