// history.js

const MAX_HISTORY_TOKENS = 200000;
let allChats = {};
let saveChatsTrigger;
let saveTimeout;

function scheduleSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        if (saveChatsTrigger) saveChatsTrigger();
    }, 1000);
}

function estimateTokenCount(text) {
    if (!text || typeof text !== 'string') return 0;
    return Math.ceil(text.length / 4);
}

export function initializeHistory(chatsObject, saveFn) {
    allChats = chatsObject;
    saveChatsTrigger = saveFn;
}

export function addMessageToHistory(chatId, messageObject) {
    if (!allChats[chatId]) return;
    if (!Array.isArray(allChats[chatId].recentMessages)) {
        allChats[chatId].recentMessages = [];
    }
    allChats[chatId].recentMessages.push(messageObject);
    allChats[chatId].timestamp = Date.now();
    triggerContextMaintenance(chatId);
    scheduleSave();
}

export async function getHistoryForApi(chatId) {
    if (!allChats[chatId] || !allChats[chatId].recentMessages) return [];
    return allChats[chatId].recentMessages;
}

export function triggerContextMaintenance(chatId) {
    if (!allChats[chatId]) return;

    const chat = allChats[chatId];
    let totalTokens = 0;

    chat.recentMessages.forEach(msg => {
        let contentText = '';
        if (typeof msg.content === 'string') {
            contentText = msg.content;
        } else if (Array.isArray(msg.content)) {
            const textPart = msg.content.find(p => p.type === 'text');
            contentText = textPart ? textPart.text : '';
        }
        totalTokens += estimateTokenCount(contentText);
    });

    if (totalTokens > MAX_HISTORY_TOKENS) {
        while (totalTokens > MAX_HISTORY_TOKENS && chat.recentMessages.length > 0) {
            const removedMessage = chat.recentMessages.shift();
            let contentText = '';
            if (typeof removedMessage.content === 'string') {
                contentText = removedMessage.content;
            } else if (Array.isArray(removedMessage.content)) {
                const textPart = removedMessage.content.find(p => p.type === 'text');
                contentText = textPart ? textPart.text : '';
            }
            totalTokens -= estimateTokenCount(contentText);
        }
        scheduleSave();
    }
}

export function clearChatHistory(chatId) {
    if (allChats[chatId]) {
        allChats[chatId].recentMessages = [];
        scheduleSave();
    }
}