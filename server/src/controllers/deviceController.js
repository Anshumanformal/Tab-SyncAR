const db = require('../config/db');
const EventBus = require('../lib/eventBus');

const getDevices = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM devices WHERE user_id = $1 ORDER BY last_seen DESC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get Devices Error:', error);
        res.status(500).json({ error: 'Failed to fetch devices' });
    }
};

const registerDevice = async (req, res) => {
    try {
        const { name, browser, platform } = req.body;

        let deviceId = req.body.deviceId;
        let device;

        if (deviceId) {
            const result = await db.query(
                'UPDATE devices SET last_seen = NOW(), name = $1, browser = $2, platform = $3 WHERE id = $4 AND user_id = $5 RETURNING *',
                [name, browser, platform, deviceId, req.user.id]
            );
            device = result.rows[0];
        }

        if (!device) {
            const result = await db.query(
                'INSERT INTO devices (user_id, name, browser, platform) VALUES ($1, $2, $3, $4) RETURNING *',
                [req.user.id, name, browser, platform]
            );
            device = result.rows[0];
        }

        // Publish event via EventBus
        await EventBus.emit(req.user.id, JSON.stringify({
            type: 'DEVICE_ONLINE',
            payload: device
        }));

        res.json(device);
    } catch (error) {
        console.error('Register Device Error:', error);
        res.status(500).json({ error: 'Failed to register device' });
    }
};

module.exports = {
    getDevices,
    registerDevice,
};
