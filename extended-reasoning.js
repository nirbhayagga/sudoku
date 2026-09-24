import { nextDeduction, applyDeduction, stateKey, REASONING_VERSION, replayDeduction } from './reasoning.js';
import { findDynamicChain, verifyDynamicProof } from './dynamic-chains.js';

export const EXTENDED_VERSION = 'human-v3.0';
export const ANALYSIS_PROFILES = Object.freeze({
    interactive: Object.freeze({ dynamicWorkPerStep: 100000 }),
    maintenance: Object.freeze({ dynamicWorkPerStep: 2000000 }),
});

export function nextExtendedDeduction(state, { profile = 'interactive', budget = {} } = {}) {
    const limits = ANALYSIS_PROFILES[profile];
    if (!limits) throw new Error('Unknown analysis profile');
    const basicBudget = {};
    const basic = nextDeduction(state, { budget: basicBudget });
    if (basic) return basic;
    const dynamicBudget = {};
    const step = findDynamicChain(state.candidates, { maxWork: limits.dynamicWorkPerStep, budget: dynamicBudget });
    budget.work = dynamicBudget.work || 0;
    budget.exhausted = Boolean(basicBudget.exhausted || dynamicBudget.exhausted);
    if (!step) return null;
    if (!verifyDynamicProof(state.candidates, step.proof)) throw new Error('Invalid dynamic proof');
    const kind = step.removals ? 'elimination' : 'placement';
    return { ...step, kind, rule: step.type, family: 'dynamic-chains',
        version: REASONING_VERSION, engineVersion: EXTENDED_VERSION, before: stateKey(state),
        premises: step.evidence.map(cell => ({ cell, value: state.board[cell], candidates: [...(state.candidates[cell] || [])].sort() })) };
}

export function replayExtendedDeduction(state, step) {
    if (!step.engineVersion) return replayDeduction(state, step);
    const target = step.kind === 'placement' ? (step.idx * 9 + Number(step.digit) - 1) * 2 + 1
        : step.removals?.length === 1 ? (step.removals[0].cell * 9 + Number(step.removals[0].digit) - 1) * 2 : null;
    if (step.engineVersion !== EXTENDED_VERSION || !verifyDynamicProof(state.candidates, step.proof)
        || target !== step.proof.target) throw new Error('Invalid dynamic proof');
    return applyDeduction(state, step);
}
