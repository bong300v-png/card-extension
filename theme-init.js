// Apply saved theme before paint to avoid FOUC.
// Loaded synchronously from popup.html <head>. Cannot be inline because the
// extension's Manifest V3 CSP forbids inline scripts.
(function () {
  try {
    var t = localStorage.getItem('cf_theme');
    if (t === 'dark') {
      document.documentElement.classList.add('dark-mode');
    }
  } catch (_) {}
})();
