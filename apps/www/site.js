// Senso marketing site: the mobile menu, the booking dialog and its toast.
// Everything else on the pages is plain HTML and CSS.
(function () {
  'use strict';

  var TOAST_MS = 5000;
  // The office contacts. The wa.me and mailto links in the pages carry the
  // same values; change them together.
  var WHATSAPP_NUMBER = '97450288285';
  var OFFICE_EMAIL = 'info@sensoqa.com';
  var EMAIL_SUBJECT = 'Site visit request';
  var TOAST_TITLE = {
    whatsapp: 'Your message is ready in WhatsApp',
    email: 'Your message is ready in your mail app',
  };

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

  // Booking dialog. There is no server behind the site, so the form does not
  // send anything itself: it opens WhatsApp or the visitor's mail app with
  // the answers already typed into a message to the office, and the visitor
  // presses send there. Which one depends on the button they pressed.
  var dialog = document.querySelector('.dialog');
  var toast = document.querySelector('.toast');
  var toastTimer = null;

  function showToast(channel) {
    toast.querySelector('.toast-title').textContent = TOAST_TITLE[channel];
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, TOAST_MS);
  }

  function bookingMessage(form) {
    var value = function (name) { return form.elements[name].value.trim(); };
    var lines = [
      'Hi Senso, I would like to book a site visit.',
      'Name: ' + value('name'),
      'Business: ' + (value('business') || '-'),
      'Monitoring: ' + value('site') + ', ' + value('units'),
    ];
    if (value('phone')) lines.push('Call me on: ' + value('phone'));
    return lines.join('\n');
  }

  function whatsappUrl(message) {
    return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(message);
  }

  function mailtoUrl(message) {
    return 'mailto:' + OFFICE_EMAIL + '?subject=' + encodeURIComponent(EMAIL_SUBJECT) + '&body=' + encodeURIComponent(message);
  }

  if (dialog) {
    var form = dialog.querySelector('form');
    var firstField = form.querySelector('input, select');
    // Where focus goes back to when the dialog closes: the button that opened it.
    var opener = null;

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
    // A click on the backdrop lands on the dialog element itself.
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', function () {
      if (opener) opener.focus();
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var channel = event.submitter && event.submitter.value === 'email' ? 'email' : 'whatsapp';
      var message = bookingMessage(form);
      if (channel === 'email') {
        // A mailto link hands the message to the mail app and leaves the page
        // where it is.
        window.location.assign(mailtoUrl(message));
      } else {
        // Opened from the submit click so browsers treat it as the visitor's
        // own action: a new tab on a laptop, the app on a phone.
        window.open(whatsappUrl(message), '_blank', 'noopener');
      }
      form.reset();
      dialog.close();
      showToast(channel);
    });
  }
})();
