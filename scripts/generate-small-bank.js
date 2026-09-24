#!/usr/bin/env node
import { writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SMALL_GEOMETRIES } from '../geometry.js';
import { solveSized, assessSized } from '../sized-solver.js';
import { generateSized, canonicalSized } from '../sized-generation.js';
const output = process.argv.find(a => a.startsWith('--out='))?.slice(6);
if (!output || existsSync(output)) throw new Error('Provide a new --out=path');
const banks = {}, report = {};
const key = a => [a.assessment.family ?? 9, a.assessment.eliminations, a.assessment.hiddenSingles, -a.puzzle.replaceAll('0', '').length];
const compare = (a, b) => { const x = key(a), y = key(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return a.puzzle.localeCompare(b.puzzle); };
for (const g of Object.values(SMALL_GEOMETRIES)) {
    const unique = new Map();
    if (g.size === 4) {
        const solutions = solveSized('0'.repeat(16), g, { limit: 1000 }).solutions;
        const representatives = [...new Set(solutions.map(p => canonicalSized(p, g)))];
        let minimalCount = 0;
        for (const solution of representatives) {
            const minimalMasks = [];
            for (let mask = 1; mask < 65536; mask++) {
                if (minimalMasks.some(m => (mask & m) === m)) continue;
                const puzzle = [...solution].map((d, i) => mask & (1 << i) ? d : '0').join('');
                const result = solveSized(puzzle, g);
                if (result.count !== 1 || result.status !== 'solved') continue;
                minimalMasks.push(mask); minimalCount++;
                const canonical = canonicalSized(puzzle, g);
                if (!unique.has(canonical)) unique.set(canonical, { puzzle: canonical, assessment: assessSized(canonical, g) });
            }
        }
        report[g.size] = { solvedGrids: solutions.length, solvedGridOrbits: representatives.length, minimalMasks: minimalCount, uniqueMinimalOrbits: unique.size, exhaustive: true };
    } else {
        for (let seed = 1; seed <= 2400; seed++) {
            const candidate = generateSized(g, seed);
            if (candidate.assessment.status !== 'solved') continue;
            const canonical = canonicalSized(candidate.puzzle, g);
            if (!unique.has(canonical)) unique.set(canonical, { ...candidate, canonical });
            if (seed % 400 === 0) console.error(`6x6 generated ${seed}/2400`);
        }
        report[g.size] = { generated: 2400, uniqueAssessedOrbits: unique.size, exhaustive: false };
    }
    const selected = [...unique.values()].sort(compare).slice(g.size === 4 ? 0 : -120).map(r => ({
        id: `${g.size}-${createHash('sha256').update(`${g.key}/${r.puzzle}`).digest('hex').slice(0, 16)}`, puzzle: r.puzzle,
        rating: { policy: 'small-human-v1', family: r.assessment.family, eliminations: r.assessment.eliminations, hiddenSingles: r.assessment.hiddenSingles }, ...(r.seed ? { seed: r.seed } : {}) }));
    banks[g.size] = selected;
    report[g.size].selected = selected.length;
}
writeFileSync(output, JSON.stringify({ version: 1, policy: 'small-human-v1', report, banks }, null, 2) + '\n', { flag: 'wx' });
console.log(report);
