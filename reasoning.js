import {
    candidateGrid, peersOf, UNITS, findNakedSingle, findHiddenSingle,
    findPointingPair, findClaimingPair, findNakedPair, findHiddenPair,
    findNakedTriple, findXWing, findXYWing, cellName,
} from './techniques.js';
import { findHiddenTriple, findNakedQuad, findHiddenQuad, findSwordfish, findJellyfish, findXYZWing } from './advanced-techniques.js';
import { findForcingChain, verifyChainProof } from './chains.js';

export const REASONING_VERSION = 'human-v2.1';
export const REASONING_FAMILIES = Object.freeze(['singles', 'locked-candidates', 'subsets', 'wings', 'chains']);
export const REASONING_RULES = Object.freeze([
    { type: 'naked-single', family: 0, find: findNakedSingle },
    { type: 'hidden-single', family: 0, find: findHiddenSingle },
    { type: 'pointing-pair', family: 1, find: findPointingPair },
    { type: 'claiming-pair', family: 1, find: findClaimingPair },
    { type: 'naked-pair', family: 2, find: findNakedPair },
    { type: 'hidden-pair', family: 2, find: findHiddenPair },
    { type: 'naked-triple', family: 2, find: findNakedTriple },
    { type: 'hidden-triple', family: 2, find: findHiddenTriple },
    { type: 'naked-quad', family: 2, find: findNakedQuad },
    { type: 'hidden-quad', family: 2, find: findHiddenQuad },
    { type: 'x-wing', family: 3, find: findXWing },
    { type: 'xy-wing', family: 3, find: findXYWing },
    { type: 'xyz-wing', family: 3, find: findXYZWing },
    { type: 'swordfish', family: 3, find: findSwordfish },
    { type: 'jellyfish', family: 3, find: findJellyfish },
    { type: 'forcing-chain', family: 4, find: findForcingChain },
]);
const PEERS = Array.from({ length: 81 }, (_, i) => peersOf(i));

/** Exact state binding, not a collision-prone hash. Only included in requested traces. */
export function stateKey(state) {
    return `${state.board.join('')}/${state.candidates.map(set => set ? [...set].sort().join('') : '-').join('.')}`;
}

export function createReasoningState(board) {
    if (typeof board !== 'string' || !/^[0-9]{81}$/.test(board)) throw new Error('Expected 81 digits');
    const state = { board: [...board], candidates: candidateGrid(board) };
    assertConsistent(state);
    return state;
}

function assertConsistent(state) {
    if (state.candidates.some(set => set?.size === 0)) throw new Error('No candidate remains');
    for (const unit of UNITS) {
        const filled = unit.cells.map(i => state.board[i]).filter(d => d !== '0');
        if (new Set(filled).size !== filled.length) throw new Error('Conflicting values');
        for (const digit of '123456789') {
            if (!filled.includes(digit) && !unit.cells.some(i => state.candidates[i]?.has(digit))) throw new Error('Digit has no home');
        }
    }
}

/** Discover from candidates alone. Every record carries evidence and its exact premises. */
export function nextDeduction(state, { familyCap = REASONING_FAMILIES.length - 1, budget = {} } = {}) {
    for (const rule of REASONING_RULES) {
        if (rule.family > familyCap) continue;
        const step = rule.find(state.candidates, { budget });
        if (!step) continue;
        const kind = step.removals ? 'elimination' : 'placement';
        const evidence = [...new Set([...(step.evidence || []), ...(step.cells || []), ...(kind === 'placement' ? [step.idx] : [])])].sort((a, b) => a - b);
        const record = { ...step, kind, rule: rule.type, family: REASONING_FAMILIES[rule.family],
            version: REASONING_VERSION, before: stateKey(state), evidence,
            premises: evidence.map(cell => ({ cell, value: state.board[cell], candidates: state.candidates[cell] ? [...state.candidates[cell]].sort() : [] })) };
        if (step.type === 'naked-single') {
            record.nudge = `${cellName(step.idx)} has only ${step.digit} remaining after the preceding exclusions.`;
        }
        return record;
    }
    return null;
}

/** Apply only to the state the proof describes; callers snapshot/recompute on edits. */
export function applyDeduction(state, step) {
    if (step.version !== REASONING_VERSION || step.before !== stateKey(state)) throw new Error('Stale deduction');
    let propagationRemovals = 0;
    if (step.kind === 'placement') {
        if (state.board[step.idx] !== '0' || !state.candidates[step.idx]?.has(step.digit)) throw new Error('Invalid placement');
        state.board[step.idx] = step.digit;
        state.candidates[step.idx] = null;
        for (const peer of PEERS[step.idx]) if (state.candidates[peer]?.delete(step.digit)) propagationRemovals++;
    } else if (step.kind === 'elimination') {
        if (!step.removals?.length || step.removals.some(({ cell, digit }) => !state.candidates[cell]?.has(digit))) throw new Error('Invalid elimination');
        for (const { cell, digit } of step.removals) state.candidates[cell].delete(digit);
    } else throw new Error('Unknown deduction kind');
    assertConsistent(state);
    return propagationRemovals;
}

/** Deterministic replay rejects tampered outcomes as well as stale premises. */
export function replayDeduction(state, step) {
    const rule = REASONING_RULES.find(item => item.type === step.rule);
    const found = rule?.find(state.candidates);
    if (step.proof && !verifyChainProof(state.candidates, step.proof)) throw new Error('Invalid chain proof');
    if (!found || step.before !== stateKey(state)
        || found.idx !== step.idx || found.digit !== step.digit
        || JSON.stringify(found.removals || []) !== JSON.stringify(step.removals || [])) throw new Error('Invalid proof');
    return applyDeduction(state, step);
}

/** Candidate eliminations persist for the whole run; the observer cannot supply moves. */
export function runReasoning(puzzle, { familyCap, maxSteps = 810, trace = false, stopAfterPlacement = false, observe = () => {} } = {}) {
    if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 810) throw new Error('Invalid step budget');
    const state = createReasoningState(puzzle);
    const steps = [];
    const techniqueCounts = Object.fromEntries(REASONING_RULES.map(rule => [rule.type, 0]));
    const workload = { placements: 0, eliminationSteps: 0, candidateEliminations: 0,
        propagationRemovals: 0, totalSteps: 0, longestEliminationRun: 0 };
    let run = 0;
    let highest = -1;
    let status = 'solved';
    while (state.board.includes('0')) {
        if (workload.totalSteps >= maxSteps) { status = 'budget-exhausted'; break; }
        const budget = {};
        const step = nextDeduction(state, { familyCap, budget });
        if (!step) { status = budget.exhausted ? 'budget-exhausted' : 'unresolved'; break; }
        workload.propagationRemovals += applyDeduction(state, step);
        workload.totalSteps++;
        techniqueCounts[step.rule] = (techniqueCounts[step.rule] || 0) + 1;
        highest = Math.max(highest, REASONING_RULES.findIndex(rule => rule.type === step.rule));
        if (step.kind === 'placement') { workload.placements++; run = 0; }
        else {
            workload.eliminationSteps++;
            workload.candidateEliminations += step.removals.length;
            workload.longestEliminationRun = Math.max(workload.longestEliminationRun, ++run);
        }
        observe(step);
        if (trace) steps.push(step);
        if (stopAfterPlacement && step.kind === 'placement') { status = 'placement'; break; }
    }
    return { version: REASONING_VERSION, status, remaining: state.board.filter(d => d === '0').length,
        highestTechniqueUsed: highest < 0 ? null : REASONING_RULES[highest].type,
        highestFamilyUsed: highest < 0 ? null : REASONING_FAMILIES[REASONING_RULES[highest].family],
        techniqueCounts, workload, ...(trace ? { trace: steps } : {}) };
}
