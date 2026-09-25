import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PUZZLES, DAILY_PUZZLES, EXPANSION_IDS } from '../puzzle-bank.js';
import { DAILY_SIZES } from '../difficulties.js';
import { assessPuzzleEnhanced } from '../enhanced-assessment.js';
import { ratingKey, difficultyFor } from '../rating-policy.js';
import { equivalenceIndex, orbitBucket, classicTransforms } from '../scripts/lib/bank-expansion.js';
const proof = JSON.parse(readFileSync(new URL('../docs/bank-expansion-1.2.json', import.meta.url)));

describe('bank additions and identity preservation', () => {
    it('keeps the original daily boards and their relative order', () => {
        expect(Object.fromEntries(Object.entries(DAILY_PUZZLES).map(([d, list]) => [d, list.length]))).toEqual(DAILY_SIZES);
        const boards = Object.values(DAILY_PUZZLES).flat().map(p => p.puzzle).sort();
        expect(createHash('sha256').update(boards.join('\n')).digest('hex')).toBe(proof.baselineBoardSetSha256);
        expect(DAILY_PUZZLES.expert[203].id).toBe('p8711470b2bbdcbc7');
        expect(Object.values(DAILY_PUZZLES).flat().every(p => !EXPANSION_IDS.has(p.id))).toBe(true);
    });
    it('uses necessary invariants without mistaking them for an equivalence proof', () => {
        const p = PUZZLES.expert[0].puzzle, variants = classicTransforms(p);
        for (const v of variants) expect(orbitBucket(v)).toBe(orbitBucket(p));
        const index = equivalenceIndex([p]);
        expect(variants.every(v => index.has(v))).toBe(true);
        expect(index.has(PUZZLES.easy[0].puzzle)).toBe(false);
    }, 20000);
    it('independently rechecks every added rating with the same maintenance policy', () => {
        const failures = [];
        for (const row of proof.additions) {
            const human = assessPuzzleEnhanced(row.puzzle);
            if (human.status !== 'solved' || difficultyFor(human) !== row.difficulty
                || JSON.stringify(ratingKey(human)) !== JSON.stringify(row.key)) failures.push(row.id);
        }
        expect(failures).toEqual([]);
    }, 120000);
});
