import { describe, expect, it } from 'vitest';
import { assessHumanPuzzle, HUMAN_FAMILIES } from '../human-rating.js';
import { assessPuzzle } from '../rating.js';
import { PUZZLES } from '../puzzle-bank.js';
import { SudokuSolver } from '../solver.js';
import { candidateGrid, candidatesFor, peersOf, UNITS } from '../techniques.js';
import * as techniques from '../techniques.js';

const LONG_CHAIN = '000006700004037209390002010509700040100400070000105002080000100000000007200070800';
const finders = {
    'pointing-pair': techniques.findPointingPair, 'claiming-pair': techniques.findClaimingPair,
    'naked-pair': techniques.findNakedPair, 'hidden-pair': techniques.findHiddenPair,
    'naked-triple': techniques.findNakedTriple, 'x-wing': techniques.findXWing, 'xy-wing': techniques.findXYWing,
};

describe('persistent human assessment', () => {
    it('retains eliminations across placements and independently replays a chain longer than a hint', () => {
        expect(assessPuzzle(LONG_CHAIN).solved).toBe(false);
        const result = assessHumanPuzzle(LONG_CHAIN, { trace: true });
        expect(result).toMatchObject({ status: 'solved', family: 'wings', remaining: 0 });
        expect(result.workload.longestEliminationRun).toBeGreaterThan(4);
        const board = [...LONG_CHAIN], grid = candidateGrid(LONG_CHAIN);
        const answer = SudokuSolver.solveSudoku(LONG_CHAIN).solution;
        const previousEliminations = [];
        let retainedAcrossPlacement = false;
        let removalCount = 0;
        for (const step of result.trace) {
            if (step.kind === 'placement') {
                expect(board[step.idx]).toBe('0');
                expect(step.digit).toBe(answer[step.idx]);
                if (step.type === 'naked-single') expect([...grid[step.idx]]).toEqual([step.digit]);
                else expect(UNITS.some(unit => unit.cells.includes(step.idx) && unit.cells.filter(i => grid[i]?.has(step.digit)).length === 1)).toBe(true);
                board[step.idx] = step.digit; grid[step.idx] = null;
                for (const peer of peersOf(step.idx)) grid[peer]?.delete(step.digit);
                retainedAcrossPlacement ||= previousEliminations.some(({ cell, digit }) =>
                    board[cell] === '0' && candidatesFor(board.join(''), cell).has(digit) && !grid[cell].has(digit));
            } else {
                const expected = finders[step.type](grid);
                expect(expected?.removals).toEqual(step.removals);
                for (const removal of step.removals) {
                    expect(removal.digit).not.toBe(answer[removal.cell]);
                    expect(grid[removal.cell].delete(removal.digit)).toBe(true);
                    previousEliminations.push(removal); removalCount++;
                }
            }
        }
        expect(retainedAcrossPlacement).toBe(true);
        expect(board.join('')).toBe(answer);
        expect(removalCount).toBe(result.workload.candidateEliminations);
        expect(result.trace.length).toBe(result.workload.totalSteps);
    });
    it('tries independent family caps, is repeatable, and omits answer spoilers by default', () => {
        const puzzle = PUZZLES.nightmare[2999].puzzle;
        const result = assessHumanPuzzle(puzzle);
        expect(result).toEqual(assessHumanPuzzle(puzzle));
        expect(result).toMatchObject({ family: 'subsets', status: 'solved', clues: 17 });
        expect(result.passes.map(pass => pass.cap)).toEqual(HUMAN_FAMILIES.slice(0, 3));
        expect(result.passes.slice(0, -1).every(pass => !pass.solved)).toBe(true);
        expect(result).not.toHaveProperty('trace');
        expect(result).not.toHaveProperty('solution');
        expect(JSON.stringify(result)).not.toContain(SudokuSolver.solveSudoku(puzzle).solution);
    });
    it('keeps unsupported boards unresolved without assigning the hardest family', () => {
        const result = assessHumanPuzzle(PUZZLES.expert[0].puzzle);
        expect(result).toMatchObject({ status: 'unresolved', family: null });
        expect(result.remaining).toBeGreaterThan(0);
        expect(result.passes).toHaveLength(4);
        expect(result.passes.every(pass => !pass.solved)).toBe(true);
        expect(result.workload.placements + result.remaining).toBe(81 - result.clues);
    });
    it('distinguishes invalid, impossible, ambiguous and completed input', () => {
        expect(assessHumanPuzzle('123')).toMatchObject({ status: 'invalid', family: null });
        expect(assessHumanPuzzle('11' + '0'.repeat(79))).toMatchObject({ status: 'no-solution', family: null });
        expect(assessHumanPuzzle('0'.repeat(81))).toMatchObject({ status: 'multiple-solutions', family: null });
        expect(assessHumanPuzzle(SudokuSolver.solveSudoku(LONG_CHAIN).solution)).toMatchObject({ status: 'complete', family: null });
    });
    it('audits a reproducible sample from every tier and accounts for all deductions', () => {
        for (const list of Object.values(PUZZLES)) {
            for (const index of [0, Math.floor(list.length / 2), list.length - 1]) {
                const result = assessHumanPuzzle(list[index].puzzle);
                expect(['solved', 'unresolved']).toContain(result.status);
                for (const pass of result.passes) {
                    expect(pass.workload.placements + pass.remaining).toBe(81 - result.clues);
                    expect(pass.workload.totalSteps).toBe(pass.workload.placements + pass.workload.eliminationSteps);
                    expect(Object.values(pass.techniqueCounts).reduce((a, b) => a + b, 0)).toBe(pass.workload.totalSteps);
                    expect(pass.workload.totalSteps).toBeLessThanOrEqual(810);
                }
                expect(result.audit.placements).toBe(result.passes.reduce((n, pass) => n + pass.workload.placements, 0));
                expect(result.audit.candidateEliminations).toBe(result.passes.reduce((n, pass) => n + pass.workload.candidateEliminations, 0));
            }
        }
    });
});
