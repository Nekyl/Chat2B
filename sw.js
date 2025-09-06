// Define um nome e versão para o nosso cache.
const CACHE_NAME = 'chat2b-cache-v2';

// Lista de todos os arquivos que nosso aplicativo precisa para funcionar offline.
const FILES_TO_CACHE = [
  'index.html',
  'style.css',
  'script.js',
  'prompt.js',
  'manifest.json',
  // Arquivos de bibliotecas externas também podem ser cacheados!
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/marked/4.0.2/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/base16/dracula.min.css'
];

// Evento 'install': é acionado quando o Service Worker é registrado pela primeira vez.
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  
  // Espera até que o cache seja aberto e todos os nossos arquivos sejam adicionados a ele.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando arquivos essenciais');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  
  // Força o novo Service Worker a se tornar ativo imediatamente.
  self.skipWaiting();
});

// Evento 'fetch': é acionado toda vez que o aplicativo faz uma requisição de rede
// (ex: buscar uma imagem, um script, uma folha de estilo).
self.addEventListener('fetch', (event) => {
  console.log('[Service Worker] Buscando recurso: ', event.request.url);

  // Responde à requisição com uma estratégia "Cache primeiro, depois rede".
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Se a resposta for encontrada no cache, retorna a versão em cache.
      if (response) {
        console.log('[Service Worker] Recurso encontrado no cache!', event.request.url);
        return response;
      }
      
      // Se não estiver no cache, vai até a rede para buscar.
      console.log('[Service Worker] Recurso não encontrado no cache, buscando na rede...', event.request.url);
      return fetch(event.request);
    })
  );
});

// Evento 'activate': é acionado quando o Service Worker se torna ativo.
// Útil para limpar caches antigos.
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando...');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                // Se o nome do cache não for o atual, ele é excluído.
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removendo cache antigo', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    // Garante que o Service Worker tome controle da página imediatamente.
    return self.clients.claim();
});
