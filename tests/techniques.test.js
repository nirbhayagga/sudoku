import { describe, it, expect } from 'vitest';
import {
    candidatesFor, candidateGrid, peersOf, cellName, UNITS,
    findNakedSingle, findHiddenSingle, findNakedPair, findPointingPair,
    applyRemovals, nextStep,
} from '../techniques.js';
import { SudokuSolver } from '../solver.js';
import { PUZZLES } from '../puzzle-bank.js';

const EMPTY = '0'.repeat(81);
const withCells = (assignments) => {
    const board = EMPTY.split('');
    for (const [idx, digit] of Object.entries(assignments)) board[idx] = digit;
    return board.join('');
};

describe('geometry', () => {
    it('names cells by row and column', () => {
        expect(cellName(0)).toBe('R1C1');
        expect(cellName(80)).toBe('R9C9');
        expect(cellName(30)).toBe('R4C4');
    });

    it('gives every cell 20 peers', () => {
        for (let i = 0; i < 81; i++) expect(peersOf(i), cellName(i)).toHaveLength(20);
    });

    it('never lists a cell as its own peer', () => {
        for (let i = 0; i < 81; i++) expect(peersOf(i)).not.toContain(i);
    });

    it('has 27 units of 9 cells', () => {
        expect(UNITS).toHaveLength(27);
        for (const unit of UNITS) expect(unit.cells).toHaveLength(9);
    });
});

describe('candidates', () => {
    it('offers every digit on an empty board', () => {
        expect(candidatesFor(EMPTY, 0).size).toBe(9);
    });

    it('excludes digits already in the row, column or box', () => {
        const board = withCells({ 1: '5', 9: '6', 20: '7' }); // row, column, box
        const candidates = candidatesFor(board, 0);
        expect(candidates.has('5')).toBe(false);
        expect(candidates.has('6')).toBe(false);
        expect(candidates.has('7')).toBe(false);
        expect(candidates.size).toBe(6);
    });

    it('leaves filled cells null in the grid', () => {
        const grid = candidateGrid(withCells({ 0: '5' }));
        expect(grid[0]).toBeNull();
        expect(grid[1]).not.toBeNull();
    });
});

describe('naked single', () => {
    it('finds a cell with one candidate left', () => {
        // Eight digits around R1C1 leave only 9.
        const board = withCells({
            1: '1', 2: '2', 9: '3', 10: '4', 11: '5', 18: '6', 19: '7', 20: '8',
        });
        const step = findNakedSingle(candidateGrid(board));
        expect(step).toMatchObject({ type: 'naked-single', idx: 0, digit: '9' });
    });

    it('finds nothing on an empty board', () => {
        expect(findNakedSingle(candidateGrid(EMPTY))).toBeNull();
    });
});

describe('hidden single', () => {
    it('finds a digit with one home left in a unit', () => {
        const grid = candidateGrid(EMPTY);
        // Strip 4 from every cell of row 0 but one.
        for (let c = 1; c < 9; c++) grid[c].delete('4');

        const step = findHiddenSingle(grid);
        expect(step).toMatchObject({ type: 'hidden-single', idx: 0, digit: '4' });
    });

    it('prefers to leave a naked single to the simpler technique', () => {
        const grid = candidateGrid(EMPTY);
        grid[0] = new Set(['4']); // both a naked and a hidden single
        for (let c = 1; c < 9; c++) grid[c].delete('4');
        expect(findHiddenSingle(grid)).toBeNull();
    });
});

describe('naked pair', () => {
    it('finds two cells sharing the same two candidates', () => {
        const grid = candidateGrid(EMPTY);
        grid[0] = new Set(['3', '7']);
        grid[1] = new Set(['3', '7']);

        const step = findNakedPair(grid);
        expect(step).toMatchObject({ type: 'naked-pair' });
        expect(step.cells.sort()).toEqual([0, 1]);
        expect(step.digits.sort()).toEqual(['3', '7']);
    });

    it('removes both digits from the rest of the unit', () => {
        const grid = candidateGrid(EMPTY);
        grid[0] = new Set(['3', '7']);
        grid[1] = new Set(['3', '7']);

        const step = findNakedPair(grid);
        // Row 0 has seven other cells, each losing 3 and 7.
        const inRow = step.removals.filter((r) => r.cell >= 2 && r.cell <= 8);
        expect(inRow).toHaveLength(14);
        expect(step.removals.every((r) => r.cell !== 0 && r.cell !== 1)).toBe(true);
    });

    it('ignores a pair that eliminates nothing', () => {
        const grid = candidateGrid(EMPTY);
        for (let c = 0; c < 9; c++) grid[c] = new Set(['3', '7']);
        // Every cell in the row already holds only those two digits.
        const step = findNakedPair(grid);
        if (step) expect(step.removals.length).toBeGreaterThan(0);
    });

    it('finds nothing when candidates differ', () => {
        const grid = candidateGrid(EMPTY);
        grid[0] = new Set(['3', '7']);
        grid[1] = new Set(['3', '8']);
        for (let i = 2; i < 81; i++) if (grid[i]) grid[i] = new Set(['1']);
        expect(findNakedPair(grid)).toBeNull();
    });
});

describe('pointing pair', () => {
    it('finds a digit confined to one row of a box', () => {
        const grid = candidateGrid(EMPTY);
        // Leave 5 only in the top row of box 0 (cells 0,1,2).
        for (const cell of [9, 10, 11, 18, 19, 20]) grid[cell].delete('5');

        const step = findPointingPair(grid);
        expect(step).toMatchObject({ type: 'pointing-pair', digits: ['5'] });
        expect(step.reason).toMatch(/row/);
    });

    it('removes the digit from the rest of that row', () => {
        const grid = candidateGrid(EMPTY);
        for (const cell of [9, 10, 11, 18, 19, 20]) grid[cell].delete('5');

        const step = findPointingPair(grid);
        // Cells 3-8 are the rest of row 0, outside the box.
        expect(step.removals.map((r) => r.cell).sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8]);
        expect(step.removals.every((r) => r.digit === '5')).toBe(true);
    });

    it('finds nothing when the digit is spread across the box', () => {
        const grid = candidateGrid(EMPTY);
        for (let i = 0; i < 81; i++) if (grid[i]) grid[i] = new Set(['1', '2']);
        expect(findPointingPair(grid)).toBeNull();
    });
});

describe('applyRemovals', () => {
    it('deletes the named candidates', () => {
        const grid = candidateGrid(EMPTY);
        applyRemovals(grid, [{ cell: 0, digit: '5' }, { cell: 1, digit: '9' }]);
        expect(grid[0].has('5')).toBe(false);
        expect(grid[1].has('9')).toBe(false);
        expect(grid[2].has('5')).toBe(true);
    });
});

describe('nextStep', () => {
    it('returns a placement for a real puzzle', () => {
        const step = nextStep(PUZZLES.easy[0].puzzle);
        expect(step).not.toBeNull();
        expect(step.idx).toBeGreaterThanOrEqual(0);
        expect(step.digit).toMatch(/[1-9]/);
        expect(step.nudge).toBeTruthy();
        expect(step.evidence.length).toBeGreaterThan(0);
    });

    it('never points at a filled cell', () => {
        for (const tier of ['easy', 'hard', 'evil']) {
            for (const p of PUZZLES[tier].slice(0, 20)) {
                const step = nextStep(p.puzzle);
                if (step) expect(p.puzzle[step.idx], `${tier} ${p.id}`).toBe('0');
            }
        }
    });

    /**
     * The property everything else rests on: a technique may only remove a
     * digit that genuinely cannot go there. One unsound elimination corrupts
     * every deduction downstream, so this is checked against the true solution
     * across many real positions.
     */
    it('never proposes a digit that contradicts the solution', () => {
        const wrong = [];
        for (const tier of ['easy', 'medium', 'hard', 'expert', 'evil', 'nightmare']) {
            for (const p of PUZZLES[tier].slice(0, 40)) {
                const solution = SudokuSolver.solveSudoku(p.puzzle).solution;
                const board = p.puzzle.split('');

                for (let n = 0; n < 25 && board.includes('0'); n++) {
                    const step = nextStep(board.join(''));
                    if (!step) break;
                    if (step.digit !== solution[step.idx]) {
                        wrong.push(`${tier} ${p.id}: ${cellName(step.idx)} said ${step.digit}, actually ${solution[step.idx]} (${step.type})`);
                    }
                    board[step.idx] = solution[step.idx];
                }
            }
        }
        expect(wrong).toEqual([]);
    });

    it('never removes a correct candidate', () => {
        const unsound = [];
        for (const tier of ['hard', 'evil', 'nightmare']) {
            for (const p of PUZZLES[tier].slice(0, 40)) {
                const solution = SudokuSolver.solveSudoku(p.puzzle).solution;
                const grid = candidateGrid(p.puzzle);

                for (const find of [findNakedPair, findPointingPair]) {
                    const elimination = find(grid);
                    if (!elimination) continue;
                    for (const { cell, digit } of elimination.removals) {
                        if (solution[cell] === digit) {
                            unsound.push(`${tier} ${p.id}: ${elimination.type} removed the answer ${digit} from ${cellName(cell)}`);
                        }
                    }
                }
            }
        }
        expect(unsound).toEqual([]);
    });

    // The whole basis for calling this a deduction rather than a giveaway:
    // these functions may not consult the answer. Comments are stripped first,
    // since the module explains this property in prose.
    it('reads only the board, never a solution', async () => {
        const fs = await import('node:fs');
        const source = fs.readFileSync(new URL('../techniques.js', import.meta.url), 'utf8');
        const code = source
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');

        expect(code).not.toMatch(/solution/i);
        expect(code).not.toMatch(/solveSudoku|SudokuSolver/);
    });
});
