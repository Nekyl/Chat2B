const DB_NAME = "Chat2B_Database";
const STORE_NAME = "chats_store";
const DB_VERSION = 1;
const STORAGE_KEY = "qX`PFDW,U}&b9=9NzX![aE]w";

const isAndroidWebView = () => {
    return window.Website2APK !== undefined;
};

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            reject(`Erro ao abrir DB: ${event.target.errorCode}`);
        };
    });
}

export async function saveChatsToStorage(data) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.put(data, STORAGE_KEY);

            request.onsuccess = () => {
                resolve();
            };
            
            request.onerror = (e) => reject(e);
        });
    } catch (error) {
        console.error("Erro ao salvar no IndexedDB:", error);

        if (!isAndroidWebView()) {
            try {

                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            } catch (e) { 
                console.error("LocalStorage cheio."); 
            }
        }
    }
}

export async function loadChatsFromStorage() {
    
    try {
        const db = await openDB();
        const dbData = await new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(STORAGE_KEY);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });

        if (dbData) {

            return dbData;
        }
    } catch (error) {
        console.error("Erro ao tentar ler IndexedDB, tentando fallback:", error);
    }

    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
        console.log("Migrando dados antigos do localStorage para IndexedDB...");
        try {
            const parsed = JSON.parse(localData);
            
            await saveChatsToStorage(parsed);
            localStorage.removeItem(STORAGE_KEY);
            
            return parsed;
        } catch (e) {
            console.error("Erro na migração:", e);
            return null;
        }
    }

    return null;
}

export function clearStorage() {
    return new Promise(async (resolve) => {
        try {
            const db = await openDB();
            const transaction = db.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            store.delete(STORAGE_KEY);
        } catch (e) {}
        
        localStorage.removeItem(STORAGE_KEY);
        resolve();
    });
}