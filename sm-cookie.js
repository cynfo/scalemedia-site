(function () {
  'use strict';
  var KEY = 'cookie_consent';
  var el  = document.getElementById('sm-cookie');
  if (!el) return;

  try { if (!localStorage.getItem(KEY)) el.style.display = 'block'; }
  catch (e) { el.style.display = 'block'; }

  window.smAccept = function () {
    try { localStorage.setItem(KEY, JSON.stringify({ analytics: true, ts: Date.now() })); } catch (e) {}
    if (typeof gtag === 'function') gtag('consent', 'update', { analytics_storage: 'granted' });
    el.style.display = 'none';
  };

  window.smReject = function () {
    try { localStorage.setItem(KEY, JSON.stringify({ analytics: false, ts: Date.now() })); } catch (e) {}
    el.style.display = 'none';
  };

  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'open-cookie-settings') {
      e.preventDefault();
      try { localStorage.removeItem(KEY); } catch (e) {}
      el.style.display = 'block';
    }
  });
}());
