import { describe, expect, it } from 'vitest';
import { generatePuzzle, generationOptions } from '../puzzle-generation.js';
import { SudokuSolver } from '../solver.js';

describe('repeatable human-rated generation', () => {
    it('reproduces an exact-clue symmetric puzzle and its independently assessed result', () => {
        const options = { seed: 'preview-check', family: 'singles', minClues: 35, maxClues: 35, symmetry: 'rotate180', maxAttempts: 2 };
        const first = generatePuzzle(options);
        expect(first).toEqual(generatePuzzle(options));
        expect(first).toMatchObject({ clues: 35, targetMet: true, assessment: { family: 'singles', playable: true } });
        expect(SudokuSolver.countSolutions(first.puzzle, 2)).toBe(1);
        expect([...first.puzzle].every((d, i) => (d === '0') === (first.puzzle[80 - i] === '0'))).toBe(true);
    });
    it('does not label the nearest result as satisfying a missed request', () => {
        const result = generatePuzzle({ seed: 'missed-target', family: 'chains', minClues: 79, maxClues: 79, maxAttempts: 2 });
        expect(result.targetMet).toBe(false);
        expect(result.assessment.family).toBe('singles');
        expect(result.attempts).toBe(2);
        expect(SudokuSolver.countSolutions(result.puzzle, 2)).toBe(1);
    });
    it.each([{ minClues: 0 }, { maxClues: 81 }, { minClues: 40, maxClues: 20 }, { family: 'nightmare' }, { symmetry: 'unknown' }, { maxAttempts: Infinity }, { seed: '' }])('rejects impossible or unsupported settings %j', options => {
        expect(() => generationOptions(options)).toThrow();
    });
});
