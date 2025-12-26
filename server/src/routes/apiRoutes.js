const express = require('express');
const router = express.Router();
const urlController = require('../controllers/urlController');
const deviceController = require('../controllers/deviceController');
const authenticateToken = require('../middleware/auth');

router.use(authenticateToken);

// URLs
router.get('/urls', urlController.getUrls);
router.post('/urls', urlController.addUrls);
router.delete('/urls', urlController.deleteUrls);

// Devices
router.get('/devices', deviceController.getDevices);
router.post('/devices', deviceController.registerDevice);

module.exports = router;
