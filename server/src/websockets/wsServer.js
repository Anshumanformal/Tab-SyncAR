const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const EventBus = require('../lib/eventBus');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const setupWebSocket = (server) => {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', async (ws, req) => {
        // Extract token from query string
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');

        if (!token) {
            ws.close(1008, 'Token required');
            return;
        }

        let user;
        try {
            user = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            ws.close(1008, 'Invalid token');
            return;
        }

        ws.user = user;
        ws.id = uuidv4(); // Unique connection ID
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        console.log(`User ${user.id} connected via WebSocket (Conn: ${ws.id})`);

        // Subscribe to EventBus
        // We pass a callback that sends the message to this specific socket
        const sendToClient = (message) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        };

        await EventBus.subscribe(user.id, ws.id, sendToClient);

        ws.on('close', async () => {
            console.log(`User ${user.id} disconnected (Conn: ${ws.id})`);
            await EventBus.unsubscribe(user.id, ws.id);
        });

        ws.on('error', (err) => {
            console.error('WebSocket error:', err);
        });
    });

    // Heartbeat
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
    });
};

module.exports = setupWebSocket;
