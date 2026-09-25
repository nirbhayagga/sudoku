#!/usr/bin/env node
/** Curate bounded, reproducible teaching positions from our own bank. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { ALL_PUZZLES } from '../puzzle-bank.js';
import { createReasoningState, nextDeduction, applyDeduction } from '../reasoning.js';
import { PRACTICE_TYPES, PRACTICE_POLICY, prepareExercise } from '../practice.js';
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const output = arg('out'), count = Number(arg('count') || 4);
if (!output || !Number.isInteger(count) || count < 1 || count > 20) throw new Error('Use --out=NEW.json and --count=1..20');
if (fs.existsSync(output)) throw new Error('Output already exists');
const groups = Object.fromEntries(PRACTICE_TYPES.map(t => [t, []]));
let examined = 0;
for (const source of ALL_PUZZLES) {
    examined++;
    const state = createReasoningState(source.puzzle), seen = new Set();
    for (let index = 0; index < 200; index++) {
        const step = nextDeduction(state, { familyCap: 3 });
        if (!step) break;
        if (!seen.has(step.type) && groups[step.type].length < count) {
            const exercise = { policy: PRACTICE_POLICY, puzzle: source.puzzle, index, type: step.type };
            prepareExercise(exercise); groups[step.type].push(exercise); seen.add(step.type);
        }
        applyDeduction(state, step);
    }
    if (Object.values(groups).every(a => a.length >= count)) break;
}
const result = { policy: PRACTICE_POLICY, bankSha256: createHash('sha256').update(ALL_PUZZLES.map(p => p.puzzle).join('\n')).digest('hex'), examined,
    groups: Object.fromEntries(Object.entries(groups).filter(([, items]) => items.length)) };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ examined, counts: Object.fromEntries(Object.entries(result.groups).map(([t, a]) => [t, a.length])) }));
