const authService = require('../services/authService');

const googleCallback = async (req, res) => {
    console.log('[AuthController] Google Callback Hit');
    try {
        const { code } = req.query;
        console.log('[AuthController] Code received:', code);
        const token = await authService.googleAuth(code);
        console.log('[AuthController] Token generated, redirecting...');
        // Redirect to extension with token
        res.redirect(`http://localhost:3000/auth/success?token=${token}`);
    } catch (error) {
        console.error('Google Auth Error Full:', error);
        if (error.response) {
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
        res.status(500).json({
            error: 'Authentication failed',
            details: error.response?.data || error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

const githubCallback = async (req, res) => {
    try {
        const { code } = req.query;
        const token = await authService.githubAuth(code);
        res.redirect(`http://localhost:3000/auth/success?token=${token}`);
    } catch (error) {
        console.error('GitHub Auth Error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Authentication failed',
            details: error.response?.data || error.message
        });
    }
};

module.exports = {
    googleCallback,
    githubCallback,
};
