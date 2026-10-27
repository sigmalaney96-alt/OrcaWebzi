/* Orca Orca Web — service worker
   App-shell precache + runtime caching + offline saved pages. */
const VERSION = 'orca-v1.0.1'; // bump on every deploy so precached assets refresh
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const OFFLINE_PAGES_CACHE = `${VERSION}-offline-pages`;

const SHELL = [
  '/',
  '/index.html',
  '/onboard.html',
  '/pwa.html',
  '/manifest.webmanifest',
  '/IMG_7168.jpeg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  '/css/site.css',
  '/css/browser.css',
  '/js/onboard.js',
  '/js/pwa/core/store.js',
  '/js/pwa/core/utils.js',
  '/js/pwa/core/ui.js',
  '/js/pwa/core/qr.js',
  '/js/pwa/app/tabs.js',
  '/js/pwa/app/views.js',
  '/js/pwa/app/pages.js',
  '/js/pwa/app/manager.js',
  '/js/pwa/app/feed.js',
  '/js/pwa/app/omnibox.js',
  '/js/pwa/app/menu.js',
  '/js/pwa/app/findinpage.js',
  '/js/pwa/app/share.js',
  '/js/pwa/app/gestures.js',
  '/js/pwa/app/shortcuts.js',
  '/js/pwa/app/downloads.js',
  '/js/pwa/app/sync.js',
  '/js/pwa/app/firstrun.js',
  '/js/pwa/app/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((k) => k.startsWith('orca-') && !k.startsWith(VERSION))
        .map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SKIP_WAITING') self.skipWaiting();
  if (msg.type === 'SAVE_OFFLINE_PAGE' && msg.url && msg.html != null) {
    const response = new Response(msg.html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Orca-Offline': '1' }
    });
    event.waitUntil(
      caches.open(OFFLINE_PAGES_CACHE).then((c) => c.put(new Request(msg.url), response))
    );
  }
  if (msg.type === 'DELETE_OFFLINE_PAGE' && msg.url) {
    event.waitUntil(
      caches.open(OFFLINE_PAGES_CACHE).then((c) => c.delete(new Request(msg.url)))
    );
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Saved offline pages are served first when the network is unavailable.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => {
          const offline = await caches.open(OFFLINE_PAGES_CACHE);
          const saved = await offline.match(req);
          if (saved) return saved;
          const cached = await caches.match(req);
          if (cached) return cached;
          // Fall back to the app shell for app routes.
          if (url.pathname === '/pwa' || url.pathname === '/pwa.html') {
            return caches.match('/pwa.html');
          }
          if (url.pathname === '/onboard' || url.pathname === '/onboard.html') {
            return caches.match('/onboard.html');
          }
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Static assets: cache-first with runtime fill.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
