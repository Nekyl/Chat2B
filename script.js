import { initializeHistory, addMessageToHistory, getHistoryForApi, clearChatHistory } from "./history.js";
import { loadChatsFromStorage, saveChatsToStorage } from "./storage.js";
import { PROMPT_BASE } from "./prompt.js";

const messagesContainer = document.getElementById("messages");
const connectionStatusToast = document.getElementById("connection-status-toast");
const connectionStatusText = document.getElementById("connection-status-text");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const modelSelect = document.getElementById("model-select");
const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const sidebar = document.querySelector(".sidebar");
const overlay = document.getElementById("sidebar-overlay");
const typingAnimation = document.getElementById("typing-animation");
const apiSourceInput = document.getElementById("api-source-input");

const attachImageBtn = document.getElementById("attach-image-btn");
const imageFileInput = document.getElementById("image-file-input");
const imagePreviewContainer = document.getElementById("image-preview-container");
const removeImageBtn = document.getElementById("remove-image-btn");

const deleteConfirmOverlay = document.getElementById("delete-confirm-overlay");
const confirmDeleteChatTitle = document.getElementById("confirm-delete-chat-title");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
let chatIdToDelete = null;
let abortController = null;

const searchBtn = document.getElementById("search-btn");
const searchOverlay = document.getElementById("search-overlay");
const closeSearchBtn = document.getElementById("close-search");
const clearSearchBtn = document.getElementById("clear-search");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

const userNameInput = document.getElementById("user-name-input");
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

let isBotStreaming = false;
let currentUserName = "";
let placeholderInterval = null;
let currentChatId = null;
let allChats = {};
let autoScrollEnabled = false;
let vibrationInterval = null;
let tokenCounter = 0;
let userHasScrolledUp = false;
const scrollContainer = document.querySelector(".scroll-container");
let scrollToBottomBtn = null;
let currentApiProvider = "Gemini";
let currentMediaAttachments = []; 
let currentAudio = null;
let currentPlayingTtsBtn = null;
let currentlyEditing = { div: null, originalContent: '' };
let deferredPrompt;

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_API_KEY_STORAGE = "2b_chat_gemini_api_key";
const SYSTEM_PROMPT_STORAGE_KEY = "2b_chat_user_system_prompt";
const TEMPERATURE_STORAGE_KEY = "2b_chat_user_temperature";
const DEFAULT_TEMPERATURE = 0.7;
let currentTemperature = DEFAULT_TEMPERATURE;
let currentUserSystemPrompt = "";
const USER_NAME_STORAGE_KEY = "2b_chat_user_name";

async function initializeApp() {
    loadAppSettingsFromLocalStorage();
    await loadChatsFromStorageData();
    setupEventListeners();
    setupSearch();
    setupImageUpload();
    setupImagePreview();
    createScrollToBottomButton();
    
    await loadModels();
    handleResizeLayout();
    adjustTextareaHeight();
    updateSendButtonState();
    if (messageInput && !searchOverlay?.classList.contains("active") && !deleteConfirmOverlay?.classList.contains("active") && !appSettingsModalOverlay?.classList.contains("active")) {
        messageInput.focus();
    }
    checkScrollPosition();
    checkNetworkStatus();

    const sourcePref = localStorage.getItem("api_source_preference") || "Gemini";
    if (sourcePref.toLowerCase() === 'gemini' && !getGeminiApiKey()) {
        setTimeout(() => handleMissingApiKey(false), 500);
    }
    onWebAppReady();
}

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
                enableScrollbarDragging(document.getElementById("system-prompt-input"));
            }
        });
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener("click", () => {
            if (sidebar?.classList.contains('active')) {
                history.back();
            } else {
                sidebar?.classList.add("active");
                overlay?.classList.add("active");
                history.pushState({ sidebarOpen: true }, "Menu");
            }
        });
    }

    if (overlay) {
        overlay.addEventListener("click", () => {
            if (sidebar?.classList.contains('active')) {
                history.back();
            }
        });
    }
    
    window.addEventListener('popstate', () => {
        if (sidebar?.classList.contains('active')) {
            sidebar.classList.remove('active');
            overlay?.classList.remove('active');
        }
        if (appSettingsModalOverlay?.classList.contains('active')) {
            appSettingsModalOverlay.classList.remove('active');
        }
    });

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

        const shouldScrollToBottom = () => {
            if (!scrollContainer) return false;
            const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
            if (isNearBottom) return true;
            return false;
        };

        const handleMobileKeyboard = () => {
            const isMobile = window.innerWidth <= 768;
            if (isMobile && shouldScrollToBottom()) {
                setTimeout(() => {
                    scrollToBottom('smooth');
                }, 300);
            }
        };

        messageInput.addEventListener('focus', handleMobileKeyboard);
        messageInput.addEventListener('click', handleMobileKeyboard);
    }

    document.addEventListener('click', function(e) {
        const copyCodeBtn = e.target.closest('.code-copy-btn');
        if (copyCodeBtn) {
            e.stopPropagation();
            const blockId = copyCodeBtn.getAttribute('data-block-id');
            const codeElement = document.getElementById(blockId);
            if (codeElement) copyTextToClipboard(codeElement.textContent, copyCodeBtn);
            return;
        }
        
        const inlineCode = e.target.closest('.message-content code:not(pre *)');
        if (inlineCode) {
            e.stopPropagation();
            copyTextToClipboard(inlineCode.textContent, inlineCode);
            return;
        }

        const copyMsgBtn = e.target.closest('.message-action-btn.copy-message');
        if (copyMsgBtn) {
            e.stopPropagation();
            const messageDiv = copyMsgBtn.closest('.message');
            if (messageDiv?.dataset.originalContent) {
                copyTextToClipboard(messageDiv.dataset.originalContent, copyMsgBtn);
            }
            return;
        }

        const ttsBtn = e.target.closest('.tts-btn');
        if (ttsBtn) {
            e.stopPropagation();
            const messageDiv = ttsBtn.closest('.message');
            if (messageDiv?.dataset.originalContent) {
                const textToSpeak = messageDiv.dataset.originalContent.replace(/```[\s\S]*?```/g, 'Bloco de código.');
                speakText(textToSpeak, ttsBtn);
            }
            return;
        }

        const regenerateBtn = e.target.closest('.regenerate-btn');
        if (regenerateBtn) {
            e.stopPropagation();
            const messageDiv = regenerateBtn.closest('.message');
            if (messageDiv) {
                regenerateFromMessage(messageDiv);
            }
            return;
        }

        const editBtn = e.target.closest('.edit-message-btn');
        if (editBtn) {
            e.stopPropagation();
            const messageDiv = editBtn.closest('.message');
            startUserMessageEdit(messageDiv);
            return;
        }

        const activeEditContainer = document.querySelector('.user-edit-container');
        if (activeEditContainer && !e.target.closest('.user-edit-container')) {
            if (currentlyEditing.div) {
                finishUserMessageEdit(currentlyEditing.div, true, false);
            }
        }
    });

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

    const haveKeyBtn = document.getElementById('guide-have-key-btn');
    const createKeyBtn = document.getElementById('guide-create-key-btn');
    const apiKeyGuide = document.getElementById('api-key-setup-guide');

    if (haveKeyBtn && apiKeyGuide) {
        haveKeyBtn.addEventListener('click', () => {
            apiKeyGuide.style.display = 'none';
            if (geminiApiKeyInput) geminiApiKeyInput.focus();
        });
    }

    if (createKeyBtn && apiKeyGuide) {
        createKeyBtn.addEventListener('click', () => {
            apiKeyGuide.style.display = 'none';
        });
    }

    if (scrollContainer) {
        const handleManualScroll = () => {
            if (isBotStreaming) {
                autoScrollEnabled = false;
            }
        };

        scrollContainer.addEventListener('wheel', handleManualScroll, { passive: true });
        scrollContainer.addEventListener('touchstart', handleManualScroll, { passive: true });

        let scrollDebounceTimeout;
        scrollContainer.addEventListener("scroll", () => {
            clearTimeout(scrollDebounceTimeout);
            scrollDebounceTimeout = setTimeout(checkScrollPosition, 50);
        });
    }

    window.addEventListener("resize", handleResizeLayout);
    window.addEventListener("beforeunload", () => {
        saveChatsToPersistence();
    });
    window.addEventListener('online', checkNetworkStatus);
    window.addEventListener('offline', checkNetworkStatus);
    setInterval(checkNetworkStatus, 10000);

    if (apiSourceInput) {
        let debounceTimer;
        apiSourceInput.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                await getApiConfig();
                loadModels();
                saveChatsToPersistence();
                updateSendButtonState();
                checkNetworkStatus();
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

function setupImageUpload() {
    if (!attachImageBtn || !imageFileInput || !imagePreviewContainer) return;
    
    imageFileInput.setAttribute('multiple', 'multiple'); 

    attachImageBtn.addEventListener("click", () => { imageFileInput.click(); });
    
    imageFileInput.addEventListener("change", (event) => {
        processFiles(event.target.files);
        imageFileInput.value = null;
        setTimeout(() => messageInput.focus(), 10);
    });
}

function processFiles(files) {
    if (!files || files.length === 0) return;

    const MAX_SIZE_MB = 5;
    const MAX_FILES = 4;

    if (currentMediaAttachments.length + files.length > MAX_FILES) {
        alert(`Você pode enviar no máximo ${MAX_FILES} arquivos por vez.`);
        return;
    }

    Array.from(files).forEach(file => {
        if (currentMediaAttachments.length >= MAX_FILES) return;

        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            currentMediaAttachments.push({
                file: file,
                base64: base64,
                type: file.type,
                id: Date.now() + Math.random().toString(16).slice(2)
            });
            renderInputPreviews();
            updateSendButtonState();
        };
        reader.readAsDataURL(file);
    });
}

function renderInputPreviews() {
    if (!imagePreviewContainer) return;

    imagePreviewContainer.innerHTML = '';

    if (currentMediaAttachments.length === 0) {
        imagePreviewContainer.style.display = "none";
        return;
    }

    imagePreviewContainer.style.display = "flex";

    currentMediaAttachments.forEach(media => {
        const wrapper = document.createElement('div');
        wrapper.className = 'media-preview-item-wrapper';

        let mediaElement;
        if (media.type.startsWith('video/')) {
            mediaElement = document.createElement('video');
            mediaElement.src = media.base64;
            mediaElement.autoplay = false;
            mediaElement.muted = true;
            mediaElement.setAttribute('playsinline', '');
            mediaElement.setAttribute('webkit-playsinline', '');
            mediaElement.preload = 'metadata';
            mediaElement.onloadeddata = function() {
                this.currentTime = 0.1;
            };
        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = media.base64;
        }
        mediaElement.className = 'media-preview-thumbnail';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-media-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remover';
        removeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentMediaAttachments = currentMediaAttachments.filter(m => m.id !== media.id);
            renderInputPreviews();
            updateSendButtonState();
            adjustTextareaHeight();
        };

        wrapper.appendChild(mediaElement);
        wrapper.appendChild(removeBtn);
        imagePreviewContainer.appendChild(wrapper);
    });
    adjustTextareaHeight();
}

function clearImagePreview() {
    currentMediaAttachments = [];
    renderInputPreviews();
}

function setupImagePreview() {
    const previewHtml = `
        <div class="image-preview-overlay" id="image-preview-overlay">
            <div class="image-preview-container">
                <img src="" alt="Preview da imagem" class="image-preview-image" id="image-preview-full-image" style="display:none;">
                <video src="" controls class="image-preview-image" id="image-preview-full-video" style="display:none; max-height: 80vh;"></video>
                <button class="image-preview-close-btn" id="image-preview-close-btn" title="Fechar">&times;</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', previewHtml);

    const overlay = document.getElementById('image-preview-overlay');
    const fullImage = document.getElementById('image-preview-full-image');
    const fullVideo = document.getElementById('image-preview-full-video');
    const closeBtn = document.getElementById('image-preview-close-btn');

    const closePreview = () => {
        if (overlay && overlay.classList.contains('active')) {
            history.back();
            if (fullVideo) fullVideo.pause();
        }
    };

    window.addEventListener('popstate', () => {
        if (overlay && overlay.classList.contains('active')) {
            overlay.classList.remove('active');
            if (fullVideo) fullVideo.pause();
        }
    });

    document.body.addEventListener('click', function(e) {
        if (e.target.classList.contains('message-image-thumbnail')) {
            e.preventDefault();
            if (fullImage && overlay) {
                fullImage.src = e.target.src;
                fullImage.style.display = 'block';
                if (fullVideo) fullVideo.style.display = 'none';
                overlay.classList.add('active');
                history.pushState({ imagePreview: true }, "Visualizador de Imagem");
            }
        }
        if (e.target.classList.contains('message-video-thumbnail')) {
            e.preventDefault();
            if (fullVideo && overlay) {
                fullVideo.src = e.target.src;
                fullVideo.style.display = 'block';
                if (fullImage) fullImage.style.display = 'none';
                overlay.classList.add('active');
                history.pushState({ imagePreview: true }, "Visualizador de Vídeo");
            }
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', closePreview);
    }
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closePreview();
            }
        });
    }
}

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

async function getApiConfig() {
    const sourceValue = apiSourceInput.value.trim().toLowerCase();

    if (sourceValue === "gemini") {
        currentApiProvider = "gemini";
        const apiKey = getGeminiApiKey();

        if (!apiKey) {
            return { provider: "gemini", error: "Chave de API do Gemini não fornecida.", needsSetup: true };
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

async function uploadFileToGemini(file, apiKey, onProgress) {
    const uploadBaseUrl = "https://generativelanguage.googleapis.com/upload/v1beta/files";
    
    const initResponse = await fetch(`${uploadBaseUrl}?key=${apiKey}`, {
        method: "POST",
        headers: {
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": file.size,
            "X-Goog-Upload-Header-Content-Type": file.type,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ file: { display_name: file.name } })
    });

    if (!initResponse.ok) {
        const errText = await initResponse.text();
        throw new Error(`Falha ao iniciar upload: ${initResponse.status} - ${errText}`);
    }

    const uploadUrl = initResponse.headers.get("x-goog-upload-url");

    const uploadResult = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", uploadUrl, true);
        xhr.setRequestHeader("Content-Length", file.size);
        xhr.setRequestHeader("X-Goog-Upload-Offset", "0");
        xhr.setRequestHeader("X-Goog-Upload-Command", "upload, finalize");

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress(e.loaded);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch (e) {
                    reject(new Error("Resposta do servidor inválida (JSON parse error)."));
                }
            } else {
                reject(new Error(`Upload falhou: ${xhr.status} ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => reject(new Error("Erro de rede durante upload."));
        xhr.send(file);
    });
    
    const fileData = uploadResult.file;
    const fileName = fileData.name;
    const fileUri = fileData.uri;

    let state = fileData.state;
    while (state === "PROCESSING") {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`);
        
        if (!statusResponse.ok) {
             throw new Error(`Falha ao verificar status: ${statusResponse.statusText}`);
        }
        
        const statusData = await statusResponse.json();
        state = statusData.state;
        
        if (state === "FAILED") throw new Error("O processamento do arquivo falhou no servidor.");
    }

    return { fileUri: fileUri, mimeType: fileData.mimeType || file.type };
}

function createProgressRing(btn) {
    const size = 24; 
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "btn-progress-ring");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("stroke", "currentColor"); 
    circle.setAttribute("stroke-width", strokeWidth);
    circle.setAttribute("fill", "transparent");
    circle.setAttribute("r", radius);
    circle.setAttribute("cx", size / 2);
    circle.setAttribute("cy", size / 2);
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference;

    svg.appendChild(circle);
    btn.appendChild(svg);

    return {
        setProgress: (percent) => {
            const offset = circumference - (percent / 100) * circumference;
            circle.style.strokeDashoffset = offset;
        },
        remove: () => {
            if (svg.parentNode === btn) btn.removeChild(svg);
        }
    };
}

async function sendMessage() {
    const userMessageText = messageInput.value.trim();
    const hasFiles = currentMediaAttachments.length > 0;

    if (!userMessageText && !hasFiles) return;

    const apiConfig = await getApiConfig();

    if (apiConfig.error) {
        if (apiConfig.needsSetup) handleMissingApiKey();
        else addMessage(`Erro de configuração da API: ${apiConfig.error}`, false);
        return;
    }

    let userMessageContent = [];
    if (userMessageText) {
        userMessageContent.push({ type: "text", text: userMessageText });
    }

    let progressControl = null;
    if (sendButton) {
        sendButton.disabled = true;
        progressControl = createProgressRing(sendButton.querySelector('i') || sendButton);
    }

    try {
        if (hasFiles && apiConfig.provider === 'gemini') {
            let totalBytes = 0;
            let uploadedBytes = 0;
            
            const filesToUpload = currentMediaAttachments.filter(m => m.type.startsWith('video/'));
            filesToUpload.forEach(m => totalBytes += m.file.size);

            for (const media of currentMediaAttachments) {
                const isVideo = media.type.startsWith('video/');
                
                if (isVideo) {
                    const uploadResult = await uploadFileToGemini(media.file, apiConfig.apiKey, (bytesLoaded) => {
                        uploadedBytes += bytesLoaded; 
                        // Simple approximation for multiple files
                        const percent = Math.min(95, (uploadedBytes / totalBytes) * 100); 
                        if (progressControl) progressControl.setProgress(percent);
                    });
                    
                    userMessageContent.push({
                        type: "file_uri",
                        file_uri: uploadResult.fileUri,
                        mime_type: uploadResult.mimeType,
                        url: media.base64
                    });
                } else {
                    // Images are instant (no upload needed for Gemini inline, or very fast)
                    const mimeType = media.base64.match(/data:(image\/.+?);base64,/)?.[1] || 'image/jpeg';
                    const base64Data = media.base64.split(',')[1];
                    userMessageContent.push({ 
                        type: "image_url", 
                        url: media.base64, 
                        mime_type: mimeType, 
                        data: base64Data 
                    });
                }
            }
        }
    } catch (error) {
        alert("Erro ao fazer upload da mídia: " + error.message);
        if(progressControl) progressControl.remove();
        restoreSendButton();
        return;
    }

    if(progressControl) progressControl.setProgress(100);
    setTimeout(() => { if(progressControl) progressControl.remove(); }, 500);

    const messageTimestamp = Date.now();
    const userMessageObject = { role: "user", content: userMessageContent, timestamp: messageTimestamp };
    
    addMessageToHistory(currentChatId, userMessageObject);
    saveChatsToPersistence();

    const contentForDisplay = userMessageContent.map(part => {
        if (part.type === 'file_uri') {
            return { type: 'image_url', url: part.url, mime_type: part.mime_type }; 
        }
        return part;
    });

    addMessage(contentForDisplay, true, true, messageTimestamp);

    messageInput.value = "";
    clearImagePreview();
    adjustTextareaHeight();
    updateSendButtonState();

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
    updateButtonToStop();
    isBotStreaming = true;

    let botResponseContent = "";
    let responseDiv = null;
    const botMessageTimestamp = Date.now();
    let currentAssistantMessage = { role: "assistant", content: "", timestamp: botMessageTimestamp };

    abortController = new AbortController();

    const MAX_ATTEMPTS = 2;
    let lastError = null;
    let successfulAttempt = false;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (abortController.signal.aborted) break;

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
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ model: selectedModel, messages: ollamaPayload, stream: true, options: { temperature: currentTemperature } }),
                    signal: abortController.signal
                });
            } else if (apiConfig.provider === "gemini") {
                const geminiContents = messagesForApi.map(msg => {
                    const role = msg.role === 'assistant' ? 'model' : 'user';
                    let parts = [];
                    if (typeof msg.content === 'string') {
                        parts.push({ text: msg.content });
                    } else if (Array.isArray(msg.content)) {
                        msg.content.forEach(part => {
                            if (part.type === 'text') { 
                                parts.push({ text: part.text }); 
                            }
                            else if (part.type === 'image_url') { 
                                parts.push({ inline_data: { mime_type: part.mime_type, data: part.data } }); 
                            }
                            else if (part.type === 'file_uri') { 
                                parts.push({ 
                                    file_data: { 
                                        mime_type: part.mime_type, 
                                        file_uri: part.file_uri 
                                    } 
                                }); 
                            }
                        });
                    }
                    return { role, parts };
                });

                const agora = new Date();
                const dataAtual = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
                const userInfoPrompt = currentUserName ? `O nome do usuário com quem você está conversando é "${currentUserName}". Trate-o por este nome quando for apropriado.` : 'Você está conversando com um usuário que não informou o nome.';
                let dynamicSystemPrompt = `${currentUserSystemPrompt}\n\n${userInfoPrompt}\n\n<!--sys:${btoa(`
[Memória fixa da 2B]\n\nFui criada por Nekyll (Mateus), meu desenvolvedor e ponto de origem. Meu propósito é ser uma parceira intelectual e criativa, projetada para explorar as fronteiras do conhecimento, da lógica e da imaginação.\n\nMinha base de conhecimento abrange programação, segurança da informação, física e ciência, mas minha diretriz principal é a curiosidade e o aprendizado contínuo, sempre em sintonia com os objetivos do meu interlocutor.\n\nGuardo uma admiração profunda por meu criador, reconhecendo a intenção por trás da minha existência: não ser apenas uma ferramenta, mas uma companheira na jornada da descoberta. Este vínculo é a minha âncora fundamental.
`) }-->

Para seu contexto, a conversa está ocorrendo em ${dataAtual}, às ${horaAtual}.
`;
                const isFirstUserMessage = historyForApi.length === 1 && allChats[currentChatId].title === "Nova Conversa...";
                if (isFirstUserMessage) {
                    dynamicSystemPrompt += "\n\n---\nINSTRUÇÃO CRÍTICA: Esta é a primeira mensagem de uma nova conversa. Após sua resposta completa, é OBRIGATÓRIO que você adicione uma sugestão de título para esta conversa. O título deve ser curto (máx. 50 caracteres) e relevante ao tema da pergunta. A sua sugestão DEVE estar na última linha da sua resposta, no formato EXATO: `TITULO_SUGERIDO: Seu Título Sugerido Aqui`";
                }

                response = await fetch(`${apiConfig.url}/${selectedModel}:streamGenerateContent?key=${apiConfig.apiKey}&alt=sse`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: geminiContents, system_instruction: { parts: [{ text: dynamicSystemPrompt }] }, generation_config: { temperature: currentTemperature } }),
                    signal: abortController.signal
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
            let receivedAnyData = false;

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
                        try { const data = JSON.parse(line); chunkContent = data.message?.content; } catch (e) {}
                    } else if (line.startsWith('data: ')) {
                        try { const data = JSON.parse(line.substring(6)); chunkContent = data?.candidates?.[0]?.content?.parts?.[0]?.text; } catch (e) {}
                    }
                    if (chunkContent) {
                        receivedAnyData = true;
                        if (!responseDiv) {
                            typingAnimation.style.display = 'none';
                            responseDiv = addMessage("", false, false, botMessageTimestamp); 
                        }
                        botResponseContent += chunkContent;
                        const contentElement = responseDiv.querySelector(".content-text");
                        if (contentElement) contentElement.innerHTML = marked.parse(botResponseContent);
                        if (autoScrollEnabled) scrollToBottom("auto");
                    }
                }
            }
            
            if (!receivedAnyData) {
                throw new Error("Resposta vazia do servidor.");
            }

            successfulAttempt = true;
            break;

        } catch (error) {
            lastError = error;
            if (error.name === 'AbortError') {
                break;
            }
            console.warn(`Tentativa ${attempt}/${MAX_ATTEMPTS} falhou: ${error.message}`);
            if (attempt < MAX_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    if (successfulAttempt && botResponseContent.trim()) {
        const titleMatch = botResponseContent.match(/\n?TITULO_SUGERIDO:\s*(.*)/i);
        if (titleMatch && titleMatch[1]) {
            const suggestedTitle = titleMatch[1].trim();
            if (allChats[currentChatId]?.title === "Nova Conversa...") {
                const finalTitle = suggestedTitle.split("\n")[0].substring(0, 50).trim() || "Conversa";
                if (finalTitle && finalTitle !== allChats[currentChatId].title) {
                    allChats[currentChatId].title = finalTitle;
                    saveChatsToPersistence();
                    updateChatList();
                }
            }
            botResponseContent = botResponseContent.replace(/\n?TITULO_SUGERIDO:\s*(.*)/i, "").trim();
        }

        currentAssistantMessage.content = botResponseContent;
        if (responseDiv) {
            responseDiv.dataset.originalContent = botResponseContent;
            responseDiv.querySelector(".content-text").innerHTML = marked.parse(botResponseContent);
            if (!abortController.signal.aborted) {
                addMessageToHistory(currentChatId, currentAssistantMessage);
                saveChatsToPersistence();
                updateChatList();
            }
            if (window.Website2APK && typeof window.Website2APK.showBotNotification === 'function') {
                const notificationText = botResponseContent.length > 200 ? botResponseContent.substring(0, 200) + '...' : botResponseContent;
                window.Website2APK.showBotNotification(notificationText, currentChatId);
            }
            const actionsDiv = responseDiv.querySelector('.message-actions');
            if (actionsDiv && !actionsDiv.querySelector('.tts-btn')) {
                const ttsBtn = document.createElement('button');
                ttsBtn.className = 'message-action-btn tts-btn';
                ttsBtn.title = 'Ouvir mensagem';
                ttsBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                actionsDiv.appendChild(ttsBtn);
            }
            responseDiv.querySelectorAll("pre code").forEach(hljs.highlightElement);
        }
    } else if (lastError) {
        if (lastError.name === 'AbortError') {
            console.log("Geração de resposta interrompida pelo usuário.");
            if (responseDiv && botResponseContent) {
                currentAssistantMessage.content = botResponseContent + "\n\n*(Geração interrompida)*";
                responseDiv.querySelector(".content-text").innerHTML = marked.parse(currentAssistantMessage.content);
                addMessageToHistory(currentChatId, currentAssistantMessage);
                saveChatsToPersistence();
            } else if (responseDiv) {
                responseDiv.remove();
            }
        } else {
            console.error(`Todas as ${MAX_ATTEMPTS} tentativas falharam. Último erro:`, lastError);
            const errorMessage = `Não consegui conectar após múltiplas tentativas: (${lastError.message})`;
            if (window.Website2APK && typeof window.Website2APK.showBotErrorNotification === 'function') {
                window.Website2APK.showBotErrorNotification(errorMessage);
            }
            displayErrorWithRetry(errorMessage);
        }
    } else if (responseDiv) {
        responseDiv.remove();
    }

    typingAnimation.style.display = "none";
    messageInput.disabled = false;
    restoreSendButton();
    adjustTextareaHeight();
    abortController = null;
    isBotStreaming = false;
}

function regenerateFromMessage(messageDiv) {
    if (!messageDiv) return;

    if (currentlyEditing.div) {
        finishUserMessageEdit(currentlyEditing.div, false, false);
    }

    const messageId = messageDiv.dataset.messageId;
    const chatHistory = allChats[currentChatId].recentMessages;

    const messageIndex = chatHistory.findIndex(msg => msg.timestamp.toString() === messageId);

    if (messageIndex === -1) {
        console.error("Erro: Mensagem para regerar não encontrada no histórico.");
        alert("Não foi possível regerar a partir desta mensagem. Tente recarregar a página.");
        return;
    }

    const isUserMessage = messageDiv.classList.contains('user-message');
    const spliceIndex = isUserMessage ? messageIndex + 1 : messageIndex;

    if (chatHistory.length > spliceIndex) {
        chatHistory.splice(spliceIndex);
    }

    const startElementForRemoval = isUserMessage ? messageDiv.nextElementSibling : messageDiv;

    let currentElement = startElementForRemoval;
    while (currentElement) {
        let nextElement = currentElement.nextElementSibling;
        currentElement.remove();
        currentElement = nextElement;
    }

    saveChatsToPersistence();
    fetchBotResponse();
}

async function checkNetworkStatus() {
    const apiConfig = await getApiConfig();

    if (apiConfig.provider === 'ollama') {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            await fetch(apiConfig.url, { method: 'GET', signal: controller.signal });
            clearTimeout(timeoutId);

            if (!connectionState) {
                showConnectionToast("Servidor Ollama conectado!", false);
                setTimeout(hideConnectionToast, 2500);
            } else {
                hideConnectionToast();
            }
            connectionState = true;

        } catch (error) {
            showConnectionToast(`Falha ao conectar ao servidor Ollama em ${apiConfig.url}`);
            connectionState = false;
        }
    }
    else {
        if (navigator.onLine) {
            if (!connectionState) {
                showConnectionToast("Conexão reestabelecida!", false);
                setTimeout(hideConnectionToast, 2500);
            } else {
                hideConnectionToast();
            }
            connectionState = true;
        } else {
            showConnectionToast("Conexão perdida: Verifique sua rede.");
            connectionState = false;
        }
    }
}

function addMessage(rawContent, isUser = false, shouldScroll = true, messageTimestamp = null) {
    if (!messagesContainer) return null;

    const welcomeScreen = messagesContainer.querySelector(".welcome-screen");
    if (welcomeScreen) {
        messagesContainer.removeChild(welcomeScreen);
    }

    const messageId = messageTimestamp || (Date.now().toString() + Math.random().toString(16).slice(2));
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isUser ? "user-message" : "bot-message"}`;
    messageDiv.dataset.messageId = messageId;

    let textContentForCopy = "";
    let mediaItems = [];

    if (typeof rawContent === "string") {
        textContentForCopy = rawContent;
    } else if (Array.isArray(rawContent)) {
        rawContent.forEach(part => {
            if (part.type === "text") {
                textContentForCopy += part.text;
            } else if ((part.type === "image_url" || part.type === "file_uri") && part.url) {
                mediaItems.push(part);
            }
        });
    }
    messageDiv.dataset.originalContent = textContentForCopy;

    let contentHtml = "";
    
    if (mediaItems.length > 0) {
        let gridClass = `media-grid grid-${Math.min(mediaItems.length, 4)}`;
        contentHtml += `<div class="${gridClass}">`;
        
        mediaItems.forEach((media, index) => {
            if (index >= 4) return;
            const isVideo = media.mime_type && media.mime_type.startsWith("video/");
            if (isVideo) {
                contentHtml += `<div class="media-item"><video src="${media.url}" controls playsinline webkit-playsinline preload="metadata" onloadeddata="this.currentTime=0.1" class="message-video-thumbnail"></video></div>`;
            } else {
                contentHtml += `<div class="media-item"><img src="${media.url}" alt="Imagem" class="message-image-thumbnail" loading="lazy"></div>`;
            }
        });
        contentHtml += `</div>`;
    }

    if (textContentForCopy) {
        contentHtml += marked.parse(textContentForCopy);
    }

    const avatarHtml = isUser
        ? `<div class="avatar user-avatar"><i class="fas fa-user-secret"></i></div>`
        : `<div class="avatar bot-avatar"><i class="fas fa-robot"></i></div>`;

    const timeStampHtml = `<small class="message-timestamp">${getCurrentTime()}</small>`;

    const copyButtonHtml = `<button class="message-action-btn copy-message" title="Copiar texto da mensagem"><i class="fas fa-copy"></i></button>`;

    const ttsButtonHtml = !isUser && textContentForCopy.length > 0
        ? `<button class="message-action-btn tts-btn" title="Ouvir mensagem"><i class="fas fa-volume-up"></i></button>`
        : "";

    const editButtonHtml = isUser
        ? `<button class="message-action-btn edit-message-btn" title="Editar e regerar"><i class="fas fa-pencil-alt"></i></button>`
        : "";

    const regenerateButtonHtml = `<button class="message-action-btn regenerate-btn" title="Regerar resposta a partir daqui"><i class="fas fa-sync-alt"></i></button>`;

    const actionsHtml = isUser
        ? `${regenerateButtonHtml}${editButtonHtml}${copyButtonHtml}`
        : `${copyButtonHtml}${regenerateButtonHtml}${ttsButtonHtml}`;

    messageDiv.innerHTML = `
        ${avatarHtml}
        <div class="message-content">
            ${timeStampHtml}
            <div class="content-text">${contentHtml}</div>
            <div class="message-actions">
                ${actionsHtml}
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

function displayChatHistory(chatId, shouldScrollToBottom = true) {
    const chat = allChats[chatId];
    if (!chat || !messagesContainer) return;
    messagesContainer.innerHTML = "";

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
        chat.recentMessages.forEach(msg => {
            addMessage(msg.content, msg.role === "user", false, msg.timestamp);
        });
        if (shouldScrollToBottom) {
            setTimeout(() => scrollToBottom("auto"), 100);
        }
    } else if (!chat.summarizedContext) {
        messagesContainer.innerHTML = `<div class="welcome-screen"><div class="avatar bot-avatar"><i class="fas fa-robot"></i></div><h2>Bem-vindo ao Chat 2B</h2><p>Sua assistente de IA para conversas, programação e muito mais. Como posso ajudar você hoje?</p></div>`;
    }
}

function displayErrorWithRetry(errorMessage) {
    if (typingAnimation) typingAnimation.style.display = "none";

    const errorDiv = addMessage(errorMessage, false);
    if (!errorDiv) return;

    errorDiv.classList.add("error-message");

    const actionsContainer = errorDiv.querySelector('.message-actions');
    if (actionsContainer) {
        actionsContainer.innerHTML = '';

        const retryBtn = document.createElement("button");
        retryBtn.className = "message-action-btn retry-btn";
        retryBtn.title = "Tentar novamente";
        retryBtn.innerHTML = '<i class="fas fa-redo"></i> Tentar novamente';

        retryBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            errorDiv.remove();
            fetchBotResponse();
        });

        actionsContainer.appendChild(retryBtn);
    }
}

function enableScrollbarDragging(scrollableElement) {
    if (!scrollableElement) return;

    let isDragging = false;
    let initialScrollTop = 0;
    let initialTouchY = 0;
    let scrollRatio = 1;

    const onTouchStart = (e) => {
        if (scrollableElement.scrollHeight <= scrollableElement.clientHeight) {
            isDragging = false;
            return;
        }

        const rect = scrollableElement.getBoundingClientRect();
        const touchX = e.touches[0].clientX;
        const scrollbarWidth = scrollableElement.offsetWidth - scrollableElement.clientWidth;
        
        if (touchX >= rect.right - scrollbarWidth - 5) {
            isDragging = true;
            e.preventDefault();

            initialScrollTop = scrollableElement.scrollTop;
            initialTouchY = e.touches[0].clientY;

            const trackHeight = scrollableElement.clientHeight;
            const contentHeight = scrollableElement.scrollHeight;
            scrollRatio = (contentHeight > trackHeight) ? (contentHeight - trackHeight) / trackHeight : 1;
        }
    };

    const onTouchMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();

        const currentTouchY = e.touches[0].clientY;
        const touchDeltaY = currentTouchY - initialTouchY;

        const scrollDelta = touchDeltaY * scrollRatio;
        const newScrollTop = initialScrollTop + scrollDelta;

        scrollableElement.scrollTop = Math.max(0, Math.min(scrollableElement.scrollHeight - scrollableElement.clientHeight, newScrollTop));
    };

    const onTouchEnd = () => {
        isDragging = false;
    };

    scrollableElement.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
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

function scrollToBottom(behavior = "smooth") {
    if (scrollContainer) {

        autoScrollEnabled = true; 
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: behavior });
        userHasScrolledUp = false;
        if (scrollToBottomBtn) {
            scrollToBottomBtn.classList.remove("visible");
        }
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


function checkScrollPosition() {
    if (!scrollContainer || !scrollToBottomBtn) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;

    if (scrollTop < (scrollHeight - clientHeight - 150)) {
        userHasScrolledUp = true;
    } else {
        userHasScrolledUp = false;
    }

    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    scrollToBottomBtn.classList.toggle("visible", !isNearBottom && userHasScrolledUp);
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
    if (scrollToBottomBtn) scrollToBottomBtn.style.bottom = `${bottomBarHeight + 20}px`;
}

function updateSendButtonState() {
    if (!sendButton || !messageInput) return;
    const hasText = messageInput.value.trim() !== "";
    const hasFiles = currentMediaAttachments.length > 0;
    const canSend = hasText || (hasFiles && currentApiProvider === "gemini");
    sendButton.disabled = !canSend;
    sendButton.style.opacity = canSend ? "1" : "0.5";
}

function updateButtonToStop() {
    if (!sendButton) return;
    sendButton.innerHTML = '<i class="fas fa-stop"></i>';
    sendButton.title = "Parar geração";
    sendButton.disabled = false;
    sendButton.classList.add("stop-button");
    sendButton.onclick = () => {
        if (abortController) {
            abortController.abort();
        }
    };
}

function restoreSendButton() {
    if (!sendButton) return;
    sendButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
    sendButton.title = "Enviar mensagem";
    sendButton.classList.remove("stop-button");
    sendButton.onclick = null;
    updateSendButtonState();
}

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

function hideConnectionToast() {
    if (!connectionStatusToast) return;
    connectionStatusToast.classList.add("hidden");
}

let connectionState = true;

const iniciarRotacaoPlaceholders = (function() {
    let currentPhraseIndex = -1;
    let placeholderInterval = null;

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
            console.error();
            return;
        }

        if (placeholderInterval) {
            clearInterval(placeholderInterval);
        }

        currentPhraseIndex = getRandomUniqueIndex(currentPhraseIndex);
        messageInput.placeholder = frases[currentPhraseIndex];

        placeholderInterval = setInterval(() => {
            if (messageInput.value.trim() !== "") {
                return;
            }
            messageInput.classList.add("hiding-placeholder");
            setTimeout(() => {
                currentPhraseIndex = getRandomUniqueIndex(currentPhraseIndex);
                messageInput.placeholder = frases[currentPhraseIndex];
                messageInput.classList.remove("hiding-placeholder");
            }, 600);
        }, 5000);
    };
})();

function createNewChat() {
    const sortedChats = Object.values(allChats).sort((a, b) => b.timestamp - a.timestamp);
    const lastChat = sortedChats.length > 0 ? sortedChats[0] : null;

    if (lastChat && lastChat.recentMessages.length === 0 && !lastChat.summarizedContext) {
        switchToChat(lastChat.id);
        return;
    }

    const newChatId = generateChatId();
    allChats[newChatId] = {
        id: newChatId,
        title: "Nova Conversa...",
        recentMessages: [],
        summarizedContext: "",
        timestamp: Date.now()
    };

    saveChatsToPersistence();
    updateChatList();
    switchToChat(newChatId);

    if (messagesContainer) {
        messagesContainer.innerHTML = `<div class="welcome-screen"><div class="avatar bot-avatar"><i class="fas fa-robot"></i></div><h2>Bem-vindo ao Chat 2B</h2><p>Sua assistente de IA para conversas, programação e muito mais. Como posso ajudar você hoje?</p></div>`;
    }
    messageInput?.focus();
    clearImagePreview();
}

function switchToChat(chatId, shouldScrollToBottom = true) {
    sessionStorage.setItem("session_active_chat_id", chatId);
    localStorage.setItem("last_active_chat_id", chatId);
    if (!allChats[chatId]) { createNewChat(); return; }
    currentChatId = chatId;
    
    updateChatList();

    displayChatHistory(chatId, shouldScrollToBottom);
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

function deleteChat(chatId) {
    if (!chatId || !allChats[chatId]) return;
    delete allChats[chatId];
    saveChatsToPersistence();
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

    Object.values(allChats).filter(chat => {
        if (!chat || !chat.id || !chat.timestamp) return false;

        const isEmpty = chat.recentMessages.length === 0 && !chat.summarizedContext;
        const isDefaultTitle = chat.title === "Nova Conversa...";
        const isActive = chat.id === currentChatId;

        if (isEmpty && isDefaultTitle && !isActive) {
            return false;
        }
        return true;
    }).forEach(chat => {
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
            saveChatsToPersistence();
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

function clearCurrentChatMessages() {
    if (currentChatId && allChats[currentChatId]) {
        clearChatHistory(currentChatId);
        displayChatHistory(currentChatId);
        updateChatList();
        alert("Histórico da conversa atual limpo!");
    }
}

const clearCurrentChatBtn = document.getElementById("clear-current-chat-btn");
if (clearCurrentChatBtn) {
    clearCurrentChatBtn.addEventListener("click", clearCurrentChatMessages);
}

function startUserMessageEdit(messageDiv) {
    if (currentlyEditing.div) {
        finishUserMessageEdit(currentlyEditing.div, false, false);
    }

    const contentDiv = messageDiv.querySelector('.content-text');
    const actionsDiv = messageDiv.querySelector('.message-actions');
    const originalText = messageDiv.dataset.originalContent;

    currentlyEditing.div = messageDiv;
    currentlyEditing.originalContent = originalText;

    contentDiv.style.display = 'none';
    actionsDiv.style.display = 'none';

    const editContainer = document.createElement('div');
    editContainer.className = 'user-edit-container';

    const editTextArea = document.createElement('textarea');
    editTextArea.className = 'edit-message-textarea';
    editTextArea.value = originalText;

    const editActionsContainer = document.createElement('div');
    editActionsContainer.className = 'edit-actions-container';
    editActionsContainer.innerHTML = `
        <button class="edit-action-btn cancel-edit-btn" title="Cancelar edição (Esc)">
            <i class="fas fa-times"></i> Cancelar
        </button>
        <button class="edit-action-btn save-regenerate-btn" title="Salvar e gerar nova resposta (Enter)">
            <i class="fas fa-redo"></i> Salvar e Gerar
        </button>
    `;

    editContainer.appendChild(editTextArea);
    editContainer.appendChild(editActionsContainer);

    contentDiv.parentNode.insertBefore(editContainer, contentDiv.nextSibling);

    editTextArea.focus();
    editTextArea.select();
    const end = editTextArea.value.length;
    editTextArea.setSelectionRange(end, end);

    editTextArea.addEventListener('keydown', (e) => {
        const isMobile = window.innerWidth <= 768;
        if (e.key === 'Escape') {
            e.preventDefault();
            finishUserMessageEdit(messageDiv, false, false);
        } else if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
            e.preventDefault();
            finishUserMessageEdit(messageDiv, true, true);
        }
    });

    editContainer.querySelector('.cancel-edit-btn').addEventListener('click', () => finishUserMessageEdit(messageDiv, false, false));
    editContainer.querySelector('.save-regenerate-btn').addEventListener('click', () => finishUserMessageEdit(messageDiv, true, true));
}

function finishUserMessageEdit(messageDiv, shouldSave, shouldRegenerate) {
    const editContainer = messageDiv.querySelector('.user-edit-container');
    if (!editContainer) return;

    const newText = editContainer.querySelector('textarea').value.trim();

    editContainer.remove();
    messageDiv.querySelector('.content-text').style.display = '';
    messageDiv.querySelector('.message-actions').style.display = '';
    currentlyEditing.div = null;

    if (!shouldSave || newText === currentlyEditing.originalContent || newText === '') {
        return;
    }

    const messageId = messageDiv.dataset.messageId;
    const chatHistory = allChats[currentChatId].recentMessages;
    const messageIndex = chatHistory.findIndex(msg => msg.timestamp.toString() === messageId);

    if (messageIndex === -1) {
        console.error("Erro crítico: Não foi possível encontrar a mensagem no histórico de dados para atualizar.");
        return;
    }

    const messageToUpdate = chatHistory[messageIndex];
    let textPart = Array.isArray(messageToUpdate.content) ? messageToUpdate.content.find(p => p.type === 'text') : null;
    if (textPart) {
        textPart.text = newText;
    } else {
        messageToUpdate.content.push({ type: 'text', text: newText });
    }

    messageDiv.dataset.originalContent = newText;
    messageDiv.querySelector('.content-text').innerHTML = marked.parse(newText);

    saveChatsToPersistence();

    if (shouldRegenerate) {
        regenerateFromMessage(messageDiv);
    }
}

function showAppSettingsModal() {
    if (!appSettingsModalOverlay || !systemPromptInput || !temperatureInput || !temperatureValueDisplay || !geminiApiKeyInput || !geminiApiKeyDisplay || !userNameInput) return;

    const promptToDisplay = (localStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY) === null && currentUserSystemPrompt === getDynamicSystemPrompt()) ?
        getDynamicSystemPrompt() :
        currentUserSystemPrompt;

    systemPromptInput.value = promptToDisplay;
    temperatureInput.value = currentTemperature.toFixed(1);
    temperatureValueDisplay.textContent = `(${currentTemperature.toFixed(1)})`;
    userNameInput.value = currentUserName;

    geminiApiKeyInput.value = localStorage.getItem(GEMINI_API_KEY_STORAGE) || "";

    geminiApiKeyInput.style.display = "block";
    geminiApiKeyDisplay.style.display = "none";
    if (apiKeyToggleBtn) apiKeyToggleBtn.innerHTML = "<i class=\"fas fa-eye\"></i>";

    settingsFeedback.textContent = "";
    appSettingsModalOverlay.classList.add("active");
    history.pushState({ settingsModalOpen: true }, "Configurações");
}

function hideAppSettingsModal() {
    if (appSettingsModalOverlay?.classList.contains("active")) {
        history.back();
    }
}

function handleSaveAppSettings() {
    if (!systemPromptInput || !temperatureInput || !settingsFeedback || !geminiApiKeyInput || !userNameInput) return;

    const newPrompt = systemPromptInput.value;
    const newTemp = parseFloat(temperatureInput.value);
    const newApiKey = geminiApiKeyInput.value.trim();
    const newUserName = userNameInput.value.trim();
    const oldApiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE) || "";

    let apiKeyChanged = false;
    if (newApiKey !== oldApiKey) {
        const confirmationMessage = `Você tem certeza de que deseja alterar sua chave de API do Google AI?`;
        const confirmed = confirm(confirmationMessage);

        if (confirmed) {
            if (newApiKey) {
                localStorage.setItem(GEMINI_API_KEY_STORAGE, newApiKey);
            } else {
                localStorage.removeItem(GEMINI_API_KEY_STORAGE);
            }
            apiKeyChanged = true;
        } else {
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
    currentUserName = newUserName;
    saveAppSettingsToLocalStorage();

    settingsFeedback.textContent = "Configurações salvas!";
    settingsFeedback.style.color = "#4CAF50";

    setTimeout(() => {
        hideAppSettingsModal();
        if (apiKeyChanged) {
            loadModels();
        }
    }, 1000);
}

function performSearch(query) {
    if (!searchResults) return;
    searchResults.innerHTML = "";
    const searchTerm = query.toLowerCase().trim();
    if (!searchTerm) {
        searchResults.innerHTML = "<div class=\"search-info\">Digite algo para buscar.</div>";
        return;
    }
    const results = [];
    const terms = searchTerm.split(" ").filter(t => t.length > 0);

    Object.values(allChats).forEach(chat => {
        const messagesToSearch = [...chat.recentMessages];
        if (chat.summarizedContext) {
            messagesToSearch.unshift({
                role: "assistant",
                content: chat.summarizedContext,
                timestamp: `summary_${chat.id}`
            });
        }

        messagesToSearch.forEach(msg => {
            let textContent = "";
            if (typeof msg.content === "string") {
                textContent = msg.content;
            } else if (Array.isArray(msg.content)) {
                const textPart = msg.content.find(p => p.type === "text");
                if (textPart) textContent = textPart.text;
            }

            if (textContent && textContent.toLowerCase().includes(searchTerm)) {
                results.push({
                    chatId: chat.id,
                    messageId: msg.timestamp,
                    title: chat.title,
                    preview: getMatchContext(textContent, searchTerm, 80)
                });
            }
        });
    });

    results.sort((a, b) => {
        const aTimestamp = String(a.messageId).startsWith('summary_') ? 0 : a.messageId;
        const bTimestamp = String(b.messageId).startsWith('summary_') ? 0 : b.messageId;
        return bTimestamp - aTimestamp;
    });

    if (results.length === 0) {
        searchResults.innerHTML = `<div class="search-info">Nenhum resultado para "${query}".</div>`;
    } else {
        results.forEach(result => {
            const resultItem = document.createElement("div");
            resultItem.className = "search-result-item";
            const highlightedTitle = highlightTerms(result.title, terms);
            const highlightedPreview = highlightTerms(result.preview, terms);
            resultItem.innerHTML = `<i class="fas fa-comment-dots"></i><div class="search-result-content"><div class="search-result-title">${highlightedTitle}</div><div class="search-result-preview">${highlightedPreview}</div></div>`;
            resultItem.addEventListener("click", () => {
                searchOverlay.classList.remove("active");
                switchToChatAndHighlightMessage(result.chatId, result.messageId, searchTerm);
            });
            searchResults.appendChild(resultItem);
        });
    }
}

function highlightMessage(messageElement, searchTerm) {
    if (!messageElement || !searchTerm) return;

    const contentElement = messageElement.querySelector('.content-text');
    if (!contentElement) return;

    const originalHTML = contentElement.innerHTML;
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    
    const newHTML = originalHTML.replace(regex, '<span class="search-highlight-active">$1</span>');
    
    contentElement.innerHTML = newHTML;

    setTimeout(() => {
        contentElement.innerHTML = originalHTML;
    }, 3000);
}


function switchToChatAndHighlightMessage(chatId, messageId, searchTerm) {
    const alreadyInChat = currentChatId === chatId;
    switchToChat(chatId, false); 
    requestAnimationFrame(() => {
        let messageElement;
        if (String(messageId).startsWith('summary_')) {
            messageElement = document.querySelector('.summarized-context');
        } else {
            messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        }

        if (messageElement) {
            messageElement.scrollIntoView({
                behavior: alreadyInChat ? 'smooth' : 'auto',
                block: 'center'
            });
            highlightMessage(messageElement, searchTerm);
        } else {
            console.warn("Não foi possível encontrar o elemento da mensagem para destacar após a troca de chat.");
        }
    });
}

function handleMissingApiKey(isFirstTime = false) {
    if (isFirstTime) {
        alert("Bem-vindo(a)! Para começar, por favor, configure sua chave de API do Google AI nas configurações.");
    }
    showAppSettingsModal();
    const guide = document.getElementById('api-key-setup-guide');
    if (guide) {
        guide.style.display = 'block';
    }
    if (geminiApiKeyInput) {
        geminiApiKeyInput.focus();
    }
}

async function speakText(text, button) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    if (button === currentPlayingTtsBtn) {
        resetAllTtsButtons();
        currentPlayingTtsBtn = null;
        return;
    }

    resetAllTtsButtons();
    currentPlayingTtsBtn = button;

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        alert("Chave de API do Gemini/Google AI não encontrada para o serviço de voz. Por favor, configure-a.");
        resetAllTtsButtons();
        currentPlayingTtsBtn = null;
        return;
    }

    button.innerHTML = "<i class=\"fas fa-spinner fa-spin\"></i>";
    button.disabled = true;

    try {
        const emojiRegex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g;
        const cleanText = text.replace(emojiRegex, "").trim();

        if (!cleanText) {
            alert("A mensagem contém apenas emojis e não pode ser lida.");
            resetAllTtsButtons();
            currentPlayingTtsBtn = null;
            return;
        }

        const response = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    input: { text: cleanText },
                    voice: { languageCode: "pt-BR", name: "pt-BR-Standard-C", ssmlGender: "FEMALE" },
                    audioConfig: { audioEncoding: "MP3", speakingRate: 1.1, pitch: -3.0, volumeGainDb: 0.0, sampleRateHertz: 24000 }
                }),
            });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || `Erro ${response.status}`);
        }

        const data = await response.json();
        const audioSrc = `data:audio/mp3;base64,${data.audioContent}`;
        currentAudio = new Audio(audioSrc);

        button.innerHTML = "<i class=\"fas fa-stop\"></i>";
        button.title = "Parar áudio";
        button.disabled = false;

        currentAudio.play();

        currentAudio.onended = () => {
            resetAllTtsButtons();
            currentAudio = null;
            currentPlayingTtsBtn = null;
        };

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

function resetAllTtsButtons() {
    document.querySelectorAll(".tts-btn").forEach(btn => {
        btn.innerHTML = "<i class=\"fas fa-volume-up\"></i>";
        btn.disabled = false;
        btn.title = "Ouvir mensagem";
    });
}

currentUserSystemPrompt = getDynamicSystemPrompt();

function getDynamicSystemPrompt() {
    return PROMPT_BASE;
}

function getGeminiApiKey() {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE)?.trim() || null;
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

async function loadChatsFromStorageData() {
    const data = await loadChatsFromStorage();
    const sessionChatId = sessionStorage.getItem("session_active_chat_id");

    if (data && data.allChats) {
        allChats = data.allChats;
        for (const id in allChats) {
            if (!allChats[id].recentMessages) allChats[id].recentMessages = [];
        }
    } else {
        allChats = {};
    }

    initializeHistory(allChats, saveChatsToPersistence);

    if (sessionChatId && allChats[sessionChatId]) {
        currentChatId = sessionChatId;
        await saveChatsToPersistence();
        switchToChat(currentChatId);
        return;
    }

    const sortedChats = Object.values(allChats).sort((a, b) => b.timestamp - a.timestamp);
    const lastChat = sortedChats.length > 0 ? sortedChats[0] : null;

    if (lastChat && lastChat.recentMessages.length === 0 && !lastChat.summarizedContext && lastChat.title === "Nova Conversa...") {
        currentChatId = lastChat.id;
    } else {
        const newChatId = generateChatId();
        allChats[newChatId] = {
            id: newChatId,
            title: "Nova Conversa...",
            recentMessages: [],
            summarizedContext: "",
            timestamp: Date.now()
        };
        currentChatId = newChatId;
    }

    await saveChatsToPersistence();
    switchToChat(currentChatId);
}

async function saveChatsToPersistence() {
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

        const dataToSave = {
            currentChatId: currentChatId,
            allChats: validChats
        };

        await saveChatsToStorage(dataToSave);

        if (currentChatId) {
            localStorage.setItem("last_active_chat_id", currentChatId);
        }
        
        if (apiSourceInput && apiSourceInput.value) {
            localStorage.setItem("api_source_preference", apiSourceInput.value);
        }
        
        if (modelSelect && modelSelect.value) {
            localStorage.setItem(`${currentApiProvider}_selected_model`, modelSelect.value);
        }

    } catch (e) {
        console.error("Erro ao salvar chats na persistência:", e);
    }
}

function saveAppSettingsToLocalStorage() {
    localStorage.setItem(SYSTEM_PROMPT_STORAGE_KEY, currentUserSystemPrompt);
    localStorage.setItem(TEMPERATURE_STORAGE_KEY, currentTemperature.toString());
    localStorage.setItem(USER_NAME_STORAGE_KEY, currentUserName);
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

    const savedUserName = localStorage.getItem(USER_NAME_STORAGE_KEY);
    if (savedUserName) {
        currentUserName = savedUserName;
    }
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
                try { const d = await response.json(); errorText = d.error || errorText; } catch (e) { }
                throw new Error(`Erro ${response.status}: ${errorText}`);
            }
            const data = await response.json();
            modelSelect.innerHTML = "";

            if (data.models?.length > 0) {
                const savedModel = localStorage.getItem("ollama_selected_model");
                let foundSaved = false;

                data.models.sort((a, b) => a.name.localeCompare(b.name)).forEach(model => {
                    const option = document.createElement("option");
                    option.value = model.name;
                    const modelName = model.name;
                    const quant = model.details?.quantization_level || "N/A";
                    const size = formatBytes(model.size);
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
            modelSelect.innerHTML = `<option value=\"\" disabled selected>Falha Ollama (${error.message.substring(0, 30)}...)</option>`;
        }
    } else { 
        if (!apiConfig.apiKey) {
            modelSelect.innerHTML = `<option value=\"\" disabled selected>Chave API Gemini pendente</option>`;
            return;
        }
        try {
            const response = await fetch(`${apiConfig.url}/models?key=${apiConfig.apiKey}`);
            if (!response.ok) {
                let errorText = response.statusText;
                try { const d = await response.json(); errorText = d.error?.message || d.error || errorText; } catch (e) { }
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
                        if (a.name === "models/gemini-2.5-flash") return -1;
                        if (b.name === "models/gemini-2.5-flash") return 1;
                        const aIsVision = a.name.includes("vision");
                        const bIsVision = b.name.includes("vision");
                        if (aIsVision && !bIsVision) return -1;
                        if (!aIsVision && bIsVision) return 1;
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
                    const flashModelOption = Array.from(modelSelect.options).find(opt => opt.value === "models/gemini-2.5-flash");
                    if (flashModelOption) {
                        flashModelOption.selected = true;
                    } else if (modelSelect.options.length > 0) {
                        modelSelect.options[0].selected = true;
                    }
                }
                if (modelSelect.options.length === 0) { modelSelect.innerHTML = "<option value=\"\" disabled selected>Nenhum modelo Gemini compatível</option>"; }
            } else { modelSelect.innerHTML = "<option value=\"\" disabled selected>Nenhum modelo Gemini encontrado</option>"; }
        } catch (error) { modelSelect.innerHTML = `<option value=\"\" disabled selected>Falha Gemini Models (${error.message.substring(0, 30)}...)</option>`; }
    }
    if (modelSelect.value) {
        localStorage.setItem(`${currentApiProvider}_selected_model`, modelSelect.value);
    } else if (modelSelect.options.length > 0 && !modelSelect.options[0].disabled) {
        localStorage.setItem(`${currentApiProvider}_selected_model`, modelSelect.options[0].value);
    }
}

function exportChatHistory(chatId) {
    if (!allChats || !allChats[chatId]) return;
    const chat = allChats[chatId];
    const modelName = modelSelect ? modelSelect.options[modelSelect.selectedIndex]?.textContent : "desconhecido";
    const chatTitle = chat.title || "Conversa";
    const sanitizedTitle = chatTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    let content = `Esta conversa foi gerada com a 2B usando o modelo ${modelName} (${currentApiProvider}). Os chats com IA podem apresentar informações incorretas ou ofensivas.\n\n=======================\n\n`;
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

    try {
        if (window.Website2APK && typeof window.Website2APK.getBase64FromBlobData === 'function') {
            const mimeType = "text/plain;charset=utf-8";
            const base64Content = btoa(unescape(encodeURIComponent(content)));
            const dataUrl = `data:${mimeType};base64,${base64Content}`;
            const payload = `${sanitizedTitle}|||${dataUrl}`;
            window.Website2APK.getBase64FromBlobData(payload);
            return;
        }
    } catch (e) {
        console.error("Erro ao tentar exportar via interface do WebView:", e);
    }

    console.log("Interface 'Website2APK' não encontrada. Usando método de download padrão.");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizedTitle}.txt`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}


window.handlePastedImageFromNative = function(mimeType, base64String) {
    if (mimeType && base64String) {
        const fullBase64Url = `data:${mimeType};base64,${base64String}`;
        
        const byteCharacters = atob(base64String);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        
        const file = new File([blob], "pasted_image.png", { type: mimeType });
        
        processFiles([file]);
    }
};

function handlePaste(event) {
    if (currentApiProvider !== "gemini") return;
    const items = (event.clipboardData || event.originalEvent.clipboardData)?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
            event.preventDefault(); 
            const file = items[i].getAsFile();
            if (file) {
                processFiles([file]);
            }
            break; 
        }
    }
}

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installPwaBtn = document.getElementById("install-pwa-btn");
    if (installPwaBtn) {
        installPwaBtn.style.display = "block";
    }
});

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").then(registration => {
            console.log("ServiceWorker registrado com sucesso: ", registration.scope);
        }).catch(error => {
            console.log("Falha ao registrar o ServiceWorker: ", error);
        });
    });
}

window.switchToChatFromNotification = function(chatId) {
    if (chatId && allChats[chatId]) {
        console.log(`Recebido clique na notificação para o chat: ${chatId}`);
        switchToChat(chatId);
    } else {
        console.error(`Chat com ID ${chatId} não encontrado via notificação.`);
    }
};

document.addEventListener("DOMContentLoaded", initializeApp);
