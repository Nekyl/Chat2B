// Define um nome e versão para o nosso cache.
const CACHE_NAME = 'chat2b-cache-v2';
const REPO_NAME = '2B-Chat';

// Lista de todos os arquivos que nosso aplicativo precisa para funcionar offline.
const FILES_TO_CACHE = [
  `/${REPO_NAME}/`,
  `/${REPO_NAME}/index.html`,
  `/${REPO_NAME}/style.css`,
  `/${REPO_NAME}/script.js`,
  `/${REPO_NAME}/prompt.js`,
  `/${REPO_NAME}/manifest.json`,
  `/${REPO_NAME}/icon-192.png`,
  `/${REPO_NAME}/icon-512.png`,
  // Arquivos de bibliotecas externas não mudam
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/marked/4.0.2/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/dracula.min.css'
];

// Evento 'install': é acionado quando o Service Worker é registrado pela primeira vez.
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando arquivos essenciais');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  
  self.skipWaiting();
});

// Evento 'fetch': é acionado toda vez que o aplicativo faz uma requisição de rede
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não são GET (como as chamadas para a API do Gemini)
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Se a resposta for encontrada no cache, retorna a versão em cache.
      if (response) {
        return response;
      }
      // Se não estiver no cache, vai até a rede para buscar.
      return fetch(event.request);
    })
  );
});

// Evento 'activate': é acionado quando o Service Worker se torna ativo.
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando...');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removendo cache antigo', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});
