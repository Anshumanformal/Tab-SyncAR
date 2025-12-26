require('dotenv').config();
const axios = require('axios');

console.log('--- Diagnostic Start ---');

// 1. Check Env Vars
const requiredVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CALLBACK_URL',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'GITHUB_CALLBACK_URL'
];

let missing = [];
requiredVars.forEach(varName => {
    if (!process.env[varName]) {
        missing.push(varName);
    } else {
        console.log(`[OK] ${varName} is set (Length: ${process.env[varName].length})`);
    }
});

if (missing.length > 0) {
    console.error('[ERROR] Missing Environment Variables:', missing);
} else {
    console.log('[OK] All required environment variables are present.');
}

// 2. Check Network Connectivity to Google
console.log('Testing connectivity to Google OAuth...');
axios.post('https://oauth2.googleapis.com/token', {})
    .then(() => {
        console.log('[UNEXPECTED] Google accepted empty request?');
    })
    .catch(err => {
        if (err.response) {
            console.log(`[OK] Reachable. Google responded with ${err.response.status}:`, err.response.data);
        } else {
            console.error('[ERROR] Network Error:', err.message);
        }
    });

console.log('--- Diagnostic End ---');
