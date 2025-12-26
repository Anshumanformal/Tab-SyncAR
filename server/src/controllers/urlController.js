const db = require('../config/db');
const EventBus = require('../lib/eventBus');

const MAX_URLS = 50;

const getUrls = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM urls WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get URLs Error:', error);
        res.status(500).json({ error: 'Failed to fetch URLs' });
    }
};

const addUrls = async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const { urls } = req.body; // Expecting array of { url, title, source }

        if (!Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        const addedUrls = [];

        for (const item of urls) {
            // Normalize URL
            let normalizedUrl = item.url.trim();
            try {
                const urlObj = new URL(normalizedUrl);
                // Remove trailing slash if path is just /
                if (urlObj.pathname === '/' && !urlObj.search && !urlObj.hash) {
                    normalizedUrl = urlObj.origin;
                } else if (urlObj.pathname.endsWith('/')) {
                    normalizedUrl = normalizedUrl.slice(0, -1);
                }
                // Lowercase scheme and host
                normalizedUrl = urlObj.protocol.toLowerCase() + '//' + urlObj.hostname.toLowerCase() + (urlObj.port ? ':' + urlObj.port : '') + urlObj.pathname + urlObj.search + urlObj.hash;
            } catch (e) {
                // Invalid URL, skip or error. Let's skip.
                continue;
            }

            // Check for duplicate active URL
            const existing = await client.query(
                'SELECT id FROM urls WHERE user_id = $1 AND url = $2 AND deleted_at IS NULL',
                [req.user.id, normalizedUrl]
            );

            if (existing.rows.length > 0) {
                continue; // Idempotent: skip if exists
            }

            // Check limit
            const countResult = await client.query(
                'SELECT COUNT(*) FROM urls WHERE user_id = $1 AND deleted_at IS NULL',
                [req.user.id]
            );
            const currentCount = parseInt(countResult.rows[0].count);

            if (currentCount >= MAX_URLS) {
                // Remove oldest auto-synced URL
                await client.query(`
          UPDATE urls SET deleted_at = NOW() 
          WHERE id = (
            SELECT id FROM urls 
            WHERE user_id = $1 AND deleted_at IS NULL AND source = 'auto' 
            ORDER BY created_at ASC LIMIT 1
          )
        `, [req.user.id]);

                const newCountResult = await client.query(
                    'SELECT COUNT(*) FROM urls WHERE user_id = $1 AND deleted_at IS NULL',
                    [req.user.id]
                );
                if (parseInt(newCountResult.rows[0].count) >= MAX_URLS) {
                    if (item.source === 'manual') {
                        throw new Error('URL limit reached. Delete some URLs to add more.');
                    }
                    continue;
                }
            }

            const result = await client.query(
                'INSERT INTO urls (user_id, url, title, source) VALUES ($1, $2, $3, $4) RETURNING *',
                [req.user.id, normalizedUrl, item.title, item.source || 'auto']
            );
            addedUrls.push(result.rows[0]);
        }

        await client.query('COMMIT');

        if (addedUrls.length > 0) {
            // Publish event via EventBus
            await EventBus.emit(req.user.id, JSON.stringify({
                type: 'URL_ADDED',
                payload: addedUrls
            }));
        }

        res.status(201).json(addedUrls);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Add URLs Error:', error);
        res.status(500).json({ error: error.message || 'Failed to add URLs' });
    } finally {
        client.release();
    }
};

const deleteUrls = async (req, res) => {
    try {
        const { ids } = req.body; // Array of UUIDs

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        await db.query(
            'UPDATE urls SET deleted_at = NOW() WHERE user_id = $1 AND id = ANY($2)',
            [req.user.id, ids]
        );

        // Publish event via EventBus
        await EventBus.emit(req.user.id, JSON.stringify({
            type: 'URL_DELETED',
            payload: ids
        }));

        res.sendStatus(200);
    } catch (error) {
        console.error('Delete URLs Error:', error);
        res.status(500).json({ error: 'Failed to delete URLs' });
    }
};

module.exports = {
    getUrls,
    addUrls,
    deleteUrls,
};
