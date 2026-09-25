#!/usr/bin/env node
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { VARIANT_GEOMETRIES } from '../geometry.js';
import { generateSized } from '../sized-generation.js';
import { canonicalVariant } from '../variant-tools.js';
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const output = arg('out'), attempts = Number(arg('attempts') || 96), count = Number(arg('count') || 24);
if (!output || fs.existsSync(output) || !Number.isInteger(attempts) || attempts < count || attempts > 10000 || !Number.isInteger(count) || count < 1) throw new Error('Use --out=NEW.json --attempts=96 --count=24');
const banks = {}, report = {};
for (const [rule, g] of Object.entries(VARIANT_GEOMETRIES)) {
    const seen = new Set(), pool = [];
    for (let seed = 1; seed <= attempts; seed++) {
        const result = generateSized(g, seed, { requireExplained: true }), canonical = canonicalVariant(result.puzzle, g);
        if (seen.has(canonical) || result.assessment.status !== 'solved') continue;
        seen.add(canonical); pool.push(result);
    }
    pool.sort((a,b) => a.assessment.family - b.assessment.family || a.assessment.eliminations - b.assessment.eliminations || a.assessment.hiddenSingles - b.assessment.hiddenSingles || a.seed - b.seed);
    if (pool.length < count) throw new Error(`Not enough verified ${rule} candidates`);
    const selected = Array.from({ length: count }, (_, i) => pool[count === 1 ? 0 : Math.floor(i * (pool.length - 1) / (count - 1))]);
    banks[rule] = selected.map(r => ({ id: `9-${rule}-${createHash('sha256').update(`${g.key}/${r.puzzle}`).digest('hex').slice(0,16)}`,
        puzzle: r.puzzle, seed: r.seed, rating: { policy: 'variant-human-v1', family: r.assessment.family, eliminations: r.assessment.eliminations, hiddenSingles: r.assessment.hiddenSingles } }));
    report[rule] = { generated: attempts, uniqueExplained: pool.length, selected: count, requireExplained: true, minimality: 'No claim of uniqueness-minimality; clue removal preserves a supported logical path', equivalence: 'digit renaming and square dihedral symmetries' };
}
fs.writeFileSync(output, JSON.stringify({ version: 1, banks, report }, null, 2) + '\n', { flag: 'wx' });
console.log(report);
