// Define um nome de cache único e com versão para forçar a atualização
// ATUALIZADO: Versão incrementada para v9 para incluir a nova fonte de compatibilidade.
const CACHE_NAME = 'chat2b-cache-v9';

// Lista de TODOS os arquivos que o Chat precisa, com base na sua estrutura de pastas.
const FILES_TO_CACHE = [
  // --- Arquivos da raiz do App ('/Chat/') ---
  '/Chat/index.html',
  '/Chat/style.css',
  '/Chat/script.js',
  '/Chat/prompt.js',
  '/Chat/history.js',
  '/Chat/manifest.json',
  '/Chat/icon-192.png',
  '/Chat/icon-512.png',

  // --- Arquivos de bibliotecas locais (/Chat/local_assets/) ---
  
  // CSS
  '/Chat/local_assets/css/all.min.css',
  '/Chat/local_assets/css/dracula.min.css',

  // JS
  '/Chat/local_assets/js/marked.min.js',
  '/Chat/local_assets/js/highlight.min.js',

  // FONTES (Lista completa da sua pasta webfonts)
  '/Chat/local_assets/webfonts/fa-brands-400.woff2',
  '/Chat/local_assets/webfonts/fa-regular-400.woff2',
  '/Chat/local_assets/webfonts/fa-solid-900.woff2',
  '/Chat/local_assets/webfonts/fa-v4compatibility.woff2`
];

// Evento 'install': Guarda os arquivos no cache
self.addEventListener('install', (event) => {
  console.log('[SW Chat] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW Chat] Cacheando arquivos essenciais');
      // O addAll faz um fetch para cada URL e armazena o resultado. Se um falhar, a instalação toda falha.
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Evento 'activate': Limpa os caches antigos
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

// Evento 'fetch': Responde com o cache e tenta atualizar em segundo plano (Stale-While-Revalidate)
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
        // A rede falhou, mas não tem problema se já tivermos uma resposta do cache.
      });

      // Retorna a resposta do cache se existir, senão, aguarda a resposta da rede.
      return cachedResponse || fetchedResponsePromise;
    })
  );
});
