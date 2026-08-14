const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const pg = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(__dirname));

/* =========================================================
   DATABASE INITIALIZATION (SQLITE OR POSTGRES)
========================================================= */

const usePostgres = !!process.env.DATABASE_URL;
let dbType = 'sqlite';
let pgPool = null;
let sqliteDb = null;

const dbPath = path.join(__dirname, 'database.db');

if (usePostgres) {
    dbType = 'postgres';
    pgPool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Required for Supabase/Neon connection on Render/Fly.io
        }
    });
    console.log('Using PostgreSQL cloud database.');
    initializeDatabase();
} else {
    dbType = 'sqlite';
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening SQLite database:', err.message);
        } else {
            console.log('Using SQLite local database (database.db).');
            initializeDatabase();
        }
    });
}

// Convert SQLite parameter marker '?' to PostgreSQL parameter marker '$1', '$2', etc.
function convertSql(sql, targetType) {
    if (targetType === 'postgres') {
        let index = 1;
        return sql.replace(/\?/g, () => `$${index++}`);
    }
    return sql;
}

// Promisified database helpers for compatibility between SQLite and pg
const dbRun = async (sql, params = []) => {
    if (dbType === 'postgres') {
        const pgSql = convertSql(sql, 'postgres');
        const res = await pgPool.query(pgSql, params);
        return { changes: res.rowCount };
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    }
};

const dbAll = async (sql, params = []) => {
    if (dbType === 'postgres') {
        const pgSql = convertSql(sql, 'postgres');
        const res = await pgPool.query(pgSql, params);
        return res.rows;
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
};

// Create tables if they do not exist
async function initializeDatabase() {
    try {
        await dbRun(`
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                main TEXT NOT NULL,
                sidebar TEXT,
                footer TEXT,
                tags TEXT, -- Store tags as JSON array string, e.g. '["tag1", "tag2"]'
                date TEXT NOT NULL,
                editDate TEXT,
                created_at BIGINT NOT NULL
            )
        `);
        console.log('Database tables verified/initialized.');
    } catch (err) {
        console.error('Database initialization failed:', err.message);
    }
}

/* =========================================================
   SECURITY MIDDLEWARE (ADMIN PASSWORD)
========================================================= */

const checkAdminPassword = (req, res, next) => {
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    // If no password is set on the server, bypass security (useful for local development)
    if (!adminPassword) {
        return next();
    }

    const clientPassword = req.headers['x-admin-password'];
    
    if (clientPassword === adminPassword) {
        return next();
    }
    
    res.status(401).json({ error: 'Unauthorized: Admin Password is required or incorrect.' });
};

/* =========================================================
   REST API ROUTES
========================================================= */

// 1. Get all posts (PUBLIC)
app.get('/api/posts', async (req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM posts ORDER BY created_at DESC');
        
        // Parse the JSON tags string back to arrays
        const posts = rows.map(row => ({
            ...row,
            tags: row.tags ? JSON.parse(row.tags) : []
        }));
        
        res.json(posts);
    } catch (err) {
        console.error('Error fetching posts:', err.message);
        res.status(500).json({ error: 'Failed to retrieve posts.' });
    }
});

// 2. Create a new post (SECURED)
app.post('/api/posts', checkAdminPassword, async (req, res) => {
    const { id, title, main, sidebar, footer, tags, date } = req.body;
    
    if (!title || !main) {
        return res.status(400).json({ error: 'Title and Main content are required.' });
    }

    const postId = id || 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const postTags = tags ? JSON.stringify(tags) : '[]';
    const createdAt = Date.now();

    try {
        await dbRun(
            `INSERT INTO posts (id, title, main, sidebar, footer, tags, date, editDate, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
            [postId, title, main, sidebar, footer, postTags, date || new Date().toLocaleString(), createdAt]
        );
        
        res.status(201).json({
            id: postId,
            title,
            main,
            sidebar,
            footer,
            tags: tags || [],
            date: date || new Date().toLocaleString(),
            editDate: null
        });
    } catch (err) {
        console.error('Error inserting post:', err.message);
        res.status(500).json({ error: 'Failed to save post.' });
    }
});

// 3. Update a post (SECURED)
app.put('/api/posts/:id', checkAdminPassword, async (req, res) => {
    const { id } = req.params;
    const { title, main, sidebar, footer, tags, editDate } = req.body;

    if (!title || !main) {
        return res.status(400).json({ error: 'Title and Main content are required.' });
    }

    const postTags = tags ? JSON.stringify(tags) : '[]';
    const postEditDate = editDate || new Date().toLocaleString();

    try {
        const result = await dbRun(
            `UPDATE posts 
             SET title = ?, main = ?, sidebar = ?, footer = ?, tags = ?, editDate = ?
             WHERE id = ?`,
            [title, main, sidebar, footer, postTags, postEditDate, id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Post not found.' });
        }

        res.json({
            id,
            title,
            main,
            sidebar,
            footer,
            tags: tags || [],
            editDate: postEditDate
        });
    } catch (err) {
        console.error('Error updating post:', err.message);
        res.status(500).json({ error: 'Failed to update post.' });
    }
});

// 4. Delete a post (SECURED)
app.delete('/api/posts/:id', checkAdminPassword, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await dbRun('DELETE FROM posts WHERE id = ?', [id]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Post not found.' });
        }

        res.json({ message: 'Post successfully deleted.', id });
    } catch (err) {
        console.error('Error deleting post:', err.message);
        res.status(500).json({ error: 'Failed to delete post.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
