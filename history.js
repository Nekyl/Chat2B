// history.js

// --- Constantes de Configuração ---
const RECENT_MESSAGES_WINDOW = 50; // Manter as últimas mensagens na íntegra.
const SUMMARY_CHUNK_SIZE = 20;     // Sumarizar em blocos de mensagens.

// --- Variáveis de Módulo ---
let allChats = {}; // Referência ao objeto principal de chats.
let getApiConfigCallback; // Callback para obter a configuração da API (Ollama/Gemini).
let saveChatsCallback; // Callback para salvar o estado dos chats no localStorage.

/**
 * Inicializa o módulo de histórico.
 * @param {object} chatsObject - A referência ao objeto `allChats` da aplicação.
 * @param {function} apiConfigFn - A função `getApiConfig` do script principal.
 * @param {function} saveFn - A função `saveChatsToLocalStorage` do script principal.
 */
export function initializeHistory(chatsObject, apiConfigFn, saveFn) {
    allChats = chatsObject;
    getApiConfigCallback = apiConfigFn;
    saveChatsCallback = saveFn;
}

/**
 * Adiciona uma nova mensagem ao histórico de um chat específico.
 * @param {string} chatId - O ID do chat.
 * @param {object} messageObject - O objeto da mensagem ({ role, content, timestamp }).
 */
export function addMessageToHistory(chatId, messageObject) {
    if (!allChats[chatId]) {
        console.error(`[History] Chat com ID ${chatId} não encontrado.`);
        return;
    }
    // Garante que recentMessages seja um array
    if (!Array.isArray(allChats[chatId].recentMessages)) {
        allChats[chatId].recentMessages = [];
    }
    allChats[chatId].recentMessages.push(messageObject);
    allChats[chatId].timestamp = Date.now(); // Atualiza o timestamp do chat para ordenação
}

/**
 * Monta e retorna o histórico de mensagens formatado para a API.
 * Combina o contexto sumarizado (longo prazo) com as mensagens recentes (curto prazo).
 * @param {string} chatId - O ID do chat.
 * @returns {Promise<Array<object>>} - Um array de mensagens pronto para a API.
 */
export async function getHistoryForApi(chatId) {
    if (!allChats[chatId]) return [];

    const chat = allChats[chatId];
    const historyForApi = [];

    // 1. Adiciona o contexto sumarizado como uma mensagem inicial do sistema/assistente.
    // É importante que o modelo entenda que este é um contexto prévio e não uma nova instrução.
    if (chat.summarizedContext) {
        historyForApi.push({
            role: 'assistant', // Usar 'assistant' para que o modelo entenda como contexto prévio.
            content: `Este é um resumo da conversa até agora, para seu contexto:\n---\n${chat.summarizedContext}\n---\nContinue a conversa a partir daqui.`
        });
    }

    // 2. Adiciona as mensagens recentes.
    historyForApi.push(...chat.recentMessages);

    return historyForApi;
}

/**
 * Dispara o processo de manutenção de contexto de forma assíncrona (fire-and-forget).
 * Verifica se o histórico recente precisa ser comprimido e, se precisar, inicia a sumarização.
 * @param {string} chatId - O ID do chat.
 * @param {string} model - O nome do modelo a ser usado para a sumarização.
 * @param {string} systemPrompt - O prompt do sistema principal para dar contexto ao sumarizador.
 */
export function triggerContextMaintenance(chatId, model, systemPrompt) {
    if (!allChats[chatId] || !getApiConfigCallback) return;

    const chat = allChats[chatId];

    // Verifica se o número de mensagens recentes excedeu a janela definida.
    if (chat.recentMessages.length > RECENT_MESSAGES_WINDOW) {
        console.log(`[History] Disparando manutenção de contexto para o chat: ${chatId}`);
        // Executa a sumarização sem esperar pela conclusão (assíncrono).
        summarizeOldMessages(chatId, model, systemPrompt).catch(err => {
            console.error(`[History] Erro durante a sumarização em segundo plano:`, err);
        });
    }
}

/**
 * Função interna que realiza a sumarização das mensagens mais antigas.
 * @private
 * @param {string} chatId - O ID do chat.
 * @param {string} model - O nome do modelo a ser usado para a sumarização.
 * @param {string} systemPrompt - O prompt do sistema principal para dar contexto ao sumarizador.
 */
async function summarizeOldMessages(chatId, model, systemPrompt) {
    const chat = allChats[chatId];
    if (!chat || chat.recentMessages.length <= RECENT_MESSAGES_WINDOW) return;

    const messagesToSummarize = chat.recentMessages.slice(0, chat.recentMessages.length - RECENT_MESSAGES_WINDOW);

    if (messagesToSummarize.length === 0) return;

    console.log(`[History] Sumarizando ${messagesToSummarize.length} mensagens antigas para o chat: ${chatId}`);

    const summaryInstructionPrompt = `Você é um assistente de IA focado em resumir conversas. Sua tarefa é criar um resumo conciso e coerente de um trecho de conversa, mantendo os pontos chave, decisões e informações importantes. O resumo deve ser em português e ter no máximo 200 palavras. Se já houver um resumo anterior, incorpore as novas informações a ele. Considere também que o contexto geral da conversa é: ${systemPrompt}`;
    let currentSummary = chat.summarizedContext || '';

    try {
        for (let i = 0; i < messagesToSummarize.length; i += SUMMARY_CHUNK_SIZE) {
            const chunk = messagesToSummarize.slice(i, i + SUMMARY_CHUNK_SIZE);
            const chunkFormattedForModel = chunk.map(msg => {
                let contentText = '';
                if (typeof msg.content === 'string') {
                    contentText = msg.content;
                } else if (Array.isArray(msg.content)) {
                    const textPart = msg.content.find(p => p.type === 'text');
                    contentText = textPart ? textPart.text : '[Conteúdo não textual]';
                }
                return { role: msg.role, content: contentText };
            });

            const fullPrompt = [
                { role: 'system', content: summaryInstructionPrompt },
                { role: 'user', content: `Aqui está um trecho da conversa para resumir. Se houver um resumo anterior, por favor, incorpore este novo trecho a ele. Resumo anterior (se houver): "${currentSummary}"\n\nTrecho da conversa:\n${chunkFormattedForModel.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nNovo resumo:` }
            ];

            const apiConfig = await getApiConfigCallback();
            let summarizedContent;

            if (apiConfig.provider === 'ollama') {
                const response = await fetch(`${apiConfig.url}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // Preenchendo o corpo da requisição
                    body: JSON.stringify({
                        model: model,
                        messages: fullPrompt,
                        stream: false 
                    })
                });
                if (!response.ok) throw new Error(`Ollama API error: ${response.statusText}`);
                const data = await response.json();
                summarizedContent = data.message.content;

            } else if (apiConfig.provider === 'gemini') {
                const geminiMessages = fullPrompt.map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                }));
                const response = await fetch(`${apiConfig.url}/${model}:generateContent?key=${apiConfig.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // Preenchendo o corpo da requisição
                    body: JSON.stringify({ contents: geminiMessages })
                });
                if (!response.ok) throw new Error(`Gemini API error: ${response.statusText}`);
                const data = await response.json();
                summarizedContent = data.candidates[0].content.parts[0].text;
            }

            if (summarizedContent) {
                currentSummary = summarizedContent.trim();
            }
        }

        chat.summarizedContext = currentSummary;
        chat.recentMessages.splice(0, messagesToSummarize.length);

        console.log(`[History] Sumarização finalizada para o chat ${chatId}.`);
        saveChatsCallback();

    } catch (error) {
        console.error(`[History] Falha ao sumarizar para o chat ${chatId}. As mensagens originais foram mantidas. Erro:`, error);
    }
}

/**
 * Limpa o histórico de mensagens recentes e o contexto sumarizado para um chat específico.
 * @param {string} chatId - O ID do chat.
 */
export function clearChatHistory(chatId) {
    if (allChats[chatId]) {
        allChats[chatId].recentMessages = [];
        allChats[chatId].summarizedContext = '';
        saveChatsCallback();
        console.log(`[History] Histórico do chat ${chatId} limpo.`);
    }
}

