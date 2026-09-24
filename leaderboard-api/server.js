const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
// Overridable so tests (and alternate deployments) can point at another store.
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'leaderboard.json');

app.use(cors({
    // Same-origin deployments need no CORS headers. Cross-origin clients must opt in.
    origin: process.env.CORS_ORIGIN || false,
}));
// A score submission is well under 1 kB; anything bigger is not a score.
app.use(express.json({ limit: '10kb' }));

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
        return validateData(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
    } catch (e) {
        if (!(e instanceof SyntaxError) && !(e instanceof TypeError)) throw e;
        console.error('Error loading data:', e.message);
        try {
            fs.renameSync(DATA_FILE, `${DATA_FILE}.corrupt-${Date.now()}`);
        } catch (moveError) {
            console.error('Could not set aside corrupt data:', moveError.message);
            throw moveError;
        }
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
        throw e;
    }
}

// GET /api/leaderboard/:difficulty
// Returns top 50 scores for a difficulty, sorted by time ascending
app.get('/api/leaderboard/:difficulty', (req, res) => {
    const { difficulty } = req.params;
    if (!VALID_DIFFICULTIES.includes(difficulty)) {
        return res.status(400).json({ error: 'Invalid difficulty' });
    }
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
// Body: { name, difficulty, time, hints, level, mistakes, autoNotes }
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'expert', 'evil', 'nightmare'];
const MAX_TIME_SECONDS = 24 * 60 * 60; // Leaderboard policy: only accept games lasting at most 24 hours.
// Cumulative counts can exceed the cell count after undoing and replaying moves.
const MAX_HINTS = Number.MAX_SAFE_INTEGER;
const MAX_MISTAKES = Number.MAX_SAFE_INTEGER;

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

// Extract plain text in one pass; never emit angle brackets, including from
// malformed/nested tags. Output still must be escaped by HTML consumers.
function cleanPlayerName(value) {
    let text = '';
    let inTag = false;
    for (const char of String(value)) {
        if (char === '<') inTag = true;
        else if (char === '>') inTag = false;
        else if (!inTag) text += char;
    }
    return text.trim().slice(0, 20);
}

function validateData(data) {
    const fail = () => { throw new TypeError('Invalid leaderboard data'); };
    const integer = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail();
    const validated = {};
    for (const [difficulty, entries] of Object.entries(data)) {
        if (!VALID_DIFFICULTIES.includes(difficulty) || !Array.isArray(entries)) fail();
        validated[difficulty] = entries.map(entry => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)
                || entry.difficulty !== difficulty
                || typeof entry.name !== 'string' || !entry.name
                || entry.name.length > 20 || !entry.name.trim()
                || entry.name.includes('<') || entry.name.includes('>')
                || !integer(entry.time, MAX_TIME_SECONDS)
                || !integer(entry.hints, MAX_HINTS)
                || (entry.level != null && (!integer(entry.level, LEVEL_LIMITS[difficulty]) || entry.level === 0))
                || (entry.mistakes != null && !integer(entry.mistakes, MAX_MISTAKES))
                || (entry.autoNotes !== undefined && typeof entry.autoNotes !== 'boolean')
                || typeof entry.date !== 'string' || !Number.isFinite(Date.parse(entry.date))) fail();
            // Older clients did not record assistance or mistakes. Copy known fields only.
            return {
                name: entry.name, difficulty, time: entry.time, hints: entry.hints,
                level: entry.level ?? null, mistakes: entry.mistakes ?? null,
                autoNotes: entry.autoNotes ?? false, date: entry.date,
            };
        }).sort((a, b) => a.time - b.time).slice(0, 100);
    }
    return validated;
}

app.post('/api/leaderboard', rateLimit, (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Invalid request body' });
    }
    const { name, difficulty, time, hints, level, autoNotes, mistakes } = req.body;

    if (!name || !difficulty || time === undefined) {
        return res.status(400).json({ error: 'Missing required fields: name, difficulty, time' });
    }

    if (!VALID_DIFFICULTIES.includes(difficulty)) {
        return res.status(400).json({ error: 'Invalid difficulty' });
    }

    // Sanitize name (max 20 chars, strip HTML)
    const cleanName = cleanPlayerName(name);
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
    const cleanMistakes = mistakes == null || !Number.isFinite(parsedMistakes)
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

    const index = data[difficulty].indexOf(entry);
    // Accepted scores outside retention are successful, but have no stored rank.
    res.json({ success: true, ranked: index !== -1, rank: index === -1 ? null : index + 1, entry });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Express's default error page includes HTML (and development stacks).
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request body too large' });
    }
    if (err.status >= 400 && err.status < 500) {
        return res.status(err.status).json({ error: 'Invalid request body' });
    }
    console.error('Leaderboard request failed:', err.message);
    res.status(500).json({ error: 'Unable to access leaderboard' });
});

// Only listen when run directly — tests import the app and bind their own port.
if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`Leaderboard API running on port ${server.address().port}`);
    });
    let shuttingDown = false;
    server.on('request', (req, res) => {
        res.once('finish', () => {
            // Requests active at close() can become idle keep-alive sockets
            // afterwards; close those too once their response has been sent.
            if (shuttingDown) server.closeIdleConnections();
        });
    });
    const shutdown = signal => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`Received ${signal}; closing leaderboard API`);
        // Stop accepting connections and let active requests finish. A stalled
        // upload must not hold container shutdown open indefinitely.
        const deadline = setTimeout(() => {
            console.error('Leaderboard shutdown timed out');
            process.exit(1);
        }, 5000);
        deadline.unref();
        server.close(error => {
            clearTimeout(deadline);
            if (error) console.error('Error closing leaderboard API:', error.message);
            process.exitCode = error ? 1 : 0;
        });
    };
    // PID 1 needs explicit handlers; imports must not install process listeners.
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
module.exports.LEVEL_LIMITS = LEVEL_LIMITS;
