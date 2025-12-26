require('dotenv').config();
const { Pool } = require('pg');

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);

const pool = new Pool({
    user: process.env.DB_USER,
    host: '127.0.0.1', // Force IPv4 loopback
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect()
    .then(client => {
        console.log('Connected successfully');
        client.release();
        pool.end();
    })
    .catch(err => {
        console.error('Connection failed:', err.message);
        pool.end();
    });
