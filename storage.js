/**
 * Every localStorage read and write in the app.
 *
 * Storage throws in more situations than people expect — Safari private mode,
 * a full quota, disabled site data — and a puzzle game must never break because
 * of it. So every access here is wrapped, failures are swallowed, and reads
 * return a sensible default. Callers can treat storage as best-effort.
 */

const SAVE_KEY = 'sudoku_saved_game';
const STREAK_KEY = 'sudoku_streak';
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
export const resetStats = () => {
    remove(STATS_KEY);
    remove(STREAK_KEY);
    remove(DAILY_KEY);
};

/** Local calendar day as YYYY-MM-DD. Streaks follow the player's own days. */
export function dayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const emptyStreak = () => ({ current: 0, best: 0, lastWin: null });

export const getStreak = () => readJson(STREAK_KEY, emptyStreak()) || emptyStreak();

/**
 * Advance the daily streak for a win on `date`.
 *
 * Several wins on one day count once — the streak measures days returned to,
 * not games played. A gap of more than a day restarts it.
 */
export function recordStreak(date = new Date()) {
    const streak = getStreak();
    const today = dayKey(date);

    if (streak.lastWin === today) return streak; // already counted today

    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);

    streak.current = streak.lastWin === dayKey(yesterday) ? streak.current + 1 : 1;
    streak.best = Math.max(streak.best || 0, streak.current);
    streak.lastWin = today;

    writeJson(STREAK_KEY, streak);
    return streak;
}

/**
 * Note that a game was started, which is what makes a win rate meaningful.
 * Previously only wins were counted, so "played" and "won" were the same number.
 */
export function recordStart(difficulty) {
    const stats = getStats();
    if (!stats[difficulty]) stats[difficulty] = blankEntry();
    stats[difficulty].started = (stats[difficulty].started || 0) + 1;
    saveStats(stats);
    return stats;
}

function blankEntry() {
    return {
        started: 0, played: 0, won: 0, bestTime: null,
        totalTime: 0, totalHints: 0, autoNotesGames: 0,
    };
}

/**
 * Record a completed game and return the updated stats.
 *
 * `autoNotes` is tracked separately from hints rather than folded into them:
 * both are assists, but a hint reveals an answer while auto-notes only does
 * bookkeeping, so conflating them would misreport how a game was played.
 */
export function recordWin(difficulty, timeSeconds, hints, autoNotes = false, date = new Date()) {
    const stats = getStats();
    if (!stats[difficulty]) stats[difficulty] = blankEntry();

    const entry = stats[difficulty];
    entry.played++;
    entry.won++;
    // Stats saved before starts were tracked would otherwise show a win rate
    // above 100%.
    if ((entry.started || 0) < entry.won) entry.started = entry.won;
    entry.totalTime += timeSeconds;
    entry.totalHints += hints;
    // Older saved stats predate this field.
    entry.autoNotesGames = (entry.autoNotesGames || 0) + (autoNotes ? 1 : 0);
    if (entry.bestTime === null || timeSeconds < entry.bestTime) {
        entry.bestTime = timeSeconds;
    }

    saveStats(stats);
    recordStreak(date);
    return stats;
}

/** Totals across every difficulty, plus the streak. */
export function getSummary() {
    const stats = getStats();
    const totals = { started: 0, won: 0, totalTime: 0, totalHints: 0, autoNotesGames: 0 };

    for (const entry of Object.values(stats)) {
        if (!entry || typeof entry !== 'object') continue;
        totals.started += entry.started || entry.won || 0;
        totals.won += entry.won || 0;
        totals.totalTime += entry.totalTime || 0;
        totals.totalHints += entry.totalHints || 0;
        totals.autoNotesGames += entry.autoNotesGames || 0;
    }

    return {
        ...totals,
        winRate: totals.started ? totals.won / totals.started : 0,
        streak: getStreak(),
    };
}

// ── Daily puzzle ───────────────────────────────────────────────────────
// Which days' puzzles have been solved. Kept as a small set of recent days so
// it cannot grow without bound.

const DAILY_KEY = 'sudoku_daily_done';
const DAILY_HISTORY = 60;

export const getDailyDone = () => {
    const days = readJson(DAILY_KEY, []);
    return Array.isArray(days) ? days : [];
};

export const isDailyDone = (dayKey) => getDailyDone().includes(dayKey);

export function markDailyDone(dayKey) {
    const days = getDailyDone();
    if (days.includes(dayKey)) return days;

    days.push(dayKey);
    days.sort();
    const trimmed = days.slice(-DAILY_HISTORY);
    writeJson(DAILY_KEY, trimmed);
    return trimmed;
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
