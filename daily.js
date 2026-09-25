/**
 * Puzzle of the day.
 *
 * Everyone must get the same board on the same date, without a server: the
 * choice is derived from the date string alone. That is what makes the existing
 * per-level leaderboard meaningful for it — every player that day is on the
 * identical puzzle, so times are directly comparable.
 *
 * The mapping is scoped to the bank revision in shared links. Revision 2
 * intentionally starts a fresh schedule alongside the new difficulty ladder.
 */
import { DAILY_SIZES } from './difficulties.js';

/**
 * Difficulty by weekday, easing in over the week and peaking at the weekend.
 * Sunday is index 0.
 */
const WEEKDAY_DIFFICULTY = [
    'expert',    // Sunday
    'easy',      // Monday
    'medium',    // Tuesday
    'medium',    // Wednesday
    'hard',      // Thursday
    'hard',      // Friday
    'evil',      // Saturday
];

/**
 * FNV-1a. Small, fast, and — unlike anything involving Math.random or hashing
 * that varies by engine — guaranteed to give the same number everywhere.
 */
function hashString(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

/**
 * The puzzle for a given day.
 *
 * @param {string} dayKey local calendar day as YYYY-MM-DD
 * @returns {{dayKey: string, difficulty: string, level: number}}
 */
export function dailyPuzzle(dayKey) {
    // Parse as local, not UTC: `new Date('2026-03-01')` is midnight UTC and can
    // land on the previous day west of Greenwich.
    const [year, month, day] = dayKey.split('-').map(Number);
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(0, 0, 0, 0);

    const difficulty = WEEKDAY_DIFFICULTY[date.getDay()];
    // This is a position in DAILY_PUZZLES, not necessarily today's display level.
    const level = (hashString(dayKey) % DAILY_SIZES[difficulty]) + 1;

    return { dayKey, difficulty, level };
}

/** Human-readable date for the status line, e.g. "Mon 2 March". */
export function formatDay(dayKey) {
    const [year, month, day] = dayKey.split('-').map(Number);
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' });
}
