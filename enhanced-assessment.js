import { SudokuSolver } from './solver.js';
import { createReasoningState, applyDeduction } from './reasoning.js';
import { ENHANCED_VERSION, ENHANCED_FAMILIES, ENHANCED_PROFILES, establishUniqueness, nextEnhancedDeduction, proofComplexity } from './enhanced-reasoning.js';

function run(puzzle, answer, options, audit) {
    const { profile, order, familyCap, maxSteps, trace } = options;
    const state = createReasoningState(puzzle);
    establishUniqueness(state, puzzle);
    const steps = [], techniqueCounts = {};
    const workload = { totalSteps: 0, placements: 0, eliminationSteps: 0, candidateEliminations: 0,
        propagationRemovals: 0, longestEliminationRun: 0, largestProof: 0, deepestProof: 0, largestBranchCount: 0 };
    const opening = { firstDeduction: null, firstPlacement: null, precedingEliminations: 0, hardestFamilyBeforeFirstPlacement: null };
    let peak = -1, highestTechniqueUsed = null, run = 0, status = 'solved';
    while (state.board.includes('0')) {
        if (workload.totalSteps >= maxSteps) { status = 'budget-exhausted'; break; }
        const budget = {};
        const step = nextEnhancedDeduction(state, { profile, order, familyCap, budget });
        if (!step) { status = budget.exhausted ? 'budget-exhausted' : 'unresolved'; break; }
        const rank = ENHANCED_FAMILIES.indexOf(step.family);
        if (rank > peak) { peak = rank; highestTechniqueUsed = step.type; }
        const size = proofComplexity(step);
        workload.largestProof = Math.max(workload.largestProof, size.nodes);
        workload.deepestProof = Math.max(workload.deepestProof, size.depth);
        workload.largestBranchCount = Math.max(workload.largestBranchCount, size.branches);
        if (!opening.firstDeduction) opening.firstDeduction = { technique: step.type, family: step.family };
        if (!opening.firstPlacement) {
            opening.hardestFamilyBeforeFirstPlacement = ENHANCED_FAMILIES[peak];
            if (step.kind === 'placement') opening.firstPlacement = { technique: step.type, family: step.family, step: workload.totalSteps + 1 };
            else opening.precedingEliminations++;
        }
        if (step.kind === 'placement') {
            if (step.digit !== answer[step.idx]) throw new Error(`Unsound ${step.type} placement`);
            workload.placements++; audit.placements++; run = 0;
        } else {
            for (const { cell, digit } of step.removals) if (answer[cell] === digit) throw new Error(`Unsound ${step.type} removal`);
            workload.candidateEliminations += step.removals.length; audit.candidateEliminations += step.removals.length;
            workload.eliminationSteps++; workload.longestEliminationRun = Math.max(workload.longestEliminationRun, ++run);
        }
        workload.propagationRemovals += applyDeduction(state, step);
        workload.totalSteps++;
        techniqueCounts[step.type] = (techniqueCounts[step.type] || 0) + 1;
        if (trace) steps.push(step);
    }
    return { status, family: status === 'solved' ? ENHANCED_FAMILIES[peak] : null,
        highestFamilyUsed: ENHANCED_FAMILIES[peak] || null, highestTechniqueUsed, order, cap: ENHANCED_FAMILIES[familyCap],
        remaining: state.board.filter(d => d === '0').length, workload, opening, techniqueCounts, ...(trace ? { trace: steps } : {}) };
}
const pathKey = p => [ENHANCED_FAMILIES.indexOf(p.family), p.workload.deepestProof, p.workload.largestProof, p.workload.eliminationSteps, p.workload.totalSteps];
function comparePaths(a, b) {
    const left = pathKey(a), right = pathKey(b);
    for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] - right[i];
    return 0;
}
/** An observed path rating, not a numeric SE grade or a minimum-complexity proof. */
export function assessPuzzleEnhanced(puzzle, { profile = 'maintenance', maxSteps = 810, trace = false } = {}) {
    if (!ENHANCED_PROFILES[profile] || !Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 810) throw new Error('Invalid assessment policy');
    const base = { version: ENHANCED_VERSION, profile, limits: ENHANCED_PROFILES[profile], family: null, playable: false };
    if (typeof puzzle !== 'string' || !/^[0-9]{81}$/.test(puzzle)) return { ...base, status: 'invalid', label: 'Enter a complete grid.' };
    const solutions = SudokuSolver.countSolutions(puzzle, 2), clues = puzzle.replaceAll('0', '').length;
    if (solutions !== 1) return { ...base, solutions, clues, status: solutions ? 'multiple-solutions' : 'no-solution', label: solutions ? 'Multiple solutions.' : 'No solution.' };
    if (clues === 81) return { ...base, solutions, clues, status: 'complete', label: 'Already complete.' };
    const answer = SudokuSolver.solveSudoku(puzzle).solution, audit = { placements: 0, candidateEliminations: 0 };
    const passes = [];
    let chosen;
    for (let cap = 0; cap < ENHANCED_FAMILIES.length; cap++) {
        chosen = run(puzzle, answer, { profile, maxSteps, familyCap: cap, order: 'forward', trace }, audit);
        const { trace: ignored, ...summary } = chosen; // traces are opt-in and only the chosen path is returned
        void ignored;
        passes.push(summary);
        if (chosen.status === 'solved') {
            if (cap > 0 && ENHANCED_PROFILES[profile].alternatives > 1) {
                const alternative = run(puzzle, answer, { profile, maxSteps, familyCap: cap, order: 'reverse', trace }, audit);
                const { trace: ignored, ...summary } = alternative; void ignored;
                passes.push(summary);
                if (alternative.status === 'solved' && comparePaths(alternative, chosen) < 0) chosen = alternative;
            }
            break;
        }
    }
    return { ...base, ...chosen, clues, solutions, playable: true, audit, passes,
        label: chosen.family ? `Solved with ${chosen.family.replaceAll('-', ' ')}.` : chosen.status === 'budget-exhausted' ? 'Assessment reached its work limit.' : 'Beyond supported deductions.' };
}
