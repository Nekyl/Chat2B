const CACHE_NAME = 'chat2b-cache-v9';

const FILES_TO_CACHE = [
  '/Chat/index.html',
  '/Chat/style.css',
  '/Chat/script.js',
  '/Chat/prompt.js',
  '/Chat/history.js',
  '/Chat/manifest.json',
  '/Chat/icon-192.png',
  '/Chat/icon-512.png',
  '/Chat/local_assets/css/all.min.css',
  '/Chat/local_assets/css/dracula.min.css',
  '/Chat/local_assets/js/marked.min.js',
  '/Chat/local_assets/js/highlight.min.js',
  '/Chat/local_assets/webfonts/fa-brands-400.woff2',
  '/Chat/local_assets/webfonts/fa-regular-400.woff2',
  '/Chat/local_assets/webfonts/fa-solid-900.woff2',
  '/Chat/local_assets/webfonts/fa-v4compatibility.woff2`
];

self.addEventListener('install', (event) => {
  console.log('[SW Chat] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW Chat] Cacheando arquivos essenciais');
      
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW Chat] Ativando...');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[SW Chat] Removendo cache antigo', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const fetchedResponsePromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => {

      });

      return cachedResponse || fetchedResponsePromise;
    })
  );
});
