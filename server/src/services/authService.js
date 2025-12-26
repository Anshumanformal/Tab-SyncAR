const db = require('../config/db');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const generateToken = (user) => {
    return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

const getOrCreateUser = async (email, provider) => {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length > 0) {
        return result.rows[0];
    } else {
        const newUser = await db.query(
            'INSERT INTO users (email, provider) VALUES ($1, $2) RETURNING *',
            [email, provider]
        );
        return newUser.rows[0];
    }
};

const googleAuth = async (code) => {
    console.log('[AuthService] Starting Google Auth with code:', code ? 'PRESENT' : 'MISSING');

    const tokenParams = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    });

    console.log('[AuthService] Requesting Google Token...');
    try {
        const { data } = await axios.post('https://oauth2.googleapis.com/token', tokenParams.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        console.log('[AuthService] Google Token Received');

        const { access_token } = data;
        console.log('[AuthService] Fetching User Info...');
        const userInfo = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` },
        });
        console.log('[AuthService] User Info Received:', userInfo.data.email);

        const user = await getOrCreateUser(userInfo.data.email, 'google');
        console.log('[AuthService] User Retrieved/Created:', user.id);
        return generateToken(user);
    } catch (error) {
        console.error('[AuthService] Google Auth Failed:', error.response?.data || error.message);
        throw error;
    }
};

const githubAuth = async (code) => {
    console.log('[AuthService] Starting GitHub Auth with code:', code ? 'PRESENT' : 'MISSING');

    try {
        console.log('[AuthService] Requesting GitHub Token...');
        const { data } = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: process.env.GITHUB_CALLBACK_URL,
        }, {
            headers: { Accept: 'application/json' }
        });

        if (data.error) {
            throw new Error(`GitHub Error: ${data.error_description || data.error}`);
        }
        console.log('[AuthService] GitHub Token Received');

        const { access_token } = data;
        console.log('[AuthService] Fetching User Info...');
        const userInfo = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        // GitHub emails can be private, need to fetch them explicitly
        let email = userInfo.data.email;
        if (!email) {
            console.log('[AuthService] Email private, fetching emails...');
            const emails = await axios.get('https://api.github.com/user/emails', {
                headers: { Authorization: `Bearer ${access_token}` },
            });
            const primary = emails.data.find(e => e.primary && e.verified);
            email = primary ? primary.email : null;
        }

        if (!email) throw new Error('No public or verified email found on GitHub account');
        console.log('[AuthService] User Email:', email);

        const user = await getOrCreateUser(email, 'github');
        console.log('[AuthService] User Retrieved/Created:', user.id);
        return generateToken(user);
    } catch (error) {
        console.error('[AuthService] GitHub Auth Failed:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = {
    googleAuth,
    githubAuth,
};
