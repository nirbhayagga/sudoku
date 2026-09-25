import { describe, expect, it } from 'vitest';
import { PRACTICE_BANK } from '../practice-bank.js';
import { prepareExercise, acceptsPracticeMove } from '../practice.js';
import { SudokuSolver } from '../solver.js';
import { replayDeduction } from '../reasoning.js';

describe('curated technique lessons', () => {
    it('reconstructs every position, independently replays its deduction and audits all conclusions', () => {
        const ids = new Set();
        for (const [type, exercises] of Object.entries(PRACTICE_BANK.groups)) for (const exercise of exercises) {
            const { state, step, id } = prepareExercise(exercise);
            expect(step.type).toBe(type); expect(ids.has(id)).toBe(false); ids.add(id);
            const answer = SudokuSolver.solveSudoku(exercise.puzzle).solution;
            if (step.kind === 'placement') {
                expect(acceptsPracticeMove(step, step.idx, step.digit)).toBe(true);
                expect(answer[step.idx]).toBe(step.digit);
            } else for (const { cell, digit } of step.removals) {
                expect(acceptsPracticeMove(step, cell, digit)).toBe(true);
                expect(answer[cell]).not.toBe(digit);
            }
            replayDeduction(state, step);
        }
        expect(ids.size).toBe(56);
    });
    it('rejects changed technique labels, unsupported offsets, and ambiguous source grids', () => {
        const exercise = PRACTICE_BANK.groups['naked-single'][0];
        expect(() => prepareExercise({ ...exercise, type: 'x-wing' })).toThrow(/changed/);
        expect(() => prepareExercise({ ...exercise, index: 999 })).toThrow();
        expect(() => prepareExercise({ ...exercise, puzzle: '0'.repeat(81) })).toThrow(/unique/);
    });
});
