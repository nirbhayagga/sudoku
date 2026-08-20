/**
 * Sudoku Puzzle Generator
 *
 * Generates puzzles with guaranteed unique solutions.
 * Uses the solver's constraint propagation for fast generation.
 *
 * API:
 *   SudokuGenerator.generate(difficulty, options)
 *     → { puzzle, solution, clues, searchNodes, attempts, targetMet, timeMs }
 */

import { SudokuSolver } from './solver.js';

export const SudokuGenerator = (() => {
    const { ALL, assign, copyValues, mostConstrained, toString } = SudokuSolver.getInternals();

    /**
     * Difficulty targets.
     *
     * `min`/`max` are clue counts; `minNodes` is the minimum search effort the
     * solver must expend (see SudokuSolver.rateDifficulty), which is what
     * actually separates the harder tiers. Clue count alone does not: puzzles
     * with identical clue counts routinely differ tenfold in solving effort.
     *
     * The ranges are calibrated against what digging can actually achieve.
     * Removing a clue can only ever increase the solution count, so a cell that
     * fails removal once can never be removed later — a single dig always ends
     * at a minimal puzzle for its removal order, and the only way lower is a
     * different board entirely. Measured floors are ~23 clues for expert and
     * ~22 for evil, so targets below that would never be met.
     */
    const CLUE_TARGETS = {
        easy: { min: 36, max: 40, minNodes: 0 },
        medium: { min: 30, max: 34, minNodes: 0 },
        hard: { min: 26, max: 29, minNodes: 1 },
        expert: { min: 23, max: 26, minNodes: 3 },
        evil: { min: 22, max: 26, minNodes: 5 },
        nightmare: { min: 17, max: 20, minNodes: 0 },
    };

    const DEFAULT_OPTIONS = {
        maxAttempts: 20,
        timeBudgetMs: 2000,
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
        // Candidates are 9-bit masks, one Uint16 per cell — see solver.js.
        const values = new Uint16Array(81).fill(ALL);

        function randomSearch(vals) {
            if (!vals) return null;

            const cell = mostConstrained(vals);
            if (cell === -1) return vals; // every cell settled

            // Randomised digit order is what makes each board different; the
            // solver's own search is deterministic by design.
            const mask = vals[cell];
            const digits = [];
            for (let d = 0; d < 9; d++) if (mask & (1 << d)) digits.push(d);

            for (const d of shuffle(digits)) {
                const result = randomSearch(assign(copyValues(vals), cell, d));
                if (result) return result;
            }
            return null;
        }

        const solved = randomSearch(values);
        return solved ? toString(solved) : null;
    }

    /**
     * Remove clues from a solved board while the solution stays unique.
     * One pass over a shuffled index order; see CLUE_TARGETS on why repeating
     * passes over the same board cannot remove anything further.
     */
    function dig(solution, targetClues) {
        const board = solution.split('');
        const indices = shuffle([...Array(81).keys()]);
        let clues = 81;

        for (const idx of indices) {
            if (clues <= targetClues) break;

            const saved = board[idx];
            board[idx] = '0';

            if (SudokuSolver.countSolutions(board.join(''), 2) !== 1) {
                board[idx] = saved; // removing it would allow multiple solutions
            } else {
                clues--;
            }
        }

        return { puzzle: board.join(''), clues };
    }

    /** How far a candidate falls short of its target; 0 means it qualifies. */
    function shortfall(candidate, target) {
        const overClues = Math.max(0, candidate.clues - target.max);
        const underNodes = Math.max(0, target.minNodes - candidate.searchNodes);
        return overClues + underNodes;
    }

    /**
     * Generate a puzzle for a difficulty.
     *
     * A single dig frequently overshoots its target, so this retries whole
     * generations until one qualifies or the budget runs out, keeping the best
     * candidate seen. `targetMet` reports whether the returned puzzle actually
     * satisfies the difficulty rather than being a best effort.
     *
     * @param {string} difficulty - easy, medium, hard, expert, evil, nightmare
     * @param {{maxAttempts?: number, timeBudgetMs?: number}} [options]
     */
    function generate(difficulty = 'medium', options = {}) {
        const { maxAttempts, timeBudgetMs } = { ...DEFAULT_OPTIONS, ...options };
        const target = CLUE_TARGETS[difficulty] || CLUE_TARGETS.medium;
        const t0 = performance.now();

        let best = null;
        let attempts = 0;

        while (attempts < maxAttempts) {
            attempts++;

            const solution = generateSolvedBoard();
            if (!solution) continue;

            const targetClues = target.min +
                Math.floor(Math.random() * (target.max - target.min + 1));
            const { puzzle, clues } = dig(solution, targetClues);

            // Only worth rating when the tier actually demands search effort.
            const searchNodes = target.minNodes > 0
                ? SudokuSolver.rateDifficulty(puzzle)
                : 0;

            const candidate = { puzzle, solution, clues, searchNodes };

            if (!best || shortfall(candidate, target) < shortfall(best, target)) {
                best = candidate;
            }
            if (shortfall(candidate, target) === 0) break;
            if (performance.now() - t0 > timeBudgetMs) break;
        }

        if (!best) return null;

        return {
            ...best,
            attempts,
            targetMet: shortfall(best, target) === 0,
            timeMs: performance.now() - t0,
        };
    }

    return { generate, CLUE_TARGETS };
})();
