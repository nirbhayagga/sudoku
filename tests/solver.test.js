import { describe, it, expect, beforeAll } from 'vitest';
import { loadSudoku } from './helpers/load-globals.js';

let SudokuSolver;

beforeAll(() => {
    ({ SudokuSolver } = loadSudoku(['solver.js']));
});

// A well-known hard puzzle and its solution.
const PUZZLE = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const SOLUTION = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

// Designed to defeat naive brute force that scans left-to-right. Constraint
// propagation cracks it without guessing, which is rather the point.
const ANTI_BRUTE_FORCE = '000000000000003085001020000000507000004000100090000000500000073002010000000040009';

// A 17-clue puzzle (bank id n00098) that genuinely needs search: 286 nodes.
const SEARCH_HEAVY = '000000000000000012000034000000000005003020000005600070000006000020000403800170000';

describe('solveSudoku', () => {
    it('solves a standard puzzle correctly', () => {
        const { solution } = SudokuSolver.solveSudoku(PUZZLE);
        expect(solution).toBe(SOLUTION);
    });

    it('preserves every given clue in the solution', () => {
        const { solution } = SudokuSolver.solveSudoku(PUZZLE);
        for (let i = 0; i < 81; i++) {
            if (PUZZLE[i] !== '0') expect(solution[i]).toBe(PUZZLE[i]);
        }
    });

    it('solves a puzzle built to defeat naive backtracking', () => {
        const { solution } = SudokuSolver.solveSudoku(ANTI_BRUTE_FORCE);
        expect(SudokuSolver.validateSolution(solution)).toBe(true);
    });

    it('accepts dots as empty cells', () => {
        const dotted = PUZZLE.replace(/0/g, '.');
        expect(SudokuSolver.solveSudoku(dotted).solution).toBe(SOLUTION);
    });

    it('ignores non-digit separators such as newlines', () => {
        const gridded = PUZZLE.match(/.{9}/g).join('\n');
        expect(SudokuSolver.solveSudoku(gridded).solution).toBe(SOLUTION);
    });

    it('returns an already-solved board unchanged', () => {
        expect(SudokuSolver.solveSudoku(SOLUTION).solution).toBe(SOLUTION);
    });

    it('reports elapsed time', () => {
        const { timeMs } = SudokuSolver.solveSudoku(PUZZLE);
        expect(timeMs).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(timeMs)).toBe(true);
    });

    describe('rejects unsolvable input', () => {
        it('returns null for a contradictory board (duplicate in a row)', () => {
            const bad = '11' + '0'.repeat(79);
            expect(SudokuSolver.solveSudoku(bad).solution).toBeNull();
        });

        it('returns null for a duplicate within a box', () => {
            const cells = Array(81).fill('0');
            cells[0] = '5';
            cells[10] = '5'; // same 3x3 box
            expect(SudokuSolver.solveSudoku(cells.join('')).solution).toBeNull();
        });

        it('returns null for a board that is too short', () => {
            expect(SudokuSolver.solveSudoku('123').solution).toBeNull();
        });

        it('returns null for a board that is too long', () => {
            expect(SudokuSolver.solveSudoku('0'.repeat(82)).solution).toBeNull();
        });

        it('returns null for a valid-looking but unsolvable puzzle', () => {
            // Every digit placed legally, yet no completion exists.
            const unsolvable =
                '516849732307605000809700065135060907472591006968370050253186074684207500791050608';
            expect(SudokuSolver.solveSudoku(unsolvable).solution).toBeNull();
        });
    });

    it('solves an empty board (any valid grid)', () => {
        const { solution } = SudokuSolver.solveSudoku('0'.repeat(81));
        expect(SudokuSolver.validateSolution(solution)).toBe(true);
    });
});

describe('validateSolution', () => {
    it('accepts a correct solution', () => {
        expect(SudokuSolver.validateSolution(SOLUTION)).toBe(true);
    });

    it('rejects a grid with a repeated digit in a row', () => {
        const broken = '1' + SOLUTION.slice(1);
        expect(SudokuSolver.validateSolution(broken)).toBe(false);
    });

    it('rejects incomplete grids', () => {
        expect(SudokuSolver.validateSolution(PUZZLE)).toBe(false);
    });

    it('rejects wrong lengths and empty input', () => {
        expect(SudokuSolver.validateSolution('')).toBe(false);
        expect(SudokuSolver.validateSolution(null)).toBe(false);
        expect(SudokuSolver.validateSolution(SOLUTION.slice(0, 80))).toBe(false);
    });
});

describe('countSolutions', () => {
    it('counts exactly one solution for a proper puzzle', () => {
        expect(SudokuSolver.countSolutions(PUZZLE, 2)).toBe(1);
    });

    it('detects multiple solutions', () => {
        // Removing a clue from a minimal puzzle admits more than one completion.
        const ambiguous = '0'.repeat(81);
        expect(SudokuSolver.countSolutions(ambiguous, 2)).toBe(2);
    });

    it('returns 0 for a contradictory board', () => {
        expect(SudokuSolver.countSolutions('11' + '0'.repeat(79), 2)).toBe(0);
    });

    it('never exceeds the requested limit', () => {
        expect(SudokuSolver.countSolutions('0'.repeat(81), 5)).toBe(5);
        expect(SudokuSolver.countSolutions('0'.repeat(81), 1)).toBe(1);
    });
});

describe('getInternals', () => {
    it('exposes the structures the generator depends on', () => {
        const internals = SudokuSolver.getInternals();
        for (const key of ['squares', 'unitList', 'units', 'peers', 'DIGITS', 'assign', 'copyValues']) {
            expect(internals).toHaveProperty(key);
        }
    });

    it('describes a well-formed 9x9 grid', () => {
        const { squares, unitList, peers } = SudokuSolver.getInternals();
        expect(squares).toHaveLength(81);
        expect(unitList).toHaveLength(27); // 9 rows + 9 columns + 9 boxes
        // Every square shares a unit with exactly 20 others.
        for (const s of squares) expect(peers[s]).toHaveLength(20);
    });
});

describe('rateDifficulty', () => {
    it('returns 0 for a puzzle solvable by propagation alone', () => {
        // Every empty cell resolves without a single guess.
        const trivial = SOLUTION.slice(0, 78) + '000';
        expect(SudokuSolver.rateDifficulty(trivial)).toBe(0);
    });

    it('returns 0 when propagation alone suffices, even for a hard-looking puzzle', () => {
        // This one defeats naive backtracking but never needs a guess here.
        expect(SudokuSolver.rateDifficulty(ANTI_BRUTE_FORCE)).toBe(0);
    });

    it('returns a positive count when guessing is required', () => {
        expect(SudokuSolver.rateDifficulty(SEARCH_HEAVY)).toBeGreaterThan(0);
    });

    it('rates a search-heavy puzzle above a propagation-only one', () => {
        expect(SudokuSolver.rateDifficulty(SEARCH_HEAVY))
            .toBeGreaterThan(SudokuSolver.rateDifficulty(PUZZLE));
    });

    it('returns -1 for an invalid board', () => {
        expect(SudokuSolver.rateDifficulty('11' + '0'.repeat(79))).toBe(-1);
        expect(SudokuSolver.rateDifficulty('123')).toBe(-1);
    });

    it('is deterministic', () => {
        const a = SudokuSolver.rateDifficulty(PUZZLE);
        const b = SudokuSolver.rateDifficulty(PUZZLE);
        expect(a).toBe(b);
    });
});
