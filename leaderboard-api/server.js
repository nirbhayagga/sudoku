const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'leaderboard.json');

app.use(cors());
app.use(express.json());

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Load or initialize leaderboard
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) { console.error('Error loading data:', e.message); }
    return {};
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) { console.error('Error saving data:', e.message); }
}

// GET /api/leaderboard/:difficulty
// Returns top 50 scores for a difficulty, sorted by time ascending
app.get('/api/leaderboard/:difficulty', (req, res) => {
    const { difficulty } = req.params;
    const data = loadData();
    const entries = data[difficulty] || [];
    res.json(entries.slice(0, 50));
});

// GET /api/leaderboard
// Returns all difficulties with their top 10
app.get('/api/leaderboard', (req, res) => {
    const data = loadData();
    const summary = {};
    for (const [diff, entries] of Object.entries(data)) {
        summary[diff] = entries.slice(0, 10);
    }
    res.json(summary);
});

// POST /api/leaderboard
// Body: { name, difficulty, time, hints, level }
app.post('/api/leaderboard', (req, res) => {
    const { name, difficulty, time, hints, level } = req.body;

    if (!name || !difficulty || time === undefined) {
        return res.status(400).json({ error: 'Missing required fields: name, difficulty, time' });
    }

    // Sanitize name (max 20 chars, strip HTML)
    const cleanName = String(name).replace(/<[^>]*>/g, '').trim().slice(0, 20);
    if (!cleanName) {
        return res.status(400).json({ error: 'Invalid name' });
    }

    const entry = {
        name: cleanName,
        difficulty,
        time: Math.round(time),
        hints: hints || 0,
        level: level || null,
        date: new Date().toISOString()
    };

    const data = loadData();
    if (!data[difficulty]) data[difficulty] = [];
    data[difficulty].push(entry);

    // Sort by time ascending, keep top 100 per difficulty
    data[difficulty].sort((a, b) => a.time - b.time);
    data[difficulty] = data[difficulty].slice(0, 100);

    saveData(data);

    const rank = data[difficulty].findIndex(e =>
        e.name === entry.name && e.time === entry.time && e.date === entry.date
    ) + 1;

    res.json({ success: true, rank, entry });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Leaderboard API running on port ${PORT}`);
});
