// Define um nome e versão para o nosso cache.
const CACHE_NAME = 'chat2b-cache-v3'; // Mudei a versão para forçar a atualização

// Lista de arquivos com caminhos relativos. Funciona em qualquer lugar.
const FILES_TO_CACHE = [
  'index.html',
  'style.css',
  'script.js',
  'prompt.js',
  'manifest.json',
  'icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/marked/4.0.2/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/dracula.min.css'
];

// Evento 'install': acionado quando o Service Worker é registrado.
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando arquivos essenciais para offline.');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Evento 'activate': acionado quando o Service Worker se torna ativo.
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando...');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                // Se o nome do cache não for o atual, ele é excluído.
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removendo cache antigo:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

// Evento 'fetch': acionado para cada requisição da página.
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não são GET (como as chamadas POST para a API)
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Retorna do cache se encontrar, senão busca na rede.
      return response || fetch(event.request);
    })
  );
});
