import { describe, expect, it } from 'vitest';
import { assessPuzzle } from '../rating.js';
import { PUZZLES } from '../puzzle-bank.js';
import { SudokuSolver } from '../solver.js';

describe('imported puzzle assessment', () => {
    it('is deterministic and assesses a unique board without altering it', () => {
        const puzzle = PUZZLES.easy[0].puzzle;
        const result = assessPuzzle(puzzle);
        expect(result).toEqual(assessPuzzle(puzzle));
        expect(result).toMatchObject({ playable: true, solutions: 1, solved: true, clues: 38, label: 'Solved with singles.' });
        expect(SudokuSolver.validateSolution(result.solution)).toBe(true);
    });
    it('keeps ambiguous, inconsistent, malformed and completed grids out of Play', () => {
        expect(assessPuzzle('0'.repeat(81))).toMatchObject({ playable: false, solutions: 2 });
        expect(assessPuzzle('11' + '0'.repeat(79))).toMatchObject({ playable: false, solutions: 0 });
        expect(assessPuzzle('123')).toMatchObject({ playable: false });
        expect(assessPuzzle(assessPuzzle(PUZZLES.easy[0].puzzle).solution)).toMatchObject({ playable: false, label: 'Already complete.' });
    });
});
