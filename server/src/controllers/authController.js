const authService = require('../services/authService');

const googleCallback = async (req, res) => {
    try {
        const { code } = req.query;
        const token = await authService.googleAuth(code);
        // Redirect to extension with token
        res.redirect(`http://localhost:3000/auth/success?token=${token}`);
    } catch (error) {
        console.error('Google Auth Error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Authentication failed',
            details: error.response?.data || error.message
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
