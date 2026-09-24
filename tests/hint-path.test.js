import { describe, it, expect } from 'vitest';
import { findHintPath } from '../hint-path.js';
import { runReasoning, createReasoningState, applyDeduction } from '../reasoning.js';
import { findForcingChain, verifyChainProof } from '../chains.js';
import { PUZZLES } from '../puzzle-bank.js';
import { SudokuSolver } from '../solver.js';

describe('hint proof continuity', () => {
    it('continues successive explanations with retained exclusions and verified placements', () => {
        let board = PUZZLES.easy[97].puzzle;
        const answer = SudokuSolver.solveSudoku(board).solution;
        let continuation = null;
        const failures = [];
        let chains = 0;
        for (let count = 0; count < 81 && board.includes('0'); count++) {
            const result = findHintPath(board, { continuation });
            if (result.status !== 'placement') { failures.push(result.status); break; }
            for (const step of result.trace) {
                if (step.proof) chains++;
                if (step.removals?.some(({ cell, digit }) => answer[cell] === digit)) failures.push('removed answer');
                if (step.kind === 'placement' && step.digit !== answer[step.idx]) failures.push('wrong placement');
            }
            continuation = result.continuation;
            board = continuation.board;
        }
        expect(failures).toEqual([]);
        expect(chains).toBeGreaterThan(0);
        expect(board).toBe(answer);
        // A changed visible board ignores the stale continuation.
        expect(findHintPath(PUZZLES.easy[0].puzzle, { continuation })).toEqual(findHintPath(PUZZLES.easy[0].puzzle));
    });
    it('reports a chain work limit even when the final allowed edge is reached exactly', () => {
        const grid = Array.from({ length: 81 }, () => null);
        grid[0] = new Set('12');
        const budget = {};
        expect(findForcingChain(grid, { maxEdges: 1, maxDepth: 1, budget })).toBeNull();
        expect(budget.exhausted).toBe(true);
        expect(() => findForcingChain(grid, { maxDepth: 0 })).toThrow('Invalid chain budget');
    });
    it('independently rejects altered chain implications and contradiction claims', () => {
        const puzzle = PUZZLES.easy[97].puzzle;
        const result = runReasoning(puzzle, { trace: true });
        const state = createReasoningState(puzzle);
        let proof;
        for (const step of result.trace) {
            if (step.proof) { proof = step.proof; break; }
            applyDeduction(state, step);
        }
        expect(verifyChainProof(state.candidates, proof)).toBe(true);
        const changed = structuredClone(proof);
        changed.nodes[1].cause = 'unknown-edge';
        expect(verifyChainProof(state.candidates, changed)).toBe(false);
        expect(verifyChainProof(state.candidates, { ...proof, contradiction: [proof.contradiction[0], proof.contradiction[0]] })).toBe(false);
    });
});
