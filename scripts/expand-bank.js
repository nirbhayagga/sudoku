#!/usr/bin/env node
// Seeded, independently generated additions. Review a proposal before --apply.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SudokuGenerator } from '../generator.js';
import { SudokuSolver } from '../solver.js';
import { seededRandom } from '../sized-generation.js';
import { assessPuzzleEnhanced } from '../enhanced-assessment.js';
import * as currentBank from '../puzzle-bank.js';
import { puzzleId } from '../puzzle-id.js';
import { RATING_POLICY, difficultyFor, ratingKey, compareRatingKeys } from '../rating-policy.js';
import { equivalenceIndex, classicTransforms } from './lib/bank-expansion.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const { PUZZLES } = currentBank;
const sha = value => createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(root, file));
const json = file => JSON.parse(read(file));
const sources = ['generator.js', 'solver.js', 'sized-generation.js', 'geometry.js', 'enhanced-assessment.js',
    'enhanced-reasoning.js', 'named-techniques.js', 'extended-reasoning.js', 'dynamic-chains.js',
    'reasoning.js', 'advanced-techniques.js', 'chains.js', 'techniques.js', 'rating-policy.js', 'puzzle-id.js',
    'scripts/expand-bank.js', 'scripts/lib/bank-expansion.js'];
const targets = ['puzzle-bank.js', 'leaderboard-api/bank-meta.json', 'leaderboard-api/bank-ids.json',
    'docs/bank-ranking.json', 'docs/bank-expansion-1.2.json', 'docs/bank-expansion-1.2.md'];
try {
    const args = {};
    for (const arg of process.argv.slice(2)) {
        const [key, ...parts] = arg.split('=');
        if (!['--seed', '--attempts', '--expert', '--nightmare', '--out', '--apply'].includes(key) || key in args || !parts.join('=')) throw new Error('Invalid argument');
        args[key] = parts.join('=');
    }
    if (args['--apply']) {
        if (Object.keys(args).length !== 1) throw new Error('Use --apply=PROPOSAL_DIRECTORY alone');
        const dir = path.resolve(args['--apply']), manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')));
        if (manifest.baseBankSha256 !== sha(read('puzzle-bank.js'))) throw new Error('Bank changed since proposal');
        for (const file of sources) if (manifest.sources[file] !== sha(read(file))) throw new Error(`Stale source: ${file}`);
        for (const file of targets) if (manifest.files[file] !== sha(fs.readFileSync(path.join(dir, file)))) throw new Error(`Altered artifact: ${file}`);
        for (const file of targets) fs.copyFileSync(path.join(dir, file), path.join(root, file));
        console.log('Applied reviewed expansion. Run full-bank, browser and container checks.');
    } else {
        if (!args['--out']) throw new Error('Use --seed=N --attempts=N --expert=N --nightmare=N --out=NEW_DIRECTORY');
        const seed = Number(args['--seed'] ?? 120026), attempts = Number(args['--attempts'] ?? 4000);
        const wanted = { expert: Number(args['--expert'] ?? 128), nightmare: Number(args['--nightmare'] ?? 64) };
        if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isInteger(attempts) || attempts < 1 || attempts > 100000
            || Object.values(wanted).some(n => !Number.isInteger(n) || n < 0 || n > 1000)) throw new Error('Invalid generation limits');
        const out = path.resolve(args['--out']);
        if (fs.existsSync(out)) throw new Error('Output directory already exists');
        const ranking = json('docs/bank-ranking.json'), metadata = json('leaderboard-api/bank-meta.json');
        const existing = Object.values(PUZZLES).flat().map(p => p.puzzle);
        if (ranking.policy !== RATING_POLICY || ranking.policySourceSha256 !== sha(read('rating-policy.js'))
            || ranking.boardSetSha256 !== sha([...existing].sort().join('\n'))) throw new Error('Baseline ranking mismatch');
        const random = seededRandom(seed), counts = {}, candidates = [], rejected = {};
        const reject = reason => { rejected[reason] = (rejected[reason] || 0) + 1; };
        fs.mkdirSync(out, { recursive: true });
        for (let i = 0; i < attempts; i++) {
            const { puzzle } = SudokuGenerator.dig(SudokuGenerator.generateSolvedBoard(random), 17, random);
            const human = assessPuzzleEnhanced(puzzle);
            counts[human.family || human.status] = (counts[human.family || human.status] || 0) + 1;
            if (human.status === 'solved' && Object.hasOwn(wanted, difficultyFor(human))) candidates.push({ attempt: i + 1, puzzle, human });
            if ((i + 1) % 200 === 0) console.log(`${i + 1}/${attempts} generated and assessed`);
        }
        const index = equivalenceIndex(existing), additions = [];
        const kept = { expert: 0, nightmare: 0 };
        // Deterministic sample across the available workload range, not only its top tail.
        for (const tier of Object.keys(wanted)) {
            const pool = candidates.filter(r => difficultyFor(r.human) === tier).sort((a, b) => compareRatingKeys(ratingKey(a.human), ratingKey(b.human)) || a.attempt - b.attempt);
            const order = []; const seen = new Set();
            for (let i = 0; i < Math.min(pool.length, wanted[tier]); i++) { const at = Math.floor(i * pool.length / Math.min(pool.length, wanted[tier])); order.push(pool[at]); seen.add(at); }
            pool.forEach((r, i) => { if (!seen.has(i)) order.push(r); });
            for (const r of order) {
                if (kept[tier] >= wanted[tier]) break;
                if (index.has(r.puzzle)) { reject('equivalent'); continue; }
                const variants = classicTransforms(r.puzzle).map(p => assessPuzzleEnhanced(p));
                if (variants.some(v => v.status !== 'solved' || v.family !== r.human.family)) { reject('unstable-or-unresolved-transform'); continue; }
                if ([...r.puzzle].some((d, i) => d !== '0' && SudokuSolver.countSolutions(r.puzzle.slice(0, i) + '0' + r.puzzle.slice(i + 1), 2) === 1)) throw new Error('Nonminimal generated puzzle');
                index.add(r.puzzle); kept[tier]++;
                additions.push({ ...r, id: puzzleId(r.puzzle), difficulty: tier, key: ratingKey(r.human), transformations: variants.map(v => ({ family: v.family, status: v.status, key: ratingKey(v) })) });
            }
        }
        if (!additions.length) throw new Error('No verified additions');
        const oldKeys = new Map(Object.values(ranking.tiers).flat().map(([id, ...key]) => [id, key]));
        const tiers = Object.fromEntries(Object.entries(PUZZLES).map(([d, list]) => [d, [
            ...list.map(p => ({ ...p, key: oldKeys.get(p.id) })), ...additions.filter(r => r.difficulty === d),
        ].sort((a, b) => compareRatingKeys(a.key, b.key) || (a.id < b.id ? -1 : 1))]));
        const all = Object.values(tiers).flat();
        if (all.some(r => !r.key) || new Set(all.map(r => r.id)).size !== all.length) throw new Error('Identity or ranking mismatch');
        const additionIds = [...(currentBank.EXPANSION_IDS || []), ...additions.map(r => r.id)];
        const bank = `// Classic 9x9 bank ordered by ${RATING_POLICY}. No solutions shipped.\nimport { puzzleId } from './puzzle-id.js';\nexport const PUZZLE_STRINGS = {\n` +
            Object.entries(tiers).map(([d, list]) => `    ${d}: [\n` + list.map(r => `        '${r.puzzle}',\n`).join('') + '    ],').join('\n') + '\n};\n';
        // Keep the old daily pool and relative order stable while inserting new challenges.
        const fullBank = bank + `export const EXPANSION_IDS = new Set(${JSON.stringify(additionIds)});\nexport const PUZZLES = Object.fromEntries(Object.entries(PUZZLE_STRINGS).map(([d, list]) => [d, list.map(puzzle => ({ id: puzzleId(puzzle), puzzle }))]));\nexport const DAILY_PUZZLES = Object.fromEntries(Object.entries(PUZZLES).map(([d, list]) => [d, list.filter(p => !EXPANSION_IDS.has(p.id))]));\nexport const ALL_PUZZLES = Object.entries(PUZZLES).flatMap(([difficulty, list]) => list.map((p, index) => ({ ...p, difficulty, level: index + 1 })));\n`;
        const sizes = Object.fromEntries(Object.entries(tiers).map(([d, list]) => [d, list.length]));
        const sourceHashes = Object.fromEntries(sources.map(file => [file, sha(read(file))]));
        const proof = { policy: RATING_POLICY, seed, attempts, wanted, kept, generatedFamilies: counts, rejected,
            baselineBoardSetSha256: ranking.boardSetSha256, sources: sourceHashes, additions };
        const report = ['# Classic bank expansion — v1.2.0', '', `Generated ${attempts} minimal, unique candidates using seed ${seed}. Added ${additions.length} independently generated boards: ${kept.expert} Expert and ${kept.nightmare} Nightmare. All original ${existing.length} boards remain.`, '',
            'Every accepted original and its digit reversal, transpose and first-row swap completes under human-v4 maintenance with the same observed family. Exact equivalence filtering covers digit relabelling, row/band and column/stack permutations and transpose; cheap necessary invariants only avoid redundant exact comparisons.', '',
            'Candidates sample the available workload range. No transformed copies or unresolved puzzles fill the requested counts. Ratings describe bounded observed paths, not universal human difficulty or exact Sudoku Explainer grades.', '',
            '| Tier | Total | Added |', '|---|---:|---:|', ...Object.entries(sizes).map(([d, n]) => `| ${d} | ${n} | ${kept[d] || 0} |`), '',
            'New puzzles are inserted in technique order. Level numbers can move; content-ID shares, saves and stored scores follow the board. The original daily pool and ordering are retained, so date links still identify the same puzzle. Bank revision 2 storage remains in use.', '',
            '## Reproduce', '', 'Run this command from the v1.1.0 bank with the expansion tooling present, using a new output directory:', '', '```bash',
            `node scripts/expand-bank.js --seed=${seed} --attempts=${attempts} --expert=${wanted.expert} --nightmare=${wanted.nightmare} --out=e2e-results/new-expansion`,
            'node scripts/expand-bank.js --apply=e2e-results/new-expansion', '```', '',
            'Review the proposal before applying. Applying checks baseline/source/artifact hashes. The JSON companion records each board, generating attempt, complete original assessment and transformed comparison keys. The same grading engine also accepts newly imported puzzles through assess-v4.js.', '',
            `Baseline SHA-256: ${ranking.boardSetSha256}`, ''].join('\n');
        const artifacts = { 'puzzle-bank.js': fullBank, 'leaderboard-api/bank-meta.json': JSON.stringify({ ...metadata, sizes, dailySizes: metadata.dailySizes || metadata.sizes }, null, 2) + '\n',
            'leaderboard-api/bank-ids.json': JSON.stringify(Object.fromEntries(Object.entries(tiers).map(([d, list]) => [d, list.map(r => r.id)]))) + '\n',
            'docs/bank-ranking.json': JSON.stringify({ ...ranking, baselineAssessmentSha256: ranking.assessmentSha256, expansionSha256: sha(JSON.stringify(proof)), boardSetSha256: sha(all.map(r => r.puzzle).sort().join('\n')), tiers: Object.fromEntries(Object.entries(tiers).map(([d, list]) => [d, list.map(r => [r.id, ...r.key])])) }) + '\n',
            'docs/bank-expansion-1.2.json': JSON.stringify(proof) + '\n', 'docs/bank-expansion-1.2.md': report };
        for (const [file, data] of Object.entries(artifacts)) { const dest = path.join(out, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, data, { flag: 'wx' }); }
        fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ baseBankSha256: sha(read('puzzle-bank.js')), sources: sourceHashes, files: Object.fromEntries(Object.entries(artifacts).map(([f, data]) => [f, sha(data)])) }));
        console.log(report);
    }
} catch (error) { console.error(error.message); process.exitCode = 1; }
