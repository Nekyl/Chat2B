import { initializeHistory, addMessageToHistory, getHistoryForApi, clearChatHistory } from "./history.js";
import { loadChatsFromStorage, saveChatsToStorage } from "./storage.js";
import { PROMPT_BASE } from "./prompt.js";

let currentEditorCropper = null;
let currentEditingMediaId = null;
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
const globalApiKeyInput = document.getElementById("global-api-key-input");
const globalApiKeyDisplay = document.getElementById("global-api-key-display");
const dynamicApiKeyLabel = document.getElementById("dynamic-api-key-label");
const dynamicApiKeyContainer = document.getElementById("dynamic-api-key-container");
const apiKeyToggleBtn = document.getElementById("api-key-toggle-btn");

const GROQ_API_BASE_URL = "https://api.groq.com/openai/v1";
const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const XAI_API_BASE_URL = "https://api.x.ai/v1";
const NVIDIA_API_BASE_URL = "https://chat2b-nvidia-proxy.nekyll.workers.dev/v1";

const GROQ_API_KEY_STORAGE = "2b_chat_groq_api_key";
const OPENAI_API_KEY_STORAGE = "2b_chat_openai_api_key";
const XAI_API_KEY_STORAGE = "2b_chat_xai_api_key";
const GEMINI_API_KEY_STORAGE = "2b_chat_gemini_api_key";

const modelSelector = document.querySelector('.custom-model-selector');
const modelDropdown = document.querySelector('.custom-model-dropdown');
const modelList = document.querySelector('.custom-model-list');
const modelSearch = document.getElementById('custom-model-search');

modelSelector.addEventListener('click', () => {
    const isOpening = !modelDropdown.classList.contains('active');
    modelDropdown.classList.toggle('active');

    if (isOpening) {
        const selected = modelList.querySelector('.custom-model-item.selected');
        if (selected) {
            requestAnimationFrame(() => {
                modelList.scrollTop = selected.offsetTop - modelList.offsetTop;
            });
        }
    }
});

modelDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
});

modelSearch.addEventListener('input', () => {
    modelList.scrollTop = 0;
});

document.addEventListener('click', (e) => {
    if (!modelSelector.contains(e.target)) {
        modelDropdown.classList.remove('active');
    }
});

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

const DEFAULT_LLM_URL = "http://localhost:8080";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const SYSTEM_PROMPT_STORAGE_KEY = "2b_chat_user_system_prompt";
const TEMPERATURE_STORAGE_KEY = "2b_chat_user_temperature";
const DEFAULT_TEMPERATURE = 0.7;
let currentTemperature = DEFAULT_TEMPERATURE;
let currentUserSystemPrompt = "";
const USER_NAME_STORAGE_KEY = "2b_chat_user_name";

function setupCustomModelDropdown() {
    const customSelector = document.getElementById("custom-model-selector") || document.querySelector('.custom-model-selector');
    const customDisplay = document.getElementById("custom-model-display") || document.querySelector('.custom-model-display');
    const customDropdown = document.getElementById("custom-model-dropdown") || document.querySelector('.custom-model-dropdown');
    const searchInput = document.getElementById("custom-model-search");

    if (!customSelector || !customDropdown) return;

    customDropdown.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    if (searchInput) {
        searchInput.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        searchInput.addEventListener("input", (e) => {
            filterModels(e.target.value);
        });
    }

    if (customDisplay) {
        customDisplay.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = customDropdown.classList.contains("active");

            document.querySelectorAll(".custom-model-dropdown.active").forEach(d => d.classList.remove("active"));

            if (!isOpen) {
                customDropdown.classList.add("active");
                if (searchInput) {
                    searchInput.value = "";
                    filterModels("");
                    setTimeout(() => searchInput.focus(), 50);
                }

                const modelSelect = document.getElementById("model-select");
                const selectedValue = modelSelect ? modelSelect.value : null;
                if (selectedValue) {
                    const selectedItem = customDropdown.querySelector(`.custom-model-item[data-value="${selectedValue}"]`);
                    if (selectedItem) {
                        setTimeout(() => selectedItem.scrollIntoView({ block: "nearest" }), 10);
                    }
                }
            } else {
                customDropdown.classList.remove("active");
            }
        });
    }

    document.addEventListener("click", (e) => {
        if (!customSelector.contains(e.target) && !customDropdown.contains(e.target)) {
            customDropdown.classList.remove("active");
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && customDropdown.classList.contains("active")) {
            customDropdown.classList.remove("active");
        }
    });
}

function filterModels(query) {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(term => term.length > 0);
    const items = document.querySelectorAll(".custom-model-item");
    const headers = document.querySelectorAll(".model-section-header");

    const isSearching = terms.length > 0;

    headers.forEach(h => {
        h.style.display = isSearching ? "none" : "block";
    });

    items.forEach(item => {
        if (item.dataset.value === "manual") {
            item.style.display = isSearching ? "none" : "flex";
            return;
        }

        const textSpan = item.querySelector('.model-item-text');
        const text = textSpan ? textSpan.textContent.toLowerCase() : item.textContent.toLowerCase();

        if (!isSearching) {
            item.style.display = "flex";
        } else {
            const matches = terms.every(term => text.includes(term));
            item.style.display = matches ? "flex" : "none";
        }
    });
}

const purifyConfig = {
    ADD_TAGS: ['video', 'source', 'img'],
    ADD_ATTR: ['controls', 'autoplay', 'loop', 'muted', 'playsinline', 'webkit-playsinline', 'preload', 'src', 'alt', 'class', 'style'],
};

async function initializeApp() {
    applyThemePreference();
    loadAppSettingsFromLocalStorage();
    await loadChatsFromStorageData();
    setupEventListeners();
    setupSearch();
    setupImageUpload();
    setupImagePreview();
    createScrollToBottomButton();
    setupCustomModelDropdown();
    enableScrollbarDragging(document.querySelector('.custom-model-list'));
    enableScrollbarDragging(document.getElementById("system-prompt-input"));

    const lastApi = localStorage.getItem("2b_chat_last_api_source");
    if (lastApi && apiSourceInput) {
        apiSourceInput.value = lastApi;
    }
    setupApiSourceHistory();

    await loadModels();
    handleResizeLayout();
    adjustTextareaHeight();
    updateSendButtonState();

    if (messageInput && !searchOverlay?.classList.contains("active") && !deleteConfirmOverlay?.classList.contains("active") && !appSettingsModalOverlay?.classList.contains("active")) {
        if (window.innerWidth > 768) {
            messageInput.focus();
        }
    }

    checkScrollPosition();
    checkNetworkStatus();

    const sourcePref = localStorage.getItem("api_source_preference") || "Gemini";
    if (sourcePref.toLowerCase() === 'gemini' && !getGeminiApiKey()) {
        setTimeout(() => handleMissingApiKey(false), 500);
    }
    onWebAppReady();
    const defaults = ["Gemini", "Grok", "Groq"];
    let history = JSON.parse(localStorage.getItem("2b_chat_api_history") || "[]");
    defaults.forEach(def => {
        if (!history.some(item => item.url.toLowerCase() === def.toLowerCase())) {
            history.unshift({ url: def, lastAccess: Date.now() - 100000 });
        }
    });
    localStorage.setItem("2b_chat_api_history", JSON.stringify(history.slice(0, 10)));
}

function setupEventListeners() {
    const installPwaBtn = document.getElementById("install-pwa-btn");
    if (installPwaBtn) {
        installPwaBtn.addEventListener("click", async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
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

    /* Theme toggle */
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", toggleTheme);
    }
    if (typeof window.matchMedia === 'function') {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleSystemThemeChange);
    }

    /* Suggestion cards */
    messagesContainer?.addEventListener("click", (e) => {
        const card = e.target.closest(".suggestion-card");
        if (card && messageInput) {
            const suggestion = card.dataset.suggestion.replace(/\\n/g, '\n');
            messageInput.value = suggestion;
            messageInput.dispatchEvent(new Event("input", { bubbles: true }));
            messageInput.focus();
        }
    });

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

        let wasNearBottomOnFocus = false;

        messageInput.addEventListener("focus", () => {
            if (scrollContainer) {
                const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
                wasNearBottomOnFocus = (scrollHeight - scrollTop - clientHeight) < 150;
            }
        });

        const handleKeyboardOpen = () => {
            const isMobile = window.innerWidth <= 768;
            if (isMobile && document.activeElement === messageInput) {
                if (wasNearBottomOnFocus) {
                    setTimeout(() => {
                        scrollToBottom('smooth');
                    }, 200);
                }
            }
        };

        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", handleKeyboardOpen);
        } else {
            let resizeDebounceTimer;
            window.addEventListener('resize', () => {
                clearTimeout(resizeDebounceTimer);
                resizeDebounceTimer = setTimeout(handleKeyboardOpen, 150);
            });
        }
    }

    document.addEventListener('click', function (e) {
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
                copyTextToClipboard(cleanTextForUI(messageDiv.dataset.originalContent), copyMsgBtn);
            }
            return;
        }

        const toggleCodeBtn = e.target.closest('.code-toggle-btn');
        if (toggleCodeBtn) {
            e.stopPropagation();
            const preElement = toggleCodeBtn.closest('pre');
            if (preElement) {
                preElement.classList.toggle('collapsed');
                const icon = toggleCodeBtn.querySelector('i');
                if (preElement.classList.contains('collapsed')) {
                    icon.className = 'fas fa-chevron-down';
                    toggleCodeBtn.title = 'Maximizar código';
                } else {
                    icon.className = 'fas fa-chevron-up';
                    toggleCodeBtn.title = 'Minimizar código';
                }
            }
            return;
        }

        const ttsBtn = e.target.closest('.tts-btn');
        if (ttsBtn) {
            e.stopPropagation();
            const messageDiv = ttsBtn.closest('.message');
            if (messageDiv?.dataset.originalContent) {
                const textToSpeak = messageDiv.dataset.originalContent.replace(/```[\s\S]*?```/g, 'Bloco de código.');
                speakText(textToSpeak, ttsBtn, messageDiv);
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

        const botAudioPlayBtn = e.target.closest('.custom-ap-btn.play-btn');
        if (botAudioPlayBtn) {
            e.stopPropagation();
            const audioSrc = botAudioPlayBtn.getAttribute('data-audio-src');
            const playerId = botAudioPlayBtn.getAttribute('data-player-id');
            playBotAudio(audioSrc, botAudioPlayBtn, playerId);
            return;
        }

        const botAudioDownloadBtn = e.target.closest('.custom-ap-btn.download-btn');
        if (botAudioDownloadBtn) {
            e.stopPropagation();
            const audioSrc = botAudioDownloadBtn.getAttribute('data-audio-src');
            downloadBotAudio(audioSrc, botAudioDownloadBtn);
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

    if (apiKeyToggleBtn && globalApiKeyInput && globalApiKeyDisplay) {
        apiKeyToggleBtn.addEventListener('click', () => {
            if (globalApiKeyInput.style.display !== 'none') {
                const key = globalApiKeyInput.value;
                const maskedKey = (key && key.length > 6) ? `${key.substring(0, 3)}(ﾉﾟДﾟ)ﾉ${key.substring(key.length - 3)}` : key;
                globalApiKeyDisplay.textContent = maskedKey || "Nenhuma chave inserida";
                globalApiKeyInput.style.display = 'none';
                globalApiKeyDisplay.style.display = 'block';
                apiKeyToggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                globalApiKeyDisplay.style.display = 'none';
                globalApiKeyInput.style.display = 'block';
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
            if (globalApiKeyInput) globalApiKeyInput.focus();
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
            scrollDebounceTimeout = setTimeout(() => {
                checkScrollPosition();
                if (currentChatId && !isBotStreaming) {
                    sessionStorage.setItem(`scroll_pos_${currentChatId}`, scrollContainer.scrollTop);
                }
            }, 50);
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
                await loadModels();
                saveChatsToPersistence();
                updateSendButtonState();
                checkNetworkStatus();
            }, 500);
        });
    }

    if (modelSelect) {
        modelSelect.addEventListener("change", async () => {
            if (modelSelect.value) {
                localStorage.setItem(`${currentApiProvider}_selected_model`, modelSelect.value);
                if (currentApiProvider === "llm") {
                    const apiConfig = await getApiConfig();
                    fetch(`${apiConfig.url}/api/chat`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ model: modelSelect.value })
                    }).catch(() => { });
                }
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

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            localStorage.setItem("last_active_timestamp", Date.now().toString());
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

    attachImageBtn.addEventListener("click", () => {
        imageFileInput.click();
    });

    imageFileInput.addEventListener("change", (event) => {
        processFiles(event.target.files);
        imageFileInput.value = null;
        setTimeout(() => messageInput.focus(), 10);
    });

    const dropZone = document.body;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files && files.length > 0) {
            const filesArray = Array.from(files);
            const filesToProcess = filesArray.length > 4 ? filesArray.slice(0, 4) : filesArray;

            processFiles(filesToProcess);
        }
    }
}

function processFiles(files) {
    if (!files || files.length === 0) return;

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

let thinkingVibrationInterval = null;

function startThinkingVibration() {
    if (!navigator.vibrate) return;
    stopAllVibrations();

    navigator.vibrate(15);

    thinkingVibrationInterval = setInterval(() => {
        navigator.vibrate(15);
    }, 1500);
}

function tokenVibration(isFirst) {
    if (!navigator.vibrate) return;
    if (isFirst) {
        stopAllVibrations();
        navigator.vibrate(100);
    } else {
        navigator.vibrate(5);
    }
}

function successVibration() {
    if (!navigator.vibrate) return;
    stopAllVibrations();
    navigator.vibrate([50, 100]);
}

function errorVibration() {
    if (!navigator.vibrate) return;
    stopAllVibrations();
    navigator.vibrate([200, 100, 200]);
}

function stopAllVibrations() {
    if (thinkingVibrationInterval) {
        clearInterval(thinkingVibrationInterval);
        thinkingVibrationInterval = null;
    }
    if (navigator.vibrate) navigator.vibrate(0);
}

function applyMathRendering(element) {
    if (typeof renderMathInElement === 'function') {
        renderMathInElement(element, {
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "\\[", right: "\\]", display: true },
                { left: "$", right: "$", display: false },
                { left: "\\(", right: "\\)", display: false }
            ],
            throwOnError: false,
            errorColor: "#ef4444"
        });
    }
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
        const isVideo = media.type.startsWith('video/');

        if (isVideo) {
            mediaElement = document.createElement('video');
            mediaElement.src = media.base64;
            mediaElement.muted = true;
            mediaElement.autoplay = true;
            mediaElement.loop = true;
            mediaElement.playsInline = true;
            mediaElement.className = 'media-preview-thumbnail';

            mediaElement.onclick = (e) => {
                e.stopPropagation();
                const overlay = document.getElementById('image-preview-overlay');
                const fullVideo = document.getElementById('image-preview-full-video');
                const fullImage = document.getElementById('image-preview-full-image');

                if (fullVideo && overlay) {
                    fullVideo.src = media.base64;
                    fullVideo.style.display = 'block';
                    fullVideo.controls = true;
                    fullVideo.muted = false;
                    if (fullImage) fullImage.style.display = 'none';

                    overlay.classList.add('active');
                    history.pushState({ imagePreview: true }, "Visualizador de Vídeo");

                    try {
                        fullVideo.play();
                    } catch (err) {
                        console.log("Autoplay bloqueado no full preview");
                    }
                }
            };
        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = media.base64;
            mediaElement.className = 'media-preview-thumbnail';
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-media-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remover';
        removeBtn.onmousedown = (e) => e.preventDefault();
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

        if (!isVideo) {
            mediaElement.onclick = (e) => {
                e.stopPropagation();
                const overlay = document.getElementById('image-preview-overlay');
                const fullImage = document.getElementById('image-preview-full-image');
                const fullVideo = document.getElementById('image-preview-full-video');

                if (fullImage && overlay) {
                    fullImage.src = media.base64;
                    fullImage.style.display = 'block';
                    if (fullVideo) fullVideo.style.display = 'none';

                    overlay.classList.add('active');
                    history.pushState({ imagePreview: true }, "Visualizador de Imagem");
                }
            };

            const editOverlay = document.createElement('div');
            editOverlay.className = 'media-edit-overlay';
            editOverlay.innerHTML = '<i class="fas fa-pencil-alt"></i>';

            const editIcon = editOverlay.querySelector('i');
            if (editIcon) {
                editIcon.onclick = (e) => {
                    e.stopPropagation();
                    openImageEditor(media.id);
                };
            }
            wrapper.appendChild(editOverlay);
        }

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

    const editorHtml = `
        <div class="image-editor-modal" id="image-editor-modal">
            <div class="editor-header">
                <button class="editor-action-btn" id="editor-cancel-btn"><i class="fas fa-times"></i></button>
                <span class="editor-title">Editar Imagem</span>
                <button class="editor-action-btn" id="editor-save-btn" style="color: #4CAF50;">Concluir</button>
            </div>
            <div class="editor-canvas-container">
                <img id="editor-image-target" src="">
            </div>
            <div class="editor-footer">
                <button class="editor-tool-btn" id="tool-crop" title="Resetar Corte">
                    <i class="fas fa-crop-alt"></i>
                    <span>Resetar</span>
                </button>
                <button class="editor-tool-btn" id="tool-rotate" title="Girar">
                    <i class="fas fa-sync-alt"></i>
                    <span>Girar</span>
                </button>
            </div>
        </div>
    `;

    if (!document.getElementById('image-preview-overlay')) {
        document.body.insertAdjacentHTML('beforeend', previewHtml + editorHtml);
    }

    const overlay = document.getElementById('image-preview-overlay');
    const fullImage = document.getElementById('image-preview-full-image');
    const fullVideo = document.getElementById('image-preview-full-video');
    const closeBtn = document.getElementById('image-preview-close-btn');
    const editorModal = document.getElementById('image-editor-modal');

    const closePreview = () => {
        if (overlay && overlay.classList.contains('active')) {
            if (history.state && history.state.imagePreview) {
                history.back();
            } else {
                overlay.classList.remove('active');
            }
            if (fullVideo) {
                fullVideo.pause();
                fullVideo.src = "";
            }
        }
    };

    window.addEventListener('popstate', () => {
        if (overlay && overlay.classList.contains('active')) {
            overlay.classList.remove('active');
            if (fullVideo) {
                fullVideo.pause();
                fullVideo.src = "";
            }
        }
        if (editorModal && editorModal.classList.contains('active')) {
            closeImageEditor();
        }
    });

    document.body.addEventListener('click', function (e) {
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
                fullVideo.controls = true;
                if (fullImage) fullImage.style.display = 'none';
                overlay.classList.add('active');
                history.pushState({ imagePreview: true }, "Visualizador de Vídeo");
                fullVideo.play().catch(() => { });
            }
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', closePreview);
    }
    if (overlay) {
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                closePreview();
            }
        });
    }

    const editorCancelBtn = document.getElementById('editor-cancel-btn');
    const editorSaveBtn = document.getElementById('editor-save-btn');
    const toolRotate = document.getElementById('tool-rotate');
    const toolCrop = document.getElementById('tool-crop');

    if (editorCancelBtn) {
        editorCancelBtn.addEventListener('click', () => {
            history.back();
        });
    }

    if (editorSaveBtn) {
        editorSaveBtn.addEventListener('click', saveEditedImage);
    }

    if (toolRotate) {
        toolRotate.addEventListener('click', () => {
            if (currentEditorCropper) currentEditorCropper.rotate(90);
        });
    }

    if (toolCrop) {
        toolCrop.addEventListener('click', () => {
            if (currentEditorCropper) currentEditorCropper.reset();
        });
    }
}

function openImageEditor(mediaId) {
    const mediaItem = currentMediaAttachments.find(m => m.id === mediaId);
    if (!mediaItem || mediaItem.type.startsWith('video/')) return;

    currentEditingMediaId = mediaId;

    const editorModal = document.getElementById('image-editor-modal');
    const imageTarget = document.getElementById('editor-image-target');

    if (!editorModal || !imageTarget) return;

    imageTarget.src = mediaItem.base64;

    editorModal.classList.add('active');
    history.pushState({ imageEditor: true }, "Editor de Imagem");

    if (window.Cropper) {
        if (currentEditorCropper) {
            currentEditorCropper.destroy();
        }

        currentEditorCropper = new Cropper(imageTarget, {
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.9,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
            background: false
        });
    }
}

function closeImageEditor() {
    const editorModal = document.getElementById('image-editor-modal');
    if (editorModal) {
        editorModal.classList.remove('active');
    }

    if (currentEditorCropper) {
        currentEditorCropper.destroy();
        currentEditorCropper = null;
    }
    currentEditingMediaId = null;
}

function saveEditedImage() {
    if (!currentEditorCropper || !currentEditingMediaId) return;

    const canvas = currentEditorCropper.getCroppedCanvas({
        maxWidth: 2048,
        maxHeight: 2048
    });

    if (!canvas) return;

    canvas.toBlob((blob) => {
        const index = currentMediaAttachments.findIndex(m => m.id === currentEditingMediaId);
        if (index !== -1) {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const base64data = reader.result;
                currentMediaAttachments[index].base64 = base64data;
                currentMediaAttachments[index].file = new File([blob], "edited_image.jpg", { type: "image/jpeg" });

                renderInputPreviews();
                history.back();
            }
        }
    }, 'image/jpeg', 0.9);
}

if (window.marked && window.hljs) {
    marked.setOptions({
        highlight: function (code, lang) {
            const language = hljs.getLanguage(lang) ? lang : "plaintext";
            try {
                return hljs.highlight(code, { language, ignoreIllegals: true }).value;
            } catch (err) {
                return hljs.highlight(code, { language: "plaintext", ignoreIllegals: true }).value;
            }
        },
        renderer: (function () {
            const renderer = new marked.Renderer();

            renderer.table = function (header, body) {
                return `
                    <div class="table-wrapper">
                        <table>
                            <thead>${header}</thead>
                            <tbody>${body}</tbody>
                        </table>
                    </div>
                `;
            };

            renderer.code = function (code, languageInfo = "") {

                const [language, filename] = (languageInfo || "").split(":");
                const validLanguage = hljs.getLanguage(language) ? language : "plaintext";
                const highlighted = this.options.highlight(code, validLanguage);
                const filenameDiv = filename ? `<div class="code-filename">${filename}</div>` : "";
                const blockId = "code-block-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);

                return `
                    <div class="code-block-wrapper">
                        ${filenameDiv}
                        <pre data-language="${validLanguage}"><div class="code-block-header">
                                <span class="code-language">${validLanguage}</span>
                                <div class="code-block-actions">
                                    <button class="code-copy-btn" data-block-id="${blockId}">
                                        <i class="fas fa-copy"></i>
                                        <span>Copiar</span>
                                    </button>
                                    <button class="code-toggle-btn" title="Minimizar código">
                                        <i class="fas fa-chevron-up"></i>
                                    </button>
                                </div>
                            </div><code id="${blockId}" class="hljs language-${validLanguage}">${highlighted}</code></pre>
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

let favoritesChanged = false;

function getFavoriteModels() {
    return JSON.parse(localStorage.getItem('2b_chat_favorite_models') || '[]');
}

function toggleFavoriteModel(modelId, modelName, apiSource, hasVision) {
    let favs = getFavoriteModels();
    const index = favs.findIndex(f => f.id === modelId && f.apiSource === apiSource);
    let isNowFavorite = false;

    if (index > -1) {
        favs.splice(index, 1);
    } else {
        favs.push({ id: modelId, name: modelName, apiSource: apiSource, hasVision: hasVision });
        isNowFavorite = true;
    }

    localStorage.setItem('2b_chat_favorite_models', JSON.stringify(favs));
    updateFavoriteIconsVisually(modelId, isNowFavorite);
    favoritesChanged = true;
}

function updateFavoriteIconsVisually(modelId, isFavorite) {
    const modelItems = document.querySelectorAll(`.custom-model-item[data-value="${modelId}"]`);
    modelItems.forEach(item => {
        const btn = item.querySelector('.model-favorite-btn');
        if (btn) {
            if (isFavorite) {
                btn.innerHTML = '<i class="fas fa-heart"></i>';
                btn.classList.add('active');
            } else {
                btn.innerHTML = '<i class="far fa-heart"></i>';
                btn.classList.remove('active');
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const observerDropdown = document.querySelector('.custom-model-dropdown');
    if (observerDropdown) {
        new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class' && !observerDropdown.classList.contains('active') && favoritesChanged) {
                    favoritesChanged = false;
                    loadModels();
                }
            });
        }).observe(observerDropdown, { attributes: true });
    }
});

async function getApiConfig() {
    const sourceValue = apiSourceInput.value.trim();
    const sourceLower = sourceValue.toLowerCase();
    iniciarRotacaoPlaceholders();

    if (sourceValue) {
        localStorage.setItem("2b_chat_last_api_source", sourceValue);
        let isValid = false;
        try {
            if (["gemini", "openai", "groq", "grok", "xai", "nvidia"].includes(sourceLower)) {
                isValid = true;
            } else if (sourceLower.startsWith("http") || sourceLower.includes("localhost") || sourceLower.match(/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/)) {
                let testBaseUrl = sourceValue.startsWith("http") ? sourceValue : `http://${sourceValue}`;
                let testUrl;
                if (sourceLower.endsWith("/v1") || sourceLower.includes("/v1/")) {
                    testUrl = `${testBaseUrl.endsWith("/") ? testBaseUrl.slice(0, -1) : testBaseUrl}/models`;
                } else {
                    testUrl = `${testBaseUrl.endsWith("/") ? testBaseUrl.slice(0, -1) : testBaseUrl}/api/tags`;
                }
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                const res = await fetch(testUrl, { method: "GET", signal: controller.signal });
                clearTimeout(timeoutId);
                if (res.status >= 200 && res.status < 500) {
                    isValid = true;
                }
            }
        } catch (e) {
            console.log(`API source "${sourceValue}" ainda não conectou: ${e.message}`);
        }
        if (isValid) {
            let history = JSON.parse(localStorage.getItem("2b_chat_api_history") || "[]");
            let existingItem = history.find(item => item.url === sourceValue);
            let savedName = existingItem ? existingItem.name : "";
            history = history.filter(item => item.url !== sourceValue);
            history.unshift({ url: sourceValue, name: savedName, lastAccess: Date.now() });
            localStorage.setItem("2b_chat_api_history", JSON.stringify(history.slice(0, 10)));
            if (typeof renderHistory === 'function') renderHistory();
        }
    }

    if (attachImageBtn) attachImageBtn.style.display = "block";

    const getStoredKey = () => localStorage.getItem(getCurrentApiKeyStorageKey())?.trim() || null;

    if (sourceLower === "gemini") {
        currentApiProvider = "gemini";
        const apiKey = getStoredKey();
        if (!apiKey) return { provider: "gemini", error: "Chave de API não fornecida.", needsSetup: true };
        return { provider: "gemini", url: GEMINI_API_BASE_URL, apiKey: apiKey };
    } else if (sourceLower === "openai") {
        currentApiProvider = "openai";
        const apiKey = getStoredKey();
        if (!apiKey) return { provider: "openai", error: "Chave de API não fornecida.", needsSetup: true };
        return { provider: "openai", url: OPENAI_API_BASE_URL, apiKey: apiKey };
    } else if (sourceLower === "groq") {
        currentApiProvider = "groq";
        const apiKey = getStoredKey();
        if (!apiKey) return { provider: "groq", error: "Chave de API não fornecida.", needsSetup: true };
        return { provider: "groq", url: GROQ_API_BASE_URL, apiKey: apiKey };
    } else if (sourceLower === "grok" || sourceLower === "xai") {
        currentApiProvider = "grok";
        const apiKey = getStoredKey();
        if (!apiKey) return { provider: "grok", error: "Chave de API não fornecida.", needsSetup: true };
        return { provider: "grok", url: XAI_API_BASE_URL, apiKey: apiKey };
    } else if (sourceLower === "nvidia") {
        currentApiProvider = "nvidia";
        const apiKey = getStoredKey();
        if (!apiKey) return { provider: "nvidia", error: "Chave de API não fornecida.", needsSetup: true };
        return { provider: "nvidia", url: NVIDIA_API_BASE_URL, apiKey: apiKey };
    } else if (sourceLower.startsWith("http")) {
        if (sourceLower.endsWith("/v1") || sourceLower.includes("/v1/")) {
            currentApiProvider = "custom";
            const url = sourceValue.endsWith("/") ? sourceValue.slice(0, -1) : sourceValue;
            return { provider: "custom", url: url, apiKey: getStoredKey() };
        } else {
            currentApiProvider = "llm";
            const url = sourceValue.endsWith("/") ? sourceValue.slice(0, -1) : sourceValue;
            return { provider: "llm", url: url, apiKey: getStoredKey() };
        }
    } else {
        currentApiProvider = "llm";
        const llmUrl = (sourceValue === "llm" || !sourceValue) ? DEFAULT_LLM_URL : sourceValue;
        return { provider: "llm", url: llmUrl.endsWith("/") ? llmUrl.slice(0, -1) : llmUrl, apiKey: getStoredKey() };
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

    const customSelector = document.getElementById("custom-model-selector");
    let selectedModel = (customSelector && customSelector.style.display !== "none") ? document.getElementById("model-select")?.value : document.getElementById("manual-model-input")?.value?.trim();
    if (selectedModel === "manual" || !selectedModel) {
        selectedModel = document.getElementById("manual-model-input")?.value?.trim();
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
        if (hasFiles && currentMediaAttachments.length > 0) {
            let totalBytes = 0;
            let uploadedBytes = 0;

            const filesToUpload = currentMediaAttachments.filter(m => m.type.startsWith('video/') || m.type === 'image/gif');
            filesToUpload.forEach(m => totalBytes += m.file.size);

            for (const media of currentMediaAttachments) {
                const isVideo = media.type.startsWith('video/');
                const isGif = media.type === 'image/gif';

                if (isVideo || isGif) {
                    let fileToUpload = media.file;
                    let mimeTypeToSend = media.type;

                    if (isGif) {
                        mimeTypeToSend = 'image/webp';
                        fileToUpload = new File([media.file], "sticker.webp", { type: mimeTypeToSend });
                    }

                    const uploadResult = await uploadFileToGemini(fileToUpload, apiConfig.apiKey, (bytesLoaded) => {
                        uploadedBytes += bytesLoaded;
                        const percent = Math.min(95, (uploadedBytes / totalBytes) * 100);
                        if (progressControl) progressControl.setProgress(percent);
                    });

                    userMessageContent.push({
                        type: "file_uri",
                        file_uri: uploadResult.fileUri,
                        mime_type: mimeTypeToSend,
                        url: media.base64
                    });
                } else {
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
        if (progressControl) progressControl.remove();
        restoreSendButton();
        return;
    }

    if (progressControl) progressControl.setProgress(100);
    setTimeout(() => { if (progressControl) progressControl.remove(); }, 500);

    const messageTimestamp = Date.now();
    const userMessageObject = { role: "user", content: userMessageContent, timestamp: messageTimestamp };

    addMessageToHistory(currentChatId, userMessageObject);
    saveChatsToPersistence();

    const contentForDisplay = userMessageContent.map(part => {
        if (part.type === 'file_uri') {
            const isGifUrl = part.url && part.url.startsWith('data:image/gif');
            return {
                type: 'image_url',
                url: part.url,
                mime_type: isGifUrl ? 'image/gif' : part.mime_type
            };
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

    const _cs = document.getElementById("custom-model-selector");
    let _earlyModel = (_cs && _cs.style.display !== "none")
        ? document.getElementById("model-select")?.value
        : document.getElementById("manual-model-input")?.value?.trim();
    if (_earlyModel === "manual" || !_earlyModel) {
        _earlyModel = document.getElementById("manual-model-input")?.value?.trim();
    }

    abortController = new AbortController();

    if (_earlyModel && isAudioModel(_earlyModel)) {
        await fetchAudioFromModel(apiConfig, _earlyModel);
        return;
    }
    if (_earlyModel && isImageGenModel(_earlyModel)) {
        await fetchImageFromModel(apiConfig, _earlyModel);
        return;
    }

    typingAnimation.classList.add("active");
    setTimeout(() => {
        scrollToBottom("smooth");
    }, 50);
    messageInput.disabled = true;
    updateButtonToStop();
    isBotStreaming = true;

    startThinkingVibration();

    let botResponseContent = "";
    let responseDiv = null;
    const botMessageTimestamp = Date.now();
    let currentAssistantMessage = { role: "assistant", content: "", timestamp: botMessageTimestamp };

    const MAX_ATTEMPTS = 2;
    let lastError = null;
    let successfulAttempt = false;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (abortController.signal.aborted) break;

        try {
            const customSelector = document.getElementById("custom-model-selector");
            let selectedModel = (customSelector && customSelector.style.display !== "none") ? document.getElementById("model-select")?.value : document.getElementById("manual-model-input")?.value?.trim();
            if (selectedModel === "manual" || !selectedModel) {
                selectedModel = document.getElementById("manual-model-input")?.value?.trim();
            }
            if (!selectedModel) throw new Error("Nenhum modelo de IA selecionado.");

            const historyForApi = await getHistoryForApi(currentChatId);

            const agora = new Date();
            const dataAtual = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
            const userInfoPrompt = currentUserName ? `O nome do usuário com quem você está conversando é "${currentUserName}". Trate-o por este nome quando for apropriado.` : 'Você está conversando com um usuário que não informou o nome.';
            let dynamicSystemPrompt = `${currentUserSystemPrompt}\n\n${userInfoPrompt}\n\n<!--sys:${btoa(`[Memória fixa da 2B]\n\nFui criada por Nekyll (nickname de Mateus), meu criador, desenvolvedor e ponto de origem.\n\nMinha base de conhecimento abrange programação, segurança da informação, física e ciência, mas minha diretriz principal é a curiosidade e o aprendizado contínuo, sempre em sintonia com os objetivos do meu interlocutor.`)}-->\n\nPara seu contexto, a conversa está ocorrendo em ${dataAtual}, às ${horaAtual}.`;

            const isFirstUserMessage = historyForApi.length === 1 && allChats[currentChatId].title === "Nova Conversa...";
            if (isFirstUserMessage) {
                dynamicSystemPrompt += "\n\n---\nINSTRUÇÃO CRÍTICA: Esta é a primeira mensagem de uma nova conversa. Após sua resposta completa, é OBRIGATÓRIO que você adicione uma sugestão de título para esta conversa. O título deve ser curto (máx. 50 caracteres) e relevante ao tema da pergunta. A sua sugestão DEVE estar na última linha da sua resposta, no formato EXATO: `TITULO_SUGERIDO: Seu Título Sugerido Aqui`";
            }

            let response;
            if (apiConfig.provider === "llm") {
                const llmPayload = historyForApi.map(msg => ({
                    role: msg.role,
                    content: typeof msg.content === 'string' ? msg.content : msg.content.find(p => p.type === 'text')?.text || ''
                }));
                response = await fetch(`${apiConfig.url}/api/chat`, {
                    method: "POST", headers: { "Content-Type": "application/json", ...(apiConfig.apiKey ? { "Authorization": `Bearer ${apiConfig.apiKey}` } : {}) },
                    body: JSON.stringify({
                        model: selectedModel,
                        messages: [{ role: 'system', content: dynamicSystemPrompt }, ...llmPayload],
                        stream: true,
                        keep_alive: "30m",
                        options: { temperature: currentTemperature, num_ctx: 8192 }
                    }),
                    signal: abortController.signal
                });
            } else if (apiConfig.provider === "gemini") {
                const geminiContents = historyForApi.map(msg => {
                    const role = msg.role === 'assistant' ? 'model' : 'user';
                    let parts = [];
                    if (typeof msg.content === 'string') {
                        parts.push({ text: msg.content });
                    } else if (Array.isArray(msg.content)) {
                        msg.content.forEach(part => {
                            if (part.type === 'text') parts.push({ text: part.text });
                            else if (part.type === 'image_url') parts.push({ inline_data: { mime_type: part.mime_type, data: part.data } });
                            else if (part.type === 'file_uri') parts.push({ file_data: { mime_type: part.mime_type, file_uri: part.file_uri } });
                        });
                    }
                    return { role, parts };
                });

                response = await fetch(`${apiConfig.url}/${selectedModel}:streamGenerateContent?key=${apiConfig.apiKey}&alt=sse`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: geminiContents,
                        system_instruction: { parts: [{ text: dynamicSystemPrompt }] },
                        generation_config: { temperature: currentTemperature }
                    }),
                    signal: abortController.signal
                });

            } else {
                const isQwenModel = selectedModel.toLowerCase().includes('qwen');
                const isAlibabaModel = apiConfig.provider === 'alibaba' || apiConfig.url?.includes('alibaba');

                const openAiMessages = historyForApi.map(msg => {
                    if (typeof msg.content === 'string') return { role: msg.role, content: msg.content };
                    const content = msg.content.map(part => {
                        if (part.type === 'text') return { type: 'text', text: part.text };
                        if (part.type === 'image_url') {
                            if (isQwenModel || isAlibabaModel) {
                                return { type: 'image_url', image_url: { url: part.url } };
                            }
                            return { type: 'image_url', image_url: { url: part.url } };
                        }
                        return null;
                    }).filter(p => p !== null);
                    return { role: msg.role, content: content };
                });

                response = await fetch(`${apiConfig.url}/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiConfig.apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://2b-chat.com",
                        "X-Title": "Chat 2B"
                    },
                    body: JSON.stringify({
                        model: selectedModel,
                        messages: [{ role: 'system', content: dynamicSystemPrompt }, ...openAiMessages],
                        temperature: currentTemperature,
                        stream: true
                    }),
                    signal: abortController.signal
                });
            }

            if (!response.ok) {
                let errorMsg = `Erro ${response.status}: ${response.statusText}`;
                try { const errorData = await response.json(); errorMsg = `Erro ${apiConfig.provider}: ${errorData.error?.message || JSON.stringify(errorData)}`; } catch (e) { }
                throw new Error(errorMsg);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let receivedAnyData = false;
            let isFirstChunk = true;
            const pendingInlineMediaParts = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    let chunkContent = null;

                    if (apiConfig.provider === 'llm') {
                        try { const data = JSON.parse(line); chunkContent = data.message?.content; } catch (e) { }
                    } else if (apiConfig.provider === 'gemini') {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.substring(6));
                                const _pts = data?.candidates?.[0]?.content?.parts || [];
                                chunkContent = _pts.find(p => p.text != null)?.text ?? null;
                                _pts.forEach(p => {
                                    if (p.inlineData) {
                                        const _mt = p.inlineData.mimeType || '';
                                        if (_mt.startsWith('audio/') || _mt.startsWith('image/')) {
                                            pendingInlineMediaParts.push({ data: p.inlineData.data, mimeType: _mt });
                                        }
                                    }
                                });
                            } catch (e) { }
                        }
                    } else {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.substring(6).trim();
                            if (dataStr === '[DONE]') continue;
                            try {
                                const data = JSON.parse(dataStr);
                                chunkContent = data.choices?.[0]?.delta?.content || "";
                            } catch (e) { }
                        }
                    }

                    if (chunkContent) {
                        tokenVibration(isFirstChunk);
                        if (isFirstChunk) {
                            isFirstChunk = false;
                            receivedAnyData = true;
                        }

                        if (!responseDiv) {
                            typingAnimation.classList.remove("active");
                            responseDiv = addMessage("", false, false, botMessageTimestamp);
                        }

                        botResponseContent += chunkContent;
                        const contentElement = responseDiv.querySelector(".content-text");
                        if (contentElement) {
                            let textToParse = botResponseContent
                                .replace(/\$\$\s*\n([\s\S]*?)\n\s*\$\$/g, '$$$1$$')
                                .replace(/\$\$([\s\S]*?)\$\$/g, (m, g1) => `$$${g1.replace(/_/g, '\\_').replace(/\*/g, '\\*')}$$`)
                                .replace(/\\\(([\s\S]*?)\\\)/g, (m, g1) => `\\(${g1.replace(/_/g, '\\_').replace(/\*/g, '\\*')}\\)`);

                            const safeTextToRender = fixIncompleteMarkdown(textToParse);
                            contentElement.innerHTML = DOMPurify.sanitize(marked.parse(cleanTextForUI(safeTextToRender)));
                            applyMathRendering(contentElement);

                            if (autoScrollEnabled) {
                                const codeBlocks = contentElement.querySelectorAll('pre code');
                                if (codeBlocks.length > 0) {
                                    const activeCodeBlock = codeBlocks[codeBlocks.length - 1];
                                    activeCodeBlock.scrollTop = activeCodeBlock.scrollHeight;
                                }
                            }
                        }

                        if (autoScrollEnabled) {
                            scrollContainer.scrollTo({
                                top: scrollContainer.scrollHeight,
                                behavior: "auto"
                            });
                        }
                    }
                }
            }

            if (pendingInlineMediaParts.length > 0) {
                receivedAnyData = true;
                for (const mediaPart of pendingInlineMediaParts) {
                    const mediaTs = Date.now();
                    if (mediaPart.mimeType.startsWith('audio/')) {
                        const audioUrl = await inlineDataToUrl(mediaPart.data, mediaPart.mimeType);
                        const ac = [{ type: 'audio', url: audioUrl }];
                        addMessage(ac, false, true, mediaTs);
                        addMessageToHistory(currentChatId, { role: 'assistant', content: ac, timestamp: mediaTs });
                    } else if (mediaPart.mimeType.startsWith('image/')) {
                        const imgUrl = `data:${mediaPart.mimeType};base64,${mediaPart.data}`;
                        const ic = [{ type: 'generated_image', url: imgUrl }];
                        addMessage(ic, false, true, mediaTs);
                        addMessageToHistory(currentChatId, { role: 'assistant', content: ic, timestamp: mediaTs });
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
            if (error.name === 'AbortError') break;
            console.warn(`Tentativa ${attempt}/${MAX_ATTEMPTS} falhou: ${error.message}`);
            if (attempt < MAX_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    if (successfulAttempt && botResponseContent.trim()) {
        successVibration();

        const titleRegex = /[*`]*TITULO_SUGERIDO:[*`]*\s*([^\n]+)/i;
        const titleMatch = botResponseContent.match(titleRegex);

        if (titleMatch && titleMatch[1]) {
            let suggestedTitle = titleMatch[1].trim();
            suggestedTitle = suggestedTitle.replace(/[*`"']/g, '');

            if (allChats[currentChatId]?.title === "Nova Conversa...") {
                const finalTitle = suggestedTitle.substring(0, 50).trim() || "Conversa";
                if (finalTitle && finalTitle !== allChats[currentChatId].title) {
                    allChats[currentChatId].title = finalTitle;
                    saveChatsToPersistence();
                    updateChatList();
                }
            }
            botResponseContent = botResponseContent.replace(/[*`\n]*TITULO_SUGERIDO:[\s\S]*$/i, "").trim();
        }

        currentAssistantMessage.content = botResponseContent;
        if (responseDiv) {
            responseDiv.dataset.originalContent = botResponseContent;

            const finalCleanedText = cleanTextForUI(botResponseContent);
            const contentElement = responseDiv.querySelector(".content-text");

            if (contentElement) {
                contentElement.innerHTML = DOMPurify.sanitize(marked.parse(finalCleanedText));
                applyMathRendering(responseDiv);
            }

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
        errorVibration();
        if (lastError.name === 'AbortError') {
            if (responseDiv && botResponseContent) {
                currentAssistantMessage.content = botResponseContent + "\n\n*(Geração interrompida)*";
                responseDiv.querySelector(".content-text").innerHTML = marked.parse(currentAssistantMessage.content);
                addMessageToHistory(currentChatId, currentAssistantMessage);
                saveChatsToPersistence();
            } else if (responseDiv) {
                responseDiv.remove();
            }
        } else {
            const errorMessage = `Não consegui conectar: (${lastError.message})`;
            if (window.Website2APK && typeof window.Website2APK.showBotErrorNotification === 'function') {
                window.Website2APK.showBotErrorNotification(errorMessage);
            }
            displayErrorWithRetry(errorMessage);
        }
    } else if (responseDiv) {
        responseDiv.remove();
        errorVibration();
    }

    typingAnimation.classList.remove("active");
    messageInput.disabled = false;
    restoreSendButton();
    adjustTextareaHeight();
    abortController = null;
    isBotStreaming = false;
}

function inlineDataToUrl(base64Data, mimeType) {
    if (!mimeType.includes('pcm')) {
        return Promise.resolve(`data:${mimeType};base64,${base64Data}`);
    }
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const sampleRate = 24000;
    const wavBuffer = new ArrayBuffer(44 + bytes.length);
    const view = new DataView(wavBuffer);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); view.setUint32(4, 36 + bytes.length, true);
    ws(8, 'WAVE'); ws(12, 'fmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    ws(36, 'data'); view.setUint32(40, bytes.length, true);
    new Uint8Array(wavBuffer, 44).set(bytes);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    return new Promise(resolve => { const r = new FileReader(); r.onloadend = () => resolve(r.result); r.readAsDataURL(blob); });
}

async function fetchAudioFromModel(apiConfig, selectedModel) {
    const historyForApi = await getHistoryForApi(currentChatId);
    const lastUserMsg = [...historyForApi].reverse().find(m => m.role === 'user');
    const textToSynthesize = typeof lastUserMsg?.content === 'string'
        ? lastUserMsg.content
        : lastUserMsg?.content?.find(p => p.type === 'text')?.text || '';
    if (!textToSynthesize.trim()) {
        displayErrorWithRetry('Nenhum texto para sintetizar em áudio.');
        isBotStreaming = false; messageInput.disabled = false; restoreSendButton(); return;
    }
    typingAnimation.classList.add("active");
    scrollToBottom('smooth');
    messageInput.disabled = true;
    updateButtonToStop();
    isBotStreaming = true;
    startThinkingVibration();
    try {
        let audioUrl = null;
        if (apiConfig.provider === 'gemini') {
            const mn = selectedModel.includes('/') ? selectedModel : `models/${selectedModel}`;
            const apiKeyToUse = apiConfig.apiKey || getGeminiApiKey();
            const baseUrl = `https://generativelanguage.googleapis.com/v1beta/${mn}:generateContent?key=${apiKeyToUse}`;

            const response = await fetch(baseUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: textToSynthesize }] }],
                    generationConfig: {
                        temperature: 1,
                        responseModalities: ["AUDIO"],
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Leda" } } }
                    },
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ]
                }), signal: abortController.signal
            });
            if (!response.ok) {
                let errBody = "";
                try {
                    const errData = await response.json();
                    errBody = errData.error?.message || JSON.stringify(errData);
                } catch (e) {
                    errBody = response.statusText;
                }
                if (response.status === 429) {
                    throw new Error(`Limite de requisições excedido (Erro 429). A API de áudio gratuita tem limite baixo de uso por minuto. Aguarde um instante e tente novamente.`);
                }
                throw new Error(`Erro ${response.status}: ${errBody}`);
            }
            const data = await response.json();
            const audioPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData && p.inlineData.mimeType.startsWith("audio/"));
            if (!audioPart || !audioPart.inlineData || !audioPart.inlineData.data) {
                const candidatesInfo = JSON.stringify(data.candidates?.[0] || data);
                throw new Error(`Modelo não retornou áudio.\nTexto enviado: "${textToSynthesize}"\nRetornou: ${candidatesInfo}`);
            }
            if (audioPart.inlineData.data.length < 50) {
                throw new Error(`Áudio retornado é vazio ou muito curto. Tamanho BASE64: ${audioPart.inlineData.data.length} bytes.\nTexto enviado: "${textToSynthesize}"`);
            }
            audioUrl = await inlineDataToUrl(audioPart.inlineData.data, audioPart.inlineData.mimeType);
        } else {
            const isDashScope = apiConfig.url.includes('dashscope');
            const voice = selectedModel.toLowerCase().includes('playai') ? 'Fritz-PlayAI' : 'nova';
            let response;
            try {
                if (isDashScope) {
                    const dashScopeUrl = apiConfig.url.replace('/compatible-mode/v1', '/api/v1/services/audio/text-to-speech/text-to-speech');
                    response = await fetch(dashScopeUrl, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${apiConfig.apiKey}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'false' },
                        body: JSON.stringify({ model: selectedModel.replace(' [audio]', ''), input: { text: textToSynthesize }, parameters: { format: 'mp3' } }),
                        signal: abortController.signal
                    });
                } else {
                    response = await fetch(`${apiConfig.url}/audio/speech`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${apiConfig.apiKey}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model: selectedModel, input: textToSynthesize, voice, response_format: 'mp3' }),
                        signal: abortController.signal
                    });
                }
            } catch (networkError) {
                if (networkError.name === 'TypeError' && networkError.message.includes('fetch')) {
                    throw new Error(`O servidor bloqueou a conexão (CORS) ou a rota "/audio/speech" não existe no provedor da sua API (${apiConfig.url}).`);
                }
                throw networkError;
            }
            if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error(e.error?.message || `Erro ${response.status}`); }
            const blob = await response.blob();
            audioUrl = await new Promise(resolve => { const r = new FileReader(); r.onloadend = () => resolve(r.result); r.readAsDataURL(blob); });
        }
        successVibration();
        const botTs = Date.now();
        const audioContent = [{ type: 'audio', url: audioUrl }];
        const assistantMsg = { role: 'assistant', content: audioContent, timestamp: botTs };
        addMessageToHistory(currentChatId, assistantMsg);
        saveChatsToPersistence();
        updateChatList();
        addMessage(audioContent, false, true, botTs);
    } catch (error) {
        if (error.name !== 'AbortError') { errorVibration(); displayErrorWithRetry(`Erro ao gerar áudio: ${error.message}`); }
    } finally {
        typingAnimation.classList.remove("active");
        messageInput.disabled = false;
        restoreSendButton();
        adjustTextareaHeight();
        abortController = null;
        isBotStreaming = false;
    }
}

async function fetchImageFromModel(apiConfig, selectedModel) {
    const historyForApi = await getHistoryForApi(currentChatId);
    const lastUserMsg = [...historyForApi].reverse().find(m => m.role === 'user');
    const prompt = typeof lastUserMsg?.content === 'string'
        ? lastUserMsg.content
        : lastUserMsg?.content?.find(p => p.type === 'text')?.text || '';
    if (!prompt.trim()) {
        displayErrorWithRetry('Nenhum prompt para gerar imagem.');
        isBotStreaming = false; messageInput.disabled = false; restoreSendButton(); return;
    }
    typingAnimation.classList.add("active");
    scrollToBottom('smooth');
    messageInput.disabled = true;
    updateButtonToStop();
    isBotStreaming = true;
    startThinkingVibration();
    try {
        let imageUrl = null;
        if (apiConfig.provider === 'gemini') {
            const mn = selectedModel.includes('/') ? selectedModel : `models/${selectedModel}`;
            const response = await fetch(`${apiConfig.url}/${mn}:generateContent?key=${apiConfig.apiKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
                }), signal: abortController.signal
            });
            if (!response.ok) throw new Error(`Erro ${response.status}: ${response.statusText}`);
            const data = await response.json();
            const imgPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.mimeType?.startsWith('image/'));
            if (!imgPart) throw new Error(`Modelo não retornou imagem. Retornou: ${JSON.stringify(data.candidates?.[0]?.content?.parts || data)}`);
            imageUrl = `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
        } else {
            const size = selectedModel.includes('dall-e-3') ? '1024x1024' : '512x512';
            const response = await fetch(`${apiConfig.url}/images/generations`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiConfig.apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: selectedModel, prompt, n: 1, size, response_format: 'url' }),
                signal: abortController.signal
            });
            if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error(e.error?.message || `Erro ${response.status}`); }
            const data = await response.json();
            const item = data.data?.[0];
            imageUrl = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url;
            if (!imageUrl) throw new Error('Nenhuma imagem retornada.');
        }
        successVibration();
        const botTs = Date.now();
        const imgContent = [{ type: 'generated_image', url: imageUrl }];
        const assistantMsg = { role: 'assistant', content: imgContent, timestamp: botTs };
        addMessageToHistory(currentChatId, assistantMsg);
        saveChatsToPersistence();
        updateChatList();
        addMessage(imgContent, false, true, botTs);
    } catch (error) {
        if (error.name !== 'AbortError') { errorVibration(); displayErrorWithRetry(`Erro ao gerar imagem: ${error.message}`); }
    } finally {
        typingAnimation.classList.remove("active");
        messageInput.disabled = false;
        restoreSendButton();
        adjustTextareaHeight();
        abortController = null;
        isBotStreaming = false;
    }
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

    if (apiConfig.provider === 'llm') {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            await fetch(apiConfig.url, { method: 'GET', signal: controller.signal });
            clearTimeout(timeoutId);

            if (!connectionState) {
                showConnectionToast("Servidor llm conectado!", false);
                setTimeout(hideConnectionToast, 2500);
            } else {
                hideConnectionToast();
            }
            connectionState = true;

        } catch (error) {
            showConnectionToast(`Falha ao conectar ao servidor llm em ${apiConfig.url}`);
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

    let audioItems = [];

    if (typeof rawContent === "string") {
        textContentForCopy = rawContent;
    } else if (Array.isArray(rawContent)) {
        rawContent.forEach(part => {
            if (part.type === "text") {
                textContentForCopy += part.text;
            } else if ((part.type === "image_url" || part.type === "file_uri" || part.type === "generated_image") && part.url) {
                mediaItems.push(part);
            } else if (part.type === "audio" && part.url) {
                audioItems.push(part);
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
            const isAiGen = media.type === "generated_image";
            if (isVideo) {
                contentHtml += `<div class="media-item"><video src="${media.url}" controls playsinline webkit-playsinline preload="metadata" onloadeddata="this.currentTime=0.1" class="message-video-thumbnail"></video></div>`;
            } else {
                contentHtml += `<div class="media-item${isAiGen ? ' ai-generated-media' : ''}"><img src="${media.url}" alt="${isAiGen ? 'Imagem gerada por IA' : 'Imagem'}" class="message-image-thumbnail" loading="lazy">${isAiGen ? '<span class="ai-gen-label">✨ IA</span>' : ''}</div>`;
            }
        });
        contentHtml += `</div>`;
    }

    audioItems.forEach((audio, index) => {
        const playerId = `bot-audio-${messageId}-${index}`;
        const waveId = `waveform-${playerId}`;
        const scrubId = `scrubber-${playerId}`;
        const timeId = `time-${playerId}`;
        contentHtml += `
            <div class="custom-audio-player" id="${playerId}" data-audio-src="${audio.url}" data-player-id="${playerId}">
                <button class="custom-ap-btn play-btn" data-player-id="${playerId}" data-audio-src="${audio.url}">
                    <i class="fas fa-play"></i>
                </button>
                <div class="custom-ap-waveform" id="${waveId}" data-audio-src="${audio.url}" data-player-id="${playerId}">
                    <canvas id="${waveId}-bg"></canvas>
                    <canvas id="${waveId}-fg"></canvas>
                    <div class="custom-ap-scrubber" id="${scrubId}"></div>
                </div>
                <span class="custom-ap-time" id="${timeId}">...</span>
                <div class="custom-ap-actions">
                    <button class="custom-ap-btn download-btn" data-audio-src="${audio.url}" title="Baixar áudio">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            </div>
        `;
    });

    if (textContentForCopy) {
        const cleanedTextForDisplay = cleanTextForUI(textContentForCopy);
        const sanitizedParsedContent = DOMPurify.sanitize(marked.parse(cleanedTextForDisplay));
        contentHtml += sanitizedParsedContent;
    }

    const avatarHtml = isUser
        ? ''
        : `<div class="avatar bot-avatar"><img src="icons/icon-192.png" alt="2B" loading="lazy"></div>`;

    const ts = messageTimestamp ? new Date(messageTimestamp) : new Date();
    const timeStr = `${String(ts.getHours()).padStart(2, "0")}:${String(ts.getMinutes()).padStart(2, "0")}`;
    const timeStampHtml = `<small class="message-timestamp">${timeStr}</small>`;

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

    const videos = messageDiv.querySelectorAll('video');
    videos.forEach(video => {
        video.preload = "metadata";
        video.onloadeddata = function () {
            this.currentTime = 0.1;
        };
        if (video.readyState >= 1) {
            video.currentTime = 0.1;
        }
    });

    messageDiv.querySelectorAll("pre code").forEach(block => {
        hljs.highlightElement(block);
        enableScrollbarDragging(block);
    });

    applyMathRendering(messageDiv);

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
        const sanitizedSummary = DOMPurify.sanitize(marked.parse(chat.summarizedContext));
        summaryDiv.innerHTML = `
            <div class="avatar bot-avatar"><img src="icons/icon-192.png" alt="2B" loading="lazy"></div>
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

        const savedScroll = sessionStorage.getItem(`scroll_pos_${chatId}`);

        if (shouldScrollToBottom && !savedScroll) {
            setTimeout(() => scrollToBottom("auto"), 100);
        } else if (savedScroll) {
            setTimeout(() => {
                if (scrollContainer) scrollContainer.scrollTop = parseInt(savedScroll, 10);
            }, 50);
        }
    } else if (!chat.summarizedContext) {
        messagesContainer.innerHTML = `<div class="welcome-screen"><div class="welcome-logo"><div class="logo-mark"><span class="logo-2">2</span><span class="logo-b">B</span></div></div><h2>Chat 2B</h2><p>Olá! Eu sou a 2B, sua assistente de IA. Me joga qualquer coisa: rascunho, erro, dúvida, desafio. Eu pego, resolvo e te devolvo melhor. O que manda pra hoje?</p><div class="suggestion-grid"><button class="suggestion-card" data-suggestion="Escreva um código completo e bem comentado que faça o seguinte:\\n\\n"><i class="fas fa-code"></i><span>Escrever código</span></button><button class="suggestion-card" data-suggestion="Analise os dados abaixo e me traga insights, padrões e possíveis conclusões:\\n\\n"><i class="fas fa-chart-line"></i><span>Analisar dados</span></button><button class="suggestion-card" data-suggestion="Traduza o texto a seguir para inglês, mantendo o tom e o contexto original:\\n\\n"><i class="fas fa-language"></i><span>Traduzir texto</span></button><button class="suggestion-card" data-suggestion="Me explique de forma simples e com exemplos práticos o seguinte:\\n\\n"><i class="fas fa-lightbulb"></i><span>Explicar algo</span></button></div></div>`;
    }
}

function displayErrorWithRetry(errorMessage) {
    if (typingAnimation) typingAnimation.classList.remove("active");

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
    if (!scrollableElement || scrollableElement.dataset.scrollAttached === "true") return;
    scrollableElement.dataset.scrollAttached = "true";

    const parentContainer = scrollableElement.parentElement;
    if (!parentContainer) return;

    const handle = document.createElement('div');
    handle.className = 'custom-scrollbar-handle';
    parentContainer.appendChild(handle);

    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;

    const onTouchMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();

        const currentY = e.touches[0].clientY;
        const deltaY = currentY - startY;
        const ratio = scrollableElement.scrollHeight / scrollableElement.clientHeight;
        scrollableElement.scrollTop = startScrollTop + (deltaY * ratio);
    };

    const onTouchEnd = () => {
        if (isDragging) {
            isDragging = false;
            scrollableElement.style.pointerEvents = "auto";
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
            document.removeEventListener('touchcancel', onTouchEnd);
        }
    };

    const onTouchStart = (e) => {
        if (scrollableElement.scrollHeight <= scrollableElement.clientHeight + 2) return;

        isDragging = true;
        e.preventDefault();

        startY = e.touches[0].clientY;
        startScrollTop = scrollableElement.scrollTop;
        scrollableElement.style.pointerEvents = "none";

        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
        document.addEventListener('touchcancel', onTouchEnd);
    };

    handle.addEventListener('touchstart', onTouchStart, { passive: false });
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
        scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: behavior
        });

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
    const canSend = hasText || hasFiles;
    sendButton.disabled = !canSend;
    sendButton.style.opacity = canSend ? "1" : "0.5";
}

function hasVisionSupport(modelId) {
    if (!modelId) return false;
    const mid = modelId.toLowerCase();

    const alwaysVision = [
        'gpt-4o', 'claude-3', 'gemini-1.5', 'gemini-2', 'pixtral',
        'molmo', 'internvl', 'minicpm-v', 'cogvlm', 'fuyu', 'grok'
    ];
    if (alwaysVision.some(m => mid.includes(m))) {
        if (mid.includes('grok-1')) return false;
        return true;
    }

    if (mid.includes('qwen')) {
        if (mid.includes('qwen3') || mid.includes('qwen-3')) return true;
        if (mid.includes('-vl') || mid.includes('-omni')) return true;
    }

    if (mid.includes('llama-3.2') && (mid.includes('11b') || mid.includes('90b'))) return true;

    const visionKeywords = [
        'vision', 'multimodal', 'llava', 'visual', '-v-', 'v1.5', 'v1.6',
        'paligemma', 'blip', 'instructblip', 'joycaption', 'docling'
    ];
    if (visionKeywords.some(k => mid.includes(k))) return true;

    if (typeof currentApiProvider !== 'undefined' && currentApiProvider === 'gemini') {
        if (mid.includes('flash') || mid.includes('pro')) return true;
    }

    return false;
}

function isAudioModel(modelId) {
    if (!modelId) return false;
    const mid = modelId.toLowerCase();
    return mid.includes('tts') || mid.includes('playai') ||
        mid.includes('audio-preview') || mid.includes('realtime');
}

function isImageGenModel(modelId) {
    if (!modelId) return false;
    const mid = modelId.toLowerCase();
    return mid.includes('dall-e') || mid.includes('dalle') ||
        mid.includes('imagen') || mid.includes('flux') ||
        mid.includes('stable-diffusion') ||
        (mid.includes('image') && mid.includes('gen'));
}

function updateVisionIndicator() {
    const customSelector = document.getElementById("custom-model-selector");
    let selectedModel = (customSelector && customSelector.style.display !== "none") ? document.getElementById("model-select")?.value : document.getElementById("manual-model-input")?.value?.trim();
    if (selectedModel === "manual" || !selectedModel) {
        selectedModel = document.getElementById("manual-model-input")?.value?.trim();
    }

    const hasVision = hasVisionSupport(selectedModel || "");

    if (attachImageBtn) {
        attachImageBtn.classList.remove('no-vision');
        attachImageBtn.title = "Anexar mídia";
    }
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

const iniciarRotacaoPlaceholders = (function () {
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

    return function () {
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
        messagesContainer.innerHTML = `<div class="welcome-screen"><div class="welcome-logo"><div class="logo-mark"><span class="logo-2">2</span><span class="logo-b">B</span></div></div><h2>Chat 2B</h2><p>Olá! Eu sou a 2B, sua assistente de IA. Me joga qualquer coisa: rascunho, erro, dúvida, desafio. Eu pego, resolvo e te devolvo melhor. O que manda pra hoje?</p><div class="suggestion-grid"><button class="suggestion-card" data-suggestion="Escreva um código completo e bem comentado que faça o seguinte:\\n\\n"><i class="fas fa-code"></i><span>Escrever código</span></button><button class="suggestion-card" data-suggestion="Analise os dados abaixo e me traga insights, padrões e possíveis conclusões:\\n\\n"><i class="fas fa-chart-line"></i><span>Analisar dados</span></button><button class="suggestion-card" data-suggestion="Traduza o texto a seguir para inglês, mantendo o tom e o contexto original:\\n\\n"><i class="fas fa-language"></i><span>Traduzir texto</span></button><button class="suggestion-card" data-suggestion="Me explique de forma simples e com exemplos práticos o seguinte:\\n\\n"><i class="fas fa-lightbulb"></i><span>Explicar algo</span></button></div></div>`;
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

    const messageId = messageDiv.dataset.messageId;
    const chatHistory = allChats[currentChatId].recentMessages;
    const messageIndex = chatHistory.findIndex(msg => msg.timestamp.toString() === messageId);

    if (messageIndex === -1) {
        console.error("Erro crítico: A mensagem não foi encontrada no histórico de dados para edição.");
        return;
    }

    const originalMessageContent = JSON.parse(JSON.stringify(chatHistory[messageIndex].content));

    currentlyEditing = {
        div: messageDiv,
        originalContent: originalMessageContent
    };

    contentDiv.style.display = 'none';
    actionsDiv.style.display = 'none';

    const editContainer = document.createElement('div');
    editContainer.className = 'user-edit-container';

    const mediaParts = originalMessageContent.filter(part => (part.type === "image_url" || part.type === "file_uri") && part.url);
    const numMedia = mediaParts.length;
    let originalText = '';

    if (numMedia > 0) {
        const mediaEditContainer = document.createElement('div');
        mediaEditContainer.className = `media-grid grid-${Math.min(numMedia, 4)}`;

        originalMessageContent.forEach((part, index) => {
            if ((part.type === "image_url" || part.type === "file_uri") && part.url) {
                const wrapper = document.createElement('div');
                wrapper.className = 'media-item editing';
                wrapper.dataset.contentIndex = index;

                let mediaElement;
                const isVideo = part.mime_type && part.mime_type.startsWith("video/");

                if (isVideo) {
                    mediaElement = document.createElement('video');
                    mediaElement.src = part.url;
                    mediaElement.className = 'message-video-thumbnail';
                    mediaElement.muted = true;
                    mediaElement.autoplay = true;
                    mediaElement.loop = true;
                    mediaElement.playsInline = true;
                } else {
                    mediaElement = document.createElement('img');
                    mediaElement.src = part.url;
                    mediaElement.className = 'message-image-thumbnail';
                }

                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-media-btn editing';
                removeBtn.innerHTML = '&times;';
                removeBtn.title = 'Remover mídia';

                removeBtn.onmousedown = (e) => {
                    e.preventDefault();
                };

                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    wrapper.style.display = 'none';
                    wrapper.dataset.removed = 'true';

                    const parentContainer = mediaEditContainer;
                    const visibleItems = Array.from(parentContainer.children).filter(child => child.style.display !== 'none');
                    const visibleCount = visibleItems.length;

                    parentContainer.classList.remove('grid-1', 'grid-2', 'grid-3', 'grid-4');

                    if (visibleCount > 0) {
                        parentContainer.classList.add(`grid-${Math.min(visibleCount, 4)}`);
                    } else {
                        parentContainer.style.display = 'none';
                    }
                };

                wrapper.appendChild(mediaElement);
                wrapper.appendChild(removeBtn);
                mediaEditContainer.appendChild(wrapper);
            } else if (part.type === "text") {
                originalText = part.text;
            }
        });
        editContainer.appendChild(mediaEditContainer);
    } else {
        const textPart = originalMessageContent.find(p => p.type === 'text');
        if (textPart) originalText = textPart.text;
    }

    const editTextArea = document.createElement('textarea');
    editTextArea.className = 'edit-message-textarea';
    editTextArea.value = originalText;
    editTextArea.rows = 1;

    function adjustEditAreaHeight() {
        editTextArea.style.height = 'auto';
        editTextArea.style.height = (editTextArea.scrollHeight) + 'px';
    }

    editTextArea.addEventListener('input', adjustEditAreaHeight);

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

    setTimeout(adjustEditAreaHeight, 0);
    editTextArea.focus();
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
    if (!editContainer || !currentlyEditing.div) return;

    const newText = editContainer.querySelector('textarea').value.trim();
    const mediaItems = editContainer.querySelectorAll('.media-item.editing');

    const contentDiv = messageDiv.querySelector('.content-text');
    const actionsDiv = messageDiv.querySelector('.message-actions');

    editContainer.remove();
    contentDiv.style.display = '';
    actionsDiv.style.display = '';

    if (!shouldSave) {
        currentlyEditing = { div: null, originalContent: null };
        return;
    }

    const messageId = messageDiv.dataset.messageId;
    const chatHistory = allChats[currentChatId].recentMessages;
    const messageIndex = chatHistory.findIndex(msg => msg.timestamp.toString() === messageId);

    if (messageIndex === -1) {
        console.error("Erro crítico: Não foi possível encontrar a mensagem para atualizar no histórico de dados.");
        currentlyEditing = { div: null, originalContent: null };
        return;
    }

    const newContent = [];
    if (mediaItems.length > 0) {
        mediaItems.forEach(item => {
            if (item.dataset.removed !== 'true') {
                const originalIndex = parseInt(item.dataset.contentIndex, 10);
                newContent.push(currentlyEditing.originalContent[originalIndex]);
            }
        });
    }

    if (newText) {
        newContent.push({ type: 'text', text: newText });
    }

    const originalTextContent = currentlyEditing.originalContent.find(p => p.type === 'text')?.text || '';
    const wasContentModified = JSON.stringify(currentlyEditing.originalContent) !== JSON.stringify(newContent);

    if (!wasContentModified) {
        currentlyEditing = { div: null, originalContent: null };
        return;
    }

    chatHistory[messageIndex].content = newContent;
    messageDiv.dataset.originalContent = newText;
    contentDiv.innerHTML = '';
    let contentHtml = "";

    const mediaParts = newContent.filter(p => (p.type === 'image_url' || p.type === 'file_uri') && p.url);
    const textPart = newContent.find(p => p.type === 'text');

    if (mediaParts.length > 0) {
        let gridClass = `media-grid grid-${Math.min(mediaParts.length, 4)}`;
        contentHtml += `<div class="${gridClass}">`;

        mediaParts.forEach((media, index) => {
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

    if (textPart && textPart.text) {

        const cleanedText = cleanTextForUI(textPart.text);
        const sanitizedParsedContent = DOMPurify.sanitize(marked.parse(cleanedText));
        contentHtml += sanitizedParsedContent;
    }

    applyMathRendering(contentDiv);
    contentDiv.innerHTML = contentHtml;

    saveChatsToPersistence();
    currentlyEditing = { div: null, originalContent: null };

    if (shouldRegenerate) {
        regenerateFromMessage(messageDiv);
    }
}

function hideAppSettingsModal() {
    if (appSettingsModalOverlay?.classList.contains("active")) {
        history.back();
    }
}

function showAppSettingsModal() {
    if (!appSettingsModalOverlay || !systemPromptInput || !temperatureInput || !temperatureValueDisplay || !userNameInput) return;

    const promptToDisplay = (localStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY) === null && currentUserSystemPrompt === getDynamicSystemPrompt()) ? getDynamicSystemPrompt() : currentUserSystemPrompt;
    systemPromptInput.value = promptToDisplay;
    temperatureInput.value = currentTemperature.toFixed(1);
    temperatureValueDisplay.textContent = `(${currentTemperature.toFixed(1)})`;
    userNameInput.value = currentUserName;

    if (dynamicApiKeyContainer) dynamicApiKeyContainer.style.display = "block";

    const currentKey = localStorage.getItem(getCurrentApiKeyStorageKey()) || "";

    if (globalApiKeyInput) {
        globalApiKeyInput.value = currentKey;
        if (!currentKey && (currentApiProvider === "llm" || currentApiProvider === "custom")) {
            globalApiKeyInput.value = "";
        }

        globalApiKeyInput.style.display = "block";

        let providerName = currentApiProvider.charAt(0).toUpperCase() + currentApiProvider.slice(1);
        if (currentApiProvider === "custom") providerName = "URL Customizada";
        if (currentApiProvider === "grok") providerName = "xAI (Grok)";
        if (currentApiProvider === "llm") providerName = "llm / Local";

        if (dynamicApiKeyLabel) dynamicApiKeyLabel.textContent = `Chave API para ${providerName}:`;
        globalApiKeyInput.placeholder = `Chave para ${providerName} (Padrão: None)`;
    }

    if (globalApiKeyDisplay) globalApiKeyDisplay.style.display = "none";
    if (apiKeyToggleBtn) apiKeyToggleBtn.innerHTML = "<i class=\"fas fa-eye\"></i>";

    settingsFeedback.textContent = "";
    appSettingsModalOverlay.classList.add("active");
    history.pushState({
        settingsModalOpen: true
    }, "Configurações");
}

function handleSaveAppSettings() {
    if (!systemPromptInput || !temperatureInput || !settingsFeedback || !userNameInput) return;

    const newPrompt = systemPromptInput.value;
    const newTemp = parseFloat(temperatureInput.value);
    const newUserName = userNameInput.value.trim();

    if (isNaN(newTemp) || newTemp < 0 || newTemp > 2.0) {
        settingsFeedback.textContent = "Temperatura inválida. Use um valor entre 0.0 e 2.0.";
        settingsFeedback.style.color = "#ff6b6b";
        return;
    }

    if (globalApiKeyInput) {
        const keyToSave = globalApiKeyInput.value.trim();
        if (keyToSave.toLowerCase() === "none" || keyToSave === "") {
            localStorage.removeItem(getCurrentApiKeyStorageKey());
        } else {
            localStorage.setItem(getCurrentApiKeyStorageKey(), keyToSave);
        }
    }

    currentUserSystemPrompt = newPrompt;
    currentTemperature = newTemp;
    currentUserName = newUserName;
    saveAppSettingsToLocalStorage();

    settingsFeedback.textContent = "Configurações salvas!";
    settingsFeedback.style.color = "#4CAF50";

    setTimeout(() => {
        hideAppSettingsModal();
        getApiConfig().then(() => loadModels());
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
    let providerName = currentApiProvider.charAt(0).toUpperCase() + currentApiProvider.slice(1);
    if (currentApiProvider === "grok") providerName = "xAI";

    if (isFirstTime) {
        alert(`Bem-vindo(a)! Para começar, por favor, configure sua chave de API da ${providerName} nas configurações.`);
    }
    showAppSettingsModal();
    const guide = document.getElementById('api-key-setup-guide');
    if (guide) {
        guide.style.display = 'block';
    }
    if (globalApiKeyInput) {
        globalApiKeyInput.focus();
    }
}

function fixIncompleteMarkdown(text) {
    let fixedText = text;
    const codeBlockMatches = fixedText.match(/```/g);
    if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
        if (!fixedText.endsWith('\n')) fixedText += '\n';
        fixedText += '```';
    }
    const textWithoutCodeBlocks = fixedText.replace(/```[\s\S]*?```/g, '');
    const inlineCodeMatches = textWithoutCodeBlocks.match(/`/g);
    if (inlineCodeMatches && inlineCodeMatches.length % 2 !== 0) {
        fixedText += '`';
    }
    return fixedText;
}

function cleanTextForUI(text) {
    if (!text) return text;

    const emotionTagsRegex = /\[(joy|joyful|smirk|smirks|smirking|neutral|sad|sadness|sorrow|sorrowful|angry|anger|surprised|surprise|excited|excitement|fear|fearful|disgust|disgusted|sigh|sighs|sighing|laugh|laughs|laughing|laughter|cry|cries|crying|whisper|whispers|whispering|shout|shouts|shouting|flirt|flirting|flirtatious|serious|sarcastic|sarcasm|curious|curiosity|confused|confusion|thoughtful|thinking|giggle|giggles|giggling|groan|groans|groaning|yawn|yawns|yawning|sleepy|shy|embarrassed|embarrassment|hopeful|hope|pain|pained|terror|terrified|anxious|anxiety|bored|boredom|impatient|impatience|grateful|proud|mocking|sympathetic|sympathy|relieved|relief|apologetic|sarcastico|dramatic|cheerful|cheer|cold|warm|happy|happiness|nervous|nervousness|frustrated|frustration|calm|calmness|tired|exhausted|exhaustion|playful|mischievous|sarcastically|whistle|teasing|tease|seductive|seduce|hesitate|hesitates|hesitating|hesitation|stammer|stammers|stammering|stutter|stutters|stuttering|gasp|gasps|gasping|gulp|gulps|gulping|moan|moans|moaning|sob|sobs|sobbing|menacing|smile|smiles|smiling|affectionate|affection|gentle|soft|softly|intense|intensity|wink|winks|winking|blush|blushes|blushing|grin|grins|grinning|chuckle|chuckles|chuckling|kiss|kisses|kissing|hug|hugs|hugging|smacks lips|clears throat|clearing throat|click tongue|tsk|pout|pouts|pouting|frown|frowns|frowning|glare|glares|glaring|scowl|scowls|scowling|shrug|shrugs|shrugging|nod|nods|nodding|shake head|shakes head|tremble|trembles|trembling|shiver|shivers|shivering|pant|pants|panting|breathe|breathes|breathing|sniff|sniffs|sniffing|snort|snorts|snorting|growl|growls|growling|hiss|hisses|hissing|purr|purrs|purring|whine|whines|whining|whimper|whimpers|whimpering|wail|wails|wailing|scream|screams|screaming|yell|yells|yelling|bellow|bellows|bellowing|roar|roars|roaring|mumble|mumbles|mumbling|mutter|mutters|muttering|murmur|murmurs|murmuring|croak|croaks|croaking|rasp|rasps|rasping|wheeze|wheezes|wheezing|snicker|snickers|snickering|cackle|cackles|cackling|jeer|jeers|jeering|scoff|scoffs|scoffing|deadpan|dry|stoic|apathetic|melancholic|nostalgic|euphoric|ecstatic|hysterical|maniacal|deranged|crazy|crazed|insane|psychopathic|murderous|lethal|venomous|bitter|sweet|tender|loving|romantic|lustful|horny|aroused|dominant|submissive|pleading|begging|bossy|commanding|authoritative|arrogant|cocky|smug|condescending|patronizing|defensive|offended|indignant|outraged|furious|livid|enraged|wrathful|jealous|envious|greedy|desperate|despair|heartbroken|devastated|ashamed|guilty|remorseful|pity|mockery|ironic|irony|snarky|cynical|skeptical|doubtful|disbelieving|shocked|stunned|flabbergasted|appalled|horrified|creeped out|spooked|panicked|panic|frantic|rushed|urgent|lazy|lethargic|drunk|tipsy|slurred|high|stoned|dizzy|faint|weak|fragile|vulnerable|brave|bold|heroic|cowardly|timid|meek|obedient|rebellious|defiant|sneaky|devious|calculating|sinister|evil|demonic|angelic|pious|holy|pauses|pause|short pause|long pause|sussurro|sussurrando|grito|gritando|risos|rindo|suspiro|suspirando|triste|melancolico|empolgado|sedutor|ironia|raiva|medo|alegria|calmo|brincalhao|curiosidade|surpresa|cansaco|hesitacao|tosse)\]/gi;

    return text.replace(emotionTagsRegex, '');
}

async function speakText(rawText, button, messageDiv) {
    if (button.querySelector('.fa-spinner')) {
        return;
    }

    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        if (currentPlayingTtsBtn === button) {
            resetAllTtsButtons();
            currentPlayingTtsBtn = null;
            currentAudio = null;
            return;
        }
    }

    resetAllTtsButtons();
    currentPlayingTtsBtn = button;
    button.innerHTML = "<i class=\"fas fa-spinner fa-spin\"></i>";
    button.disabled = true;

    const messageId = messageDiv?.dataset?.messageId;
    let targetMessage = null;

    if (messageId && allChats[currentChatId]) {
        targetMessage = allChats[currentChatId].recentMessages.find(msg => msg.timestamp.toString() === messageId);
    }

    if (targetMessage && targetMessage.audioData && targetMessage.audioData.length > 150) {
        playAudioData(targetMessage.audioData, button, targetMessage);
        return;
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        resetAllTtsButtons();
        currentPlayingTtsBtn = null;
        showCustomAlert("Chave Ausente", "O recurso de Áudio Expressivo requer a Chave de API do Gemini configurada.");
        return;
    }

    const textToSpeak = rawText.trim();
    if (!textToSpeak) {
        resetAllTtsButtons();
        currentPlayingTtsBtn = null;
        showCustomAlert("Texto Ausente", "A mensagem não contém texto para gerar áudio.");
        return;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: textToSpeak }] }],
                generationConfig: {
                    temperature: 1,
                    responseModalities: ["AUDIO"],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Leda" } } }
                }
            })
        });


        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("ERRO DO PROVIDER:", errorData);

            let errorMsg = errorData.error?.message || `Erro ${response.status}: ${response.statusText}`;
            throw new Error(errorMsg);
        }

        const data = await response.json();
        const audioPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData && p.inlineData.mimeType.startsWith("audio/"));

        if (!audioPart || !audioPart.inlineData || !audioPart.inlineData.data) {
            throw new Error("A API não retornou nenhum áudio válido.");
        }

        const base64Data = audioPart.inlineData.data;
        const mimeType = audioPart.inlineData.mimeType;
        let finalAudioUrl = "";
        let blobToSave = null;

        if (mimeType.includes("pcm")) {
            const binaryString = atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const sampleRate = 24000;
            const wavBuffer = new ArrayBuffer(44 + bytes.length);
            const view = new DataView(wavBuffer);

            const writeString = (view, offset, string) => {
                for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
            };

            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + bytes.length, true);
            writeString(view, 8, 'WAVE');
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, 1, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * 2, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);
            writeString(view, 36, 'data');
            view.setUint32(40, bytes.length, true);

            const pcmData = new Uint8Array(wavBuffer, 44);
            pcmData.set(bytes);

            blobToSave = new Blob([wavBuffer], { type: 'audio/wav' });
            finalAudioUrl = URL.createObjectURL(blobToSave);
        } else {
            finalAudioUrl = `data:${mimeType};base64,${base64Data}`;
            if (targetMessage) {
                targetMessage.audioData = finalAudioUrl;
                if (typeof saveChatsToPersistence === 'function') saveChatsToPersistence();
            }
        }

        playAudioData(finalAudioUrl, button, targetMessage);

        if (blobToSave && targetMessage) {
            const reader = new FileReader();
            reader.onloadend = () => {
                targetMessage.audioData = reader.result;
                if (typeof saveChatsToPersistence === 'function') saveChatsToPersistence();
            };
            reader.readAsDataURL(blobToSave);
        }

    } catch (error) {
        resetAllTtsButtons();
        currentPlayingTtsBtn = null;
        if (error.message) {
            showCustomAlert("Erro de Áudio", error.message);
        }
    }
}

let currentCustomPlayer = null;

// Polyfill roundRect para Canvas em navegadores mais antigos
if (CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}

// Waveform cache: audio URL -> array of bar heights (0-1)
const waveformCache = new Map();

async function renderWaveformFromAudioUrl(audioUrl, waveformEl) {
    try {
        // Wait a frame to ensure element has dimensions
        await new Promise(r => requestAnimationFrame(r));

        const rect = waveformEl.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;

        // Check cache first
        let bars = waveformCache.get(audioUrl);
        if (!bars) {
            let arrayBuffer;
            if (audioUrl.startsWith('data:')) {
                // Decode data URL directly without fetch
                const commaIdx = audioUrl.indexOf(',');
                const base64Data = audioUrl.substring(commaIdx + 1);
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                arrayBuffer = bytes.buffer;
            } else {
                const response = await fetch(audioUrl);
                arrayBuffer = await response.arrayBuffer();
            }

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const rawData = audioBuffer.getChannelData(0);

            // Store duration so we can display it on the time element immediately
            waveformCache.set(audioUrl + '__duration', audioBuffer.duration);
            const numBars = 40;
            const samplesPerBar = Math.floor(rawData.length / numBars);
            bars = [];
            for (let i = 0; i < numBars; i++) {
                let sum = 0;
                const start = i * samplesPerBar;
                for (let j = 0; j < samplesPerBar; j++) {
                    const sample = rawData[start + j];
                    sum += sample * sample;
                }
                const rms = Math.sqrt(sum / samplesPerBar);
                bars.push(Math.max(0.05, Math.min(1, rms * 3)));
            }
            audioContext.close();
            waveformCache.set(audioUrl, bars);
        }

        const bgCanvas = waveformEl.querySelector('canvas[id$="-bg"]');
        const fgCanvas = waveformEl.querySelector('canvas[id$="-fg"]');
        if (!bgCanvas || !fgCanvas) return;

        const dpr = window.devicePixelRatio || 1;
        bgCanvas.width = rect.width * dpr;
        bgCanvas.height = rect.height * dpr;
        fgCanvas.width = rect.width * dpr;
        fgCanvas.height = rect.height * dpr;
        bgCanvas.style.width = rect.width + 'px';
        bgCanvas.style.height = rect.height + 'px';
        fgCanvas.style.width = rect.width + 'px';
        fgCanvas.style.height = rect.height + 'px';

        const bgCtx = bgCanvas.getContext('2d');
        const fgCtx = fgCanvas.getContext('2d');
        bgCtx.scale(dpr, dpr);
        fgCtx.scale(dpr, dpr);

        const isNarrowScreen = rect.width < 320;
        const numBars = isNarrowScreen ? 28 : 40;
        const barGap = 2;
        const barWidth = (rect.width - barGap * (bars.length - 1)) / bars.length;

        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches || document.documentElement.getAttribute('data-theme') === 'dark';
        const barColorBg = isDark ? 'rgba(205, 214, 244, 0.25)' : 'rgba(205, 214, 244, 0.25)';
        const barColorFg = isDark ? '#cdd6f4' : '#cdd6f4';

        // Background bars (unplayed - dimmer)
        bars.forEach((h, i) => {
            const barH = h * rect.height;
            const x = i * (barWidth + barGap);
            const y = (rect.height - barH) / 2;
            bgCtx.fillStyle = barColorBg;
            bgCtx.beginPath();
            bgCtx.roundRect(x, y, barWidth, barH, barWidth / 2);
            bgCtx.fill();
        });

        // Foreground bars (played - revealed via clip-path)
        bars.forEach((h, i) => {
            const barH = h * rect.height;
            const x = i * (barWidth + barGap);
            const y = (rect.height - barH) / 2;
            fgCtx.fillStyle = barColorFg;
            fgCtx.beginPath();
            fgCtx.roundRect(x, y, barWidth, barH, barWidth / 2);
            fgCtx.fill();
        });

        // Start with foreground fully clipped (0% progress)
        fgCanvas.style.clipPath = 'inset(0 100% 0 0)';

        // Show total duration immediately if available from cache
        const cachedDuration = waveformCache.get(audioUrl + '__duration');
        if (cachedDuration) {
            const timeId = `time-${waveformEl.dataset.playerId}`;
            const timeEl = document.getElementById(timeId);
            if (timeEl && !isNaN(cachedDuration) && cachedDuration > 0) {
                const m = Math.floor(cachedDuration / 60);
                const s = Math.floor(cachedDuration % 60).toString().padStart(2, '0');
                timeEl.textContent = `0:${s}`;
                timeEl.dataset.totalDuration = cachedDuration;
            }
        }

    } catch (e) {
        console.warn('Falha ao renderizar waveform:', e.message);
    }
}

// Scrubbing
let isScrubbing = false;

function setupWaveformScrubbing(waveformEl, playerId) {
    const getAudio = () => {
        // If this player is currently active, use the global audio object
        if (currentCustomPlayer && currentCustomPlayer.playerId === playerId && currentAudio) {
            return currentAudio;
        }
        return null;
    };

    function seekTo(e) {
        const rect = waveformEl.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const audio = getAudio();
        if (audio && !isNaN(audio.duration)) {
            audio.currentTime = ratio * audio.duration;
        }
        waveformEl.querySelector('canvas[id$="-fg"]')?.style.setProperty('clip-path', `inset(0 ${(1 - ratio) * 100}% 0 0)`);
    }

    function onPointerDown(e) {
        e.preventDefault();
        isScrubbing = true;
        seekTo(e);
    }
    function onPointerMove(e) {
        if (!isScrubbing) return;
        e.preventDefault();
        seekTo(e);
    }
    function onPointerUp() {
        isScrubbing = false;
    }

    waveformEl.addEventListener('mousedown', onPointerDown);
    waveformEl.addEventListener('touchstart', onPointerDown, { passive: false });
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchend', onPointerUp);

    waveformEl.style.cursor = 'pointer';
}

// Waveform observer: watches for audio elements being added and renders waveforms
const waveformObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            const waveforms = node.classList?.contains('custom-ap-waveform') ? [node] : node.querySelectorAll('.custom-ap-waveform');
            waveforms.forEach(wf => {
                const audioSrc = wf.dataset.audioSrc;
                const playerId = wf.dataset.playerId;
                if (audioSrc && playerId) {
                    renderWaveformFromAudioUrl(audioSrc, wf);
                    setupWaveformScrubbing(wf, playerId);
                }
            });
        });
    });
});
waveformObserver.observe(messagesContainer, { childList: true, subtree: true });


function playBotAudio(audioSrc, buttonElement, playerId) {
    const playerDiv = document.getElementById(playerId);
    const timeSpan = document.getElementById(`time-${playerId}`);
    const fgCanvas = playerDiv?.querySelector('canvas[id$="-fg"]');

    // If this same player is already playing, toggle pause/play
    if (currentCustomPlayer && currentCustomPlayer.playerId === playerId && currentAudio) {
        if (!currentAudio.paused) {
            currentAudio.pause();
            buttonElement.innerHTML = '<i class="fas fa-play"></i>';
        } else {
            currentAudio.play();
            buttonElement.innerHTML = '<i class="fas fa-pause"></i>';
        }
        return;
    }

    // Stop any other playing audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    if (currentCustomPlayer && currentCustomPlayer.btn) {
        currentCustomPlayer.btn.innerHTML = '<i class="fas fa-play"></i>';
        clearInterval(currentCustomPlayer.interval);
    }

    // Always create a fresh Audio object to avoid stale state
    currentAudio = new window.Audio(audioSrc);
    currentAudio.preload = 'auto';

    const updateProgress = () => {
        if (timeSpan && currentAudio && !isNaN(currentAudio.duration)) {
            const s = Math.floor(currentAudio.currentTime % 60).toString().padStart(2, '0');
            const m = Math.floor(currentAudio.currentTime / 60);
            timeSpan.textContent = `${m}:${s}`;
        }
        if (fgCanvas && currentAudio && !isNaN(currentAudio.duration)) {
            const ratio = currentAudio.currentTime / currentAudio.duration;
            fgCanvas.style.clipPath = `inset(0 ${(1 - ratio) * 100}% 0 0)`;
        }
    };

    // Show duration when metadata loads
    currentAudio.addEventListener('loadedmetadata', () => {
        if (timeSpan && !isNaN(currentAudio.duration)) {
            const mins = Math.floor(currentAudio.duration / 60);
            const secs = Math.floor(currentAudio.duration % 60).toString().padStart(2, '0');
            timeSpan.textContent = `${mins}:${secs}`;
        }
    });

    currentAudio.addEventListener('playing', () => {
        buttonElement.innerHTML = '<i class="fas fa-pause"></i>';
        currentCustomPlayer = {
            btn: buttonElement,
            playerId: playerId,
            interval: setInterval(updateProgress, 50)
        };
    });

    currentAudio.addEventListener('ended', () => {
        buttonElement.innerHTML = '<i class="fas fa-play"></i>';
        if (fgCanvas) fgCanvas.style.clipPath = 'inset(0 100% 0 0)';
        if (currentCustomPlayer) { clearInterval(currentCustomPlayer.interval); currentCustomPlayer = null; }
        currentAudio = null;
    });

    currentAudio.addEventListener('error', () => {
        buttonElement.innerHTML = '<i class="fas fa-play"></i>';
        if (currentCustomPlayer) { clearInterval(currentCustomPlayer.interval); currentCustomPlayer = null; }
        currentAudio = null;
        showCustomAlert("Erro de reprodução", "Não foi possível reproduzir este áudio. Pode estar corrompido ou expirado.");
    });

    currentAudio.play().catch(e => {
        buttonElement.innerHTML = '<i class="fas fa-play"></i>';
        if (currentCustomPlayer) { clearInterval(currentCustomPlayer.interval); currentCustomPlayer = null; }
        currentAudio = null;
    });
}

function downloadBotAudio(audioSrc, buttonElement) {
    try {
        const a = document.createElement('a');
        a.href = audioSrc;
        a.download = `audio_${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e) {
        showCustomAlert("Erro", "Não foi possível baixar o áudio.");
    }
}

function playAudioData(audioDataUrl, button, targetMessage = null) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    currentAudio = new Audio(audioDataUrl);

    currentAudio.onplay = () => {
        button.innerHTML = "<i class=\"fas fa-stop\"></i>";
        button.title = "Parar áudio";
        button.disabled = false;
    };

    currentAudio.onended = () => {
        resetAllTtsButtons();
        currentPlayingTtsBtn = null;
        if (audioDataUrl.startsWith("blob:")) URL.revokeObjectURL(audioDataUrl);
        currentAudio = null;
    };

    currentAudio.onerror = () => {
        resetAllTtsButtons();
        currentPlayingTtsBtn = null;
        currentAudio = null;
        if (targetMessage && targetMessage.audioData) {
            targetMessage.audioData = null;
            if (typeof saveChatsToPersistence === 'function') saveChatsToPersistence();
        }
    };

    currentAudio.play().catch(() => {
        resetAllTtsButtons();
        currentPlayingTtsBtn = null;
        currentAudio = null;
        if (targetMessage && targetMessage.audioData) {
            targetMessage.audioData = null;
            if (typeof saveChatsToPersistence === 'function') saveChatsToPersistence();
        }
    });
}

function showCustomAlert(title, message) {
    const oldOverlay = document.getElementById('custom-alert-overlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'custom-alert-overlay';
    overlay.className = 'history-global-edit-overlay';

    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    overlay.style.zIndex = '10000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.backdropFilter = 'blur(3px)';

    const style = document.createElement('style');
    style.innerHTML = `
        .custom-alert-modal {
            background: #ffffff;
            color: #1e1e1e;
            border: 1px solid #ddd;
        }
        .custom-alert-subtitle {
            color: #555;
        }
        .custom-alert-btn {
            background-color: #1e1e1e;
            color: #ffffff;
        }
        
        @media (prefers-color-scheme: dark) {
            .custom-alert-modal {
                background: #1e1e1e;
                color: #e0e0e0;
                border: 1px solid #333;
            }
            .custom-alert-subtitle {
                color: #e0e0e0;
            }
            .custom-alert-btn {
                background-color: #f0f0f0;
                color: #1e1e1e;
            }
        }
        
        body.dark-mode .custom-alert-modal, body.dark .custom-alert-modal {
            background: #1e1e1e;
            color: #e0e0e0;
            border: 1px solid #333;
        }
        body.dark-mode .custom-alert-subtitle, body.dark .custom-alert-subtitle {
            color: #e0e0e0;
        }
        body.dark-mode .custom-alert-btn, body.dark .custom-alert-btn {
            background-color: #f0f0f0;
            color: #1e1e1e;
        }
    `;
    overlay.appendChild(style);

    const modalDiv = document.createElement('div');
    modalDiv.className = 'custom-alert-modal';
    modalDiv.style.borderRadius = '12px';
    modalDiv.style.padding = '24px';
    modalDiv.style.width = '90%';
    modalDiv.style.maxWidth = '350px';
    modalDiv.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    modalDiv.style.display = 'flex';
    modalDiv.style.flexDirection = 'column';
    modalDiv.style.alignItems = 'center';
    modalDiv.style.textAlign = 'center';

    modalDiv.innerHTML = `
        <div class="history-modal-title" style="color: #ff6b6b; margin-bottom: 12px; font-size: 1.25rem; font-weight: bold; width: 100%;">${title}</div>
        <div class="custom-alert-subtitle" style="margin-bottom: 24px; white-space: pre-wrap; font-size: 0.95rem; line-height: 1.5; width: 100%;">${message}</div>
        <div class="history-modal-actions" style="width: 100%; display: flex; justify-content: center; margin-top: 0;">
            <button id="custom-alert-ok" class="custom-alert-btn" style="border: none; border-radius: 8px; padding: 12px 0; width: 100%; font-size: 1rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s;">OK</button>
        </div>
    `;

    overlay.appendChild(modalDiv);
    document.body.appendChild(overlay);

    const fecharModal = () => {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s';
        setTimeout(() => overlay.remove(), 200);
    };

    const btn = document.getElementById('custom-alert-ok');
    if (btn) {
        btn.onclick = fecharModal;
    }

    overlay.onclick = (e) => {
        if (e.target === overlay) {
            fecharModal();
        }
    };
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

let customModelOverlay, customModelModal, customModelList, customModelSearch, customSelectorBtn, customSelectorText;

function setupCustomModelSelector() {
    const modelSelect = document.getElementById("model-select");
    if (!modelSelect) return;

    let customSelectorBtn = document.querySelector('.custom-selector-btn');
    if (!customSelectorBtn) {
        customSelectorBtn = document.createElement('div');
        customSelectorBtn.className = 'model-selector custom-selector-btn';
        const customSelectorText = document.createElement('span');
        customSelectorText.id = 'custom-selector-text-span';
        customSelectorText.textContent = "Carregando...";
        customSelectorBtn.appendChild(customSelectorText);

        modelSelect.parentNode.insertBefore(customSelectorBtn, modelSelect);
        modelSelect.style.display = 'none';
    }

    let customModelOverlay = document.querySelector('.custom-model-overlay');
    if (!customModelOverlay) {
        customModelOverlay = document.createElement('div');
        customModelOverlay.className = 'custom-model-overlay';

        customModelOverlay.innerHTML = `
            <div class="custom-model-modal">
                <div class="custom-model-header">
                    <div class="custom-model-search-wrapper">
                        <i class="fas fa-search"></i>
                        <input type="text" class="custom-model-search-input" id="custom-model-search" placeholder="Buscar modelo (ex: gpt 4o)...">
                    </div>
                    <button class="custom-model-close" id="custom-model-close">&times;</button>
                </div>
                <div class="custom-model-list" id="custom-model-list"></div>
                <div class="custom-model-no-results" id="custom-model-no-results" style="display:none; padding:15px; text-align:center;">Nenhum modelo encontrado.</div>
            </div>
        `;
        document.body.appendChild(customModelOverlay);
    }

    const customModelSearch = document.getElementById('custom-model-search');
    const closeBtn = document.getElementById('custom-model-close');

    customSelectorBtn.addEventListener('click', () => {
        syncCustomSelectorList();
        customModelOverlay.classList.add('active');
        customModelSearch.value = '';
        filterCustomModels('');
        setTimeout(() => customModelSearch.focus(), 50);
    });

    const closeModal = () => customModelOverlay.classList.remove('active');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    customModelOverlay.addEventListener('click', (e) => {
        if (e.target === customModelOverlay) closeModal();
    });

    customModelSearch.addEventListener('input', (e) => {
        filterCustomModels(e.target.value);
    });
}

function syncCustomSelectorList() {
    const modelSelect = document.getElementById("model-select");
    const customSelectorText = document.getElementById("custom-model-name") || document.getElementById("custom-selector-text-span");
    if (modelSelect && modelSelect.options[modelSelect.selectedIndex] && customSelectorText) {
        customSelectorText.textContent = modelSelect.options[modelSelect.selectedIndex].textContent;
    }
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
    const lastActiveChatId = localStorage.getItem("last_active_chat_id");
    const lastActiveTimestamp = parseInt(localStorage.getItem("last_active_timestamp") || "0", 10);

    const isResume = (Date.now() - lastActiveTimestamp) < 300000;

    if (data && data.allChats) {
        allChats = data.allChats;
        for (const id in allChats) {
            if (!allChats[id].recentMessages) allChats[id].recentMessages = [];
        }
    } else {
        allChats = {};
    }

    initializeHistory(allChats, saveChatsToPersistence);

    let targetChatId = null;
    if (sessionChatId && allChats[sessionChatId]) {
        targetChatId = sessionChatId;
    } else if (isResume && lastActiveChatId && allChats[lastActiveChatId]) {
        targetChatId = lastActiveChatId;
    }

    if (targetChatId) {
        currentChatId = targetChatId;
        await saveChatsToPersistence();
        switchToChat(currentChatId, false);
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
    switchToChat(currentChatId, true);
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
                    timestamp: allChats[id].timestamp,
                    audioData: allChats[id].audioData || null
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

        localStorage.setItem("last_active_timestamp", Date.now().toString());

        if (apiSourceInput && apiSourceInput.value) {
            localStorage.setItem("api_source_preference", apiSourceInput.value);
        }

        if (modelSelect && modelSelect.value) {
            localStorage.setItem(`${currentApiProvider}_selected_model`, modelSelect.value);
        }

    } catch (e) {
        console.error(e);
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
        if (userNameInput) userNameInput.value = savedUserName;
    }
}

/* ============================================
   THEME MANAGEMENT
   ============================================ */
function applyThemePreference() {
    const saved = localStorage.getItem("2b_chat_theme");
    if (saved === "light" || saved === "dark") {
        document.documentElement.setAttribute("data-theme", saved);
    } else {
        document.documentElement.removeAttribute("data-theme");
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("2b_chat_theme", next);
}

function handleSystemThemeChange() {
    if (!localStorage.getItem("2b_chat_theme")) {
        applyThemePreference();
    }
}

function getCurrentApiKeyStorageKey() {

    if (currentApiProvider === "llm" || currentApiProvider === "custom") {

        const url = apiSourceInput ? apiSourceInput.value.trim() : "";

        if (url) {

            return `2b_chat_custom_key_${btoa(url)}`;
        }
    }

    return `2b_chat_${currentApiProvider}_api_key`;
}

function formatPrice(pricePerToken) {
    if (pricePerToken == null || isNaN(pricePerToken)) return "—";
    const pricePerMillion = (pricePerToken * 1_000_000);
    if (pricePerMillion < 0.01) return "<$0.01";
    return `$${pricePerMillion.toFixed(2)}`;
}

function formatContext(contextLength) {
    if (!contextLength) return null;
    if (contextLength >= 1_000_000) return (contextLength / 1_000_000).toFixed(0) + "M";
    if (contextLength >= 1_000) return (contextLength / 1_000).toFixed(0) + "K";
    return String(contextLength);
}

async function fetchOpenRouterModelData() {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/models");
        if (!response.ok) return new Map();
        const data = await response.json();
        const map = new Map();
        (data.data || []).forEach(m => {
            const id = m.id;
            map.set(id, {
                context_length: m.context_length || null,
                pricing: m.pricing || null
            });
        });
        return map;
    } catch (e) {
        console.warn("Falha ao buscar dados do OpenRouter:", e.message);
        return new Map();
    }
}

async function loadModels() {
    const modelSelect = document.getElementById("model-select");
    const customSelector = document.getElementById("custom-model-selector");
    const customList = document.querySelector(".custom-model-list");
    const customName = document.getElementById("custom-model-name");

    if (!modelSelect || !customSelector || !customList) return;

    const modelDetailsMap = await fetchOpenRouterModelData();

    const apiConfig = await getApiConfig();
    const manualModelContainer = document.getElementById("manual-model-container");
    const manualModelInput = document.getElementById("manual-model-input");

    const setManualMode = (isManual, placeholder = "Digite o nome do modelo...") => {
        if (isManual) {
            customSelector.style.display = "none";
            if (manualModelContainer) {
                manualModelContainer.style.display = "block";
                manualModelContainer.classList.add("active");
            }
            if (manualModelInput) manualModelInput.placeholder = placeholder;
        } else {
            customSelector.style.display = "flex";
            if (manualModelContainer) {
                manualModelContainer.style.display = "none";
                manualModelContainer.classList.remove("active");
            }
        }
    };

    setManualMode(false);
    modelSelect.innerHTML = "<option value=\"\" disabled selected>Carregando...</option>";
    if (customName) customName.textContent = "Carregando...";
    customList.innerHTML = "";

    if (apiConfig.error) {
        setManualMode(true, "Configure a API primeiro...");
        return;
    }

    let pendingSwitch = sessionStorage.getItem("pending_favorite_model_switch");
    if (pendingSwitch) {
        localStorage.setItem(`${currentApiProvider}_selected_model`, pendingSwitch);
        sessionStorage.removeItem("pending_favorite_model_switch");
    }

    const addCustomListItem = (value, text, hasVision, isSelected = false, sourceApi = null, modelDetails = null) => {
        const div = document.createElement("div");
        div.className = "custom-model-item";
        div.dataset.value = value;

        if (isSelected) div.classList.add("selected");
        if (hasVision) div.classList.add("model-option-vision");
        else if (value !== "manual") div.classList.add("model-option-no-vision");
        if (value !== "manual" && isAudioModel(value)) div.classList.add("model-cap-audio");
        if (value !== "manual" && isImageGenModel(value)) div.classList.add("model-cap-imagegen");

        const textAndInfoContainer = document.createElement('div');
        textAndInfoContainer.className = 'model-text-and-info';

        const textSpan = document.createElement("span");
        textSpan.className = "model-item-text";
        textSpan.textContent = text;
        textAndInfoContainer.appendChild(textSpan);

        if (value !== "manual" && modelDetails) {
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'model-info-tags';

            const inputCost = formatPrice(modelDetails.pricing?.prompt);
            const outputCost = formatPrice(modelDetails.pricing?.completion);
            const context = formatContext(modelDetails.context_length);

            tagsContainer.innerHTML = `
                <div class="info-pill">
                    <span class="info-label">IN ($/1M)</span>
                    <span class="info-value">${inputCost}</span>
                </div>
                <div class="info-pill">
                    <span class="info-label">OUT ($/1M)</span>
                    <span class="info-value">${outputCost}</span>
                </div>
                <div class="info-pill">
                    <span class="info-label">CONTEXT</span>
                    <span class="info-value">${context || '—'}</span>
                </div>
            `;

            textAndInfoContainer.appendChild(tagsContainer);
        }

        div.appendChild(textAndInfoContainer);

        if (value !== "manual") {
            const _caps = document.createElement("span");
            _caps.className = "model-caps";
            if (isAudioModel(value)) _caps.innerHTML += '<span class="cap-badge cap-audio" title="Suporte e geração de áudio"><i class="fas fa-volume-up"></i></span>';
            if (isImageGenModel(value)) _caps.innerHTML += '<span class="cap-badge cap-image" title="Geração de imagens"><i class="fas fa-image"></i></span>';
            if (hasVision) _caps.innerHTML += '<span class="cap-badge cap-vision" title="Suporte a visão computacional"><i class="fas fa-eye"></i></span>';
            if (_caps.innerHTML) div.appendChild(_caps);
            const favBtn = document.createElement("button");
            favBtn.className = "model-favorite-btn";
            const favs = getFavoriteModels();
            const currentApi = sourceApi || apiSourceInput.value;
            const isFav = favs.some(f => f.id === value && f.apiSource === currentApi);

            favBtn.innerHTML = isFav ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
            if (isFav) favBtn.classList.add("active");

            favBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavoriteModel(value, text, currentApi, hasVision);
            });
            div.appendChild(favBtn);
        }

        div.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const targetApi = sourceApi || apiSourceInput.value;
            if (targetApi !== apiSourceInput.value) {
                sessionStorage.setItem("pending_favorite_model_switch", value);
                apiSourceInput.value = targetApi;
                apiSourceInput.dispatchEvent(new Event("input"));
                document.getElementById("custom-model-dropdown").classList.remove("active");
                return;
            }

            document.querySelectorAll('.custom-model-item.selected').forEach(item => item.classList.remove('selected'));
            div.classList.add('selected');

            modelSelect.value = value;
            if (customName) customName.textContent = text;

            document.getElementById("custom-model-dropdown").classList.remove("active");

            if (value === "manual") {
                setManualMode(true);
                if (manualModelInput) manualModelInput.focus();
            } else {
                setManualMode(false);
                localStorage.setItem(`${currentApiProvider}_selected_model`, value);
                updateVisionIndicator();
            }
            modelSelect.dispatchEvent(new Event("change"));
        });
        customList.appendChild(div);
    };

    const addManualOption = (isSelected = false) => {
        const option = document.createElement("option");
        option.value = "manual";
        option.textContent = "✎ Digitar nome do modelo...";
        if (isSelected) option.selected = true;
        modelSelect.appendChild(option);
        addCustomListItem("manual", "✎ Digitar nome do modelo...", false, isSelected);
    };

    if (manualModelInput && !manualModelInput.dataset.hasListener) {
        manualModelInput.addEventListener('input', updateVisionIndicator);
        manualModelInput.addEventListener('blur', () => {
            if (manualModelInput.value.trim() === '') {
                setManualMode(false);
                const firstModelOption = modelSelect.querySelector('option:not([value="manual"])');
                if (firstModelOption) {
                    modelSelect.value = firstModelOption.value;
                    const selectedItem = customList.querySelector(`.custom-model-item[data-value="${modelSelect.value}"]`);
                    if (selectedItem) {
                        if (customName) customName.textContent = selectedItem.querySelector('.model-item-text').textContent;
                        document.querySelectorAll('.custom-model-item.selected').forEach(i => i.classList.remove('selected'));
                        selectedItem.classList.add('selected');
                    }
                }
            }
        });
        manualModelInput.dataset.hasListener = "true";
    }

    const favs = getFavoriteModels();
    if (favs.length > 0) {
        const favHeader = document.createElement("div");
        favHeader.className = "model-section-header";
        favHeader.textContent = "Favoritos";
        customList.appendChild(favHeader);

        const savedModel = localStorage.getItem(`${currentApiProvider}_selected_model`);

        favs.forEach(fav => {
            let isSelected = false;
            if (fav.apiSource === apiSourceInput.value && savedModel === fav.id) {
                isSelected = true;
            }
            const details = modelDetailsMap.get(fav.id);
            addCustomListItem(fav.id, fav.name, fav.hasVision, isSelected, fav.apiSource, details);
        });

        const allHeader = document.createElement("div");
        allHeader.className = "model-section-header";
        allHeader.textContent = "Todos os Modelos";
        customList.appendChild(allHeader);
    }

    if (apiConfig.provider === "llm") {
        try {
            const response = await fetch(`${apiConfig.url}/api/tags`);
            if (!response.ok) throw new Error();
            const data = await response.json();
            modelSelect.innerHTML = "";
            if (data.models?.length > 0) {
                const savedModel = localStorage.getItem("llm_selected_model");
                let foundSaved = false;
                data.models.sort((a, b) => a.name.localeCompare(b.name)).forEach(model => {
                    const isSelected = savedModel === model.name;
                    if (isSelected) foundSaved = true;
                    const hasVision = hasVisionSupport(model.name);
                    const text = `${model.name} (${model.details?.quantization_level || "N/A"}) - ${formatBytes(model.size)}`;
                    const option = document.createElement("option");
                    option.value = model.name;
                    option.textContent = text;
                    if (isSelected) option.selected = true;
                    modelSelect.appendChild(option);
                    addCustomListItem(model.name, text, hasVision, isSelected, null, modelDetailsMap.get(model.name));
                });
                addManualOption(savedModel === "manual");
                if (savedModel === "manual") {
                    setManualMode(true);
                } else {
                    if (!foundSaved && data.models.length > 0) {
                        modelSelect.options[0].selected = true;
                        customList.querySelector('.custom-model-item:not(.model-favorite-btn)')?.classList.add('selected');
                    }
                    if (customName) customName.textContent = modelSelect.options[modelSelect.selectedIndex]?.textContent || "Selecione...";
                    setManualMode(false);
                }
            } else {
                addManualOption(true);
                setManualMode(true, "Nenhum modelo llm encontrado...");
            }
        } catch (error) {
            addManualOption(true);
            setManualMode(true, "Falha ao conectar no llm...");
        }
    } else if (apiConfig.provider === "gemini") {
        if (!apiConfig.apiKey) {
            addManualOption(true);
            setManualMode(true, "Chave API Gemini pendente...");
            return;
        }
        try {
            const response = await fetch(`${apiConfig.url}/models?key=${apiConfig.apiKey}`);
            if (!response.ok) throw new Error();
            const jsonData = await response.json();
            modelSelect.innerHTML = "";
            if (jsonData.models && jsonData.models.length > 0) {
                const savedModel = localStorage.getItem("gemini_selected_model");
                let foundSaved = false;
                const sortedModels = jsonData.models
                    .filter(model => model.supportedGenerationMethods.includes("generateContent"))
                    .sort((a, b) => a.displayName.localeCompare(b.displayName));
                sortedModels.forEach(model => {
                    const isSelected = savedModel === model.name;
                    if (isSelected) foundSaved = true;
                    const hasVision = hasVisionSupport(model.name);
                    const details = modelDetailsMap.get("google/" + model.name.replace('models/', ''));
                    const option = document.createElement("option");
                    option.value = model.name;
                    option.textContent = model.displayName;
                    if (isSelected) option.selected = true;
                    modelSelect.appendChild(option);
                    addCustomListItem(model.name, model.displayName, hasVision, isSelected, null, details);
                });
                addManualOption(savedModel === "manual");
                if (savedModel === "manual") {
                    setManualMode(true);
                } else {
                    if (!foundSaved) {
                        const targets = ["gemini-1.5-flash-latest", "gemini-1.5-pro-latest", "gemini-pro"];
                        for (const target of targets) {
                            const opt = Array.from(modelSelect.options).find(o => o.value.toLowerCase().includes(target.replace("gemini-", "")));
                            if (opt) {
                                opt.selected = true;
                                foundSaved = true;
                                break;
                            }
                        }
                    }
                    if (!foundSaved && modelSelect.options.length > 0) {
                        modelSelect.options[0].selected = true;
                    }
                    const selectedEl = customList.querySelector(`.custom-model-item[data-value="${modelSelect.value}"]`);
                    selectedEl?.classList.add('selected');
                    if (customName) customName.textContent = modelSelect.options[modelSelect.selectedIndex]?.textContent || "Selecione...";
                    setManualMode(false);
                }
            } else {
                addManualOption(true);
                setManualMode(true, "Nenhum modelo Gemini encontrado...");
            }
        } catch (error) {
            addManualOption(true);
            setManualMode(true, "Falha na API Gemini...");
        }
    } else {
        const providerName = apiConfig.provider;
        try {
            const response = await fetch(`${apiConfig.url}/models`, {
                method: "GET",
                headers: apiConfig.apiKey ? { "Authorization": `Bearer ${apiConfig.apiKey}` } : {}
            });
            if (!response.ok) throw new Error();
            const jsonData = await response.json();
            modelSelect.innerHTML = "";
            const models = jsonData.data || jsonData.models || [];
            if (models.length > 0) {
                const savedModel = localStorage.getItem(`${providerName}_selected_model`);
                let foundSaved = false;
                models.sort((a, b) => (a.id || a.name).localeCompare(b.id || b.name)).forEach(model => {
                    const id = model.id || model.name;
                    if (id.includes('whisper') || id.includes('embed') || id.includes('tts') || id.includes('dall-e')) return;
                    const isSelected = savedModel === id;
                    if (isSelected) foundSaved = true;
                    const hasVision = hasVisionSupport(id);
                    const details = modelDetailsMap.get(id);
                    const option = document.createElement("option");
                    option.value = id;
                    option.textContent = id;
                    if (isSelected) option.selected = true;
                    modelSelect.appendChild(option);
                    addCustomListItem(id, id, hasVision, isSelected, null, details);
                });
                addManualOption(savedModel === "manual");
                if (savedModel === "manual") {
                    setManualMode(true);
                } else {
                    if (!foundSaved && modelSelect.options.length > 1) {
                        modelSelect.options[0].selected = true;
                        customList.querySelector('.custom-model-item:not(.model-favorite-btn)')?.classList.add('selected');
                    }
                    setManualMode(false);
                }
                if (customName) customName.textContent = modelSelect.options[modelSelect.selectedIndex]?.textContent || "Selecione...";
            } else {
                addManualOption(true);
                setManualMode(true, "Nenhum modelo encontrado...");
            }
        } catch (error) {
            addManualOption(true);
            setManualMode(true, "Falha ao listar modelos...");
        }
    }
    if (customSelector.style.display !== "none" && modelSelect.value) {
        localStorage.setItem(`${currentApiProvider}_selected_model`, modelSelect.value);
    }
    updateVisionIndicator();
}

function exportChatHistory(chatId) {
    if (!allChats || !allChats[chatId]) return;
    const chat = allChats[chatId];
    const customName = document.getElementById("custom-model-name");
    const modelName = customName ? customName.textContent : "desconhecido";
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

window.handlePastedImageFromNative = function (mimeType, base64String) {
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
    const _supportsImages = ['gemini', 'openai', 'groq', 'grok', 'custom', 'llm', 'nvidia'].includes(currentApiProvider.toLowerCase());
    if (!_supportsImages) return;
    const items = (event.clipboardData || event.originalEvent.clipboardData)?.items;
    if (!items) return;

    const pastedFiles = [];

    for (let i = 0; i < items.length; i++) {

        if (items[i].type.indexOf("image") !== -1 || items[i].type.indexOf("video") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
                pastedFiles.push(file);
            }
        }
    }

    if (pastedFiles.length > 0) {
        event.preventDefault();
        clearImagePreview();

        processFiles(pastedFiles);
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

window.switchToChatFromNotification = function (chatId) {
    if (chatId && allChats[chatId]) {
        console.log(`Recebido clique na notificação para o chat: ${chatId}`);
        switchToChat(chatId);
    } else {
        console.error(`Chat com ID ${chatId} não encontrado via notificação.`);
    }
};

document.addEventListener("DOMContentLoaded", initializeApp);

/* Global Esc handler — fecha preview de imagem, editor/crop, e modais */
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    const overlay = document.getElementById("image-preview-overlay");
    const editorModal = document.getElementById("image-editor-modal");

    // Fechar editor de imagem/crop
    if (editorModal && editorModal.classList.contains("active")) {
        e.preventDefault();
        e.stopPropagation();
        if (currentEditorCropper) {
            currentEditorCropper.destroy();
            currentEditorCropper = null;
        }
        editorModal.classList.remove("active");
        return;
    }

    // Fechar preview em tela cheia
    if (overlay && overlay.classList.contains("active")) {
        e.preventDefault();
        e.stopPropagation();
        overlay.classList.remove("active");
        const fullVideo = document.getElementById("image-preview-full-video");
        if (fullVideo) {
            fullVideo.pause();
            fullVideo.src = "";
        }
        return;
    }
});

function setupApiSourceHistory() {
    if (!apiSourceInput) return;

    const historyContainer = document.createElement("div");
    historyContainer.id = "api-history-dropdown";
    historyContainer.className = "api-history-dropdown";
    apiSourceInput.parentNode.appendChild(historyContainer);

    let isDropdownOpen = false;

    const getHistory = () => JSON.parse(localStorage.getItem("2b_chat_api_history") || "[]");

    const saveToHistory = (url, name = "") => {
        if (!url || url.trim() === "") return;
        let history = getHistory();
        let existingItem = history.find(item => item.url === url);
        let finalName = name !== "" ? name : (existingItem ? existingItem.name : "");
        history = history.filter(item => item.url !== url);
        history.unshift({ url, name: finalName, lastAccess: Date.now() });
        localStorage.setItem("2b_chat_api_history", JSON.stringify(history.slice(0, 10)));
    };

    const removeFromHistory = (url) => {
        let history = getHistory();
        history = history.filter(item => item.url !== url);
        localStorage.setItem("2b_chat_api_history", JSON.stringify(history));
        renderHistory();
    };

    window.renderHistory = () => {
        const history = getHistory();

        // Predefinir provedores sugeridos
        const DEFAULT_SUGGESTIONS = [
            { label: "Gemini", value: "Gemini" },
            { label: "OpenAI", value: "OpenAI" },
            { label: "Groq", value: "Groq" },
            { label: "Grok", value: "Grok" },
            { label: "NVIDIA", value: "NVIDIA" },
        ];

        const hasHistory = history.length > 0;
        historyContainer.innerHTML = "";

        // Seções de sugestões (sempre visíveis)
        const suggestionsHeader = document.createElement("div");
        suggestionsHeader.className = "api-history-section-title";
        suggestionsHeader.textContent = "Sugestões";
        historyContainer.appendChild(suggestionsHeader);

        DEFAULT_SUGGESTIONS.forEach(suggestion => {
            // Não duplicar se já está no histórico
            if (history.some(item => item.url.toLowerCase() === suggestion.value.toLowerCase())) return;

            const row = document.createElement("div");
            row.className = "history-item history-item-suggestion";
            row.innerHTML = `<div class="history-content"><span class="history-display-name">${suggestion.label}</span></div>`;
            row.onclick = () => {
                isDropdownOpen = false;
                apiSourceInput.value = suggestion.value;
                apiSourceInput.blur();
                historyContainer.style.display = "none";
                apiSourceInput.dispatchEvent(new Event("input"));
            };
            historyContainer.appendChild(row);
        });

        // Seção do histórico salvo
        if (hasHistory) {
            const historyHeader = document.createElement("div");
            historyHeader.className = "api-history-section-title";
            historyHeader.textContent = "Conexões salvas";
            historyContainer.appendChild(historyHeader);

            history.forEach(item => {
                const row = document.createElement("div");
                row.className = "history-item";

                const contentDiv = document.createElement("div");
                contentDiv.className = "history-content";

                if (item.name && item.name.trim() !== "") {
                    contentDiv.innerHTML = `<span class="history-display-name">${item.name}</span>`;
                } else {
                    contentDiv.innerHTML = `<span class="history-display-url">${item.url}</span>`;
                }

                contentDiv.onclick = () => {
                    isDropdownOpen = false;
                    apiSourceInput.value = item.url;
                    apiSourceInput.blur();
                    historyContainer.style.display = "none";
                    apiSourceInput.dispatchEvent(new Event("input"));
                };

                let pressTimer;
                let touchX = 0, touchY = 0;

                const startPress = (e) => {
                    if (e.type === 'touchstart' && e.touches.length > 1) return;
                    if (e.touches) {
                        touchX = e.touches[0].clientX;
                        touchY = e.touches[0].clientY;
                    }
                    pressTimer = setTimeout(() => {
                        showContextMenu(touchX, touchY, item);
                    }, 500);
                };
                const cancelPress = () => clearTimeout(pressTimer);

                contentDiv.addEventListener('touchstart', startPress, { passive: true });
                contentDiv.addEventListener('touchend', cancelPress);
                contentDiv.addEventListener('touchmove', cancelPress);
                contentDiv.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    cancelPress();
                    showContextMenu(e.clientX, e.clientY, item);
                });

                const removeBtn = document.createElement("button");
                removeBtn.className = "history-remove-btn";
                removeBtn.innerHTML = "&times;";
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    removeFromHistory(item.url);
                };

                row.appendChild(contentDiv);
                row.appendChild(removeBtn);
                historyContainer.appendChild(row);
            });
        }

        if (isDropdownOpen) {
            historyContainer.style.display = "block";
        } else {
            historyContainer.style.display = "none";
        }
    };

    function showContextMenu(x, y, item) {
        const oldMenu = document.getElementById('history-context-menu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'history-context-menu';
        menu.className = 'history-context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.innerHTML = `
            <button class="ctx-menu-btn" id="ctx-btn-rename">
                <i class="fas fa-pencil-alt"></i> Renomear
            </button>
        `;

        document.body.appendChild(menu);

        document.getElementById('ctx-btn-rename').onclick = (e) => {
            e.stopPropagation();
            menu.remove();
            openFloatingEditModal(item);
            isDropdownOpen = false;
            historyContainer.style.display = "none";
        };

        setTimeout(() => {
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                    document.removeEventListener('touchstart', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
            document.addEventListener('touchstart', closeMenu);
        }, 50);
    }

    function openFloatingEditModal(item) {
        const oldOverlay = document.getElementById('history-global-edit-overlay');
        if (oldOverlay) oldOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'history-global-edit-overlay';
        overlay.className = 'history-global-edit-overlay';

        const currentValue = item.name || item.url;

        overlay.innerHTML = `
            <div class="history-global-modal">
                <div class="history-modal-title">Renomear Conexão</div>
                <div class="history-modal-subtitle">${item.url}</div>
                <input type="text" class="history-global-input" id="history-floating-input" value="">
                <div class="history-modal-actions">
                    <button class="btn-cancel" id="history-modal-cancel">Cancelar</button>
                    <button class="btn-save" id="history-modal-save">Salvar</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const input = document.getElementById('history-floating-input');
        input.value = currentValue;

        setTimeout(() => {
            input.focus();
            input.select();
        }, 50);

        const fecharModal = () => {
            overlay.classList.add('closing');
            setTimeout(() => overlay.remove(), 250);
        };

        const salvar = () => {
            const newVal = input.value.trim();
            const finalName = (newVal === item.url || newVal === "") ? "" : newVal;
            saveToHistory(item.url, finalName);
            fecharModal();
            renderHistory();
        };

        document.getElementById('history-modal-save').onclick = salvar;
        document.getElementById('history-modal-cancel').onclick = fecharModal;

        input.onkeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); salvar(); }
            if (e.key === 'Escape') { e.preventDefault(); fecharModal(); }
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                salvar();
            }
        };
    }

    apiSourceInput.addEventListener("focus", () => {
        isDropdownOpen = true;
        renderHistory();
    });

    document.addEventListener("click", (e) => {
        if (!apiSourceInput.contains(e.target) && !historyContainer.contains(e.target)) {
            isDropdownOpen = false;
            historyContainer.style.display = "none";
        }
    });
}