import { SudokuSolver } from './solver.js';
import {
    candidateGrid, peersOf, findNakedSingle, findHiddenSingle,
    findPointingPair, findClaimingPair, findNakedPair, findHiddenPair,
    findNakedTriple, findXWing, findXYWing,
} from './techniques.js';

// Changing technique order, family caps or workload definitions requires a new
// policy version. This is an assessment policy, not the bank's six-tier mapping.
export const HUMAN_RATING_VERSION = 'persistent-candidates-v1';
export const HUMAN_FAMILIES = Object.freeze(['singles', 'locked-candidates', 'subsets', 'wings']);
const TECHNIQUES = [
    { type: 'naked-single', family: 0, find: findNakedSingle },
    { type: 'hidden-single', family: 0, find: findHiddenSingle },
    { type: 'pointing-pair', family: 1, find: findPointingPair },
    { type: 'claiming-pair', family: 1, find: findClaimingPair },
    { type: 'naked-pair', family: 2, find: findNakedPair },
    { type: 'hidden-pair', family: 2, find: findHiddenPair },
    { type: 'naked-triple', family: 2, find: findNakedTriple },
    { type: 'x-wing', family: 3, find: findXWing },
    { type: 'xy-wing', family: 3, find: findXYWing },
];
export const HUMAN_TECHNIQUE_ORDER = Object.freeze(TECHNIQUES.map(item => item.type));
const PEERS = Array.from({ length: 81 }, (_, i) => peersOf(i));

/** One deterministic pass. The observer audits completed steps; its return
 * value is never read and it receives no mutable candidate/board state.
 * Candidate sets are initialized ONCE and only shrink until a cell is filled.
 */
function runPass(puzzle, familyCap, observe) {
    const board = [...puzzle];
    const candidates = candidateGrid(puzzle);
    const counts = Object.fromEntries(HUMAN_TECHNIQUE_ORDER.map(type => [type, 0]));
    const workload = { placements: 0, eliminationSteps: 0, candidateEliminations: 0,
        propagationRemovals: 0, totalSteps: 0, longestEliminationRun: 0 };
    let eliminationRun = 0;
    let highest = -1;
    while (board.includes('0')) {
        let changed = false;
        for (let rank = 0; rank < TECHNIQUES.length; rank++) {
            const technique = TECHNIQUES[rank];
            if (technique.family > familyCap) continue;
            const step = technique.find(candidates);
            if (!step) continue;
            const kind = technique.family === 0 ? 'placement' : 'elimination';
            if (kind === 'placement') {
                if (board[step.idx] !== '0' || !candidates[step.idx]?.has(step.digit)) throw new Error('Invalid human placement');
                board[step.idx] = step.digit;
                candidates[step.idx] = null;
                for (const peer of PEERS[step.idx]) {
                    if (candidates[peer]?.delete(step.digit)) workload.propagationRemovals++;
                }
                workload.placements++;
                eliminationRun = 0;
                observe({ kind, type: technique.type, idx: step.idx, digit: step.digit });
            } else {
                const removals = [];
                for (const { cell, digit } of step.removals) {
                    if (candidates[cell]?.delete(digit)) removals.push({ cell, digit });
                }
                if (!removals.length) throw new Error('Human technique did not remove a candidate');
                workload.eliminationSteps++;
                workload.candidateEliminations += removals.length;
                eliminationRun++;
                workload.longestEliminationRun = Math.max(workload.longestEliminationRun, eliminationRun);
                observe({ kind, type: technique.type, removals });
            }
            if (candidates.some(set => set?.size === 0)) throw new Error('Human technique emptied a candidate set');
            counts[technique.type]++;
            workload.totalSteps++;
            highest = Math.max(highest, rank);
            changed = true;
            break; // Restart with singles after EVERY deduction.
        }
        if (!changed) break;
        // Every iteration either fills an empty cell or removes a candidate.
        // 81 cells + at most 729 candidates is a proof-bound, not a hint budget.
        if (workload.totalSteps > 810) throw new Error('Human assessment failed to make bounded progress');
    }
    return {
        cap: HUMAN_FAMILIES[familyCap], solved: !board.includes('0'),
        remaining: board.filter(digit => digit === '0').length,
        highestTechniqueUsed: highest < 0 ? null : TECHNIQUES[highest].type,
        highestFamilyUsed: highest < 0 ? null : HUMAN_FAMILIES[TECHNIQUES[highest].family],
        workload, techniqueCounts: counts,
    };
}

/** Assess a canonical 81-digit puzzle without supplying answers as deductions.
 * The complete solver is used for uniqueness and independent soundness checks
 * only. A failed check throws; it must never be reported as a hard puzzle.
 * Default output omits both the solution and the deduction trace.
 */
export function assessHumanPuzzle(puzzle, { trace = false } = {}) {
    const base = { version: HUMAN_RATING_VERSION, family: null };
    if (typeof puzzle !== 'string' || !/^[0-9]{81}$/.test(puzzle)) return { ...base, status: 'invalid' };
    const solutions = SudokuSolver.countSolutions(puzzle, 2);
    const clues = puzzle.replaceAll('0', '').length;
    if (solutions !== 1) return { ...base, clues, status: solutions === 0 ? 'no-solution' : 'multiple-solutions' };
    if (clues === 81) return { ...base, clues, status: 'complete' };

    const answer = SudokuSolver.solveSudoku(puzzle).solution;
    const passes = [];
    const audit = { placements: 0, candidateEliminations: 0 };
    for (let family = 0; family < HUMAN_FAMILIES.length; family++) {
        const steps = [];
        const observe = step => {
            if (step.kind === 'placement') {
                if (step.digit !== answer[step.idx]) throw new Error(`Unsound ${step.type} placement`);
                audit.placements++;
            } else {
                for (const { cell, digit } of step.removals) {
                    if (digit === answer[cell]) throw new Error(`Unsound ${step.type} elimination`);
                    audit.candidateEliminations++;
                }
            }
            if (trace) steps.push(step);
        };
        const pass = runPass(puzzle, family, observe);
        passes.push(pass);
        if (pass.solved || family === HUMAN_FAMILIES.length - 1) {
            return {
                ...base, clues, status: pass.solved ? 'solved' : 'unresolved',
                family: pass.solved ? HUMAN_FAMILIES[family] : null,
                remaining: pass.remaining, workload: pass.workload,
                highestTechniqueUsed: pass.highestTechniqueUsed,
                techniqueCounts: pass.techniqueCounts, passes, audit,
                ...(trace ? { trace: steps } : {}),
            };
        }
    }
}
