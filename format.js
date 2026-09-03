/**
 * Small formatting helpers, kept separate because they are pure and used from
 * several places (timer display, win summary, resume banner, leaderboard rows).
 */

/** Seconds as m:ss, or h:mm:ss past an hour. */
export function formatTime(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Escape a value for interpolation into innerHTML. Uses the DOM's own escaping
 * rather than a hand-rolled replace chain.
 */
export function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

/**
 * Render an 81-char board (0 or . = empty) in one of four text styles:
 *   line  - one line, dots for empties (what most solvers/visualizers accept)
 *   zeros - one line, zeros for empties
 *   rows  - nine lines of nine, dots
 *   grid  - human-readable grid with box separators
 * Every style round-trips through parsePuzzleText.
 */
export function formatPuzzle(board, style = 'line') {
    const cells = String(board).replace(/\./g, '0');
    if (!/^[0-9]{81}$/.test(cells)) {
        throw new Error('formatPuzzle needs an 81-cell board string');
    }
    const dotted = cells.replace(/0/g, '.');
    switch (style) {
        case 'zeros':
            return cells;
        case 'line':
            return dotted;
        case 'rows': {
            const rows = [];
            for (let r = 0; r < 9; r++) rows.push(dotted.slice(r * 9, r * 9 + 9));
            return rows.join('\n');
        }
        case 'grid': {
            const lines = [];
            for (let r = 0; r < 9; r++) {
                const boxes = [];
                for (let b = 0; b < 3; b++) {
                    const start = r * 9 + b * 3;
                    boxes.push(dotted.slice(start, start + 3).split('').join(' '));
                }
                lines.push(boxes.join(' | '));
                if (r === 2 || r === 5) lines.push('------+-------+------');
            }
            return lines.join('\n');
        }
        default:
            throw new Error(`unknown puzzle format: ${style}`);
    }
}

/**
 * Extract an 81-cell board from pasted text, or null if there isn't one.
 * Returns the normalized form writeGrid expects: 81 digits, 0 for empty.
 *
 * Two passes, strict first: the strict alphabet (digits and dots, everything
 * else is a separator) already accepts bare strings, 9x9 rows, and pretty
 * grids — including ones whose separator lines are made of dashes. Only when
 * that fails are the common empty markers (* _ ? x -) read as empties, so a
 * dash can be a separator in one paste and an empty cell in another without
 * ambiguity inside a single paste.
 */
export function parsePuzzleText(raw) {
    const text = String(raw ?? '');
    const strict = text.replace(/[^0-9.]/g, '');
    if (strict.length === 81) return strict.replace(/\./g, '0');
    const relaxed = text.replace(/[*_?xX-]/g, '.').replace(/[^0-9.]/g, '');
    if (relaxed.length === 81) return relaxed.replace(/\./g, '0');
    return null;
}
