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
    const { data } = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token } = data;
    const userInfo = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
    });

    const user = await getOrCreateUser(userInfo.data.email, 'google');
    return generateToken(user);
};

const githubAuth = async (code) => {
    const { data } = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_CALLBACK_URL,
    }, {
        headers: { Accept: 'application/json' }
    });

    const { access_token } = data;
    const userInfo = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${access_token}` },
    });

    // GitHub emails can be private, need to fetch them explicitly
    let email = userInfo.data.email;
    if (!email) {
        const emails = await axios.get('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${access_token}` },
        });
        const primary = emails.data.find(e => e.primary && e.verified);
        email = primary ? primary.email : null;
    }

    if (!email) throw new Error('No public or verified email found on GitHub account');

    const user = await getOrCreateUser(email, 'github');
    return generateToken(user);
};

module.exports = {
    googleAuth,
    githubAuth,
};
