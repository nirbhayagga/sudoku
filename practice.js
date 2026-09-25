import { createReasoningState, nextDeduction, applyDeduction, REASONING_RULES } from './reasoning.js';
import { SudokuSolver } from './solver.js';
import { puzzleId } from './puzzle-id.js';

export const PRACTICE_POLICY = 'practice-v1';
export const PRACTICE_TYPES = [...REASONING_RULES.filter(r => r.family < 4).map(r => r.type), 'claiming-triple'];
export const practiceIdentity = (puzzle, index) => `practice-${puzzleId(puzzle)}-${index}`;

/** Reconstruct candidates through real deductions, never from personal notes.
 * Exercises record a source board and bounded position, rather than trusting a
 * separately authored candidate grid. This also works for newly curated boards.
 */
export function prepareExercise(exercise) {
    if (!exercise || exercise.policy !== PRACTICE_POLICY || !PRACTICE_TYPES.includes(exercise.type)
        || !Number.isInteger(exercise.index) || exercise.index < 0 || exercise.index >= 200) throw new Error('Invalid practice exercise');
    const state = createReasoningState(exercise.puzzle);
    if (SudokuSolver.countSolutions(exercise.puzzle, 2) !== 1) throw new Error('Practice requires a unique puzzle');
    const solution = SudokuSolver.solveSudoku(exercise.puzzle).solution;
    for (let index = 0; index <= exercise.index; index++) {
        const step = nextDeduction(state, { familyCap: 3 });
        if (!step) throw new Error('Practice path is unavailable');
        if (step.removals ? step.removals.some(r => solution[r.cell] === r.digit) : step.digit !== solution[step.idx]) throw new Error('Practice proof failed its answer audit');
        if (index === exercise.index) {
            if (step.type !== exercise.type) throw new Error('Practice technique changed; regenerate the collection');
            return { state, step, id: practiceIdentity(exercise.puzzle, index) };
        }
        applyDeduction(state, step);
    }
}
export function acceptsPracticeMove(step, cell, digit) {
    return step.kind === 'placement' ? step.idx === cell && step.digit === digit
        : step.removals.some(r => r.cell === cell && r.digit === digit);
}
