// Instalación como app: service worker para jugar offline y botón "Instalar".
(function () {
  const $ = (id) => document.getElementById(id);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferredPrompt = null;

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('No se pudo registrar el service worker', e));
  }

  const btn = $('btn-install');
  if (standalone) return; // ya está instalada

  // Android / Chrome / Edge: el navegador avisa que se puede instalar.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    btn.hidden = true;
  });

  // iPhone/iPad no tiene ese aviso: se instala desde el menú Compartir de Safari.
  if (isIOS) btn.hidden = false;

  btn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      btn.hidden = true;
    } else {
      $('install-help').hidden = false;
    }
  });
  $('btn-close-install').addEventListener('click', () => { $('install-help').hidden = true; });
})();
