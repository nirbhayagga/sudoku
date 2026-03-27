/**
 * Sudoku Puzzle Generator
 *
 * Generates puzzles with guaranteed unique solutions.
 * Uses the solver's constraint propagation for fast generation.
 *
 * API:
 *   SudokuGenerator.generate(difficulty) → { puzzle: string, solution: string, clues: number, timeMs: number }
 */

const SudokuGenerator = (() => {
    const { squares, peers, DIGITS, copyValues } = SudokuSolver.getInternals();

    // Difficulty → target clue range
    const CLUE_TARGETS = {
        easy: { min: 38, max: 45 },
        medium: { min: 30, max: 37 },
        hard: { min: 25, max: 29 },
        expert: { min: 22, max: 24 },
        evil: { min: 19, max: 21 },
        nightmare: { min: 17, max: 18 },
    };

    /** Shuffle an array in place (Fisher-Yates) */
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * Generate a random complete (solved) board.
     * Fills the board using the solver with randomized digit ordering.
     */
    function generateSolvedBoard() {
        const { squares: sq, DIGITS: dg, assign } = SudokuSolver.getInternals();

        // Start with all possibilities open
        const values = {};
        for (const s of sq) values[s] = dg;

        function randomSearch(vals) {
            if (!vals) return null;
            if (sq.every(s => vals[s].length === 1)) return vals;

            // MRV heuristic
            let minLen = 10, minSquare = null;
            for (const s of sq) {
                const len = vals[s].length;
                if (len > 1 && len < minLen) {
                    minLen = len;
                    minSquare = s;
                }
            }

            // Randomize digit order for variety
            const digits = shuffle(vals[minSquare].split(''));
            for (const d of digits) {
                const result = randomSearch(assign(copyValues(vals), minSquare, d));
                if (result) return result;
            }
            return null;
        }

        const solved = randomSearch(values);
        if (!solved) return null;

        return sq.map(s => solved[s]).join('');
    }

    /**
     * Generate a puzzle by removing cells from a solved board.
     *
     * @param {string} difficulty - one of: easy, medium, hard, expert, evil, nightmare
     * @returns {{ puzzle: string, solution: string, clues: number, timeMs: number }}
     */
    function generate(difficulty = 'medium') {
        const t0 = performance.now();
        const target = CLUE_TARGETS[difficulty] || CLUE_TARGETS.medium;

        // Generate a solved board
        const solution = generateSolvedBoard();
        if (!solution) return null;

        // Start with the full solution
        const board = solution.split('');
        const indices = shuffle([...Array(81).keys()]);

        let clues = 81;
        const targetClues = target.min + Math.floor(Math.random() * (target.max - target.min + 1));

        for (const idx of indices) {
            if (clues <= targetClues) break;

            const saved = board[idx];
            board[idx] = '0';

            // Check uniqueness (must have exactly 1 solution)
            const count = SudokuSolver.countSolutions(board.join(''), 2);
            if (count !== 1) {
                // Removing this cell creates multiple solutions — put it back
                board[idx] = saved;
            } else {
                clues--;
            }
        }

        const t1 = performance.now();
        const puzzle = board.join('');

        return {
            puzzle,
            solution,
            clues,
            timeMs: t1 - t0,
        };
    }

    return { generate };
})();
