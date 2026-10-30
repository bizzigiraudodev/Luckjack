// Service worker: guarda el juego para poder jugar sin internet.
// Primero intenta la red (así siempre ves la última versión) y si no hay conexión usa la copia guardada.
const CACHE = 'luckjack-v6';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/fonts.css',
  'css/style.css',
  'js/cards.js',
  'js/bonuses.js',
  'js/decks.js',
  'js/upgrades.js',
  'js/game.js',
  'js/pixel.js',
  'js/audio.js',
  'js/table.js',
  'js/cutscene.js',
  'js/story.js',
  'js/leaderboard.js',
  'js/truco.js',
  'js/truco-ai.js',
  'js/truco-ui.js',
  'js/pwa.js',
  'js/ui.js',
  'js/bg.js',

  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Los rankings siempre van a la red (no se guardan para jugar offline).
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
  );
});
