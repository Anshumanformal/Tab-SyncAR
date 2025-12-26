import { API, getAuthToken } from './api.js';

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

// --- WebSocket & Real-time ---

const connectWebSocket = async () => {
    const token = await getAuthToken();
    if (!token) return;

    if (ws) {
        ws.close();
    }

    ws = new WebSocket(`ws://localhost:3000?token=${token}`);

    ws.onopen = async () => {
        console.log('WebSocket Connected');
        reconnectAttempts = 0;
        // Re-fetch authoritative state on reconnect
        await syncAll();
    };

    ws.onmessage = async (event) => {
        try {
            const message = JSON.parse(event.data);
            handleServerEvent(message);
        } catch (e) {
            console.error('Error parsing WS message', e);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket Disconnected');
        ws = null;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
        reconnectAttempts++;
        setTimeout(connectWebSocket, delay);
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error', error);
        ws.close();
    };
};

const handleServerEvent = async (event) => {
    console.log('Received Event:', event.type, event.payload);

    // Optimistic updates or just re-fetch?
    // For simplicity and correctness, we can re-fetch or update local storage directly.
    // Let's update local storage to keep popup fast.

    if (event.type === 'URL_ADDED') {
        const { syncedUrls = [] } = await chrome.storage.local.get('syncedUrls');
        // Prepend new URLs
        const newUrls = [...event.payload, ...syncedUrls];
        // Dedupe by ID just in case
        const uniqueUrls = Array.from(new Map(newUrls.map(item => [item.id, item])).values());
        // Sort by created_at desc
        uniqueUrls.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        // Limit to 50 locally too
        const limitedUrls = uniqueUrls.slice(0, 50);

        await chrome.storage.local.set({ syncedUrls: limitedUrls });
    } else if (event.type === 'URL_DELETED') {
        const { syncedUrls = [] } = await chrome.storage.local.get('syncedUrls');
        const filteredUrls = syncedUrls.filter(u => !event.payload.includes(u.id));
        await chrome.storage.local.set({ syncedUrls: filteredUrls });
    } else if (event.type === 'DEVICE_ONLINE') {
        // Maybe trigger a device refresh if popup is open?
        // We can store devices locally too.
        const { devices = [] } = await chrome.storage.local.get('devices');
        // Update or add
        const idx = devices.findIndex(d => d.id === event.payload.id);
        if (idx !== -1) {
            devices[idx] = event.payload;
        } else {
            devices.unshift(event.payload);
        }
        await chrome.storage.local.set({ devices });
    }
};

// --- Sync Logic ---

const syncAll = async () => {
    try {
        const urls = await API.getUrls();
        await chrome.storage.local.set({ syncedUrls: urls });

        const devices = await API.getDevices();
        await chrome.storage.local.set({ devices });

        // Register this device
        await registerCurrentDevice();
    } catch (e) {
        console.error('Sync failed', e);
    }
};

const registerCurrentDevice = async () => {
    const manifest = chrome.runtime.getManifest();
    // Simple detection
    const isFirefox = navigator.userAgent.includes("Firefox");
    const platform = navigator.platform; // e.g. MacIntel

    // Get stored device ID to maintain session
    const { deviceId } = await chrome.storage.local.get('deviceId');

    const device = await API.registerDevice({
        deviceId,
        name: `${isFirefox ? 'Firefox' : 'Chrome'} on ${platform}`,
        browser: isFirefox ? 'Firefox' : 'Chrome',
        platform: platform
    });

    if (device && device.id) {
        await chrome.storage.local.set({ deviceId: device.id });
    }
};

// --- Tab Listeners ---

// Only for desktop, check platform?
// Requirement: "Firefox Android: manual sync only".
// We can check user agent or just let it fail gracefully if API missing?
// Android Firefox supports tabs API but not background persistent listeners well?
// Actually, it says "No background tab listeners" for Android.
// We can detect Android in UA.

const isAndroid = navigator.userAgent.includes("Android");

if (!isAndroid) {
    chrome.tabs.onCreated.addListener((tab) => {
        if (tab.url && tab.url.startsWith('http')) {
            syncUrl(tab);
        }
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
            syncUrl(tab);
        }
    });
}

const syncUrl = async (tab) => {
    const token = await getAuthToken();
    if (!token) return;

    try {
        await API.addUrls([{
            url: tab.url,
            title: tab.title,
            source: 'auto'
        }]);
    } catch (e) {
        console.error('Auto-sync failed', e);
    }
};

// --- Initialization ---

chrome.runtime.onStartup.addListener(() => {
    connectWebSocket();
});

chrome.runtime.onInstalled.addListener(() => {
    connectWebSocket();
});

// Listen for messages from popup (e.g. login success)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LOGIN_SUCCESS') {
        connectWebSocket();
        sendResponse({ status: 'ok' });
    } else if (message.type === 'LOGOUT') {
        if (ws) ws.close();
        sendResponse({ status: 'ok' });
    } else if (message.type === 'SYNC_NOW') {
        syncAll().then(() => sendResponse({ status: 'ok' }));
        return true; // Async response
    } else if (message.type === 'MANUAL_ADD') {
        // Handle manual add from popup
        API.addUrls([{
            url: message.url,
            title: message.title || message.url,
            source: 'manual'
        }]).then(() => sendResponse({ status: 'ok' }))
            .catch(e => sendResponse({ status: 'error', message: e.message }));
        return true;
    }
});
