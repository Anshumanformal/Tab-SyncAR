const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
require('dotenv').config();

router.get('/google', (req, res) => {
    const redirectUri = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_CALLBACK_URL)}&response_type=code&scope=email%20profile`;
    res.redirect(redirectUri);
});

router.get('/google/callback', authController.googleCallback);

router.get('/github', (req, res) => {
    const redirectUri = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GITHUB_CALLBACK_URL)}&scope=user:email`;
    res.redirect(redirectUri);
});

router.get('/github/callback', authController.githubCallback);

router.get('/success', (req, res) => {
    res.send(`
        <html>
            <body>
                <h1>Authentication Successful</h1>
                <p>You can now close this window and return to the extension.</p>
                <script>
                    // The extension should intercept this URL or we can use window.postMessage if opened in popup (unlikely for OAuth)
                    // For now, just a success message.
                </script>
            </body>
        </html>
    `);
});

module.exports = router;
