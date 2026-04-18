const CACHE_NAME = 'chat2b-cache-v11';

// Arquivos essenciais locais — cache-first
const CORE_ASSETS = [
  '/index.html',
  '/style.css',
  '/script.js',
  '/prompt.js',
  '/history.js',
  '/storage.js',
  '/manifest.json',
  '/icons/favicon.ico',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png',
  '/local_assets/css/all.min.css',
  '/local_assets/css/cropper.min.css',
  '/local_assets/css/katex.min.css',
  '/local_assets/js/marked.min.js',
  '/local_assets/js/purify.min.js',
  '/local_assets/js/highlight.min.js',
  '/local_assets/js/katex.min.js',
  '/local_assets/js/auto-render.min.js',
  '/local_assets/js/cropper.min.js',
  '/local_assets/webfonts/fa-brands-400.woff2',
  '/local_assets/webfonts/fa-regular-400.woff2',
  '/local_assets/webfonts/fa-solid-900.woff2',
  '/local_assets/webfonts/fa-v4compatibility.woff2',
];

// Fontes KaTeX — cache separado (muitos arquivos)
const KATEX_FONTS = [
  '/local_assets/css/fonts/KaTeX_AMS-Regular.woff2',
  '/local_assets/css/fonts/KaTeX_Caligraphic-Bold.woff2',
  '/local_assets/css/fonts/KaTeX_Caligraphic-Regular.woff2',
  '/local_assets/css/fonts/KaTeX_Fraktur-Bold.woff2',
  '/local_assets/css/fonts/KaTeX_Fraktur-Regular.woff2',
  '/local_assets/css/fonts/KaTeX_Main-Bold.woff2',
  '/local_assets/css/fonts/KaTeX_Main-BoldItalic.woff2',
  '/local_assets/css/fonts/KaTeX_Main-Italic.woff2',
  '/local_assets/css/fonts/KaTeX_Main-Regular.woff2',
  '/local_assets/css/fonts/KaTeX_Math-BoldItalic.woff2',
  '/local_assets/css/fonts/KaTeX_Math-Italic.woff2',
  '/local_assets/css/fonts/KaTeX_SansSerif-Bold.woff2',
  '/local_assets/css/fonts/KaTeX_SansSerif-Italic.woff2',
  '/local_assets/css/fonts/KaTeX_SansSerif-Regular.woff2',
  '/local_assets/css/fonts/KaTeX_Script-Regular.woff2',
  '/local_assets/css/fonts/KaTeX_Size1-Regular.woff2',
  '/local_assets/css/fonts/KaTeX_Size2-Regular.woff2',
  '/local_assets/css/fonts/KaTeX_Size3-Regular.woff2',
  '/local_assets/css/fonts/KaTeX_Size4-Regular.woff2',
  '/local_assets/css/fonts/KaTeX_Typewriter-Regular.woff2',
];

self.addEventListener('install', (event) => {
  console.log('[SW 2B] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW 2B] Cacheando arquivos essenciais');
      return cache.addAll([...CORE_ASSETS, ...KATEX_FONTS]);
    }).catch((err) => {
      // Se falhar ao cachear algum arquivo (ex: offline), ainda ativa
      console.warn('[SW 2B] Falha parcial no cache:', err.message);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW 2B] Ativando...');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW 2B] Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Não cachear chamadas de API externas
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);

      // Cache-first: serve do cache e atualiza em background
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      }).catch(() => null);

      return cached || fetchPromise;
    })
  );
});
