import { API, AUTH_BASE } from './api.js';

// DOM Elements
const app = document.getElementById('app');
const authSection = document.getElementById('auth-section');
const mainSection = document.getElementById('main-section');
const loginGoogleBtn = document.getElementById('login-google');
const loginGithubBtn = document.getElementById('login-github');
const logoutBtn = document.getElementById('logout-btn');
const urlList = document.getElementById('url-list');
const deviceList = document.getElementById('device-list');
const syncNowBtn = document.getElementById('sync-now-btn');
const addCurrentBtn = document.getElementById('add-current-btn');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const themeToggle = document.getElementById('theme-toggle');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// State
let selectedUrls = new Set();

// --- Initialization ---

const init = async () => {
    const { authToken } = await chrome.storage.local.get('authToken');
    if (authToken) {
        showMain();
    } else {
        showAuth();
    }

    loadTheme();
    setupEventListeners();

    // Check for auth success from OAuth redirect (if we were able to intercept, but usually that's a new tab)
    // Actually, we need a way to get the token from the OAuth callback page.
    // The callback page is http://localhost:3000/auth/success?token=...
    // We can use chrome.identity.launchWebAuthFlow or just listen for the tab update if we opened it.
    // For simplicity, let's assume user copies token or we use a content script on the success page to send message.
    // Wait, the requirement says "Extension stores JWT securely".
    // Better approach: `chrome.identity.launchWebAuthFlow`.
};

const setupEventListeners = () => {
    loginGoogleBtn.addEventListener('click', () => startAuth('google'));
    loginGithubBtn.addEventListener('click', () => startAuth('github'));
    logoutBtn.addEventListener('click', logout);

    syncNowBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'SYNC_NOW' }, () => {
            renderUrls(); // Refresh from storage
        });
    });

    addCurrentBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.runtime.sendMessage({
                type: 'MANUAL_ADD',
                url: tab.url,
                title: tab.title
            });
        }
    });

    deleteSelectedBtn.addEventListener('click', async () => {
        if (selectedUrls.size === 0) return;
        try {
            await API.deleteUrls(Array.from(selectedUrls));
            selectedUrls.clear();
            updateDeleteBtn();
            // UI will update via WS event or we can optimistically remove
        } catch (e) {
            console.error(e);
        }
    });

    themeToggle.addEventListener('click', toggleTheme);

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
        });
    });

    // Listen for storage changes to update UI
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            if (changes.syncedUrls) renderUrls();
            if (changes.devices) renderDevices();
        }
    });
};

// --- Auth ---

const startAuth = (provider) => {
    const authUrl = `${AUTH_BASE}/${provider}`;
    chrome.tabs.create({ url: authUrl });
    // The background script will listen for the callback URL, extract the token, and close the tab.
    // We listen for the LOGIN_SUCCESS message to update UI.
};

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'LOGIN_SUCCESS') {
        showMain();
    }
});

// --- UI Rendering ---

const showAuth = () => {
    authSection.classList.remove('hidden');
    mainSection.classList.add('hidden');
    logoutBtn.classList.add('hidden');
};

const showMain = () => {
    authSection.classList.add('hidden');
    mainSection.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    renderUrls();
    renderDevices();
};

const renderUrls = async () => {
    const { syncedUrls = [] } = await chrome.storage.local.get('syncedUrls');
    urlList.innerHTML = '';

    syncedUrls.forEach(url => {
        const li = document.createElement('li');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedUrls.has(url.id);
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) selectedUrls.add(url.id);
            else selectedUrls.delete(url.id);
            updateDeleteBtn();
        });

        const div = document.createElement('div');
        div.className = 'url-item';

        const content = document.createElement('div');
        content.className = 'url-content';
        content.innerHTML = `
            <div class="url-title">${url.title || 'No Title'}</div>
            <div class="url-link">${url.url}</div>
        `;
        content.addEventListener('click', () => {
            chrome.tabs.create({ url: url.url });
        });

        div.appendChild(checkbox);
        div.appendChild(content);
        li.appendChild(div);
        urlList.appendChild(li);
    });
};

const renderDevices = async () => {
    const { devices = [] } = await chrome.storage.local.get('devices');
    deviceList.innerHTML = '';

    devices.forEach(device => {
        const li = document.createElement('li');
        li.textContent = `${device.name} (${device.browser}) - ${new Date(device.last_seen).toLocaleString()}`;
        deviceList.appendChild(li);
    });
};

const updateDeleteBtn = () => {
    deleteSelectedBtn.disabled = selectedUrls.size === 0;
    if (selectedUrls.size > 0) deleteSelectedBtn.classList.remove('hidden');
    else deleteSelectedBtn.classList.add('hidden');
};

const logout = async () => {
    await chrome.storage.local.remove(['authToken', 'syncedUrls', 'devices', 'deviceId']);
    chrome.runtime.sendMessage({ type: 'LOGOUT' });
    showAuth();
};

// --- Theme ---

const toggleTheme = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    chrome.storage.local.set({ theme: newTheme });
};

const loadTheme = async () => {
    const { theme } = await chrome.storage.local.get('theme');
    if (theme) {
        document.body.setAttribute('data-theme', theme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.setAttribute('data-theme', 'dark');
    }
};

init();
