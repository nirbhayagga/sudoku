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
 */
import { BANK_SIZES } from './difficulties.js';

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
