/**
 * Every localStorage read and write in the app.
 *
 * Storage throws in more situations than people expect — Safari private mode,
 * a full quota, disabled site data — and a puzzle game must never break because
 * of it. So every access here is wrapped, failures are swallowed, and reads
 * return a sensible default. Callers can treat storage as best-effort.
 */

const SAVE_KEY = 'sudoku_saved_game';
const STATS_KEY = 'sudoku_stats';
const THEME_KEY = 'sudoku-theme';
const NAME_KEY = 'sudoku-player-name';
const playedKey = (difficulty) => `played_${difficulty}`;

function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        return false; // quota exceeded or storage unavailable
    }
}

function remove(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) { /* nothing to do */ }
}

// ── Saved game ─────────────────────────────────────────────────────────
export const loadSavedGame = () => readJson(SAVE_KEY, null);
export const saveGameState = (state) => writeJson(SAVE_KEY, state);
export const deleteSavedGame = () => remove(SAVE_KEY);

// ── Stats ──────────────────────────────────────────────────────────────
export const getStats = () => readJson(STATS_KEY, {}) || {};
export const saveStats = (stats) => writeJson(STATS_KEY, stats);
export const resetStats = () => remove(STATS_KEY);

/**
 * Record a completed game and return the updated stats.
 *
 * `autoNotes` is tracked separately from hints rather than folded into them:
 * both are assists, but a hint reveals an answer while auto-notes only does
 * bookkeeping, so conflating them would misreport how a game was played.
 */
export function recordWin(difficulty, timeSeconds, hints, autoNotes = false) {
    const stats = getStats();
    if (!stats[difficulty]) {
        stats[difficulty] = {
            played: 0, won: 0, bestTime: null, totalTime: 0, totalHints: 0, autoNotesGames: 0,
        };
    }

    const entry = stats[difficulty];
    entry.played++;
    entry.won++;
    entry.totalTime += timeSeconds;
    entry.totalHints += hints;
    // Older saved stats predate this field.
    entry.autoNotesGames = (entry.autoNotesGames || 0) + (autoNotes ? 1 : 0);
    if (entry.bestTime === null || timeSeconds < entry.bestTime) {
        entry.bestTime = timeSeconds;
    }

    saveStats(stats);
    return stats;
}

// ── Preferences ────────────────────────────────────────────────────────
export function getTheme(fallback = 'midnight') {
    try {
        return localStorage.getItem(THEME_KEY) || fallback;
    } catch (e) {
        return fallback;
    }
}

export function setTheme(theme) {
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (e) { /* preference simply will not persist */ }
}

export function getPlayerName() {
    try {
        return localStorage.getItem(NAME_KEY) || '';
    } catch (e) {
        return '';
    }
}

export function setPlayerName(name) {
    try {
        localStorage.setItem(NAME_KEY, name);
    } catch (e) { /* preference simply will not persist */ }
}

// ── Played-puzzle tracking ─────────────────────────────────────────────
// Ids of puzzles already served, per difficulty, so random picks avoid repeats.

export function getPlayed(difficulty) {
    const played = readJson(playedKey(difficulty), []);
    return Array.isArray(played) ? played : [];
}

export function markPlayed(difficulty, id) {
    const played = getPlayed(difficulty);
    played.push(id);
    writeJson(playedKey(difficulty), played);
    return played;
}

export function clearPlayed(difficulty) {
    writeJson(playedKey(difficulty), []);
}
