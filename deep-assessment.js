import { assessPuzzleV2 } from './assessment.js';
import { createReasoningState, applyDeduction, REASONING_RULES } from './reasoning.js';
import { EXTENDED_VERSION, ANALYSIS_PROFILES, nextExtendedDeduction } from './extended-reasoning.js';
import { SudokuSolver } from './solver.js';

/** Preserve the v2 family passes, then measure a stronger pass only if needed.
 * Same arbitrary-board core for maintenance and interactive import; the profile
 * is recorded and controls deterministic work, never the resulting tier label.
 */
export function assessPuzzleDeep(puzzle, { trace = false, maxSteps = 810, profile = 'maintenance' } = {}) {
    if (!ANALYSIS_PROFILES[profile]) throw new Error('Unknown analysis profile');
    const baseline = assessPuzzleV2(puzzle, { trace, maxSteps });
    const common = { version: EXTENDED_VERSION, profile, limits: ANALYSIS_PROFILES[profile], baselineVersion: baseline.version };
    if (!['unresolved', 'budget-exhausted'].includes(baseline.status)) return { ...baseline, ...common };
    const state = createReasoningState(puzzle);
    const answer = SudokuSolver.solveSudoku(puzzle).solution;
    const steps = [], techniqueCounts = {};
    const workload = { placements: 0, eliminationSteps: 0, candidateEliminations: 0, propagationRemovals: 0,
        totalSteps: 0, longestEliminationRun: 0, dynamicWork: 0, largestBranchProof: 0 };
    const audit = { ...baseline.audit, dynamicProofs: 0 };
    const ruleOrder = [...REASONING_RULES, { type: 'dynamic-forcing-chain', family: 5 }, { type: 'forcing-convergence', family: 5 }];
    let status = 'solved', run = 0, highest = -1, highestFamilyUsed = null;
    while (state.board.includes('0')) {
        if (workload.totalSteps >= maxSteps) { status = 'budget-exhausted'; break; }
        const budget = {};
        const step = nextExtendedDeduction(state, { profile, budget });
        workload.dynamicWork += budget.work || 0;
        if (!step) { status = budget.exhausted ? 'budget-exhausted' : 'unresolved'; break; }
        if (step.kind === 'placement') {
            if (step.digit !== answer[step.idx]) throw new Error('Unsound placement');
            workload.placements++; audit.placements++; run = 0;
        } else {
            for (const { cell, digit } of step.removals) if (answer[cell] === digit) throw new Error('Unsound removal');
            workload.eliminationSteps++; workload.candidateEliminations += step.removals.length;
            audit.candidateEliminations += step.removals.length;
            workload.longestEliminationRun = Math.max(workload.longestEliminationRun, ++run);
        }
        if (step.engineVersion) {
            audit.dynamicProofs++;
            workload.largestBranchProof = Math.max(workload.largestBranchProof, ...step.proof.branches.map(b => b.nodes.length));
        }
        const rank = ruleOrder.findIndex(rule => rule.type === step.rule);
        if (rank > highest) { highest = rank; highestFamilyUsed = step.family; }
        workload.propagationRemovals += applyDeduction(state, step);
        workload.totalSteps++;
        techniqueCounts[step.rule] = (techniqueCounts[step.rule] || 0) + 1;
        if (trace) steps.push(step);
    }
    const family = status === 'solved' ? 'dynamic-chains' : null;
    const result = { ...common, status, family, playable: true, clues: baseline.clues, solutions: 1,
        highestTechniqueUsed: highest < 0 ? null : ruleOrder[highest].type, highestFamilyUsed, remaining: state.board.filter(d => d === '0').length,
        workload, techniqueCounts, label: family ? 'Solved with dynamic chains.'
            : status === 'budget-exhausted' ? 'Assessment reached its work limit.' : 'Beyond the currently supported deductions.' };
    return { ...result, audit, passes: [...baseline.passes, { cap: 'dynamic-chains', ...result }], ...(trace ? { trace: steps } : {}) };
}
