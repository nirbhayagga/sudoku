import { describe, expect, it } from 'vitest';
import { findHiddenTriple, findNakedQuad, findHiddenQuad, findSwordfish, findJellyfish, findXYZWing } from '../advanced-techniques.js';
import { createReasoningState, nextDeduction, applyDeduction, replayDeduction, runReasoning } from '../reasoning.js';
import { assessPuzzleV2 } from '../assessment.js';
import { SudokuSolver } from '../solver.js';
import { PUZZLES } from '../puzzle-bank.js';

const full = () => Array.from({ length: 81 }, () => new Set('123456789'));
const row = (grid, sets) => sets.forEach((set, i) => { grid[i] = new Set(set); });

describe('additional human techniques', () => {
    it('reserves naked quads, including four different bivalue cells', () => {
        const grid = full();
        row(grid, ['12', '23', '34', '14']);
        const step = findNakedQuad(grid);
        expect(step?.cells).toEqual([0, 1, 2, 3]);
        expect(step.removals).toContainEqual({ cell: 8, digit: '4' });
        expect(grid[8].has('4')).toBe(true);
        grid[3].add('5');
        expect(findNakedQuad(grid)).toBeNull();
    });
    it.each([
        [findHiddenTriple, ['124', '235', '136', '456789', '456789', '456789', '456789', '456789', '456789'], '4'],
        [findHiddenQuad, ['125', '236', '347', '148', '56789', '56789', '56789', '56789', '56789'], '5'],
    ])('restricts hidden subsets only when all their homes fit the subset', (find, sets, extra) => {
        const grid = full(); row(grid, sets);
        const step = find(grid);
        expect(step.removals).toContainEqual({ cell: 0, digit: extra });
        expect(step.removals).not.toContainEqual({ cell: 0, digit: '1' });
        grid[8].add('1');
        expect(find(grid)).toBeNull();
    });
    it.each([[3, findSwordfish], [4, findJellyfish]])('detects degree %i fish without requiring every base to have every cover', (size, find) => {
        const grid = full();
        for (let base = 0; base < size; base++) {
            for (let col = 0; col < 9; col++) if (![base * 2, ((base + 1) % size) * 2].includes(col)) grid[base * 18 + col].delete('1');
        }
        const step = find(grid);
        expect(step?.orientation).toBe('row');
        expect(step.removals).toContainEqual({ cell: 9, digit: '1' });
        const transpose = Array.from({ length: 81 }, (_, i) => grid[(i % 9) * 9 + Math.floor(i / 9)]);
        expect(find(transpose)?.orientation).toBe('column');
        grid[1].add('1');
        expect(find(grid)).toBeNull();
    });
    it('XYZ-Wing targets must see all three cells, including the pivot', () => {
        const grid = full();
        grid[0] = new Set('123'); grid[1] = new Set('13'); grid[9] = new Set('23');
        expect(findXYZWing(grid)?.removals).toContainEqual({ cell: 10, digit: '3' });
        const separated = full();
        separated[10] = new Set('123'); separated[13] = new Set('13'); separated[37] = new Set('23');
        expect(findXYZWing(separated)).toBeNull();
    });
});

describe('shared proof records and assessment', () => {
    it('binds a deduction to its exact premises and rejects stale or altered outcomes', () => {
        const puzzle = PUZZLES.easy[0].puzzle;
        const state = createReasoningState(puzzle);
        const step = nextDeduction(state);
        expect(step.premises.length).toBeGreaterThan(0);
        expect(step.nudge).toBeTruthy();
        expect(() => replayDeduction(state, { ...step, digit: step.digit === '1' ? '2' : '1' })).toThrow('Invalid proof');
        replayDeduction(state, step);
        expect(() => applyDeduction(state, step)).toThrow('Stale');
    });
    it('replays a full persistent path and audits every elimination across varied boards', () => {
        const failures = [];
        for (const [tier, puzzles] of Object.entries(PUZZLES)) {
            for (const offset of Array.from({ length: 10 }, (_, i) => Math.floor(i * (puzzles.length - 1) / 9))) {
                const puzzle = puzzles[offset].puzzle;
                const answer = SudokuSolver.solveSudoku(puzzle).solution;
                const run = runReasoning(puzzle, { trace: true });
                const replay = createReasoningState(puzzle);
                for (const step of run.trace) {
                    if (step.kind === 'placement' && step.digit !== answer[step.idx]) failures.push(`${tier}/${offset}: placement`);
                    if (step.removals?.some(({ cell, digit }) => digit === answer[cell])) failures.push(`${tier}/${offset}: elimination`);
                    replayDeduction(replay, step);
                }
                if (run.status === 'solved' && replay.board.join('') !== answer) failures.push(`${tier}/${offset}: finish`);
            }
        }
        expect(failures).toEqual([]);
    });
    it('separates invalid, impossible, ambiguous, complete and budget-limited states', () => {
        expect(assessPuzzleV2('')).toMatchObject({ status: 'invalid', playable: false });
        expect(assessPuzzleV2('11' + '0'.repeat(79))).toMatchObject({ status: 'no-solution', playable: false });
        expect(assessPuzzleV2('0'.repeat(81))).toMatchObject({ status: 'multiple-solutions', playable: false });
        expect(assessPuzzleV2(SudokuSolver.solveSudoku(PUZZLES.easy[0].puzzle).solution)).toMatchObject({ status: 'complete', playable: false });
        expect(assessPuzzleV2(PUZZLES.easy[0].puzzle, { maxSteps: 1 })).toMatchObject({ status: 'budget-exhausted', family: null, playable: true });
    });
    it('assesses previously unseen digit relabelings and keeps answers out of ordinary reports', () => {
        const puzzle = PUZZLES.medium[2].puzzle.replace(/[1-9]/g, d => String(10 - Number(d)));
        const result = assessPuzzleV2(puzzle);
        expect(result.playable).toBe(true);
        expect(result).not.toHaveProperty('solution');
        expect(result).not.toHaveProperty('trace');
        expect(result).toEqual(assessPuzzleV2(puzzle));
    });
});
