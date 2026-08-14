const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(__dirname));

// Initialize Database connection
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

// Helper functions to wrap sqlite3 methods in Promises
const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
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
                created_at INTEGER NOT NULL
            )
        `);
        console.log('Database tables initialized.');
    } catch (err) {
        console.error('Database initialization failed:', err.message);
    }
}

/* =========================================================
   REST API ROUTES
========================================================= */

// Get all posts
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

// Create a new post
app.post('/api/posts', async (req, res) => {
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

// Update a post
app.put('/api/posts/:id', async (req, res) => {
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

// Delete a post
app.delete('/api/posts/:id', async (req, res) => {
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
