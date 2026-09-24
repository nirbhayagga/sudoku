import { SudokuSolver } from './solver.js';
import { runReasoning, REASONING_FAMILIES, REASONING_VERSION } from './reasoning.js';

/** Shared arbitrary-board assessment. Answer verification audits, never chooses, deductions. */
export function assessPuzzleV2(puzzle, { trace = false, maxSteps = 810 } = {}) {
    const base = { version: REASONING_VERSION, family: null, playable: false };
    if (typeof puzzle !== 'string' || !/^[0-9]{81}$/.test(puzzle)) return { ...base, status: 'invalid', label: 'Enter a complete 81-cell grid.' };
    const solutions = SudokuSolver.countSolutions(puzzle, 2);
    const clues = puzzle.replaceAll('0', '').length;
    if (solutions !== 1) return { ...base, clues, solutions, status: solutions ? 'multiple-solutions' : 'no-solution',
        label: solutions ? 'Multiple solutions. Add givens, or open in Solver to explore.' : 'No solution. Check the givens, or open in Solver to edit.' };
    if (clues === 81) return { ...base, clues, solutions, status: 'complete', label: 'Already complete.' };
    const answer = SudokuSolver.solveSudoku(puzzle).solution;
    const passes = [];
    const audit = { placements: 0, candidateEliminations: 0 };
    for (let cap = 0; cap < REASONING_FAMILIES.length; cap++) {
        const result = runReasoning(puzzle, { familyCap: cap, maxSteps, trace, observe: step => {
            if (step.kind === 'placement') {
                if (step.digit !== answer[step.idx]) throw new Error(`Unsound ${step.type} placement`);
                audit.placements++;
            } else for (const { cell, digit } of step.removals) {
                if (digit === answer[cell]) throw new Error(`Unsound ${step.type} elimination`);
                audit.candidateEliminations++;
            }
        } });
        const { trace: steps, ...pass } = result;
        passes.push({ cap: REASONING_FAMILIES[cap], ...pass });
        if (result.status === 'solved' || result.status === 'budget-exhausted' || cap === REASONING_FAMILIES.length - 1) {
            const family = result.status === 'solved' ? REASONING_FAMILIES[cap] : null;
            const label = family ? `Solved with ${family.replaceAll('-', ' ')}.`
                : result.status === 'budget-exhausted' ? 'Assessment reached its work limit.' : 'Beyond the currently supported deductions.';
            return { ...base, ...pass, family, playable: true, clues, solutions, label, passes, audit,
                ...(trace ? { trace: steps } : {}) };
        }
    }
}
