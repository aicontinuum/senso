// Senso marketing site: the mobile menu, the booking dialog and its toast.
// Everything else on the pages is plain HTML and CSS.
(function () {
  'use strict';

  var TOAST_MS = 3600;
  var SENDING_LABEL = 'Sending…';

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

  // Booking dialog.
  var dialog = document.querySelector('.dialog');
  var toast = document.querySelector('.toast');
  var toastTimer = null;

  function showToast() {
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, TOAST_MS);
  }

  // The form is a placeholder: nothing is sent anywhere yet. This is the one
  // function to replace when it is; the button's busy state and the toast
  // around it already behave as they will then.
  function sendBooking() {
    return Promise.resolve();
  }

  if (dialog) {
    var form = dialog.querySelector('form');
    var firstField = form.querySelector('input, select');
    var buttons = form.querySelectorAll('button');
    var submit = form.querySelector('button[type="submit"]');
    var submitLabel = submit.textContent;
    // Where focus goes back to when the dialog closes: the button that opened it.
    var opener = null;

    function setBusy(busy) {
      submit.textContent = busy ? SENDING_LABEL : submitLabel;
      buttons.forEach(function (button) { button.disabled = busy; });
    }

    document.querySelectorAll('[data-open-dialog]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (menu) setMenu(false);
        opener = button;
        dialog.showModal();
        firstField.focus();
      });
    });
    dialog.querySelectorAll('[data-close-dialog]').forEach(function (button) {
      button.addEventListener('click', function () { dialog.close(); });
    });
    // A click on the backdrop lands on the dialog element itself. Neither it
    // nor Escape (which closes a modal dialog by itself) may close the form
    // while it is sending.
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog && !submit.disabled) dialog.close();
    });
    dialog.addEventListener('cancel', function (event) {
      if (submit.disabled) event.preventDefault();
    });
    dialog.addEventListener('close', function () {
      if (opener) opener.focus();
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      setBusy(true);
      sendBooking().then(function () {
        setBusy(false);
        form.reset();
        dialog.close();
        showToast();
      });
    });
  }
})();
