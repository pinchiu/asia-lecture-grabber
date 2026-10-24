const CACHE_NAME = 'asia-lecture-grabber-v11';
const PRECACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 僅處理 GET 請求，POST / PUT / DELETE 交由瀏覽器自然傳輸
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API 請求走純網路，若離線回傳 503
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: '離線狀態，無法連線本機服務' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
      })
    );
    return;
  }

  // 靜態資源走 Network-First（網路優先），離線時優雅降級回快取
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('離線模式，資源無法載入', { status: 504, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        });
      })
  );
});
