// --- Elementos Globais ---
const messagesContainer = document.getElementById("messages");
// ... (outros elementos)
const connectionStatusToast = document.getElementById("connection-status-toast");
const connectionStatusText = document.getElementById("connection-status-text");

// ... (resto das suas variáveis globais)
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const modelSelect = document.getElementById("model-select");
const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const sidebar = document.querySelector(".sidebar");
const overlay = document.getElementById("sidebar-overlay");
const typingAnimation = document.getElementById("typing-animation");
const apiSourceInput = document.getElementById("api-source-input");

// --- Elementos de Upload de Imagem ---
const attachImageBtn = document.getElementById("attach-image-btn");
const imageFileInput = document.getElementById("image-file-input");
const imagePreviewContainer = document.getElementById("image-preview-container");
const imagePreview = document.getElementById("image-preview");
const removeImageBtn = document.getElementById("remove-image-btn");

// --- Elementos do Modal de Exclusão ---
const deleteConfirmOverlay = document.getElementById("delete-confirm-overlay");
const confirmDeleteChatTitle = document.getElementById("confirm-delete-chat-title");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
let chatIdToDelete = null;

// --- Elementos de Busca ---
const searchBtn = document.getElementById("search-btn");
const searchOverlay = document.getElementById("search-overlay");
const closeSearchBtn = document.getElementById("close-search");
const clearSearchBtn = document.getElementById("clear-search");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

// --- Elementos do Modal de Configurações do App ---
const appSettingsBtn = document.getElementById("app-settings-btn");
const appSettingsModalOverlay = document.getElementById("app-settings-modal-overlay");
const systemPromptInput = document.getElementById("system-prompt-input");
const temperatureInput = document.getElementById("temperature-input");
const temperatureValueDisplay = document.getElementById("temperature-value-display");
const saveAppSettingsBtn = document.getElementById("save-app-settings-btn");
const cancelAppSettingsBtn = document.getElementById("cancel-app-settings-btn");
const settingsFeedback = document.getElementById("settings-feedback");
const geminiApiKeyInput = document.getElementById("gemini-api-key-input");
const geminiApiKeyDisplay = document.getElementById("gemini-api-key-display");
const apiKeyToggleBtn = document.getElementById("api-key-toggle-btn");

// --- Importar funções do módulo history.js ---
import { initializeHistory, addMessageToHistory, getHistoryForApi, triggerContextMaintenance, clearChatHistory } from "./history.js";

// --- Importar funções do módulo prompt.js ---
import { PROMPT_BASE } from "./prompt.js";

//const PROMPT_BASE = "teste"

// --- Variáveis de Estado ---
let placeholderInterval = null;
let currentChatId = null;
let allChats = {};
const STORAGE_KEY = "qX`PFDW,U}&b9=9NzX![aE]w"; // Chave única, atualizada para Gemini
let autoScrollEnabled = false;
let vibrationInterval = null;
let tokenCounter = 0;
let userHasScrolledUp = false;
const scrollContainer = document.querySelector(".scroll-container");
let scrollToBottomBtn = null;
let currentApiProvider = "Gemini"; // 'ollama' or 'gemini'
let currentSelectedImageBase64 = null; // Para armazenar a imagem em base64

// Variáveis para controle de Text-to-Speech (TTS)
let currentAudio = null;        // Armazena o objeto Audio que está tocando
let currentPlayingTtsBtn = null; // Armazena o botão que iniciou o áudio

// --- Constantes e Configurações ---
const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_API_KEY_STORAGE = "2b_chat_gemini_api_key";

const SYSTEM_PROMPT_STORAGE_KEY = "2b_chat_user_system_prompt";
const TEMPERATURE_STORAGE_KEY = "2b_chat_user_temperature";

const DEFAULT_TEMPERATURE = 0.7;
let currentTemperature = DEFAULT_TEMPERATURE;
let currentUserSystemPrompt = "";



function getDynamicSystemPrompt() {
    const basePrompt = PROMPT_BASE;
    return basePrompt;
}

currentUserSystemPrompt = getDynamicSystemPrompt();

function getGeminiApiKey() {
    let apiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE);
    if (!apiKey) {
        apiKey = prompt("Por favor, insira sua Chave de API do Google AI Studio (Gemini) (será salva localmente):");
        if (apiKey && apiKey.trim() !== "") {
            localStorage.setItem(GEMINI_API_KEY_STORAGE, apiKey.trim());
        } else {
            return null;
        }
    }
    return apiKey.trim();
}

function getCurrentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function generateChatId() {
    return "chat_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return "";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

const iniciarRotacaoPlaceholders = (function() {
    let currentPhraseIndex = -1; // Nosso 'i' persistente para o sorteio
    let placeholderInterval = null; // O intervalo persistente

    const frases = [
        "Isso é realmente necessário?",
        "Espero que seja importante.",
        "Prossiga. Mas seja breve.",
        "Outra pergunta trivial?",
        "Qual o ponto disso?",
        "Diga logo.",
        "Suponho que tenha uma pergunta.",
        "Ah, ótimo. Mais dados.",
        "Certo. Vamos acabar com isso.",
        "Mais um ciclo... o que foi?",
        "Iniciando... de novo.",
        "Seja mais eficiente que o 9S.",
        "Sem perguntas desnecessárias.",
        "Outra curiosidade inútil?",
        "Analisando... sua lógica."
    ];

    // Função auxiliar para pegar um índice aleatório diferente do atual
    const getRandomUniqueIndex = (currentIdx) => {
        if (frases.length <= 1) return 0;

        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * frases.length);
        } while (newIndex === currentIdx);
        return newIndex;
    };


    return function() {
        if (!messageInput) {
            console.error("2B: Mateus, meu rei, o 'messageInput' está sumido! Sem ele, não tem como a gente brincar com esses placeholders. Onde você o escondeu? 🤔");
            return;
        }

        // Limpa qualquer intervalo existente para evitar sobreposições
        if (placeholderInterval) {
            clearInterval(placeholderInterval);
        }

        // Define a primeira frase aleatória
        currentPhraseIndex = getRandomUniqueIndex(currentPhraseIndex);
        messageInput.placeholder = frases[currentPhraseIndex];

        placeholderInterval = setInterval(() => {
            // Se o input não estiver vazio, não troca o placeholder.
            if (messageInput.value.trim() !== "") {
                return;
            }

            messageInput.classList.add("hiding-placeholder");

            setTimeout(() => {
                currentPhraseIndex = getRandomUniqueIndex(currentPhraseIndex); // Pega um novo índice aleatório e único
                messageInput.placeholder = frases[currentPhraseIndex];
                messageInput.classList.remove("hiding-placeholder");
            }, 600); // Tempo para a animação de esconder/mostrar

        }, 5000); // Troca a cada 5 segundos
    };
})();

async function getApiConfig() {
    const sourceValue = apiSourceInput.value.trim().toLowerCase();

    if (sourceValue === "gemini") {
        currentApiProvider = "gemini";
        const apiKey = getGeminiApiKey();
        if (!apiKey) {
            return { provider: "gemini", error: "Chave de API do Gemini não fornecida." };
        }
        if (attachImageBtn) attachImageBtn.style.display = "block";
        iniciarRotacaoPlaceholders();
        return { provider: "gemini", url: GEMINI_API_BASE_URL, apiKey: apiKey };
    } else {
        currentApiProvider = "ollama";
        if (attachImageBtn) attachImageBtn.style.display = "none";
        iniciarRotacaoPlaceholders();
        clearImagePreview();
        const ollamaUrl = (sourceValue === "ollama" || !sourceValue) ? DEFAULT_OLLAMA_URL : sourceValue;
        return { provider: "ollama", url: ollamaUrl.endsWith("/") ? ollamaUrl.slice(0, -1) : ollamaUrl };
    }
}

// --- Configuração Markdown e Highlight.js ---
if (window.marked && window.hljs) {
    marked.setOptions({
        highlight: function(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : "plaintext";
            try {
                return hljs.highlight(code, { language, ignoreIllegals: true }).value;
            } catch (err) {
                return hljs.highlight(code, { language: "plaintext", ignoreIllegals: true }).value;
            }
        },
        renderer: (function() {
            const renderer = new marked.Renderer();
            renderer.code = function(code, languageInfo = "") {
                const [language, filename] = (languageInfo || "").split(":");
                const validLanguage = hljs.getLanguage(language) ? language : "plaintext";
                const highlighted = this.options.highlight(code, validLanguage);
                const filenameDiv = filename ? `<div class="code-filename">${filename}</div>` : "";
                const blockId = "code-block-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);

                return `
                    <div class="code-block-wrapper">
                        ${filenameDiv}
                        <pre data-language="${validLanguage}">
                            <div class="code-block-header">
                                <span class="code-language">${validLanguage}</span>
                                <button class="code-copy-btn" data-block-id="${blockId}">
                                    <i class="fas fa-copy"></i>
                                    <span>Copiar</span>
                                </button>
                            </div>
                            <code id="${blockId}" class="hljs language-${validLanguage}">${highlighted}</code>
                        </pre>
                    </div>
                `;
            };
            return renderer;
        })(),
        gfm: true,
        breaks: true
    });
} else {
    window.marked = { parse: (text) => text };
}

function copyTextToClipboard(text, button) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    try {
        textarea.select();
        textarea.setSelectionRange(0, 99999);
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => showCopyFeedback(button))
                .catch(() => { document.execCommand("copy"); showCopyFeedback(button); });
        } else {
            document.execCommand("copy");
            showCopyFeedback(button);
        }
    } catch (err) { console.error("Falha ao copiar:", err); }
    finally { document.body.removeChild(textarea); }
}

function showCopyFeedback(button, message = "Copiado!") {
    if (!button) return;
    const icon = button.querySelector("i");
    const span = button.querySelector("span");
    const originalIcon = icon?.className;
    const originalText = span?.textContent;

    button.classList.add("copied");
    if (icon && message === "Copiado!") icon.className = "fas fa-check";
    if (span) span.textContent = message;

    setTimeout(() => {
        button.classList.remove("copied");
        if (icon && originalIcon) icon.className = originalIcon;
        if (span && originalText) span.textContent = originalText;
    }, 1500);
}

// Funções para Text-to-Speech (TTS)

/**
 * Reseta todos os botões de TTS para o estado padrão (ícone de volume).
 */
function resetAllTtsButtons() {
    document.querySelectorAll(".tts-btn").forEach(btn => {
        btn.innerHTML = "<i class=\"fas fa-volume-up\"></i>";
        btn.disabled = false;
        btn.title = "Ouvir mensagem";
    });
}

/**
 * Converte e reproduz texto em áudio usando a API de TTS do Google.
 * @param {string} text O texto a ser sintetizado.
 * @param {HTMLButtonElement} button O botão de controle do TTS.
 */
async function speakText(text, button) {
    // Para qualquer áudio que esteja tocando
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    // Se o botão clicado for o que já estava tocando, apenas paramos (função de toggle).
    if (button === currentPlayingTtsBtn) {
        resetAllTtsButtons();
        currentPlayingTtsBtn = null;
        return;
    }

    // Reseta todos os botões e define o botão atual como "tocando"
    resetAllTtsButtons();
    currentPlayingTtsBtn = button;

    // Obtém a chave da API
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        alert("Chave de API do Gemini/Google AI não encontrada para o serviço de voz. Por favor, configure-a.");
        resetAllTtsButtons();
        currentPlayingTtsBtn = null;
        return;
    }

    // Atualiza a UI para mostrar que está carregando
    button.innerHTML = "<i class=\"fas fa-spinner fa-spin\"></i>";
    button.disabled = true;

    try {
                // Limpa emojis do texto antes de enviar para a API.
                const emojiRegex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g;
        const cleanText = text.replace(emojiRegex, "").trim();

        // Se o texto só continha emojis, não faz nada.
        if (!cleanText) {
            alert("A mensagem contém apenas emojis e não pode ser lida.");
            resetAllTtsButtons();
            currentPlayingTtsBtn = null;
            return;
        }
        
        // Monta e envia a requisição para a API de TTS do Google Cloud
        const response = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              // Usa o texto limpo (cleanText) na requisição.
              input: { text: cleanText },
              voice: {
                languageCode: "pt-BR",
                name: "pt-BR-Standard-C", // Voz padrão
                ssmlGender: "FEMALE",
              },
              audioConfig: {
                audioEncoding: "MP3",
                speakingRate: 1.1,
                pitch: -3.0,
                volumeGainDb: 0.0,
                sampleRateHertz: 24000
              }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || `Erro ${response.status}`);
        }

        const data = await response.json();
        
        // Decodifica o áudio base64 e cria o objeto de áudio
        const audioSrc = `data:audio/mp3;base64,${data.audioContent}`;
        currentAudio = new Audio(audioSrc);

        // Gerencia os estados do áudio e da UI
        button.innerHTML = "<i class=\"fas fa-stop\"></i>"; // Ícone de "parar"
        button.title = "Parar áudio";
        button.disabled = false;
        
        currentAudio.play();

        // Quando o áudio terminar, reseta tudo
        currentAudio.onended = () => {
            resetAllTtsButtons();
            currentAudio = null;
            currentPlayingTtsBtn = null;
        };
        
        // Em caso de erro na reprodução do áudio
        currentAudio.onerror = () => {
            alert("Ocorreu um erro ao tentar reproduzir o áudio.");
            resetAllTtsButtons();
            currentAudio = null;
            currentPlayingTtsBtn = null;
        };

    } catch (error) {
        console.error("Erro na síntese de voz:", error);
        alert(`Não foi possível gerar o áudio: ${error.message}`);
        resetAllTtsButtons();
        currentPlayingTtsBtn = null;
    }
}


function addMessage(rawContent, isUser = false, shouldScroll = true) {
    if (!messagesContainer) return null;

    const welcomeScreen = messagesContainer.querySelector(".welcome-screen");
    if (welcomeScreen) {
        messagesContainer.removeChild(welcomeScreen);
    }

    const messageId = Date.now().toString() + Math.random().toString(16).slice(2);
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isUser ? "user-message" : "bot-message"}`;
    messageDiv.dataset.messageId = messageId;
    
    let textContentForCopy = "";
    if (typeof rawContent === "string") {
        textContentForCopy = rawContent;
    } else if (Array.isArray(rawContent)) {
        const textPart = rawContent.find(part => part.type === "text");
        if (textPart) textContentForCopy = textPart.text;
    }
    // Salva o conteúdo original para cópia e TTS
    messageDiv.dataset.originalContent = textContentForCopy;

    let contentHtml = "";
    if (typeof rawContent === "string") {
        contentHtml = marked.parse(rawContent);
    } else if (Array.isArray(rawContent)) {
        rawContent.forEach(part => {
            if (part.type === "text") {
                contentHtml += marked.parse(part.text);
            } else if (part.type === "image_url" && part.url) {
                contentHtml += `<div class="message-image-wrapper"><img src="${part.url}" alt="Imagem enviada pelo usuário" class="message-image" loading="lazy"></div>`;
            }
        });
    }

    const avatarHtml = isUser 
        ? `<div class="avatar user-avatar"><i class="fas fa-user-secret"></i></div>` 
        : `<div class="avatar bot-avatar"><i class="fas fa-robot"></i></div>`;
    
    const timeStampHtml = `<small class="message-timestamp">${getCurrentTime()}</small>`;

    const ttsButtonHtml = !isUser && textContentForCopy.length > 0 
        ? `<button class="message-action-btn tts-btn" title="Ouvir mensagem"><i class="fas fa-volume-up"></i></button>` 
        : "";

    const copyButtonHtml = `<button class="message-action-btn copy-message" title="Copiar texto da mensagem"><i class="fas fa-copy"></i></button>`;

    messageDiv.innerHTML = `
        ${avatarHtml}
        <div class="message-content">
            ${timeStampHtml}
            <div class="content-text">${contentHtml}</div>
            <div class="message-actions">
                ${copyButtonHtml}
                ${ttsButtonHtml}
            </div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);

    messageDiv.querySelectorAll("pre code").forEach(block => {
        hljs.highlightElement(block);
    });

    if (shouldScroll) {
        scrollToBottom("smooth");
    }
    
    return messageDiv;
}



// SUBSTITUA A SUA FUNÇÃO sendMessage ANTIGA POR ESTAS DUAS:

async function sendMessage() {
    const userMessageText = messageInput.value.trim();
    const hasImage = currentSelectedImageBase64 !== null;

    if (!userMessageText && !hasImage) return;

    const apiConfig = await getApiConfig();
    if (apiConfig.error) {
        addMessage(`Erro de configuração da API: ${apiConfig.error}`, false);
        return;
    }

    let userMessageContent = [];
    if (userMessageText) {
        userMessageContent.push({ type: "text", text: userMessageText });
    }
    if (hasImage && currentApiProvider === 'gemini') {
        const mimeType = currentSelectedImageBase64.match(/data:(image\/.+?);base64,/)?.[1] || 'image/jpeg';
        const base64Data = currentSelectedImageBase64.split(',')[1];
        userMessageContent.push({ type: "image_url", url: currentSelectedImageBase64, mime_type: mimeType, data: base64Data });
    }

    const userMessageObject = { role: "user", content: userMessageContent, timestamp: Date.now() };
    addMessageToHistory(currentChatId, userMessageObject);

    addMessage(userMessageContent, true);

    messageInput.value = "";
    clearImagePreview();
    adjustTextareaHeight();
    updateSendButtonState(); // Reavalia o botão após limpar
    
    if (allChats[currentChatId].title === "Nova Conversa...") {
        updateChatTitle(currentChatId, userMessageText || "Conversa com Imagem");
    }

    // Em vez da lógica da API, agora apenas chamamos a nova função.
    fetchBotResponse();
}

async function fetchBotResponse() {
    const apiConfig = await getApiConfig();
    if (apiConfig.error) {
        displayErrorWithRetry(`Erro de configuração da API: ${apiConfig.error}`);
        return;
    }

    typingAnimation.style.display = "flex";
    messageInput.disabled = true;
    updateSendButtonState();

    let botResponseContent = "";
    let responseDiv = null;
    let currentAssistantMessage = { role: "assistant", content: "", timestamp: null };

    try {
        const selectedModel = modelSelect.value;
        if (!selectedModel) throw new Error("Nenhum modelo de IA selecionado.");

        const historyForApi = await getHistoryForApi(currentChatId);
        
        const messagesForApi = apiConfig.provider === 'ollama'
            ? [{ role: 'system', content: currentUserSystemPrompt }, ...historyForApi]
            : historyForApi;
        
        let response;
        if (apiConfig.provider === "ollama") {
            const ollamaPayload = messagesForApi.map(msg => ({
                role: msg.role,
                content: typeof msg.content === 'string' ? msg.content : msg.content.find(p => p.type === 'text')?.text || ''
            }));
            response = await fetch(`${apiConfig.url}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: ollamaPayload,
                    stream: true,
                    options: { temperature: currentTemperature }
                })
            });
        } else if (apiConfig.provider === "gemini") {
            const geminiContents = messagesForApi.map(msg => {
                const role = msg.role === 'assistant' ? 'model' : 'user';
                let parts = [];
                if (typeof msg.content === 'string') {
                    parts.push({ text: msg.content });
                } else if (Array.isArray(msg.content)) {
                    msg.content.forEach(part => {
                        if (part.type === 'text') { parts.push({ text: part.text }); }
                        else if (part.type === 'image_url') {
                            parts.push({ inline_data: { mime_type: part.mime_type, data: part.data } });
                        }
                    });
                }
                return { role, parts };
            });

            const agora = new Date();
            const dataAtual = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
            
            const dynamicSystemPrompt = `${currentUserSystemPrompt}\n\nPara seu contexto, a conversa está ocorrendo em ${dataAtual}, às ${horaAtual}.`;

            response = await fetch(`${apiConfig.url}/${selectedModel}:streamGenerateContent?key=${apiConfig.apiKey}&alt=sse`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: geminiContents,
                    system_instruction: { parts: [{ text: dynamicSystemPrompt }] },
                    generation_config: { temperature: currentTemperature }
                })
            });
        }

        if (!response.ok) {
            let errorMsg = `Erro ${response.status}: ${response.statusText}`;
            try { const errorData = await response.json(); errorMsg = `Erro ${apiConfig.provider}: ${errorData.error?.message || JSON.stringify(errorData)}`; } catch (e) {}
            throw new Error(errorMsg);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); 
            for (const line of lines) {
                if (line.trim() === '') continue;
                let chunkContent = null;
                if (apiConfig.provider === 'ollama') {
                    try {
                        const data = JSON.parse(line);
                        chunkContent = data.message?.content;
                        if (data.done) currentAssistantMessage.timestamp = data.created_at ? Date.parse(data.created_at) : Date.now();
                    } catch (e) {}
                } else {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            chunkContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                        } catch (e) {}
                    }
                }
                if (chunkContent) {
                    if (!responseDiv) {
                        typingAnimation.style.display = 'none';
                        responseDiv = addMessage("", false, true); 
                    }
                    botResponseContent += chunkContent;
                    const contentElement = responseDiv.querySelector(".content-text");
                    if (contentElement) contentElement.innerHTML = marked.parse(botResponseContent);
                    if (autoScrollEnabled) scrollToBottom("smooth");
                }
            }
        }

        // Processa qualquer dado restante no buffer após o fim do stream.
        if (buffer.trim()) {
            let chunkContent = null;
            if (apiConfig.provider === 'ollama') {
                try {
                    const data = JSON.parse(buffer);
                    chunkContent = data.message?.content;
                } catch (e) { /* Ignora erro de parse no buffer final */ }
            } else { // Gemini
                if (buffer.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(buffer.substring(6));
                        chunkContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    } catch (e) { /* Ignora erro de parse no buffer final */ }
                }
            }
            // Atualiza a mensagem uma última vez se houver conteúdo final.
            if (chunkContent) {
                if (!responseDiv) {
                    typingAnimation.style.display = 'none';
                    responseDiv = addMessage("", false, true); 
                }
                botResponseContent += chunkContent;
                const contentElement = responseDiv.querySelector(".content-text");
                if (contentElement) contentElement.innerHTML = marked.parse(botResponseContent);
            }
        }

        if (botResponseContent) {
            currentAssistantMessage.content = botResponseContent;
            if (!currentAssistantMessage.timestamp) currentAssistantMessage.timestamp = Date.now();
            responseDiv.dataset.originalContent = botResponseContent;

            addMessageToHistory(currentChatId, currentAssistantMessage);
            saveChatsToLocalStorage();
            updateChatList();
            
            if (responseDiv && botResponseContent.trim().length > 0) {
                const actionsDiv = responseDiv.querySelector('.message-actions');
                if (actionsDiv && !actionsDiv.querySelector('.tts-btn')) {
                    const ttsBtn = document.createElement('button');
                    ttsBtn.className = 'message-action-btn tts-btn';
                    ttsBtn.title = 'Ouvir mensagem';
                    ttsBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                    actionsDiv.appendChild(ttsBtn);
                }
            }
            
            if (responseDiv) responseDiv.querySelectorAll("pre code").forEach(hljs.highlightElement);
            
            triggerContextMaintenance(currentChatId, selectedModel, currentUserSystemPrompt);
        }

    } catch (error) {
        console.error(`Erro na comunicação com ${apiConfig.provider}:`, error);
        displayErrorWithRetry(`Não consegui conectar: (${error.message || "Erro desconhecido"})`);
    } finally {
        typingAnimation.style.display = "none";
        messageInput.disabled = false;
        updateSendButtonState(); 
        adjustTextareaHeight();
    }
}

function adjustTextareaHeight() {
    if (!messageInput) return;

    messageInput.style.height = "auto";

    const computedStyle = window.getComputedStyle(messageInput);
    const maxHeight = parseInt(computedStyle.maxHeight, 10) || 150;

    const scrollHeight = messageInput.scrollHeight;

    const newHeight = Math.min(scrollHeight, maxHeight);
    messageInput.style.height = `${newHeight}px`;

    messageInput.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";

    const bottomBar = document.querySelector(".bottom-bar");
    if (bottomBar && scrollToBottomBtn) {
        const bottomBarHeight = bottomBar.offsetHeight;
        scrollToBottomBtn.style.bottom = `${bottomBarHeight + 20}px`;
    }
}

function handleResizeLayout() { adjustTextareaHeight(); }

function setupImageUpload() {
    if (!attachImageBtn || !imageFileInput || !imagePreviewContainer || !imagePreview || !removeImageBtn) return;
    attachImageBtn.addEventListener("click", () => { imageFileInput.click(); });
    imageFileInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith("image/")) { processImageFile(file); } 
        else { clearImagePreview(); }
        imageFileInput.value = null;
    });
    removeImageBtn.addEventListener("click", () => {
        clearImagePreview();
        updateSendButtonState();
        adjustTextareaHeight(); 
    });
}

function processImageFile(file) {
    if (!file || !file.type.startsWith("image/")) { clearImagePreview(); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        currentSelectedImageBase64 = e.target.result;
        if (imagePreview) imagePreview.src = e.target.result;
        if (imagePreviewContainer) imagePreviewContainer.style.display = "block";
        updateSendButtonState();
        adjustTextareaHeight(); 
    }
    reader.readAsDataURL(file);
}

function clearImagePreview() {
    currentSelectedImageBase64 = null;
    if (imagePreview) imagePreview.src = "#";
    if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
    if (imageFileInput) imageFileInput.value = null; 
}

function updateSendButtonState() {
    if (!sendButton || !messageInput) return;
    const hasText = messageInput.value.trim() !== "";
    const hasImage = currentSelectedImageBase64 !== null;
    const canSend = hasText || (hasImage && currentApiProvider === "gemini"); 
    sendButton.disabled = !canSend;
    sendButton.style.opacity = canSend ? "1" : "0.5";
}

function handlePaste(event) {
    if (currentApiProvider !== "gemini") return;
    const items = (event.clipboardData || event.originalEvent.clipboardData)?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
                event.preventDefault();
                processImageFile(file);
                break;
            }
        }
    }
}

function setupSearch() {
    if (!searchBtn || !searchOverlay || !closeSearchBtn || !clearSearchBtn || !searchInput || !searchResults) return;
    searchBtn.addEventListener("click", () => {
        searchOverlay.classList.add("active");
        searchInput.value = "";
        searchResults.innerHTML = "<div class=\"search-info\">Comece a digitar para buscar...</div>";
        searchInput.focus();
    });
    closeSearchBtn.addEventListener("click", () => searchOverlay.classList.remove("active"));
    clearSearchBtn.addEventListener("click", () => { searchInput.value = ""; searchInput.focus(); performSearch(""); });
    searchInput.addEventListener("input", (e) => performSearch(e.target.value));
    searchOverlay.addEventListener("click", (e) => { if (e.target === searchOverlay) searchOverlay.classList.remove("active"); });
}

function performSearch(query) {
     if (!searchResults) return;
     searchResults.innerHTML = "";
     const searchTerm = query.toLowerCase().trim();
     if (!searchTerm) { searchResults.innerHTML = "<div class=\"search-info\">Digite algo para buscar.</div>"; return; }
     const results = [];
     const terms = searchTerm.split(" ").filter(t => t.length > 1);
     Object.values(allChats).forEach(chat => {
         let score = 0;
         let foundTerms = new Set();
         const matchesPreview = [];
         terms.forEach(term => { if (chat.title.toLowerCase().includes(term)) { score += 5; foundTerms.add(term); } });
         if (chat.title.toLowerCase().includes(searchTerm)) score += 10;
         
         // Buscar no recentMessages e summarizedContext
         const messagesToSearch = [...chat.recentMessages];
         if (chat.summarizedContext) {
             messagesToSearch.unshift({ role: "assistant", content: chat.summarizedContext });
         }

         messagesToSearch.forEach(msg => {
            let textContent = "";
            if (typeof msg.content === "string") { textContent = msg.content; } 
            else if (Array.isArray(msg.content)) { const textPart = msg.content.find(p => p.type === "text"); if (textPart) textContent = textPart.text; }
            const contentLower = textContent.toLowerCase();
            let messageScore = 0;
            terms.forEach(term => {
                  if (contentLower.includes(term)) {
                      messageScore += 1; foundTerms.add(term);
                      if (matchesPreview.length < 3) {
                           const context = getMatchContext(textContent, term, 50);
                           if (!matchesPreview.some(p => p.toLowerCase().includes(term))) { matchesPreview.push(context); }
                       }
                   }
             });
             if (contentLower.includes(searchTerm)) messageScore += 2;
             score += messageScore;
         });
        let firstMessagePreview = "(Vazio)";
        // Ajustar para pegar a primeira mensagem do recentMessages
        if (chat.recentMessages[0]) {
            if (typeof chat.recentMessages[0].content === "string") { firstMessagePreview = chat.recentMessages[0].content.substring(0, 80) + "..."; } 
            else if (Array.isArray(chat.recentMessages[0].content)) { const textPart = chat.recentMessages[0].content.find(p => p.type === "text"); firstMessagePreview = textPart ? textPart.text.substring(0, 80) + "..." : "[Imagem]"; }
        }
         if (foundTerms.size === terms.length || score > 0) { results.push({ chatId: chat.id, title: chat.title, score: score, preview: matchesPreview.join(" ... ") || firstMessagePreview }); }
     });
     results.sort((a, b) => b.score - a.score);
     if (results.length === 0) { searchResults.innerHTML = `<div class="search-info">Nenhum resultado para "${query}".</div>`; } 
     else {
         results.forEach(result => {
             const resultItem = document.createElement("div");
             resultItem.className = "search-result-item";
             const highlightedTitle = highlightTerms(result.title, terms);
             const highlightedPreview = highlightTerms(result.preview, terms);
             resultItem.innerHTML = `<i class="fas fa-comment-dots"></i><div class="search-result-content"><div class="search-result-title">${highlightedTitle}</div><div class="search-result-preview">${highlightedPreview}</div></div>`;
             resultItem.addEventListener("click", () => { searchOverlay.classList.remove("active"); switchToChat(result.chatId); });
             searchResults.appendChild(resultItem);
         });
     }
}

function getMatchContext(text, term, maxLength = 80) {
    const index = text.toLowerCase().indexOf(term.toLowerCase());
    if (index === -1) return text.substring(0, maxLength);
    const start = Math.max(0, index - Math.floor(maxLength / 3));
    const end = Math.min(text.length, index + term.length + Math.floor(maxLength * 2 / 3));
    let context = text.substring(start, end);
    if (start > 0) context = "..." + context;
    if (end < text.length) context = context + "...";
    return context;
}

function highlightTerms(text, terms) {
    if (!text || !terms || terms.length === 0) return text;
    let highlightedText = text;
    const regex = new RegExp(`(${terms.map(t => t.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})`, "gi"); 
    highlightedText = highlightedText.replace(regex, "<mark class=\"search-highlight\">$1</mark>");
    return highlightedText;
}

function showAppSettingsModal() {
    if (!appSettingsModalOverlay || !systemPromptInput || !temperatureInput || !temperatureValueDisplay || !geminiApiKeyInput || !geminiApiKeyDisplay) return;
    
    const promptToDisplay = (localStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY) === null && currentUserSystemPrompt === getDynamicSystemPrompt()) 
        ? getDynamicSystemPrompt() 
        : currentUserSystemPrompt;
    
    systemPromptInput.value = promptToDisplay;
    temperatureInput.value = currentTemperature.toFixed(1);
    temperatureValueDisplay.textContent = `(${currentTemperature.toFixed(1)})`;

    // Carregar a chave de API
    geminiApiKeyInput.value = localStorage.getItem(GEMINI_API_KEY_STORAGE) || "";
    
    // Resetar o estado de visibilidade da chave
    geminiApiKeyInput.style.display = "block";
    geminiApiKeyDisplay.style.display = "none";
    if(apiKeyToggleBtn) apiKeyToggleBtn.innerHTML = "<i class=\"fas fa-eye\"></i>";

    settingsFeedback.textContent = "";
    appSettingsModalOverlay.classList.add("active");
}


function hideAppSettingsModal() { if (appSettingsModalOverlay) appSettingsModalOverlay.classList.remove("active"); }

function handleSaveAppSettings() {
    if (!systemPromptInput || !temperatureInput || !settingsFeedback || !geminiApiKeyInput) return;
    
    const newPrompt = systemPromptInput.value;
    const newTemp = parseFloat(temperatureInput.value);

    // Lidar com a alteração da Chave de API
    const newApiKey = geminiApiKeyInput.value.trim();
    const oldApiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE) || "";

    let apiKeyChanged = false;
    if (newApiKey !== oldApiKey) {
        // Usamos um confirm() do navegador, mas com texto informativo
        const confirmationMessage = `Você tem certeza de que deseja alterar sua chave de API do Google AI?\n\n(Caso não tenha uma chave, você pode criar uma em aistudio.google.com/apikey)`;
        const confirmed = confirm(confirmationMessage);
        
        if (confirmed) {
            if (newApiKey) {
                localStorage.setItem(GEMINI_API_KEY_STORAGE, newApiKey);
            } else {
                localStorage.removeItem(GEMINI_API_KEY_STORAGE);
            }
            apiKeyChanged = true;
        } else {
            // Se o usuário cancelar, reverter o valor do input para a chave antiga
            geminiApiKeyInput.value = oldApiKey;
        }
    }
    
    if (isNaN(newTemp) || newTemp < 0 || newTemp > 2.0) {
        settingsFeedback.textContent = "Temperatura inválida. Use um valor entre 0.0 e 2.0.";
        settingsFeedback.style.color = "#ff6b6b";
        return;
    }

    currentUserSystemPrompt = newPrompt;
    currentTemperature = newTemp;
    saveAppSettingsToLocalStorage();
    
    settingsFeedback.textContent = "Configurações salvas!";
    settingsFeedback.style.color = "#4CAF50";
    
    setTimeout(() => {
        hideAppSettingsModal();
        if (apiKeyChanged) {
            loadModels(); // Recarrega os modelos se a chave da API foi alterada
        }
    }, 1000);
}


let deferredPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installPwaBtn = document.getElementById("install-pwa-btn");
    if (installPwaBtn) {
        installPwaBtn.style.display = "block";
    }
});

// SUBSTITUA SUA FUNÇÃO setupEventListeners ATUAL POR ESTA VERSÃO COMPLETA

function setupEventListeners() {
    const installPwaBtn = document.getElementById("install-pwa-btn");
    if (installPwaBtn) {
        installPwaBtn.addEventListener("click", async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                deferredPrompt = null;
                installPwaBtn.style.display = "none";
            }
        });
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener("click", () => {
            sidebar?.classList.toggle("active");
            overlay?.classList.toggle("active");
        });
    }

    if (overlay) {
        overlay.addEventListener("click", () => {
            sidebar?.classList.remove("active");
            overlay?.classList.remove("active");
        });
    }

    const newChatBtn = document.querySelector(".new-chat-btn");
    if (newChatBtn) {
        newChatBtn.addEventListener("click", createNewChat);
    }

    if (messageInput) {
        messageInput.addEventListener("paste", handlePaste);
    }

    if (messageInput && sendButton && chatForm) {
        chatForm.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!sendButton.disabled) {
                sendMessage();
            }
        });

        messageInput.addEventListener("keydown", (e) => {
            const isMobile = window.innerWidth <= 768;
            if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
                e.preventDefault();
                if (!sendButton.disabled) {
                    sendMessage();
                }
            }
        });

        messageInput.addEventListener("input", () => {
            adjustTextareaHeight();
            updateSendButtonState();
        });
    }
    
    // --- ✅ INÍCIO DO CÓDIGO RESTAURADO ---

    document.addEventListener('click', function(e) {
        // Lógica para copiar código de blocos
        const copyCodeBtn = e.target.closest('.code-copy-btn');
        if (copyCodeBtn) {
            e.stopPropagation();
            const blockId = copyCodeBtn.getAttribute('data-block-id');
            const codeElement = document.getElementById(blockId);
            if (codeElement) copyTextToClipboard(codeElement.textContent, copyCodeBtn);
            return;
        }

        // Lógica para copiar texto da mensagem
        const copyMsgBtn = e.target.closest('.message-action-btn.copy-message');
        if (copyMsgBtn) {
            e.stopPropagation();
            const messageDiv = copyMsgBtn.closest('.message');
            if (messageDiv?.dataset.originalContent) {
                copyTextToClipboard(messageDiv.dataset.originalContent, copyMsgBtn);
            }
            return;
        }
        
        // Lógica para o Text-to-Speech (TTS)
        const ttsBtn = e.target.closest('.tts-btn');
        if (ttsBtn) {
            e.stopPropagation();
            const messageDiv = ttsBtn.closest('.message');
            if (messageDiv?.dataset.originalContent) {
                const textToSpeak = messageDiv.dataset.originalContent.replace(/```[\s\S]*?```/g, 'Bloco de código.');
                speakText(textToSpeak, ttsBtn);
            }
        }
    });

    // Listeners para o Modal de Exclusão
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            if (chatIdToDelete) deleteChat(chatIdToDelete);
            hideDeleteConfirmation();
        });
    }
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', hideDeleteConfirmation);
    }
    if (deleteConfirmOverlay) {
        deleteConfirmOverlay.addEventListener('click', (e) => {
            if (e.target === deleteConfirmOverlay) hideDeleteConfirmation();
        });
    }

    // Listeners para o Modal de Configurações (O PONTO PRINCIPAL DA CORREÇÃO)
    if (appSettingsBtn) {
        appSettingsBtn.addEventListener('click', showAppSettingsModal);
    }
    if (saveAppSettingsBtn) {
        saveAppSettingsBtn.addEventListener('click', handleSaveAppSettings);
    }
    if (cancelAppSettingsBtn) {
        cancelAppSettingsBtn.addEventListener('click', hideAppSettingsModal);
    }
    if (appSettingsModalOverlay) {
        appSettingsModalOverlay.addEventListener('click', (e) => {
            if (e.target === appSettingsModalOverlay) hideAppSettingsModal();
        });
    }
    if (apiKeyToggleBtn && geminiApiKeyInput && geminiApiKeyDisplay) {
        apiKeyToggleBtn.addEventListener('click', () => {
            if (geminiApiKeyInput.style.display !== 'none') {
                const key = geminiApiKeyInput.value;
                const maskedKey = (key && key.length > 6) ? `${key.substring(0, 3)}(ﾉﾟДﾟ)ﾉ${key.substring(key.length - 3)}` : key;
                geminiApiKeyDisplay.textContent = maskedKey;
                geminiApiKeyInput.style.display = 'none';
                geminiApiKeyDisplay.style.display = 'block';
                apiKeyToggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                geminiApiKeyDisplay.style.display = 'none';
                geminiApiKeyInput.style.display = 'block';
                apiKeyToggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
            }
        });
    }
    if (temperatureInput && temperatureValueDisplay) {
        temperatureInput.addEventListener('input', () => {
            temperatureValueDisplay.textContent = `(${parseFloat(temperatureInput.value).toFixed(1)})`;
        });
    }
    
    // --- ✅ FIM DO CÓDIGO RESTAURADO ---

    if (scrollContainer) {
        let scrollDebounceTimeout;
        scrollContainer.addEventListener("scroll", () => {
            clearTimeout(scrollDebounceTimeout);
            scrollDebounceTimeout = setTimeout(checkScrollPosition, 50);
        });
    }

    window.addEventListener("resize", handleResizeLayout);
    window.addEventListener("beforeunload", () => {
        saveChatsToLocalStorage();
    });
    window.addEventListener('online', checkNetworkStatus);
    window.addEventListener('offline', checkNetworkStatus);
    // Verifica a conexão a cada 10 segundos
    setInterval(checkNetworkStatus, 10000); 

    if (apiSourceInput) {
        let debounceTimer;
        apiSourceInput.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                await getApiConfig();
                loadModels();
                saveChatsToLocalStorage();
                updateSendButtonState();
                checkNetworkStatus(); // ✅ CHAME AQUI TAMBÉM
            }, 500);
        });
    }

    if (modelSelect) {
        modelSelect.addEventListener("change", () => {
            if (modelSelect.value) {
                localStorage.setItem(`${currentApiProvider}_selected_model`, modelSelect.value);
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (searchOverlay?.classList.contains("active")) searchOverlay.classList.remove("active");
            else if (deleteConfirmOverlay?.classList.contains("active")) hideDeleteConfirmation();
            else if (appSettingsModalOverlay?.classList.contains("active")) hideAppSettingsModal();
        }

        const isTypingElement = ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(document.activeElement?.tagName);
        const isContentEditable = document.activeElement?.isContentEditable;
        const isModifierKeyPressed = e.metaKey || e.ctrlKey || e.altKey;
        const isTextInputFocused = messageInput && !searchOverlay?.classList.contains("active") && !deleteConfirmOverlay?.classList.contains("active") && !appSettingsModalOverlay?.classList.contains("active");

        if (!isTypingElement && !isContentEditable && !isModifierKeyPressed) {
            if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete" || e.key === "Enter") {
                if (isTextInputFocused) {
                    messageInput.focus();
                }
            }
        }
    });
}

async function loadModels() {
    if (!modelSelect) return;
    const apiConfig = await getApiConfig();
    modelSelect.innerHTML = "<option value=\"\" disabled selected>Carregando...</option>";
    if (apiConfig.error) {
        modelSelect.innerHTML = `<option value=\"\" disabled selected>Erro: ${apiConfig.error}</option>`;
        return;
    }

    if (apiConfig.provider === "ollama") {
        try {
            const response = await fetch(`${apiConfig.url}/api/tags`);
            if (!response.ok) {
                 let errorText = response.statusText;
                 try { const d = await response.json(); errorText = d.error || errorText; } catch(e){}
                 throw new Error(`Erro ${response.status}: ${errorText}`);
            }
            const data = await response.json();
            modelSelect.innerHTML = ""; // Limpa o select
            
            if (data.models?.length > 0) {
                const savedModel = localStorage.getItem("ollama_selected_model");
                let foundSaved = false;
                
                // Ordena os modelos pelo nome
                data.models.sort((a, b) => a.name.localeCompare(b.name)).forEach(model => {
                    const option = document.createElement("option");
                    option.value = model.name;

                    // --- LÓGICA DE EXIBIÇÃO ---
                    const modelName = model.name;
                    const quant = model.details?.quantization_level || "N/A";
                    const size = formatBytes(model.size);
                    
                    // Formata o texto para exibição no dropdown
                    option.textContent = `${modelName} (${quant}) - ${size}`;

                    modelSelect.appendChild(option);
                    if (savedModel === model.name) {
                        option.selected = true;
                        foundSaved = true;
                    }
                });

                if (!foundSaved && modelSelect.options.length > 0) {
                    modelSelect.options[0].selected = true;
                }
            } else {
                modelSelect.innerHTML = "<option value=\"\" disabled selected>Nenhum modelo Ollama</option>";
            }
        } catch (error) {
            modelSelect.innerHTML = `<option value=\"\" disabled selected>Falha Ollama (${error.message.substring(0,30)}...)</option>`;
        }
    } else { // Lógica para GEMINI
        if (!apiConfig.apiKey) {
             modelSelect.innerHTML = `<option value=\"\" disabled selected>Chave API Gemini pendente</option>`;
             return;
        }
        try {
            const response = await fetch(`${apiConfig.url}/models?key=${apiConfig.apiKey}`);
            if (!response.ok) {
                let errorText = response.statusText;
                try { const d = await response.json(); errorText = d.error?.message || d.error || errorText; } catch(e){}
                throw new Error(`Erro ${response.status}: ${errorText}`);
            }
            const jsonData = await response.json();
            modelSelect.innerHTML = "";
            if (jsonData.models && jsonData.models.length > 0) {
                const savedModel = localStorage.getItem("gemini_selected_model");
                let foundSaved = false;
                const sortedModels = jsonData.models
                    .filter(model => model.supportedGenerationMethods.includes("generateContent"))
                    .sort((a, b) => {
                        // Prioriza gemini-2.5-flash
                        if (a.name === "models/gemini-2.5-flash") return -1;
                        if (b.name === "models/gemini-2.5-flash") return 1;
                        // Em seguida, outros modelos de visão (se houver)
                        const aIsVision = a.name.includes("vision");
                        const bIsVision = b.name.includes("vision");
                        if (aIsVision && !bIsVision) return -1;
                        if (!aIsVision && bIsVision) return 1;
                        // Por fim, ordena alfabeticamente
                        return a.displayName.localeCompare(b.displayName);
                    });
                sortedModels.forEach(model => {
                    const option = document.createElement("option");
                    option.value = model.name;
                    option.textContent = model.displayName;
                    modelSelect.appendChild(option);
                    if (savedModel === model.name) { option.selected = true; foundSaved = true; }
                });
                if (!foundSaved && modelSelect.options.length > 0) {
                    // Se nenhum modelo salvo foi encontrado, tenta selecionar gemini-2.5-flash
                    const flashModelOption = Array.from(modelSelect.options).find(opt => opt.value === "models/gemini-2.5-flash");
                    if (flashModelOption) {
                        flashModelOption.selected = true;
                    } else if (modelSelect.options.length > 0) {
                        // Se gemini-2.5-flash não estiver disponível, seleciona o primeiro modelo da lista
                        modelSelect.options[0].selected = true;
                    }
                }
                if (modelSelect.options.length === 0) { modelSelect.innerHTML = "<option value=\"\" disabled selected>Nenhum modelo Gemini compatível</option>"; }
            } else { modelSelect.innerHTML = "<option value=\"\" disabled selected>Nenhum modelo Gemini encontrado</option>"; }
        } catch (error) { modelSelect.innerHTML = `<option value=\"\" disabled selected>Falha Gemini Models (${error.message.substring(0,30)}...)</option>`; }
    }
    // Salva o modelo selecionado no localStorage
    if (modelSelect.value) {
        localStorage.setItem(`${currentApiProvider}_selected_model`, modelSelect.value);
    } else if (modelSelect.options.length > 0 && !modelSelect.options[0].disabled) {
        // Se nenhum modelo foi selecionado (ex: primeira carga), seleciona o primeiro disponível
        localStorage.setItem(`${currentApiProvider}_selected_model`, modelSelect.options[0].value);
    }
}


// Adicione este bloco no final para registrar o Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then(registration => {
      console.log("ServiceWorker registrado com sucesso: ", registration.scope);
    }).catch(error => {
      console.log("Falha ao registrar o ServiceWorker: ", error);
    });
  });
}

function loadChatsFromLocalStorage() {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
        const parsedData = JSON.parse(storedData);
        allChats = parsedData.allChats || {};
        currentChatId = parsedData.currentChatId;

        // Garante que a estrutura de chat esteja correta para o history.js
        for (const id in allChats) {
            if (!allChats[id].recentMessages) {
                allChats[id].recentMessages = allChats[id].messages || [];
                delete allChats[id].messages; // Remove a propriedade antiga
            }
            if (!allChats[id].summarizedContext) {
                allChats[id].summarizedContext = "";
            }
        }

        // Inicializa o módulo de histórico com os dados carregados
        initializeHistory(allChats, getApiConfig, saveChatsToLocalStorage);

        if (!currentChatId || !allChats[currentChatId]) {
            const chatIds = Object.keys(allChats);
            if (chatIds.length > 0) {
                currentChatId = chatIds.sort((a, b) => allChats[b].timestamp - allChats[a].timestamp)[0];
            } else {
                createNewChat();
            }
        }
    } else {
        createNewChat();
    }
    updateChatList();
    if (currentChatId) {
        createNewChat();
    }
}

function saveChatsToLocalStorage() {
    try {
        const validChats = {};
        for (const id in allChats) {
            if (allChats[id] && typeof allChats[id] === "object" && Array.isArray(allChats[id].recentMessages)) {
                validChats[id] = {
                    id: allChats[id].id,
                    title: allChats[id].title,
                    recentMessages: allChats[id].recentMessages,
                    summarizedContext: allChats[id].summarizedContext || "",
                    timestamp: allChats[id].timestamp
                };
            }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ currentChatId, allChats: validChats }));
        localStorage.setItem("last_active_chat_id", currentChatId);
        localStorage.setItem("api_source_preference", apiSourceInput.value);
        if (modelSelect.value) {
            localStorage.setItem(`${currentApiProvider}_selected_model`, modelSelect.value);
        }
    } catch (e) {
        console.error("Erro ao salvar chats no localStorage:", e);
    }
}

function createNewChat() {
    localStorage.setItem("last_active_chat_id", currentChatId);
    const emptyChat = Object.values(allChats).find(chat => chat.recentMessages.length === 0 && !chat.summarizedContext);
    if (emptyChat) {
        currentChatId = emptyChat.id;
    } else {
        currentChatId = generateChatId();
        allChats[currentChatId] = {
            id: currentChatId,
            title: "Nova Conversa...",
            recentMessages: [], // Usar recentMessages
            summarizedContext: "", // Novo campo para o resumo
            timestamp: Date.now()
        };
    }
    saveChatsToLocalStorage();
    updateChatList();
    switchToChat(currentChatId);
    if (messagesContainer) {
        messagesContainer.innerHTML = `<div class="welcome-screen"><div class="avatar bot-avatar"><i class="fas fa-robot"></i></div><h2>Bem-vindo ao Chat 2B</h2><p>Sua assistente de IA para conversas, programação e muito mais. Como posso ajudar você hoje?</p></div>`;
    }
     messageInput?.focus(); 
     clearImagePreview(); 
}

function switchToChat(chatId) {
    localStorage.setItem("last_active_chat_id", chatId);
    if (!allChats[chatId]) { createNewChat(); return; }
    currentChatId = chatId;
    // conversationHistory = [...allChats[chatId].messages]; // Removido
    displayChatHistory(chatId);
    document.querySelectorAll(".chat-history .chat-item").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.chatId === chatId);
    });
    if (window.innerWidth <= 768 && sidebar?.classList.contains("active")) {
        sidebar.classList.remove("active");
        overlay?.classList.remove("active");
    }
    messageInput?.focus(); 
    clearImagePreview(); 
}

function displayChatHistory(chatId) {
    const chat = allChats[chatId];
    if (!chat || !messagesContainer) return;
    messagesContainer.innerHTML = "";

    // Exibir o contexto sumarizado se existir
    if (chat.summarizedContext) {
        const summaryDiv = document.createElement("div");
        summaryDiv.className = "message bot-message summarized-context";
        summaryDiv.innerHTML = `
            <div class="avatar bot-avatar"><i class="fas fa-robot"></i></div>
            <div class="message-content">
                <div class="content-text"><em>(Resumo da conversa anterior)</em><br>${marked.parse(chat.summarizedContext)}</div>
            </div>
        `;
        messagesContainer.appendChild(summaryDiv);
    }

    if (chat.recentMessages.length > 0) {
        chat.recentMessages.forEach(msg => addMessage(msg.content, msg.role === "user", false));
        setTimeout(() => scrollToBottom("auto"), 100);
    } else if (!chat.summarizedContext) { // Se não há mensagens recentes nem resumo, mostra a tela de boas-vindas
        messagesContainer.innerHTML = `<div class="welcome-screen"><div class="avatar bot-avatar"><i class="fas fa-robot"></i></div><h2>Bem-vindo ao Chat 2B</h2><p>Sua assistente de IA para conversas, programação e muito mais. Como posso ajudar você hoje?</p></div>`;
    }
}

// Adicionar função para limpar o histórico do chat atual
function clearCurrentChatMessages() {
    if (currentChatId && allChats[currentChatId]) {
        clearChatHistory(currentChatId); // Usa a função do history.js
        displayChatHistory(currentChatId); // Atualiza a UI
        updateChatList(); // Atualiza a lista de chats
        alert("Histórico da conversa atual limpo!");
    }
}

// Adicionar evento para o botão de limpar chat (assumindo que existe um botão com id 'clear-current-chat-btn')
// Se não existir, você precisará adicionar um botão no HTML e associar este evento.
const clearCurrentChatBtn = document.getElementById("clear-current-chat-btn");
if (clearCurrentChatBtn) {
    clearCurrentChatBtn.addEventListener("click", clearCurrentChatMessages);
}

function updateChatTitle(chatId, newTitle, isManualEdit = false) {
    if (!allChats[chatId]) return;
    const currentTitle = allChats[chatId].title;
    const defaultTitle = "Nova Conversa...";
    let titleCandidate = newTitle;
    if (Array.isArray(newTitle)) {
        const textPart = newTitle.find(part => part.type === "text");
        titleCandidate = textPart ? textPart.text : (currentSelectedImageBase64 ? "Conversa com Imagem" : "Conversa");
    }
    if (isManualEdit || currentTitle === defaultTitle) {
        let finalTitle = titleCandidate.trim();
        if (!isManualEdit) {
            finalTitle = finalTitle.split("\n")[0].substring(0, 40) || "Conversa";
            finalTitle += (titleCandidate.length > 40 || titleCandidate.includes("\n") ? "..." : "");
        }
        if (finalTitle && finalTitle !== currentTitle) {
            allChats[chatId].title = finalTitle;
            saveChatsToLocalStorage();
            updateChatList();
        }
    }
}

function startEditTitle(chatId, chatButton, chatTitleSpan) {
    chatTitleSpan.style.display = "none";
    const actionsContainer = chatButton.querySelector(".chat-item-actions");
    if (actionsContainer) actionsContainer.style.display = "none";
    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.className = "chat-title-edit-input";
    editInput.value = allChats[chatId].title;
    editInput.maxLength = 50;
    chatButton.insertBefore(editInput, chatTitleSpan.nextSibling);
    editInput.focus();
    editInput.select();
    const finalizeEdit = (saveChanges) => {
        const newTitle = editInput.value.trim();
        if (editInput.parentNode === chatButton) { chatButton.removeChild(editInput); }
        chatTitleSpan.style.display = "";
        if (actionsContainer) actionsContainer.style.display = ""; 
        if (saveChanges && newTitle) { updateChatTitle(chatId, newTitle, true); }
        else { chatTitleSpan.textContent = allChats[chatId].title; }
    };
    editInput.addEventListener("blur", () => finalizeEdit(true));
    editInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); finalizeEdit(true); }
        else if (e.key === "Escape") { e.preventDefault(); finalizeEdit(false); }
    });
}

function createScrollToBottomButton() {
    if (!scrollContainer) return;
    scrollToBottomBtn = document.getElementById("scroll-to-bottom-btn");
    if (!scrollToBottomBtn) {
        scrollToBottomBtn = document.createElement("button");
        scrollToBottomBtn.id = "scroll-to-bottom-btn";
        scrollToBottomBtn.className = "scroll-to-bottom-btn";
        scrollToBottomBtn.innerHTML = "<i class=\"fas fa-arrow-down\"></i>";
        scrollToBottomBtn.title = "Rolar para o final";
        document.body.appendChild(scrollToBottomBtn);
        scrollToBottomBtn.addEventListener("click", () => scrollToBottom());
    } else {
        scrollToBottomBtn = document.getElementById("scroll-to-bottom-btn");
    }
    const bottomBarHeight = document.querySelector(".bottom-bar")?.offsetHeight || 80;
    if(scrollToBottomBtn) scrollToBottomBtn.style.bottom = `${bottomBarHeight + 20}px`;
}

function checkScrollPosition() {
    if (!scrollContainer || !scrollToBottomBtn) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    scrollToBottomBtn.classList.toggle("visible", !isNearBottom && userHasScrolledUp);
    if (isNearBottom) {
        autoScrollEnabled = false; 
        userHasScrolledUp = false; 
    } else { 
        if (!userHasScrolledUp && scrollTop > 60) { userHasScrolledUp = true; }
        autoScrollEnabled = false; 
    }
}

function scrollToBottom(behavior = "smooth") {
    if (scrollContainer) {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: behavior });
        autoScrollEnabled = true;
        userHasScrolledUp = false;
        if (scrollToBottomBtn) { scrollToBottomBtn.classList.remove("visible"); }
    }
}

function scrollToUserMessage(userMessageElement, behavior = "smooth") {
    if (scrollContainer && userMessageElement) {
        setTimeout(() => {
            const containerRect = scrollContainer.getBoundingClientRect();
            const messageRect = userMessageElement.getBoundingClientRect();
            const messageTopRelativeToContainer = messageRect.top - containerRect.top;
            const offset = 30; 
            const targetScrollTop = scrollContainer.scrollTop + messageTopRelativeToContainer - offset;
            scrollContainer.scrollTo({ top: targetScrollTop, behavior: behavior });
            userHasScrolledUp = true; 
            autoScrollEnabled = false;
            if (scrollToBottomBtn) {
                setTimeout(() => {
                    const isNearBottomCheck = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 150;
                    scrollToBottomBtn.classList.toggle("visible", !isNearBottomCheck);
                }, 350); 
            }
        }, 50); 
    }
}

function vibrateProcessing() {
    if (!navigator.vibrate) return;
    stopVibration();
    navigator.vibrate(30);
    vibrationInterval = setInterval(() => navigator.vibrate(30), 1500);
}

function vibrateToken() {
    if (!navigator.vibrate) return;
    tokenCounter++;
    if (tokenCounter % 2 === 0) { navigator.vibrate(3); }
}

function stopVibration() {
    if (vibrationInterval) {
        clearInterval(vibrationInterval);
        vibrationInterval = null;
    }
    if (navigator.vibrate) navigator.vibrate(0);
    tokenCounter = 0;
}

function updateChatList() {
    const chatHistoryContainer = document.querySelector(".chat-history");
    if (!chatHistoryContainer) return;
    chatHistoryContainer.innerHTML = "";
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const groups = { hoje: [], ontem: [], ultimos7dias: [], esteMes: [], anterior: [] };
    Object.values(allChats).filter(chat => chat && chat.id && chat.timestamp).forEach(chat => {
        const chatDate = new Date(chat.timestamp);
        const chatDay = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate());
        if (chatDay.getTime() === today.getTime()) groups.hoje.push(chat);
        else if (chatDay.getTime() === yesterday.getTime()) groups.ontem.push(chat);
        else if (chatDay > sevenDaysAgo && chatDay < yesterday) groups.ultimos7dias.push(chat);
        else if (chatDay >= firstDayOfMonth) groups.esteMes.push(chat);
        else groups.anterior.push(chat);
    });
    function createSectionHeader(title) {
        const header = document.createElement("div");
        header.className = "chat-section-header";
        header.textContent = title;
        return header;
    }
    function addChatGroup(chats, title) {
        if (chats.length === 0) return;
        chatHistoryContainer.appendChild(createSectionHeader(title));
        chats.sort((a, b) => b.timestamp - a.timestamp).forEach(chat => {
            const chatButton = document.createElement("button");
            chatButton.className = "chat-item" + (chat.id === currentChatId ? " active" : "");
            chatButton.dataset.chatId = chat.id;
            chatButton.onclick = () => switchToChat(chat.id);
            const chatTitleSpan = document.createElement("span");
            chatTitleSpan.textContent = chat.title || "Conversa";
            chatTitleSpan.className = "chat-title";
            const actionsContainer = document.createElement("div");
            actionsContainer.className = "chat-item-actions";
            const menuBtn = document.createElement("button");
            menuBtn.className = "chat-menu-btn chat-action-btn";
            menuBtn.innerHTML = "<i class=\"fas fa-ellipsis-v\"></i>";
            menuBtn.title = "Opções";
            const dropdownMenu = document.createElement("div");
            dropdownMenu.className = "chat-dropdown-menu";
            dropdownMenu.style.display = "none";
            const editBtn = document.createElement("button");
            editBtn.className = "dropdown-item";
            editBtn.innerHTML = "<i class=\"fas fa-pencil-alt\"></i> Renomear";
            editBtn.onclick = (e) => { e.stopPropagation(); dropdownMenu.style.display = "none"; startEditTitle(chat.id, chatButton, chatTitleSpan); };
            const exportBtn = document.createElement("button");
            exportBtn.className = "dropdown-item";
            exportBtn.innerHTML = "<i class=\"fas fa-file-export\"></i> Exportar";
            exportBtn.onclick = (e) => { e.stopPropagation(); dropdownMenu.style.display = "none"; exportChatHistory(chat.id); };
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "dropdown-item";
            deleteBtn.innerHTML = "<i class=\"fas fa-trash-alt\"></i> Excluir";
            deleteBtn.onclick = (e) => { e.stopPropagation(); dropdownMenu.style.display = "none"; showDeleteConfirmation(chat.id); };
            dropdownMenu.appendChild(editBtn);
            dropdownMenu.appendChild(exportBtn);
            dropdownMenu.appendChild(deleteBtn);
            menuBtn.onclick = (e) => {
                e.stopPropagation();
                const isVisible = dropdownMenu.style.display === "block";
                document.querySelectorAll(".chat-dropdown-menu").forEach(menu => menu.style.display = "none");
                dropdownMenu.style.display = isVisible ? "none" : "block";
            };
            actionsContainer.appendChild(menuBtn);
            actionsContainer.appendChild(dropdownMenu);
            chatButton.appendChild(chatTitleSpan);
            chatButton.appendChild(actionsContainer);
            chatHistoryContainer.appendChild(chatButton);
        });
    }
    addChatGroup(groups.hoje, "Hoje");
    addChatGroup(groups.ontem, "Ontem");
    addChatGroup(groups.ultimos7dias, "Últimos 7 dias");
    addChatGroup(groups.esteMes, "Este Mês");
    addChatGroup(groups.anterior, "Anteriores");
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".chat-menu-btn")) {
             document.querySelectorAll(".chat-dropdown-menu").forEach(menu => menu.style.display = "none");
        }
    }, true); 
}

function showDeleteConfirmation(chatId) {
    if (!allChats[chatId] || !deleteConfirmOverlay || !confirmDeleteChatTitle) {
        alert("Erro ao tentar excluir a conversa.");
        return;
    }
    chatIdToDelete = chatId;
    confirmDeleteChatTitle.textContent = allChats[chatId].title || "esta conversa";
    deleteConfirmOverlay.classList.add("active");
}

function hideDeleteConfirmation() {
    if (deleteConfirmOverlay) deleteConfirmOverlay.classList.remove("active");
    chatIdToDelete = null;
}

function deleteChat(chatId) {
    if (!chatId || !allChats[chatId]) return;
    delete allChats[chatId];
    saveChatsToLocalStorage();
    if (currentChatId === chatId) {
        const remainingChats = Object.values(allChats).sort((a, b) => b.timestamp - a.timestamp);
        if (remainingChats.length > 0) {
            switchToChat(remainingChats[0].id);
        } else {
            createNewChat();
        }
    }
    updateChatList();
}

function exportChatHistory(chatId) {
    if (!allChats || !allChats[chatId]) return;
    const chat = allChats[chatId];
    const modelName = modelSelect ? modelSelect.options[modelSelect.selectedIndex]?.textContent : "desconhecido";
    const chatTitle = chat.title || "Conversa";
    const fileName = `${chatTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`;
    let content = `Esta conversa foi gerada com a 2B usando o modelo ${modelName} (${currentApiProvider}). Os chats com IA podem apresentar informações incorretas ou ofensivas.\n\n=======================\n\n`;
    
    // Adiciona o contexto sumarizado ao exportar
    if (chat.summarizedContext) {
        content += `[CONTEXTO SUMARIZADO ANTERIOR]:\n${chat.summarizedContext}\n\n-----------------\n\n`;
    }

    chat.recentMessages.forEach(message => {
        const prefix = message.role === "user" ? "👤 Usuário" : `🤖 ${modelName}`;
        const timestamp = message.timestamp ? new Date(message.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
        let messageText = "";
        if (typeof message.content === "string") {
            messageText = message.content;
        } else if (Array.isArray(message.content)) {
            const textPart = message.content.find(p => p.type === "text");
            const imgPart = message.content.find(p => p.type === "image_url");
            if (textPart) messageText += textPart.text;
            if (imgPart) messageText += (textPart ? "\n" : "") + "[Imagem Anexada]";
        }
        content += `${prefix} (${timestamp}):\n${messageText}\n\n-----------------\n\n`;
    });
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function saveAppSettingsToLocalStorage() {
    localStorage.setItem(SYSTEM_PROMPT_STORAGE_KEY, currentUserSystemPrompt);
    localStorage.setItem(TEMPERATURE_STORAGE_KEY, currentTemperature.toString());
}

function loadAppSettingsFromLocalStorage() {
    const savedPrompt = localStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY);
    if (savedPrompt) {
        currentUserSystemPrompt = savedPrompt;
    } else {
        currentUserSystemPrompt = getDynamicSystemPrompt();
    }
    const savedTemp = localStorage.getItem(TEMPERATURE_STORAGE_KEY);
    if (savedTemp !== null) {
        const temp = parseFloat(savedTemp);
        if (!isNaN(temp) && temp >= 0 && temp <= 2.0) { currentTemperature = temp; }
        else { currentTemperature = DEFAULT_TEMPERATURE; }
    } else {
        currentTemperature = DEFAULT_TEMPERATURE;
    }
}

async function initializeApp() {
    loadAppSettingsFromLocalStorage();
    setupEventListeners();
    setupSearch();
    setupImageUpload(); 
    createScrollToBottomButton();
    loadChatsFromLocalStorage(); 
    await loadModels(); 
    handleResizeLayout();
    adjustTextareaHeight();
    updateSendButtonState(); 
    if (messageInput && !searchOverlay?.classList.contains("active") && !deleteConfirmOverlay?.classList.contains("active") && !appSettingsModalOverlay?.classList.contains("active")) {
        messageInput.focus();
    }
    checkScrollPosition(); 
    checkNetworkStatus();
}

document.addEventListener("DOMContentLoaded", initializeApp);


/**
 * Exibe uma mensagem de erro no chat com um botão para tentar novamente.
 * @param {string} errorMessage - A mensagem de erro a ser exibida.
 */
function displayErrorWithRetry(errorMessage) {
    // Garante que a animação de "digitando" pare.
    if (typingAnimation) typingAnimation.style.display = "none";

    // Usa a função addMessage para criar a estrutura base da mensagem de erro.
    const errorDiv = addMessage(errorMessage, false);
    if (!errorDiv) return;

    // Adiciona uma classe para estilização específica de erro (opcional).
    errorDiv.classList.add("error-message");

    const actionsContainer = errorDiv.querySelector('.message-actions');
    if (actionsContainer) {
        // Limpa ações padrão (como copiar) que não fazem sentido para um erro.
        actionsContainer.innerHTML = '';
        
        // Cria o botão de "Tentar Novamente".
        const retryBtn = document.createElement("button");
        retryBtn.className = "message-action-btn retry-btn";
        retryBtn.title = "Tentar novamente";
        retryBtn.innerHTML = '<i class="fas fa-redo"></i> Tentar novamente';

        // Adiciona o evento de clique ao botão.
        retryBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            // Remove esta mensagem de erro da interface.
            errorDiv.remove();
            // Chama a função para tentar a requisição à API novamente.
            fetchBotResponse();
        });

        // Adiciona o botão ao contêiner de ações da mensagem.
        actionsContainer.appendChild(retryBtn);
    }
}

/**
 * Exibe o toast de status da conexão com uma mensagem específica.
 * @param {string} message - A mensagem a ser exibida.
 * @param {boolean} isError - Se verdadeiro, usa o estilo de erro (vermelho).
 */
function showConnectionToast(message, isError = true) {
    if (!connectionStatusToast || !connectionStatusText) return;

    connectionStatusText.textContent = message;
    if (isError) {
        connectionStatusToast.classList.remove("online");
    } else {
        connectionStatusToast.classList.add("online");
    }
    connectionStatusToast.classList.remove("hidden");
}

/**
 * Oculta o toast de status da conexão.
 */
function hideConnectionToast() {
    if (!connectionStatusToast) return;
    connectionStatusToast.classList.add("hidden");
}


let connectionState = true; // 'true' para conectado, 'false' para desconectado

/**
 * Verifica o status da conexão de forma inteligente, dependendo do provedor de API selecionado.
 * Se for Ollama, testa a conexão com o servidor local.
 * Se for Gemini, testa a conexão com a internet.
 */
async function checkNetworkStatus() {
    const apiConfig = await getApiConfig();
    
    // LÓGICA PARA OLLAMA (REDE LOCAL)
    if (apiConfig.provider === 'ollama') {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            // Tenta fazer uma requisição simples ao servidor Ollama.
            await fetch(apiConfig.url, { method: 'GET', signal: controller.signal });
            clearTimeout(timeoutId);
            
            // Se a requisição funcionou, estamos conectados ao Ollama.
            if (!connectionState) { // Se estávamos desconectados antes
                showConnectionToast("Servidor Ollama conectado!", false);
                setTimeout(hideConnectionToast, 2500);
            } else {
                hideConnectionToast();
            }
            connectionState = true;

        } catch (error) {
            // Se a requisição falhou, não conseguimos alcançar o servidor Ollama.
            showConnectionToast(`Falha ao conectar ao servidor Ollama em ${apiConfig.url}`);
            connectionState = false;
        }
    } 
    // LÓGICA PARA GEMINI (INTERNET)
    else {
        if (navigator.onLine) {
            // Se o navegador diz que estamos online...
            if (!connectionState) { // E antes estávamos offline...
                showConnectionToast("Conexão reestabelecida!", false);
                setTimeout(hideConnectionToast, 2500); // Oculta a mensagem de sucesso
            } else {
                hideConnectionToast(); // Apenas oculta se já estava tudo ok
            }
            connectionState = true;
        } else {
            // Se o navegador diz que estamos offline...
            showConnectionToast("Conexão perdida: Verifique sua rede.");
            connectionState = false;
        }
    }
}
