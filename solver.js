/**
 * Sudoku Solver — Constraint Propagation + Backtracking (Norvig-style)
 *
 * Candidates are held as 9-bit masks in a Uint16Array, one entry per cell:
 * bit 0 means "1 is still possible", bit 8 means "9 is still possible". The
 * algorithm is unchanged from the classic string-based formulation — the
 * representation is simply cheaper. Eliminating a digit is one AND instead of
 * a string rebuild, and copying the board for a search branch is a memcpy
 * rather than 81 property writes, which matters because search copies
 * constantly.
 *
 * Cells are addressed by index 0-80 (row * 9 + column) throughout.
 *
 * API:
 *   solveSudoku(boardStr)  →  { solution: string|null, timeMs: number }
 *   countSolutions(boardStr, limit)  →  number (capped at limit)
 *   validateSolution(solutionStr)  →  boolean
 *   rateDifficulty(boardStr)  →  number (search nodes; 0 = pure logic)
 *   getInternals()  →  structures the generator builds on
 */

export const SudokuSolver = (() => {
    const DIGITS = '123456789';
    const ALL = 0x1FF; // all nine candidates open

    // ── Precomputed geometry ───────────────────────────────────────────
    const squares = Array.from({ length: 81 }, (_, i) => i);

    /** 27 units: 9 rows, 9 columns, 9 boxes. */
    const unitList = [];
    for (let r = 0; r < 9; r++) {
        unitList.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
    }
    for (let c = 0; c < 9; c++) {
        unitList.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
    }
    for (let br = 0; br < 3; br++) {
        for (let bc = 0; bc < 3; bc++) {
            const box = [];
            for (let r = br * 3; r < br * 3 + 3; r++) {
                for (let c = bc * 3; c < bc * 3 + 3; c++) box.push(r * 9 + c);
            }
            unitList.push(box);
        }
    }

    /** units[i] = the three units containing cell i. */
    const units = squares.map((i) => unitList.filter((unit) => unit.includes(i)));

    /** peers[i] = the 20 cells sharing a unit with i. */
    const peers = squares.map((i) => {
        const set = new Set();
        for (const unit of units[i]) for (const c of unit) set.add(c);
        set.delete(i);
        return [...set];
    });

    // Lookups over the 512 possible masks, so popcount and "which digit is
    // this" are table reads rather than loops in the hot path.
    const POPCOUNT = new Uint8Array(ALL + 1);
    const LOWEST_DIGIT = new Int8Array(ALL + 1).fill(-1);
    for (let mask = 1; mask <= ALL; mask++) {
        POPCOUNT[mask] = POPCOUNT[mask >> 1] + (mask & 1);
        for (let d = 0; d < 9; d++) {
            if (mask & (1 << d)) { LOWEST_DIGIT[mask] = d; break; }
        }
    }

    const isSingle = (mask) => mask !== 0 && (mask & (mask - 1)) === 0;

    // ── Core ───────────────────────────────────────────────────────────

    /** Parse a board string into candidate masks, or null if contradictory. */
    function parseGrid(boardStr) {
        const chars = String(boardStr ?? '').replace(/[^0-9.]/g, '');
        if (chars.length !== 81) return null;

        const values = new Uint16Array(81).fill(ALL);
        for (let i = 0; i < 81; i++) {
            const ch = chars[i];
            if (ch !== '0' && ch !== '.') {
                if (!assign(values, i, ch.charCodeAt(0) - 49)) return null;
            }
        }
        return values;
    }

    /** Assign digit d (0-8) to cell i by eliminating every other candidate. */
    function assign(values, i, d) {
        const others = values[i] & ~(1 << d);
        for (let d2 = 0; d2 < 9; d2++) {
            if (others & (1 << d2)) {
                if (!eliminate(values, i, d2)) return null;
            }
        }
        return values;
    }

    /** Remove digit d (0-8) from cell i and propagate. Null on contradiction. */
    function eliminate(values, i, d) {
        const bit = 1 << d;
        if (!(values[i] & bit)) return values; // already gone

        values[i] &= ~bit;
        const remaining = values[i];

        if (remaining === 0) return null; // nothing left for this cell

        // Only one candidate here now: strip it from every peer.
        if (isSingle(remaining)) {
            const only = LOWEST_DIGIT[remaining];
            const cellPeers = peers[i];
            for (let p = 0; p < cellPeers.length; p++) {
                if (!eliminate(values, cellPeers[p], only)) return null;
            }
        }

        // The digit may now have only one home left in a unit.
        const cellUnits = units[i];
        for (let u = 0; u < cellUnits.length; u++) {
            const unit = cellUnits[u];
            let places = 0;
            let where = -1;
            for (let c = 0; c < 9; c++) {
                if (values[unit[c]] & bit) {
                    places++;
                    where = unit[c];
                }
            }
            if (places === 0) return null; // nowhere for it to go
            if (places === 1) {
                if (!assign(values, where, d)) return null;
            }
        }

        return values;
    }

    /** Uint16Array copies are a memcpy, which is why search stays cheap. */
    const copyValues = (values) => values.slice();

    const isSolved = (values) => {
        for (let i = 0; i < 81; i++) if (!isSingle(values[i])) return false;
        return true;
    };

    /** Most-constrained cell, or -1 when solved. */
    function mostConstrained(values) {
        let best = -1;
        let bestCount = 10;
        for (let i = 0; i < 81; i++) {
            const count = POPCOUNT[values[i]];
            if (count > 1 && count < bestCount) {
                bestCount = count;
                best = i;
                if (count === 2) break; // cannot do better
            }
        }
        return best;
    }

    /** Depth-first search with constraint propagation. */
    function search(values) {
        if (!values) return null;

        const cell = mostConstrained(values);
        if (cell === -1) return values; // every cell settled

        const mask = values[cell];
        for (let d = 0; d < 9; d++) {
            if (!(mask & (1 << d))) continue;
            const result = search(assign(copyValues(values), cell, d));
            if (result) return result;
        }
        return null;
    }

    const toString = (values) => {
        let out = '';
        for (let i = 0; i < 81; i++) out += String.fromCharCode(49 + LOWEST_DIGIT[values[i]]);
        return out;
    };

    // ── Public API ─────────────────────────────────────────────────────

    function solveSudoku(boardStr) {
        const t0 = performance.now();
        const solved = search(parseGrid(boardStr));
        const timeMs = performance.now() - t0;

        return { solution: solved ? toString(solved) : null, timeMs };
    }

    /**
     * Count solutions up to `limit`, stopping as soon as it is reached.
     * Uniqueness checking uses limit=2: anything >= 2 means not unique.
     */
    function countSolutions(boardStr, limit = 2) {
        const values = parseGrid(boardStr);
        if (!values) return 0;

        let count = 0;
        (function walk(vals) {
            if (!vals || count >= limit) return;

            const cell = mostConstrained(vals);
            if (cell === -1) {
                count++;
                return;
            }

            const mask = vals[cell];
            for (let d = 0; d < 9; d++) {
                if (count >= limit) return;
                if (mask & (1 << d)) walk(assign(copyValues(vals), cell, d));
            }
        })(values);

        return count;
    }

    function validateSolution(solutionStr) {
        if (!solutionStr || solutionStr.length !== 81) return false;

        for (const unit of unitList) {
            let seen = 0;
            for (const cell of unit) {
                const digit = solutionStr.charCodeAt(cell) - 49;
                if (digit < 0 || digit > 8) return false;
                const bit = 1 << digit;
                if (seen & bit) return false; // repeated in this unit
                seen |= bit;
            }
        }
        return true;
    }

    /**
     * How much guessing a puzzle needs beyond pure constraint propagation,
     * measured as search nodes explored. 0 means logic alone cracks it.
     *
     * A far better difficulty signal than clue count: two puzzles with the same
     * number of givens can differ by an order of magnitude here. Returns -1 for
     * an invalid board.
     */
    function rateDifficulty(boardStr) {
        const values = parseGrid(boardStr);
        if (!values) return -1;

        let nodes = 0;
        (function rate(vals) {
            if (!vals) return null;

            const cell = mostConstrained(vals);
            if (cell === -1) return vals;

            const mask = vals[cell];
            for (let d = 0; d < 9; d++) {
                if (!(mask & (1 << d))) continue;
                nodes++;
                const result = rate(assign(copyValues(vals), cell, d));
                if (result) return result;
            }
            return null;
        })(values);

        return nodes;
    }

    /** Structures the generator builds on. */
    function getInternals() {
        return {
            squares, unitList, units, peers, DIGITS, ALL,
            parseGrid, assign, eliminate, search, copyValues,
            isSolved, mostConstrained, toString,
        };
    }

    return { solveSudoku, countSolutions, validateSolution, rateDifficulty, getInternals };
})();
