import { createReasoningState, applyDeduction } from './reasoning.js';
import { nextExtendedDeduction } from './extended-reasoning.js';

/** Retain only proven exclusions across consecutive hint reveals, separate from pencil marks. */
export function findHintPath(puzzle, { continuation = null, maxSteps = 810 } = {}) {
    if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 810) throw new Error('Invalid step budget');
    const state = createReasoningState(puzzle);
    if (continuation?.board === puzzle) {
        if (!Array.isArray(continuation.candidates) || continuation.candidates.length !== 81) throw new Error('Invalid hint continuation');
        state.candidates = state.candidates.map((legal, cell) => {
            const saved = continuation.candidates[cell];
            if (!legal) { if (saved !== null) throw new Error('Invalid filled cell'); return null; }
            if (!Array.isArray(saved) || !saved.length || saved.some(d => !legal.has(d))) throw new Error('Invalid candidates');
            return new Set(saved);
        });
    }
    const trace = [];
    for (let i = 0; i < maxSteps; i++) {
        const budget = {};
        const step = nextExtendedDeduction(state, { profile: 'interactive', budget });
        if (!step) return { status: budget.exhausted ? 'budget-exhausted' : 'unresolved', trace };
        applyDeduction(state, step);
        trace.push(step);
        if (step.kind === 'placement') return { status: 'placement', trace,
            continuation: { board: state.board.join(''), candidates: state.candidates.map(set => set ? [...set].sort() : null) } };
    }
    return { status: 'budget-exhausted', trace };
}
