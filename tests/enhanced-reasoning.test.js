import { describe, it, expect } from 'vitest';
import { SudokuSolver } from '../solver.js';
import { createReasoningState, applyDeduction } from '../reasoning.js';
import { assessPuzzleEnhanced } from '../enhanced-assessment.js';
import { nextEnhancedDeduction, replayEnhancedDeduction, establishUniqueness, proofComplexity } from '../enhanced-reasoning.js';

describe('enhanced reasoning', () => {
    it('finds a simpler uniqueness rectangle for original Expert 445 and independently replays it', () => {
        const puzzle = '000070000010400372600005000006000000000030000200000408300090054050000007802041060';
        const result = assessPuzzleEnhanced(puzzle, { trace: true });
        expect(result.family).toBe('uniqueness');
        expect(result.techniqueCounts['unique-rectangle-4']).toBeGreaterThan(0);
        const state = createReasoningState(puzzle);
        for (const step of result.trace) {
            if (step.uniqueness) {
                expect(() => replayEnhancedDeduction(state, { ...step, uniqueness: '0'.repeat(81) })).toThrow('uniqueness premise');
                expect(() => replayEnhancedDeduction(state, { ...step, removals: [{ cell: 0, digit: '1' }] })).toThrow('uniqueness deduction');
            }
            replayEnhancedDeduction(state, step);
        }
        expect(state.board.join('')).toBe(SudokuSolver.solveSudoku(puzzle).solution);
        expect(result.opening.firstPlacement.step).toBeGreaterThan(0);
    });
    it.each([[117, "000807000070500000400219008583002001020008000900071000100780056007100092600904100"], [165, "450020908080000050710006002800300090130200004000045200000070025560000000371902006"]])('replays named uniqueness patterns on original Medium %s', (level, puzzle) => {
        const result = assessPuzzleEnhanced(puzzle, { trace: true });
        const state = createReasoningState(puzzle);
        const named = result.trace.filter(step => step.uniqueness).map(step => step.type);
        expect(named).toEqual(expect.arrayContaining(level === 117 ? ['unique-rectangle-1', 'unique-rectangle-2'] : ['bug-plus-one']));
        for (const step of result.trace) replayEnhancedDeduction(state, step);
        expect(state.board.join('')).toBe(SudokuSolver.solveSudoku(puzzle).solution);
    });
    it('never trusts a uniqueness flag on an ambiguous board', () => {
        const state = createReasoningState('0'.repeat(81));
        expect(establishUniqueness(state)).toBe(false);
        expect(assessPuzzleEnhanced('0'.repeat(81)).status).toBe('multiple-solutions');
    });
    it('records bounded alternative paths, true proof sizes, and auditable moves', () => {
        const puzzle = '000030029700009400080600007060000090030500000002000030500860070010000008300010000';
        const result = assessPuzzleEnhanced(puzzle, { trace: true });
        expect(result.status).toBe('solved');
        expect(result.passes.some(p => p.order === 'reverse')).toBe(true);
        expect(result.workload.largestProof).toBeGreaterThan(0);
        const state = createReasoningState(puzzle);
        for (const step of result.trace) replayEnhancedDeduction(state, step);
        expect(result.workload.deepestProof).toBe(Math.max(...result.trace.map(s => proofComplexity(s).depth)));
    });
    it('uses the same verified patterns on transformed imported boards in interactive mode', () => {
        const puzzle = '000070000010400372600005000006000000000030000200000408300090054050000007802041060'.replace(/[1-9]/g, d => String(10 - Number(d)));
        const state = createReasoningState(puzzle);
        establishUniqueness(state);
        const answer = SudokuSolver.solveSudoku(puzzle).solution;
        for (let i = 0; i < 810 && state.board.includes('0'); i++) {
            const step = nextEnhancedDeduction(state);
            expect(step).not.toBeNull();
            if (step.removals) expect(step.removals.some(r => answer[r.cell] === r.digit)).toBe(false);
            else expect(step.digit).toBe(answer[step.idx]);
            applyDeduction(state, step);
        }
        expect(state.board.join('')).toBe(answer);
    });
});
