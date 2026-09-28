import { it, expect } from 'vitest';
import { PRACTICE_BANK } from '../practice-bank.js';
import { prepareExercise } from '../practice.js';
import { patternCells, patternDigits, checkPracticePattern, practiceFeedback, TECHNIQUE_LESSONS } from '../practice-coach.js';

it('every curated lesson has a rule and an identifiable candidate pattern', () => {
    for (const group of Object.values(PRACTICE_BANK.groups)) for (const exercise of group) {
        const { state, step } = prepareExercise(exercise);
        expect(TECHNIQUE_LESSONS[step.type]).toBeTruthy();
        expect(patternCells(step).length, step.type).toBeGreaterThan(0);
        expect(checkPracticePattern(state, step, patternCells(step), patternDigits(state, step))).toMatchObject({ correct: true });
        for (const move of step.removals || [{ cell: step.idx, digit: step.digit }]) expect(practiceFeedback(state, step, move.cell, move.digit).correct).toBe(true);
    }
});
it('explains a failed subset premise without consulting a solution', () => {
    const { state, step } = prepareExercise(PRACTICE_BANK.groups['naked-pair'][0]);
    expect(checkPracticePattern(state, step, [0, 40, 80], ['1', '2']).message).toContain('do not share');
    expect(practiceFeedback(state, step, null, '1').message).toContain('Select a cell');
});
