import { describe, it, expect } from 'vitest';
import { SudokuSolver } from '../solver.js';
import { createReasoningState, applyDeduction, runReasoning } from '../reasoning.js';
import { assessPuzzleDeep } from '../deep-assessment.js';
import { nextExtendedDeduction, replayExtendedDeduction } from '../extended-reasoning.js';
import { findDynamicChain, verifyDynamicProof } from '../dynamic-chains.js';
import { findHintPath } from '../hint-path.js';

const cases = ['000070000010400372600005000006000000000030000200000408300090054050000007802041060', '000030029700009400080600007060000090030500000002000030500860070010000008300010000', '705010000100209000068000002000501004630020001000030020300150200000000000000400819'];

describe('dynamic proof engine', () => {
    it.each(cases)('finishes formerly stalled puzzles with independently replayable deductions', puzzle => {
        expect(runReasoning(puzzle).status).not.toBe('solved');
        const result = assessPuzzleDeep(puzzle, { trace: true });
        expect(result).toMatchObject({ status: 'solved', family: 'dynamic-chains', version: 'human-v3.0' });
        const state = createReasoningState(puzzle);
        const answer = SudokuSolver.solveSudoku(puzzle).solution;
        let dynamic = 0;
        for (const step of result.trace) {
            if (step.engineVersion) {
                dynamic++;
                expect(verifyDynamicProof(state.candidates, step.proof)).toBe(true);
            }
            if (step.removals) expect(step.removals.some(({ cell, digit }) => answer[cell] === digit)).toBe(false);
            else expect(step.digit).toBe(answer[step.idx]);
            replayExtendedDeduction(state, step);
        }
        expect(dynamic).toBeGreaterThan(0);
        expect(state.board.join('')).toBe(answer);
    });
    it('rejects missing multi-parent premises, altered outcomes and invalid alternatives', () => {
        const state = createReasoningState(cases[1]);
        let checkedParent = false, checkedConvergence = false;
        while (state.board.includes('0')) {
            const step = nextExtendedDeduction(state, { profile: 'maintenance' });
            if (step.engineVersion) {
                expect(() => replayExtendedDeduction(state, { ...step, proof: { ...step.proof, target: step.proof.target ^ 1 } })).toThrow('Invalid dynamic proof');
                const changed = structuredClone(step.proof);
                const node = changed.branches.flatMap(b => b.nodes).find(n => n.parents.length > 1);
                if (node) { node.parents.pop(); expect(verifyDynamicProof(state.candidates, changed)).toBe(false); checkedParent = true; }
                if (step.proof.kind === 'convergence') {
                    const invalid = { ...step.proof, branches: [step.proof.branches[0], step.proof.branches[0]] };
                    expect(verifyDynamicProof(state.candidates, invalid)).toBe(false);
                    checkedConvergence = true;
                }
            }
            applyDeduction(state, step);
        }
        expect(checkedParent).toBe(true);
        expect(checkedConvergence).toBe(true);
    });
    it('stops at deterministic work limits and leaves candidates untouched', () => {
        const state = createReasoningState(cases[0]);
        const before = structuredClone(state.candidates);
        const budget = {};
        expect(findDynamicChain(state.candidates, { maxWork: 1, budget })).toBeNull();
        expect(budget).toEqual({ work: 1, exhausted: true });
        expect(state.candidates).toEqual(before);
        expect(() => findDynamicChain(state.candidates, { maxWork: Infinity })).toThrow('Invalid dynamic');
        expect(() => assessPuzzleDeep(cases[0], { profile: 'unknown' })).toThrow('Unknown analysis');
        expect(assessPuzzleDeep(cases[0], { maxSteps: 1 })).toMatchObject({ status: 'budget-exhausted', family: null, highestFamilyUsed: 'singles' });
    });
    it('handles arbitrary transformed imports and keeps interactive hints consistent', () => {
        // Digit relabeling is not a lookup into a known puzzle/level.
        const puzzle = cases[1].replace(/[1-9]/g, d => String(10 - Number(d)));
        const assessment = assessPuzzleDeep(puzzle, { profile: 'interactive' });
        expect(assessment.status).toBe('solved');
        expect(assessment.limits.dynamicWorkPerStep).toBe(100000);
        expect(assessment.solution).toBeUndefined();
        let board = puzzle, continuation = null, dynamic = 0;
        for (let i = 0; i < 81 && board.includes('0'); i++) {
            const hint = findHintPath(board, { continuation });
            expect(hint.status).toBe('placement');
            dynamic += hint.trace.filter(s => s.engineVersion).length;
            continuation = hint.continuation; board = continuation.board;
        }
        expect(dynamic).toBeGreaterThan(0);
        expect(board).toBe(SudokuSolver.solveSudoku(puzzle).solution);
    });
    it('retains invalid, impossible, ambiguous and complete distinctions', () => {
        expect(assessPuzzleDeep('abc').status).toBe('invalid');
        expect(assessPuzzleDeep('11' + '0'.repeat(79)).status).toBe('no-solution');
        expect(assessPuzzleDeep('0'.repeat(81)).status).toBe('multiple-solutions');
        expect(assessPuzzleDeep(SudokuSolver.solveSudoku(cases[0]).solution).status).toBe('complete');
    });
});
