import { REASONING_RULES, REASONING_FAMILIES, REASONING_VERSION, stateKey, applyDeduction, replayDeduction } from './reasoning.js';
import { nextExtendedDeduction, replayExtendedDeduction } from './extended-reasoning.js';
import { findForcingChain, verifyChainProof } from './chains.js';
import { findUniqueRectangle, findBugPlusOne } from './named-techniques.js';
import { SudokuSolver } from './solver.js';

export const ENHANCED_VERSION = 'human-v4.0';
export const ENHANCED_FAMILIES = [...REASONING_FAMILIES.slice(0, 4), 'uniqueness', 'chains', 'dynamic-chains'];
export const ENHANCED_PROFILES = Object.freeze({
    interactive: Object.freeze({ alternatives: 1, shallowEdges: 15000, chainDepths: [4, 8] }),
    maintenance: Object.freeze({ alternatives: 2, shallowEdges: 60000, chainDepths: [4, 8, 12] }),
});
const uniquePremises = new WeakMap();
export function establishUniqueness(state, puzzle = state.board.join('')) {
    if (!/^[0-9]{81}$/.test(puzzle) || [...puzzle].some((d, i) => d !== '0' && state.board[i] !== d)
        || SudokuSolver.countSolutions(puzzle, 2) !== 1) return false;
    uniquePremises.set(state, puzzle);
    return true;
}
function record(state, step, family, extra = {}) {
    const evidence = [...new Set([...(step.evidence || []), ...(step.cells || []), ...(step.idx === undefined ? [] : [step.idx])])].sort((a, b) => a - b);
    return { ...step, ...extra, kind: step.removals ? 'elimination' : 'placement', rule: step.type, family,
        version: REASONING_VERSION, before: stateKey(state), evidence,
        premises: evidence.map(cell => ({ cell, value: state.board[cell], candidates: [...(state.candidates[cell] || [])].sort() })) };
}
/** Same rules on phones and maintenance runs, deterministic bounded lookahead. */
export function nextEnhancedDeduction(state, { profile = 'interactive', order = 'forward', familyCap = 6, budget = {} } = {}) {
    const limits = ENHANCED_PROFILES[profile];
    if (!limits || !['forward', 'reverse'].includes(order)) throw new Error('Invalid reasoning policy');
    for (let family = 0; family < 4 && family <= familyCap; family++) {
        const rules = REASONING_RULES.filter(r => r.family === family);
        if (order === 'reverse') rules.reverse();
        for (const rule of rules) {
            const step = rule.find(state.candidates);
            if (step) return record(state, step, ENHANCED_FAMILIES[family]);
        }
    }
    if (familyCap < 4) return null;
    const uniqueness = uniquePremises.get(state);
    if (uniqueness) {
        const step = findUniqueRectangle(state.candidates) || findBugPlusOne(state.candidates);
        if (step) return record(state, step, 'uniqueness', { uniqueness, policy: ENHANCED_VERSION });
    }
    if (familyCap < 5) return null;
    // Try short paths throughout the grid before accepting the first long chain.
    for (const maxDepth of limits.chainDepths) {
        const trial = {};
        const step = findForcingChain(state.candidates, { maxDepth, maxEdges: limits.shallowEdges, budget: trial });
        if (step) return record(state, step, 'chains');
    }
    if (familyCap === 5) {
        const step = findForcingChain(state.candidates, { budget });
        return step ? record(state, step, 'chains') : null;
    }
    return nextExtendedDeduction(state, { profile, budget });
}
export function replayEnhancedDeduction(state, step) {
    if (step.uniqueness) {
        if (step.policy !== ENHANCED_VERSION || !establishUniqueness(state, step.uniqueness)) throw new Error('Invalid uniqueness premise');
        const found = step.type === 'bug-plus-one' ? findBugPlusOne(state.candidates) : findUniqueRectangle(state.candidates);
        if (!found || found.type !== step.type || found.idx !== step.idx || found.digit !== step.digit
            || JSON.stringify(found.removals || []) !== JSON.stringify(step.removals || [])) throw new Error('Invalid uniqueness deduction');
        return applyDeduction(state, step);
    }
    if (step.rule === 'forcing-chain') {
        const a = step.proof?.assumption;
        if (!verifyChainProof(state.candidates, step.proof) || (a.on
            ? step.removals?.length !== 1 || step.removals[0].cell !== a.cell || step.removals[0].digit !== a.digit
            : step.idx !== a.cell || step.digit !== a.digit)) throw new Error('Invalid chain conclusion');
        return applyDeduction(state, step);
    }
    return step.engineVersion ? replayExtendedDeduction(state, step) : replayDeduction(state, step);
}
export function proofComplexity(step) {
    const branches = step.proof?.branches || (step.proof ? [step.proof] : []);
    let nodes = 0, depth = 0;
    for (const branch of branches) {
        const depths = new Map();
        for (const node of branch.nodes) {
            const parents = node.parents || (node.parent == null ? [] : [node.parent]);
            const d = parents.length ? 1 + Math.max(...parents.map(p => depths.get(p) || 0)) : 0;
            depths.set(node.id, d); depth = Math.max(depth, d); nodes++;
        }
    }
    return { branches: branches.length, nodes, depth };
}
