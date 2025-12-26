const db = require('./db');

const createTables = async () => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Users Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        provider TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

        // Devices Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        browser TEXT NOT NULL,
        platform TEXT NOT NULL,
        last_seen TIMESTAMP DEFAULT NOW()
      );
    `);

        // URLs Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS urls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        title TEXT,
        source TEXT CHECK (source IN ('auto', 'manual')) DEFAULT 'auto',
        created_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
    `);

        // Indexes for performance
        await client.query(`CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls(user_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_urls_created_at ON urls(created_at);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);`);

        await client.query('COMMIT');
        console.log('Tables created successfully');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error creating tables', e);
    } finally {
        client.release();
        process.exit();
    }
};

createTables();
