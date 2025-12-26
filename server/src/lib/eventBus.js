const { caching } = require('cache-manager');

// In-memory store for connection metadata
// We use cache-manager as requested to hold the "state" of active clients
let memoryCache;

// Local map for actual WebSocket connections (cannot be stored in cache-manager if it serializes)
// Since we are single process, this is fine.
const localConnections = new Map();

const init = async () => {
    if (!memoryCache) {
        memoryCache = await caching('memory', {
            max: 1000,
            ttl: 0 // No TTL, explicit management
        });
    }
};

const subscribe = async (userId, connectionId, sendFn) => {
    await init();

    // Store the actual connection handler locally
    localConnections.set(connectionId, sendFn);

    // Update the list of active connections for this user in cache-manager
    let connections = await memoryCache.get(`user:${userId}`) || [];
    if (!connections.includes(connectionId)) {
        connections.push(connectionId);
        await memoryCache.set(`user:${userId}`, connections);
    }
};

const unsubscribe = async (userId, connectionId) => {
    await init();

    localConnections.delete(connectionId);

    let connections = await memoryCache.get(`user:${userId}`) || [];
    connections = connections.filter(id => id !== connectionId);

    if (connections.length > 0) {
        await memoryCache.set(`user:${userId}`, connections);
    } else {
        await memoryCache.del(`user:${userId}`);
    }
};

const emit = async (userId, event) => {
    await init();

    const connections = await memoryCache.get(`user:${userId}`);
    if (!connections) return;

    connections.forEach(connId => {
        const sendFn = localConnections.get(connId);
        if (sendFn) {
            try {
                sendFn(event);
            } catch (e) {
                console.error('Error sending to client', connId, e);
            }
        }
    });
};

module.exports = {
    subscribe,
    unsubscribe,
    emit
};
