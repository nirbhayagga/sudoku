/* exported SudokuSolver */
/**
 * Sudoku Solver — Constraint Propagation + Backtracking (Norvig-style)
 *
 * API:
 *   solveSudoku(boardStr)  →  { solution: string|null, timeMs: number }
 *   countSolutions(boardStr, limit)  →  number (capped at limit)
 *   validateSolution(solutionStr)  →  boolean
 *   rateDifficulty(boardStr)  →  number (search nodes; 0 = pure logic)
 *   getInternals()  →  { squares, unitList, units, peers, DIGITS, parseGrid, assign, eliminate, search }
 */

const SudokuSolver = (() => {
    // ── Precompute indices ─────────────────────────────────────────────
    const ROWS = 'ABCDEFGHI';
    const COLS = '123456789';
    const DIGITS = '123456789';

    const cross = (a, b) => {
        const result = [];
        for (const ai of a) for (const bi of b) result.push(ai + bi);
        return result;
    };

    const squares = cross(ROWS, COLS); // 81 squares

    // All 27 units (rows, columns, boxes)
    const unitList = [];
    for (const c of COLS) unitList.push(cross(ROWS, c));          // columns
    for (const r of ROWS) unitList.push(cross(r, COLS));          // rows
    for (const rs of ['ABC', 'DEF', 'GHI'])
        for (const cs of ['123', '456', '789'])
            unitList.push(cross(rs, cs));                              // boxes

    // units[s] = list of units containing square s
    const units = {};
    // peers[s] = set of squares that share a unit with s (excluding s)
    const peers = {};

    for (const s of squares) {
        units[s] = unitList.filter(u => u.includes(s));
        const peerSet = new Set();
        for (const u of units[s]) for (const s2 of u) if (s2 !== s) peerSet.add(s2);
        peers[s] = [...peerSet];
    }

    // ── Core functions ─────────────────────────────────────────────────

    /** Parse a board string into initial values map { square: digit } */
    function parseGrid(boardStr) {
        const chars = boardStr.replace(/[^0-9.]/g, '');
        if (chars.length !== 81) return null;

        const values = {};
        for (const s of squares) values[s] = DIGITS;

        for (let i = 0; i < 81; i++) {
            const d = chars[i];
            if (d !== '0' && d !== '.') {
                if (!assign(values, squares[i], d)) return null;
            }
        }
        return values;
    }

    /** Assign digit d to square s; propagate constraints. Return values or null. */
    function assign(values, s, d) {
        const otherDigits = values[s].replace(d, '');
        for (const d2 of otherDigits) {
            if (!eliminate(values, s, d2)) return null;
        }
        return values;
    }

    /** Eliminate digit d from values[s]; propagate. Return values or null. */
    function eliminate(values, s, d) {
        if (!values[s].includes(d)) return values;
        values[s] = values[s].replace(d, '');
        const len = values[s].length;

        if (len === 0) return null;

        if (len === 1) {
            const d2 = values[s];
            for (const s2 of peers[s]) {
                if (!eliminate(values, s2, d2)) return null;
            }
        }

        for (const u of units[s]) {
            const dPlaces = u.filter(s2 => values[s2].includes(d));
            if (dPlaces.length === 0) return null;
            if (dPlaces.length === 1) {
                if (!assign(values, dPlaces[0], d)) return null;
            }
        }

        return values;
    }

    /** Deep copy a values map */
    function copyValues(values) {
        const copy = {};
        for (const s of squares) copy[s] = values[s];
        return copy;
    }

    /** DFS search with constraint propagation */
    function search(values) {
        if (!values) return null;
        if (squares.every(s => values[s].length === 1)) return values;

        let minLen = 10, minSquare = null;
        for (const s of squares) {
            const len = values[s].length;
            if (len > 1 && len < minLen) {
                minLen = len;
                minSquare = s;
            }
        }

        for (const d of values[minSquare]) {
            const result = search(assign(copyValues(values), minSquare, d));
            if (result) return result;
        }
        return null;
    }

    // ── Solution counting (for generator uniqueness check) ─────────────

    /**
     * Count solutions up to `limit`. Returns as soon as limit is reached.
     * For uniqueness checking, use limit=2: if result >= 2, puzzle has multiple solutions.
     */
    function countSolutions(boardStr, limit = 2) {
        const values = parseGrid(boardStr);
        if (!values) return 0;
        let count = 0;

        function searchCount(vals) {
            if (!vals) return;
            if (count >= limit) return;

            if (squares.every(s => vals[s].length === 1)) {
                count++;
                return;
            }

            let minLen = 10, minSquare = null;
            for (const s of squares) {
                const len = vals[s].length;
                if (len > 1 && len < minLen) {
                    minLen = len;
                    minSquare = s;
                }
            }

            for (const d of vals[minSquare]) {
                if (count >= limit) return;
                searchCount(assign(copyValues(vals), minSquare, d));
            }
        }

        searchCount(values);
        return count;
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
        function rate(vals) {
            if (!vals) return null;
            if (squares.every(s => vals[s].length === 1)) return vals;

            let minLen = 10, minSquare = null;
            for (const s of squares) {
                const len = vals[s].length;
                if (len > 1 && len < minLen) {
                    minLen = len;
                    minSquare = s;
                }
            }

            for (const d of vals[minSquare]) {
                nodes++;
                const result = rate(assign(copyValues(vals), minSquare, d));
                if (result) return result;
            }
            return null;
        }

        rate(values);
        return nodes;
    }

    // ── Public API ─────────────────────────────────────────────────────

    function solveSudoku(boardStr) {
        const t0 = performance.now();
        const values = parseGrid(boardStr);
        const solved = search(values);
        const t1 = performance.now();

        if (!solved) return { solution: null, timeMs: t1 - t0 };

        const solutionStr = squares.map(s => solved[s]).join('');
        return { solution: solutionStr, timeMs: t1 - t0 };
    }

    function validateSolution(solutionStr) {
        if (!solutionStr || solutionStr.length !== 81) return false;
        const values = {};
        for (let i = 0; i < 81; i++) values[squares[i]] = solutionStr[i];
        for (const u of unitList) {
            const digits = u.map(s => values[s]).sort().join('');
            if (digits !== DIGITS) return false;
        }
        return true;
    }

    /** Expose internals for the generator */
    function getInternals() {
        return { squares, unitList, units, peers, DIGITS, parseGrid, assign, eliminate, search, copyValues };
    }

    return { solveSudoku, countSolutions, validateSolution, rateDifficulty, getInternals };
})();
