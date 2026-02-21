const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'scores.db');

app.use(cors());
app.use(express.json());

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// Initialize SQLite DB
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    } else {
        console.log('Connected to SQLite database at', DB_PATH);
        db.run(`
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                difficulty TEXT NOT NULL,
                level INTEGER,
                time_seconds INTEGER NOT NULL,
                date TEXT NOT NULL
            )
        `);
    }
});

app.get('/api/scores', (req, res) => {
    const { difficulty } = req.query;
    if (!difficulty) return res.status(400).json({ error: 'Difficulty is required' });

    db.all(`
        SELECT name, difficulty, level, time_seconds, date 
        FROM scores 
        WHERE difficulty = ? 
        ORDER BY time_seconds ASC 
        LIMIT 10
    `, [difficulty], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/scores', (req, res) => {
    const { name, difficulty, level, time_seconds } = req.body;
    if (!name || !difficulty || time_seconds === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Sanitize 
    const cleanName = String(name).substring(0, 20).trim();
    if (!cleanName) return res.status(400).json({ error: 'Name cannot be empty' });

    const date = new Date().toISOString();

    db.run(`
        INSERT INTO scores (name, difficulty, level, time_seconds, date)
        VALUES (?, ?, ?, ?, ?)
    `, [cleanName, difficulty, level, time_seconds, date], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, name: cleanName, difficulty, level, time_seconds, date });
    });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
    console.log(`Sudoku backend running on port ${PORT}`);
});
