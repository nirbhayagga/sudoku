/**
 * Shareable puzzle links.
 *
 * Two shapes, both readable and both surviving a copy-paste:
 *
 *   ?d=evil&level=42   a bank puzzle, by difficulty and level
 *   ?p=<81 digits>     any puzzle, including one typed into solver mode
 *   ?daily=2026-08-20  that day's puzzle
 *
 * A bank link is preferred where possible: it is short, and it carries the
 * level, which is what the leaderboard compares.
 *
 * A fourth shape carries a game in progress rather than a puzzle:
 *
 *   ?g=1&b=<81>&v=<81>&n=…&h=…&t=…&k=…&m=…&x=easy&l=42
 *
 * That is how a game moves to another device with no account and no server:
 * the whole save state — board, entries, notes, revealed hints, clock, hint and
 * mistake counts — rides in the URL. Its keys deliberately avoid the puzzle
 * link's (`d`, `p`, `daily`) so parseShareLink never mistakes one for a bank
 * puzzle; callers check for a game link first.
 */
import { BANK_SIZES } from './difficulties.js';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a shared puzzle out of a URL. Returns null when there is nothing to load. */
export function parseShareLink(search) {
    const params = new URLSearchParams(search || '');

    const daily = params.get('daily');
    if (daily && /^\d{4}-\d{2}-\d{2}$/.test(daily)) {
        return { kind: 'daily', dayKey: daily };
    }

    const difficulty = params.get('d');
    const level = Number(params.get('level'));
    if (difficulty && BANK_SIZES[difficulty]) {
        if (Number.isInteger(level) && level >= 1 && level <= BANK_SIZES[difficulty]) {
            return { kind: 'bank', difficulty, level };
        }
        // A difficulty on its own is still useful; the level is just ignored.
        return { kind: 'bank', difficulty, level: null };
    }

    const puzzle = params.get('p');
    if (puzzle) {
        const board = puzzle.replace(/[.\s]/g, '0');
        if (/^[0-9]{81}$/.test(board)) return { kind: 'puzzle', puzzle: board };
    }

    return null;
}

/** Build a link for a bank puzzle. */
export function bankLink(origin, difficulty, level) {
    const url = new URL(origin);
    url.search = '';
    url.searchParams.set('d', difficulty);
    if (level) url.searchParams.set('level', String(level));
    return url.toString();
}

/** Build a link for an arbitrary board. */
export function puzzleLink(origin, board) {
    const url = new URL(origin);
    url.search = '';
    url.searchParams.set('p', board);
    return url.toString();
}

/** Build a link for a day's puzzle. */
export function dailyLink(origin, dayKey) {
    const url = new URL(origin);
    url.search = '';
    url.searchParams.set('daily', dayKey);
    return url.toString();
}

/**
 * Copy text to the clipboard, reporting whether it worked.
 *
 * navigator.clipboard is unavailable on file:// and on insecure origins, and
 * can be refused by permissions, so callers must have a visible fallback.
 */
export async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) { /* fall through */ }
    return false;
}

// ── Game-in-progress links ─────────────────────────────────────────────

const GAME_LINK_VERSION = '1';
const MAX_TIME_SECONDS = 24 * 60 * 60;

/** Pack an array of booleans into base64url, eight to a byte. */
function packBits(bits) {
    const bytes = new Uint8Array(Math.ceil(bits.length / 8));
    bits.forEach((bit, i) => { if (bit) bytes[i >> 3] |= 1 << (i & 7); });
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The inverse of packBits, for a known bit count. Null when malformed. */
function unpackBits(text, count) {
    if (typeof text !== 'string' || !/^[A-Za-z0-9_-]*$/.test(text)) return null;
    if (text.length !== Math.ceil(Math.ceil(count / 8) * 4 / 3)) return null;
    let binary;
    try {
        binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    } catch (e) {
        return null;
    }
    if (binary.length !== Math.ceil(count / 8)) return null;
    return Array.from({ length: count }, (_, i) => (binary.charCodeAt(i >> 3) >> (i & 7)) & 1 ? true : false);
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Build a link that resumes a game elsewhere.
 *
 * `state` is the save-game shape app.js already serialises: puzzle,
 * userValues, notes (81 arrays of digits), hintCells (81 booleans),
 * timerSeconds, hintsUsed, mistakes, difficulty, level, daily, autoNotes,
 * autoNotesUsed. The solution is not carried — it is derived from the puzzle
 * on arrival, which also means a tampered board cannot smuggle a wrong one.
 */
export function gameLink(origin, state) {
    const url = new URL(origin);
    url.search = '';
    const set = (key, value) => url.searchParams.set(key, String(value));

    set('g', GAME_LINK_VERSION);
    set('b', state.puzzle);
    set('v', state.userValues);

    const noteBits = [];
    for (let i = 0; i < 81; i++) {
        const cell = new Set(state.notes[i] || []);
        for (const d of DIGITS) noteBits.push(cell.has(d));
    }
    if (noteBits.some(Boolean)) set('n', packBits(noteBits));

    const hintCells = state.hintCells || [];
    if (hintCells.some(Boolean)) set('h', packBits(Array.from({ length: 81 }, (_, i) => Boolean(hintCells[i]))));

    set('t', Math.max(0, Math.floor(state.timerSeconds || 0)));
    if (state.hintsUsed) set('k', state.hintsUsed);
    if (state.mistakes) set('m', state.mistakes);
    set('x', state.difficulty);
    if (state.level) set('l', state.level);
    if (state.daily) set('day', state.daily);
    if (state.autoNotes) set('a', 1);
    if (state.autoNotesUsed) set('u', 1);
    return url.toString();
}

/**
 * Parse a game link back into save-game state, or null if it is not one or is
 * malformed in any way. Every field is bounded: the URL is user-writable, so
 * this is the only thing standing between it and the app's invariants.
 */
export function parseGameLink(search) {
    const params = new URLSearchParams(search || '');
    if (params.get('g') !== GAME_LINK_VERSION) return null;

    const puzzle = params.get('b') || '';
    const userValues = params.get('v') || '';
    if (!/^[0-9]{81}$/.test(puzzle) || !/^[0-9]{81}$/.test(userValues)) return null;
    // Givens are part of the board; a link that changes them is not this game.
    for (let i = 0; i < 81; i++) {
        if (puzzle[i] !== '0' && userValues[i] !== puzzle[i]) return null;
    }

    const difficulty = params.get('x');
    if (!BANK_SIZES[difficulty]) return null;

    const noteBits = params.has('n') ? unpackBits(params.get('n'), 81 * 9) : new Array(81 * 9).fill(false);
    const hintCells = params.has('h') ? unpackBits(params.get('h'), 81) : new Array(81).fill(false);
    if (!noteBits || !hintCells) return null;

    const bounded = (key, max) => {
        if (!params.has(key)) return 0;
        const n = Number(params.get(key));
        if (!Number.isInteger(n) || n < 0 || n > max) return null;
        return n;
    };
    const timerSeconds = bounded('t', MAX_TIME_SECONDS);
    const hintsUsed = bounded('k', 81);
    const mistakes = bounded('m', 999);
    if (timerSeconds === null || hintsUsed === null || mistakes === null) return null;

    let level = null;
    if (params.has('l')) {
        level = Number(params.get('l'));
        if (!Number.isInteger(level) || level < 1 || level > BANK_SIZES[difficulty]) return null;
    }

    const daily = params.get('day');
    if (daily && !DAY_KEY.test(daily)) return null;

    return {
        puzzle,
        userValues,
        notes: Array.from({ length: 81 }, (_, i) => DIGITS.filter((_, d) => noteBits[i * 9 + d])),
        hintCells,
        // A cell is locked if it was given or revealed by a hint.
        lockedCells: Array.from({ length: 81 }, (_, i) => puzzle[i] !== '0' || hintCells[i]),
        timerSeconds,
        hintsUsed,
        mistakes,
        difficulty,
        level,
        daily: daily || null,
        autoNotes: params.get('a') === '1',
        autoNotesUsed: params.get('u') === '1',
    };
}
