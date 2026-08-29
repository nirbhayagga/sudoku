const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
// Overridable so tests (and alternate deployments) can point at another store.
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'leaderboard.json');

app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
}));
app.use(express.json());

// How many proxies sit in front of this process. Rate limiting is per client
// address, and behind nginx every request arrives from nginx's own address —
// so without this the entire site shared one bucket of five submissions a
// minute. Set to the number of hops (nginx alone is 1; Traefik then nginx is
// 2) so Express reads the client from X-Forwarded-For at that depth and no
// deeper. Zero, the default, trusts nothing: a process reachable directly
// must not let a client name its own address and walk past the limit.
app.set('trust proxy', Number(process.env.TRUST_PROXY) || 0);

// Simple in-memory rate limiting for POST submissions
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 5; // submissions per window

function rateLimit(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress;
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (entry && now - entry.start < RATE_LIMIT_WINDOW) {
        if (entry.count >= RATE_LIMIT_MAX) {
            return res.status(429).json({ error: 'Too many submissions. Try again later.' });
        }
        entry.count++;
    } else {
        rateLimitMap.set(ip, { start: now, count: 1 });
    }
    next();
}

// Clean up stale rate limit entries every 5 minutes.
// unref() so this timer never keeps the process alive on shutdown.
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        if (now - entry.start > RATE_LIMIT_WINDOW) rateLimitMap.delete(ip);
    }
}, 5 * 60 * 1000).unref();

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

/**
 * Load the leaderboard, or start empty.
 *
 * A file that exists but will not parse is moved aside rather than read over:
 * returning {} is the only way to keep serving, but the next save would then
 * overwrite whatever was salvageable with an empty board. Keeping the original
 * under a timestamped name turns silent data loss into a recoverable one.
 */
function loadData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        console.error('Error loading data:', e.message);
        try {
            fs.renameSync(DATA_FILE, `${DATA_FILE}.corrupt-${Date.now()}`);
        } catch (moveError) { console.error('Could not set aside corrupt data:', moveError.message); }
        return {};
    }
}

/**
 * Write the whole file atomically: to a temporary name, then rename over the
 * original. writeFileSync truncates before it writes, so a crash or a full
 * disk mid-write used to leave a half-written file — and an empty board on
 * the next start. rename() is atomic on the same filesystem, so readers only
 * ever see the old file or the new one.
 */
function saveData(data) {
    const tmp = `${DATA_FILE}.tmp`;
    try {
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
        fs.renameSync(tmp, DATA_FILE);
    } catch (e) {
        console.error('Error saving data:', e.message);
        try { fs.rmSync(tmp, { force: true }); } catch (cleanupError) { /* nothing left to do */ }
    }
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
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'expert', 'evil', 'nightmare'];
const MAX_TIME_SECONDS = 24 * 60 * 60; // a day; anything beyond is bogus
const MAX_HINTS = 81;
const MAX_MISTAKES = 999;

/**
 * Puzzles per tier — a level is a 1-based position in that tier's bank, so
 * anything past the end names no puzzle. Mirrors BANK_SIZES in difficulties.js,
 * which this package cannot import (it ships in its own container); a test in
 * the frontend suite asserts the two agree.
 *
 * Out of range is coerced to null rather than rejected: the client never sends
 * one, so it is either forged, where dropping the claim is enough, or a bank
 * that grew before this API was redeployed, where losing the score would be
 * the wrong outcome.
 */
const LEVEL_LIMITS = {
    easy: 500, medium: 500, hard: 500, expert: 500, evil: 500, nightmare: 3000,
};

app.post('/api/leaderboard', rateLimit, (req, res) => {
    const { name, difficulty, time, hints, level, autoNotes, mistakes } = req.body;

    if (!name || !difficulty || time === undefined) {
        return res.status(400).json({ error: 'Missing required fields: name, difficulty, time' });
    }

    if (!VALID_DIFFICULTIES.includes(difficulty)) {
        return res.status(400).json({ error: 'Invalid difficulty' });
    }

    // Sanitize name (max 20 chars, strip HTML)
    const cleanName = String(name).replace(/<[^>]*>/g, '').trim().slice(0, 20);
    if (!cleanName) {
        return res.status(400).json({ error: 'Invalid name' });
    }

    // Every numeric field is coerced and bounded. These are rendered by the
    // frontend, so anything that is not a number here becomes markup there;
    // unvalidated they were a stored XSS vector as well as a way to corrupt
    // the time-based sort.
    const cleanTime = Number(time);
    if (!Number.isFinite(cleanTime) || cleanTime < 0 || cleanTime > MAX_TIME_SECONDS) {
        return res.status(400).json({ error: 'Invalid time' });
    }

    const parsedHints = Number(hints);
    const cleanHints = Number.isFinite(parsedHints)
        ? Math.min(MAX_HINTS, Math.max(0, Math.round(parsedHints)))
        : 0;

    // Null, not zero, when absent: a client that predates the field made an
    // unknown number of mistakes, not none.
    const parsedMistakes = Number(mistakes);
    const cleanMistakes = mistakes === undefined || !Number.isFinite(parsedMistakes)
        ? null
        : Math.min(MAX_MISTAKES, Math.max(0, Math.round(parsedMistakes)));

    const parsedLevel = Math.round(Number(level));
    const cleanLevel = Number.isFinite(parsedLevel) && parsedLevel >= 1 && parsedLevel <= LEVEL_LIMITS[difficulty]
        ? parsedLevel
        : null;

    const entry = {
        name: cleanName,
        difficulty,
        time: Math.round(cleanTime),
        hints: cleanHints,
        mistakes: cleanMistakes,
        level: cleanLevel,
        // Auto-notes fills candidates automatically. It reveals no answers, but
        // it removes the scanning work, so entries record whether it was on.
        autoNotes: autoNotes === true,
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

// Only listen when run directly — tests import the app and bind their own port.
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Leaderboard API running on port ${PORT}`);
    });
}

module.exports = app;
module.exports.LEVEL_LIMITS = LEVEL_LIMITS;
