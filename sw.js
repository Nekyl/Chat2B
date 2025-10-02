// Define um nome de cache único e com versão para forçar a atualização
const CACHE_NAME = 'chat2b-cache-v7';

// Lista de TODOS os arquivos que o Chat precisa, com CAMINHOS ABSOLUTOS
const FILES_TO_CACHE = [
  // Arquivos do próprio App
  '/Chat/index.html',
  '/Chat/style.css',
  '/Chat/script.js',
  '/Chat/prompt.js',
  '/Chat/history.js',
  '/Chat/manifest.json',
  '/Chat/icon-192.png',
  '/Chat/icon-512.png',

  // Arquivos de bibliotecas externas
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/marked/4.0.2/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/dracula.min.css'
];

// Evento 'install': Guarda os arquivos no cache
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
  // Ignora requisições que não são GET, pois não podem ser cacheadas.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Tenta pegar do cache primeiro para uma resposta rápida e offline.
      const cachedResponse = await cache.match(event.request);

      // 2. Em paralelo, busca uma versão nova na rede.
      const fetchedResponsePromise = fetch(event.request).then((networkResponse) => {
        // Se a busca na rede funcionou, atualiza o cache com a nova versão.
        if (networkResponse.ok) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => {
        // O fetch falhou (servidor offline, sem rede).
        // Isso não é um erro crítico, pois o cache pode já ter sido servido.
        // Se não havia cache, a falha será propagada.
      });

      // 3. Retorna a resposta do cache se existir,
      // ou aguarda a resposta da rede caso o arquivo ainda não esteja no cache.
      return cachedResponse || fetchedResponsePromise;
    })
  );
});