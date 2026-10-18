const CACHE = 'bakimos-shell-v2';
const SHELL = ['/', '/login', '/offline', '/offline.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && shouldCache(url.pathname)) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          if (cached) return cached;
          const offlinePage = await caches.match('/offline.html');
          return offlinePage || new Response('Çevrimdışı', { status: 503, statusText: 'Offline' });
        });
      return cached || network;
    }),
  );
});

function shouldCache(pathname) {
  if (pathname.startsWith('/_next/static/')) return true;
  if (pathname.endsWith('.js') || pathname.endsWith('.css')) return true;
  if (pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/offline')) return true;
  if (pathname.startsWith('/icons/')) return true;
  return false;
}
