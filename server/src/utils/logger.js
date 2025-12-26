const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, 'app.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Helper to format args
const formatArgs = (args) => {
    return args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');
};

// Override console methods
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    const msg = `[${new Date().toISOString()}] [INFO] ${formatArgs(args)}\n`;
    logStream.write(msg);
    originalLog.apply(console, args);
};

console.error = (...args) => {
    const msg = `[${new Date().toISOString()}] [ERROR] ${formatArgs(args)}\n`;
    logStream.write(msg);
    originalError.apply(console, args);
};

console.log('--- Logger Initialized ---');

module.exports = { logFile };
