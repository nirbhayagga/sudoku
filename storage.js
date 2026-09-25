/**
 * Every localStorage read and write in the app.
 *
 * Storage throws in more situations than people expect — Safari private mode,
 * a full quota, disabled site data — and a puzzle game must never break because
 * of it. So every access here is wrapped, failures are swallowed, and reads
 * return a sensible default. Callers can treat storage as best-effort.
 * Backup operations report failures explicitly instead of hiding data loss.
 */

import { BANK_VERSION, BANK_SIZES, GAME_LABELS, isDifficulty, isGameDifficulty } from './difficulties.js';
import { SudokuSolver } from './solver.js';
import { isPuzzleId } from './puzzle-id.js';
import { normalizeProgress, validProgressId } from './progression.js';

const DIFFICULTIES = Object.keys(BANK_SIZES);
const THEMES = ['light', 'dark', 'midnight', 'sakura', 'ocean', 'forest', 'arctic', 'peony', 'matcha', 'vino'];
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCount = value => Number.isSafeInteger(value) && value >= 0;
const count = value => isCount(value) ? value : 0;
const add = (a, b) => Math.min(Number.MAX_SAFE_INTEGER, a + b);

/** Gregorian calendar validation without Date's rollover or years 0–99 special case. */
export function isCalendarDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return year >= 1 && month >= 1 && month <= 12 && day >= 1 &&
        day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/**
 * Validate and copy a save. Expensive solution recomputation is reserved for
 * load/import/handoff boundaries; normal move saves only check the schema.
 * Optional fields introduced after the original save format receive defaults.
 */
export function validateGameState(state, { recomputeSolution = true } = {}) {
    if (!isRecord(state) || !['puzzle', 'userValues', 'difficulty'].every(key => Object.hasOwn(state, key)) || !isGameDifficulty(state.difficulty)) return null;
    const board = value => typeof value === 'string' && /^[0-9]{81}$/.test(value);
    if (!board(state.puzzle) || !board(state.userValues)) return null;
    const notes = Object.hasOwn(state, 'notes') ? state.notes : Array.from({ length: 81 }, () => []);
    if (!Array.isArray(notes) || notes.length !== 81 ||
        !Array.from(notes).every(cell => Array.isArray(cell) && cell.length <= 9 &&
            cell.every(digit => typeof digit === 'string' && /^[1-9]$/.test(digit)) && new Set(cell).size === cell.length)) return null;
    const result = {
        puzzle: state.puzzle, userValues: state.userValues, difficulty: state.difficulty,
        notes: notes.map(cell => [...cell]),
    };
    for (const key of ['timerSeconds', 'hintsUsed', 'mistakes']) {
        const value = Object.hasOwn(state, key) ? state[key] : 0;
        if (!isCount(value)) return null;
        result[key] = value;
    }
    for (const key of ['autoNotes', 'autoNotesUsed']) {
        const value = Object.hasOwn(state, key) ? state[key] : false;
        if (typeof value !== 'boolean') return null;
        result[key] = value;
    }
    // Auto-notes usage is sticky, including saves predating the usage flag.
    result.autoNotesUsed ||= result.autoNotes;
    result.completion = null;
    if (state.completion != null) {
        const completed = state.completion;
        if (!isRecord(completed) || !['time', 'hints', 'mistakes'].every(key => isCount(completed[key])) ||
            typeof completed.autoNotes !== 'boolean' || typeof completed.submitted !== 'boolean') return null;
        result.completion = { time: completed.time, hints: completed.hints, mistakes: completed.mistakes,
            autoNotes: completed.autoNotes, submitted: completed.submitted };
    }
    result.level = state.level ?? null;
    if (result.level !== null && (!isCount(result.level) || result.level < 1 || result.level > BANK_SIZES[result.difficulty])) return null;
    result.daily = state.daily ?? null;
    if (result.daily !== null && !isCalendarDay(result.daily)) return null;
    result.progression = state.progression ?? false;
    if (typeof result.progression !== 'boolean' || result.progression && (result.daily !== null || result.difficulty === 'imported')) return null;
    if (result.difficulty === 'imported' && (result.level !== null || result.daily !== null)) return null;
    if (Object.hasOwn(state, 'timestamp')) {
        if (!isCount(state.timestamp)) return null;
        result.timestamp = state.timestamp;
    }
    for (const key of ['hintCells', 'lockedCells']) {
        if (Object.hasOwn(state, key) && (!Array.isArray(state[key]) || state[key].length !== 81 ||
            !Array.from(state[key]).every(value => typeof value === 'boolean'))) return null;
    }
    result.hintCells = state.hintCells ? [...state.hintCells] : Array(81).fill(false);
    result.lockedCells = Array.from({ length: 81 }, (_, i) => result.puzzle[i] !== '0' || result.hintCells[i]);
    if (state.lockedCells && state.lockedCells.some((value, i) => value !== result.lockedCells[i])) return null;
    if (result.hintCells.filter(Boolean).length > result.hintsUsed) return null;
    for (let i = 0; i < 81; i++) {
        if (result.puzzle[i] !== '0' && (result.userValues[i] !== result.puzzle[i] || result.hintCells[i])) return null;
        if (result.hintCells[i] && result.userValues[i] === '0') return null;
    }
    if (recomputeSolution) {
        if (result.difficulty === 'imported' && SudokuSolver.countSolutions(result.puzzle, 2) !== 1) return null;
        const { solution } = SudokuSolver.solveSudoku(result.puzzle);
        if (!solution || !SudokuSolver.validateSolution(solution)) return null;
        result.solution = solution;
        if (result.hintCells.some((hint, i) => hint && result.userValues[i] !== solution[i])) return null;
    } else if (Object.hasOwn(state, 'solution')) {
        if (typeof state.solution !== 'string' || !/^[1-9]{81}$/.test(state.solution)) return null;
        result.solution = state.solution;
    }
    return result;
}

const SAVE_KEY = 'sudoku_saved_game_v2';
const STREAK_KEY = 'sudoku_streak';
const STATS_KEY = 'sudoku_stats_v2';
const THEME_KEY = 'sudoku-theme';
const NAME_KEY = 'sudoku-player-name';
const SHORTCUTS_KEY = 'sudoku-shortcuts-open';
const PROGRESSION_KEY = 'sudoku_progression_v1';
export const getProgression = () => normalizeProgress(readJson(PROGRESSION_KEY, null));
export function recordProgression(track, id) {
    track = String(track);
    if (!validProgressId(track, id)) return false;
    const progress = getProgression();
    if (!progress[track].includes(id)) progress[track].push(id);
    return writeJson(PROGRESSION_KEY, progress);
}
export function getShortcutsOpen(fallback = null) {
    const value = readJson(SHORTCUTS_KEY, null);
    return typeof value === 'boolean' ? value : fallback;
}
export const setShortcutsOpen = value => writeJson(SHORTCUTS_KEY, Boolean(value));
const playedKey = (difficulty) => `played_v2_${difficulty}`;

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
export const loadSavedGame = () => validateGameState(readJson(SAVE_KEY, null));
export const saveGameState = (state) => {
    const validated = validateGameState(state, { recomputeSolution: false });
    return validated !== null && writeJson(SAVE_KEY, validated);
};
export const deleteSavedGame = () => remove(SAVE_KEY);

// ── Stats ──────────────────────────────────────────────────────────────
export const getStats = () => normalizeStats(readJson(STATS_KEY, {}));
export const saveStats = (stats) => writeJson(STATS_KEY, normalizeStats(stats));
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

function normalizeStreak(raw) {
    if (!isRecord(raw)) return emptyStreak();
    const current = isCalendarDay(raw.lastWin) ? count(raw.current) : 0;
    return { current, best: Math.max(current, count(raw.best)), lastWin: isCalendarDay(raw.lastWin) ? raw.lastWin : null };
}

export const getStreak = () => normalizeStreak(readJson(STREAK_KEY, null));

/**
 * Advance the daily streak for a win on `date`.
 *
 * Several wins on one day count once — the streak measures days returned to,
 * not games played. A gap of more than a day restarts it.
 */
export function recordStreak(date = new Date()) {
    const streak = getStreak();
    const today = dayKey(date);
    if (!isCalendarDay(today)) return streak;

    if (streak.lastWin === today) return streak; // already counted today

    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);

    streak.current = streak.lastWin === dayKey(yesterday) ? add(streak.current, 1) : 1;
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
    if (!isGameDifficulty(difficulty)) return stats;
    if (!Object.hasOwn(stats, difficulty)) stats[difficulty] = blankEntry();
    stats[difficulty].started = add(stats[difficulty].started, 1);
    saveStats(stats);
    return stats;
}

function blankEntry() {
    return {
        started: 0, played: 0, won: 0, bestTime: null,
        totalTime: 0, totalHints: 0, autoNotesGames: 0, totalMistakes: 0,
    };
}

function normalizeStats(raw) {
    const stats = {};
    if (!isRecord(raw)) return stats;
    for (const difficulty of Object.keys(GAME_LABELS)) {
        if (!Object.hasOwn(raw, difficulty) || !isRecord(raw[difficulty])) continue;
        const old = raw[difficulty];
        const entry = blankEntry();
        for (const key of Object.keys(entry)) {
            const value = Object.hasOwn(old, key) ? old[key] : undefined;
            entry[key] = key === 'bestTime' ? (isCount(value) ? value : null) : count(value);
        }
        entry.started = Math.max(entry.started, entry.won);
        stats[difficulty] = entry;
    }
    return stats;
}

/**
 * Record a completed game and return the updated stats.
 *
 * `autoNotes` is tracked separately from hints rather than folded into them:
 * both are assists, but a hint reveals an answer while auto-notes only does
 * bookkeeping, so conflating them would misreport how a game was played.
 */
// `mistakes` comes last so existing callers passing a date keep working.
export function recordWin(difficulty, timeSeconds, hints, autoNotes = false, date = new Date(), mistakes = 0) {
    const stats = getStats();
    if (!isGameDifficulty(difficulty)) return stats;
    if (!Object.hasOwn(stats, difficulty)) stats[difficulty] = blankEntry();

    if (![timeSeconds, hints, mistakes].every(isCount) || typeof autoNotes !== 'boolean') return stats;
    const entry = stats[difficulty];
    entry.played = add(entry.played, 1);
    entry.won = add(entry.won, 1);
    // Stats saved before starts were tracked would otherwise show a win rate
    // above 100%.
    if ((entry.started || 0) < entry.won) entry.started = entry.won;
    entry.totalTime = add(entry.totalTime, timeSeconds);
    entry.totalHints = add(entry.totalHints, hints);
    // Older saved stats predate this field.
    entry.autoNotesGames = add(entry.autoNotesGames, autoNotes ? 1 : 0);
    entry.totalMistakes = add(entry.totalMistakes, mistakes);
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

const DAILY_KEY = 'sudoku_daily_done_v2';
const DAILY_HISTORY = 60;

export const getDailyDone = () => {
    const days = readJson(DAILY_KEY, []);
    return normalizeDaily(days);
};

export const isDailyDone = (dayKey) => getDailyDone().includes(dayKey);

export function markDailyDone(dayKey) {
    const days = getDailyDone();
    if (!isCalendarDay(dayKey) || days.includes(dayKey)) return days;

    days.push(dayKey);
    days.sort();
    const trimmed = days.slice(-DAILY_HISTORY);
    writeJson(DAILY_KEY, trimmed);
    return trimmed;
}

// ── Preferences ────────────────────────────────────────────────────────
export const clearTheme = () => remove(THEME_KEY);

export function getTheme(fallback = 'midnight') {
    try {
        const theme = localStorage.getItem(THEME_KEY);
        return THEMES.includes(theme) ? theme : fallback;
    } catch (e) {
        return fallback;
    }
}

export function setTheme(theme) {
    if (!THEMES.includes(theme)) return;
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (e) { /* preference simply will not persist */ }
}

export function getPlayerName() {
    try {
        return (localStorage.getItem(NAME_KEY) || '').slice(0, 20);
    } catch (e) {
        return '';
    }
}

export function setPlayerName(name) {
    if (typeof name !== 'string') return;
    name = name.slice(0, 20);
    try {
        localStorage.setItem(NAME_KEY, name);
    } catch (e) { /* preference simply will not persist */ }
}

// ── Played-puzzle tracking ─────────────────────────────────────────────
// Ids of puzzles already served, per difficulty, so random picks avoid repeats.

export function getPlayed(difficulty) {
    if (!isDifficulty(difficulty)) return [];
    return normalizePlayed(readJson(playedKey(difficulty), []), difficulty);
}

export function markPlayed(difficulty, id) {
    const played = getPlayed(difficulty);
    if (!isDifficulty(difficulty) || !validPlayedId(id, difficulty) || played.includes(id)) return played;
    played.push(id);
    writeJson(playedKey(difficulty), played);
    return played;
}

export function clearPlayed(difficulty) {
    if (!isDifficulty(difficulty)) return;
    writeJson(playedKey(difficulty), []);
}


function validPlayedId(id, difficulty) {
    return isDifficulty(difficulty) && isPuzzleId(id);
}
function normalizePlayed(raw, difficulty) {
    return Array.isArray(raw) ? [...new Set(raw.filter(id => validPlayedId(id, difficulty)))] : [];
}
function normalizeDaily(raw) {
    return Array.isArray(raw) ? [...new Set(raw.filter(isCalendarDay))].sort().slice(-DAILY_HISTORY) : [];
}

/** Compare JSON data without trusting prototypes or object key order. */
function sameData(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameData(a[key], b[key]));
}

/**
 * Version 1 personal backup, independent of UI/DOM. Returns downloadable JSON.
 * Throws when storage cannot be read or the included game cannot be validated.
 * A missing savedGame leaves the destination game alone; null clears it.
 */
export function exportBackup({ includeSavedGame = true } = {}) {
    try {
        // Unlike ordinary reads, an unavailable store must not look like an empty backup.
        const read = key => {
            const raw = localStorage.getItem(key);
            return raw === null ? null : JSON.parse(raw);
        };
        const theme = localStorage.getItem(THEME_KEY);
        const playerName = localStorage.getItem(NAME_KEY);
        const backup = {
            format: 'sudoku-backup', version: 1, bankVersion: BANK_VERSION,
            stats: normalizeStats(read(STATS_KEY)),
            settings: { theme: THEMES.includes(theme) ? theme : null, playerName: (playerName || '').slice(0, 20), shortcutsOpen: getShortcutsOpen() },
            played: Object.fromEntries(DIFFICULTIES.map(difficulty => [difficulty, normalizePlayed(read(playedKey(difficulty)), difficulty)])),
            streak: normalizeStreak(read(STREAK_KEY)),
            dailyDone: normalizeDaily(read(DAILY_KEY)),
            progression: normalizeProgress(read(PROGRESSION_KEY)),
        };
        if (includeSavedGame) {
            const raw = read(SAVE_KEY);
            backup.savedGame = raw === null ? null : validateGameState(raw);
            if (raw !== null && backup.savedGame === null) throw new Error('The saved game is invalid. Export without the saved game to recover personal data.');
        }
        return JSON.stringify(backup, null, 2);
    } catch (e) {
        throw new Error('Could not export personal data: ' + e.message);
    }
}

/** Validate the complete document before touching storage; roll back failed writes. */
export function restoreBackup(raw) {
    let writes;
    try {
        if (typeof raw !== 'string') throw new Error('Expected backup JSON text.');
        const backup = JSON.parse(raw);
        if (!isRecord(backup) || backup.format !== 'sudoku-backup' || (backup.version !== 1 || backup.bankVersion !== BANK_VERSION)) throw new Error('Unsupported backup format or version.');
        const { stats, settings, played, streak, dailyDone } = backup;
        if (!isRecord(stats) || !sameData(stats, normalizeStats(stats)) ||
            !isRecord(settings) || !sameData(settings, { theme: settings.theme, playerName: settings.playerName,
                ...(Object.hasOwn(settings, 'shortcutsOpen') ? { shortcutsOpen: settings.shortcutsOpen } : {}) }) ||
            (settings.shortcutsOpen != null && typeof settings.shortcutsOpen !== 'boolean') ||
            (settings.theme !== null && !THEMES.includes(settings.theme)) ||
            typeof settings.playerName !== 'string' || settings.playerName.length > 20 ||
            !isRecord(played) || !sameData(played, Object.fromEntries(DIFFICULTIES.map(d => [d, normalizePlayed(played[d], d)]))) ||
            !sameData(streak, normalizeStreak(streak)) || !sameData(dailyDone, normalizeDaily(dailyDone))) throw new Error('Invalid personal data in backup.');
        writes = [
            [STATS_KEY, JSON.stringify(stats)], [STREAK_KEY, JSON.stringify(streak)],
            [DAILY_KEY, JSON.stringify(dailyDone)], [THEME_KEY, settings.theme], [NAME_KEY, settings.playerName],
            ...DIFFICULTIES.map(d => [playedKey(d), JSON.stringify(played[d])]),
        ];
        // Old backups leave newer progression alone; new ones validate before
        // the existing atomic/rollback write path touches any personal data.
        if (Object.hasOwn(backup, 'progression')) {
            if (!sameData(backup.progression, normalizeProgress(backup.progression))) throw new Error('Invalid progression data.');
            writes.push([PROGRESSION_KEY, JSON.stringify(backup.progression)]);
        }
        if (Object.hasOwn(settings, 'shortcutsOpen')) writes.push([SHORTCUTS_KEY, settings.shortcutsOpen === null ? null : JSON.stringify(settings.shortcutsOpen)]);
        if (Object.hasOwn(backup, 'savedGame')) {
            const game = backup.savedGame === null ? null : validateGameState(backup.savedGame);
            if (backup.savedGame !== null && game === null) throw new Error('Invalid saved game in backup.');
            writes.push([SAVE_KEY, game === null ? null : JSON.stringify(game)]);
        }
    } catch (e) {
        return { success: false, error: e instanceof SyntaxError ? 'Invalid backup JSON.' : e.message };
    }
    const previous = new Map();
    const changed = [];
    const write = (key, value) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
    try {
        for (const [key] of writes) previous.set(key, localStorage.getItem(key));
        for (const [key, value] of writes) {
            changed.push(key);
            write(key, value);
        }
        return { success: true };
    } catch (e) {
        let rollbackFailed = false;
        for (const key of changed.reverse()) {
            try { write(key, previous.get(key)); } catch (e) { rollbackFailed = true; }
        }
        return { success: false, error: rollbackFailed ? 'Restore failed; some previous data could not be recovered.' : 'Restore failed; previous data was preserved.', rollbackFailed };
    }
}

// Small classic boards have their own versioned saves and content-ID progress.
export const loadSmallData = size => ['4', '6', '9-diagonal', '9-hyper'].includes(String(size)) ? readJson(`sudoku_small_v1_${size}`, null) : null;
export const saveSmallData = (size, state) => ['4', '6', '9-diagonal', '9-hyper'].includes(String(size)) && writeJson(`sudoku_small_v1_${size}`, state);
/** Restore a validated board and its optional path together, with rollback. */
export function restoreSmallBackup(track, state, completed) {
    if (!['4', '6', '9-diagonal', '9-hyper'].includes(String(track))) return false;
    const key = `sudoku_small_v1_${track}`, writes = [[key, JSON.stringify(state)]];
    if (completed !== undefined) {
        if (!Array.isArray(completed) || completed.length > 20000 || new Set(completed).size !== completed.length || !completed.every(id => validProgressId(String(track), id))) return false;
        const paths = getProgression(); paths[track] = completed;
        writes.push([PROGRESSION_KEY, JSON.stringify(paths)]);
    }
    const before = new Map(), changed = [];
    try {
        for (const [key] of writes) before.set(key, localStorage.getItem(key));
        for (const [key, value] of writes) { changed.push(key); localStorage.setItem(key, value); }
        return true;
    } catch {
        for (const key of changed.reverse()) {
            try { if (before.get(key) === null) localStorage.removeItem(key); else localStorage.setItem(key, before.get(key)); } catch { /* unavailable storage */ }
        }
        return false;
    }
}
export function smallProgress() {
    const raw = readJson('sudoku_small_progress_v1', []);
    return Array.isArray(raw) ? [...new Set(raw.filter(id => typeof id === 'string' && /^(?:[46]|9-(?:diagonal|hyper))-[a-f0-9]{16}$/.test(id)))].slice(0, 10000) : [];
}
export function recordSmallWin(id) {
    if (/^(?:[46]|9-(?:diagonal|hyper))-[a-f0-9]{16}$/.test(id)) writeJson('sudoku_small_progress_v1', [...new Set([...smallProgress(), id])]);
}
