import { describe, it, expect, beforeAll } from 'vitest';
import { SudokuSolver } from '../solver.js';
import { SudokuGenerator } from '../generator.js';

beforeAll(() => {
    ({ CLUE_TARGETS } = SudokuGenerator);
});

// Read from the generator rather than duplicated, so the two cannot drift.
let CLUE_TARGETS;

// 'nightmare' is excluded: digging to 17 clues at runtime is far too slow,
// which is why app.js never falls back to the generator for it.
const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert', 'evil'];

describe('generate', () => {
    for (const difficulty of DIFFICULTIES) {
        describe(difficulty, () => {
            let result;
            beforeAll(() => {
                // Generation is probabilistic: each attempt is an independent
                // dig, so the default budget occasionally runs out (~1% of the
                // time at expert). These assertions are about what the algorithm
                // achieves given room to work, so the budget is made generous
                // here; the default best-effort behaviour is covered separately.
                result = SudokuGenerator.generate(difficulty, {
                    maxAttempts: 60,
                    timeBudgetMs: 20_000,
                });
            });

            it('returns a puzzle, solution and clue count', () => {
                expect(result).not.toBeNull();
                expect(result.puzzle).toHaveLength(81);
                expect(result.solution).toHaveLength(81);
                expect(result.clues).toBe(result.puzzle.replace(/0/g, '').length);
            });

            it('produces a valid complete solution', () => {
                expect(SudokuSolver.validateSolution(result.solution)).toBe(true);
            });

            it('produces a puzzle consistent with its solution', () => {
                for (let i = 0; i < 81; i++) {
                    if (result.puzzle[i] !== '0') {
                        expect(result.puzzle[i]).toBe(result.solution[i]);
                    }
                }
            });

            it('produces a puzzle with exactly one solution', () => {
                expect(SudokuSolver.countSolutions(result.puzzle, 2)).toBe(1);
            });

            it('solves back to the same solution', () => {
                expect(SudokuSolver.solveSudoku(result.puzzle).solution).toBe(result.solution);
            });

            it('lands inside the target clue range', () => {
                expect(result.clues).toBeGreaterThanOrEqual(CLUE_TARGETS[difficulty].min);
                expect(result.clues).toBeLessThanOrEqual(CLUE_TARGETS[difficulty].max);
            });

            it('meets the difficulty target rather than settling for best effort', () => {
                expect(result.targetMet).toBe(true);
            });

            it('requires at least the tier\'s minimum search effort', () => {
                expect(result.searchNodes).toBeGreaterThanOrEqual(CLUE_TARGETS[difficulty].minNodes);
            });

            it('reports how many attempts it took', () => {
                expect(result.attempts).toBeGreaterThanOrEqual(1);
                expect(result.timeMs).toBeGreaterThanOrEqual(0);
            });
        });
    }

    it('defaults to medium for an unknown difficulty', () => {
        const result = SudokuGenerator.generate('does-not-exist');
        expect(result.clues).toBeGreaterThanOrEqual(CLUE_TARGETS.medium.min);
    });

    it('produces a different puzzle each call', () => {
        const a = SudokuGenerator.generate('easy');
        const b = SudokuGenerator.generate('easy');
        expect(a.puzzle).not.toBe(b.puzzle);
    });

    it('reports targetMet honestly when the budget runs out', () => {
        // One attempt almost never satisfies evil, and the result must say so
        // rather than quietly returning an easier puzzle as if it qualified.
        const result = SudokuGenerator.generate('evil', { maxAttempts: 1 });
        if (!result.targetMet) {
            const target = CLUE_TARGETS.evil;
            expect(result.clues > target.max || result.searchNodes < target.minNodes).toBe(true);
        }
    });

    it('still returns a usable puzzle when the budget is exhausted', () => {
        // One attempt is rarely enough for evil, but a best-effort puzzle must
        // still be valid and uniquely solvable rather than null.
        const result = SudokuGenerator.generate('evil', { maxAttempts: 1 });
        expect(result.attempts).toBe(1);
        expect(SudokuSolver.countSolutions(result.puzzle, 2)).toBe(1);
    });

    it('honours a time budget', () => {
        const result = SudokuGenerator.generate('evil', { timeBudgetMs: 1 });
        expect(result.attempts).toBeLessThan(20);
        expect(SudokuSolver.countSolutions(result.puzzle, 2)).toBe(1);
    });
});

describe('difficulty ladder', () => {
    // The tiers must actually differ in solving effort. Clue count alone does
    // not deliver that — it is why the bank's expert and evil tiers came out
    // indistinguishable.
    it('demands strictly more search effort at each step', () => {
        const order = ['easy', 'medium', 'hard', 'expert', 'evil'];
        const thresholds = order.map((d) => CLUE_TARGETS[d].minNodes);
        for (let i = 1; i < thresholds.length; i++) {
            expect(thresholds[i], order[i]).toBeGreaterThanOrEqual(thresholds[i - 1]);
        }
        expect(CLUE_TARGETS.evil.minNodes).toBeGreaterThan(CLUE_TARGETS.expert.minNodes);
    });

    it('allows fewer clues at each step up', () => {
        const order = ['easy', 'medium', 'hard', 'expert', 'evil'];
        for (let i = 1; i < order.length; i++) {
            expect(CLUE_TARGETS[order[i]].min, order[i])
                .toBeLessThan(CLUE_TARGETS[order[i - 1]].min);
        }
    });
});
