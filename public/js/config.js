// Site-wide constants for the browser. The contact email lives here (and in api/_config.js).
window.CC = {
  contact: 'peter.karki0422@gmail.com',
  itch: 'https://pinological.itch.io/changa-chett',
  testerForm: 'https://forms.gle/2Zg98kkJ8AN7hJGt6',
};

// Fill every [data-contact] link from the constant above (the HTML keeps a working default without JS).
document.querySelectorAll('[data-contact]').forEach(function (a) {
  a.href = 'mailto:' + window.CC.contact + (a.getAttribute('data-subject') ? '?subject=' + encodeURIComponent(a.getAttribute('data-subject')) : '');
  if (a.hasAttribute('data-contact-text')) a.textContent = window.CC.contact;
});
