const API_BASE = 'http://localhost:3000/api';
const AUTH_BASE = 'http://localhost:3000/auth';

const getAuthToken = async () => {
    const { authToken } = await chrome.storage.local.get('authToken');
    return authToken;
};

const apiRequest = async (endpoint, method = 'GET', body = null) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE}${endpoint}`, options);

    if (response.status === 401 || response.status === 403) {
        // Token expired or invalid
        await chrome.storage.local.remove('authToken');
        throw new Error('Authentication expired');
    }

    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }

    // Handle empty responses (e.g. DELETE)
    const text = await response.text();
    return text ? JSON.parse(text) : null;
};

const API = {
    getUrls: () => apiRequest('/urls'),
    addUrls: (urls) => apiRequest('/urls', 'POST', { urls }),
    deleteUrls: (ids) => apiRequest('/urls', 'DELETE', { ids }),
    getDevices: () => apiRequest('/devices'),
    registerDevice: (device) => apiRequest('/devices', 'POST', device),
};

export { API, AUTH_BASE, getAuthToken };
