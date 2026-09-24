#!/usr/bin/env node
/** Repeatable assessment, independent of production hints and bank order. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUZZLES } from '../puzzle-bank.js';
import { SudokuSolver } from '../solver.js';
import { assessPuzzle } from '../rating.js';
import { parsePuzzleText } from '../format.js';
import { assessHumanPuzzle, HUMAN_RATING_VERSION, HUMAN_TECHNIQUE_ORDER, HUMAN_FAMILIES } from '../human-rating.js';
import { summarizeAssessments, renderAssessmentReport } from './lib/assessment-report.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const args = process.argv.slice(2);
const flags = new Set(['--all', '--trace', '--help']);
const values = new Set(['--sample', '--out', '--report', '--puzzle', '--puzzle-file']);
const options = {};
try {
    for (const arg of args) {
        const index = arg.indexOf('=');
        const key = index < 0 ? arg : arg.slice(0, index);
        if (!(index < 0 ? flags.has(key) : values.has(key)) || Object.hasOwn(options, key)) throw new Error(`Unknown or duplicate option: ${key}`);
        options[key] = index < 0 ? true : arg.slice(index + 1);
        if (options[key] === '') throw new Error(`Missing value for ${key}`);
    }
    if (options['--help']) {
        console.log('Usage: node scripts/assess-difficulty.js --all|--sample=100 [--out=result.json] [--report=report.md]\nSingle puzzle: --puzzle=<81 digits/dots>|--puzzle-file=grid.txt [--trace] [--out=result.json]\nExisting output files are never overwritten. --trace reveals deductions; it is only available for one puzzle.');
        process.exit(0);
    }
    const single = options['--puzzle'] !== undefined || options['--puzzle-file'] !== undefined;
    if (options['--puzzle'] !== undefined && options['--puzzle-file'] !== undefined) throw new Error('Choose one puzzle input.');
    if (single && (options['--all'] || options['--sample'] || options['--report'])) throw new Error('Single-puzzle assessment cannot use bank/report options.');
    if (!single && options['--trace']) throw new Error('Use --trace with one puzzle, not the full bank.');
    if (!single && Boolean(options['--all']) === Boolean(options['--sample'])) throw new Error('Choose exactly one of --all or --sample=<positive integer>.');
    const sample = options['--sample'] === undefined ? null : Number(options['--sample']);
    if (sample !== null && (!Number.isSafeInteger(sample) || sample < 1)) throw new Error('Sample must be a positive integer.');
    const outputPaths = [options['--out'], options['--report']].filter(Boolean).map(path => resolve(path));
    if (new Set(outputPaths).size !== outputPaths.length) throw new Error('JSON and Markdown need different output paths.');
    for (const path of outputPaths) if (existsSync(path)) throw new Error('An output file already exists; choose a new path to preserve it.');

    const sources = ['human-rating.js', 'techniques.js', 'solver.js', 'rating.js', 'format.js',
        'scripts/assess-difficulty.js', 'scripts/lib/assessment-report.js'];
    const sourceHashes = Object.fromEntries(sources.map(path => [path, hash(readFileSync(resolve(root, path)))]));
    const policy = { version: HUMAN_RATING_VERSION, techniqueOrder: HUMAN_TECHNIQUE_ORDER,
        familyCaps: HUMAN_FAMILIES, candidates: 'Persistent within each pass; each family pass restarts from the givens.',
        unresolved: 'Unranked; never mapped to the hardest tier.',
        workload: 'Observed operations, not a weighted human difficulty score.' };
    let report;
    if (single) {
        const raw = options['--puzzle-file'] ? readFileSync(options['--puzzle-file'], 'utf8') : options['--puzzle'];
        const puzzle = parsePuzzleText(raw);
        if (!puzzle) throw new Error('Expected a supported 81-cell puzzle format.');
        report = { schemaVersion: 1, policy,
            provenance: { inputSha256: hash(puzzle), sourceHashes, sourceSha256: hash(JSON.stringify(sourceHashes)) },
            puzzle, assessment: assessHumanPuzzle(puzzle, { trace: Boolean(options['--trace']) }) };
    } else {
        const selected = Object.entries(PUZZLES).flatMap(([difficulty, puzzles]) => {
            const size = sample === null ? puzzles.length : Math.min(sample, puzzles.length);
            return Array.from({ length: size }, (_, i) => {
                const index = size === 1 ? 0 : Math.floor(i * (puzzles.length - 1) / (size - 1));
                return { difficulty, id: puzzles[index].id, level: index + 1, puzzle: puzzles[index].puzzle };
            });
        });
        const records = selected.map((item, index) => {
            const human = assessHumanPuzzle(item.puzzle);
            if (!['solved', 'unresolved'].includes(human.status)) throw new Error(`Invalid bank puzzle: ${item.difficulty}/${item.level} (${human.status})`);
            const production = assessPuzzle(item.puzzle);
            if ((index + 1) % 500 === 0 || index === selected.length - 1) console.error(`Assessed ${index + 1}/${selected.length} puzzles.`);
            return { ...item, sha256: hash(item.puzzle), searchNodes: SudokuSolver.rateDifficulty(item.puzzle),
                production: { solved: production.solved, placements: production.placements }, human };
        });
        report = { schemaVersion: 1, policy,
            provenance: { selection: sample === null ? 'all' : 'evenly spaced including tier endpoints', samplePerTier: sample,
                inputSha256: hash(JSON.stringify(selected)), sourceHashes, sourceSha256: hash(JSON.stringify(sourceHashes)) },
            summary: summarizeAssessments(records), records };
        console.error(`${report.summary.solved}/${records.length} solved; ${report.summary.unresolved} unresolved; ${report.summary.newlySolved} additional finishes; ${report.summary.noLongerSolved} disagreements.`);
    }
    const writeNew = (path, contents) => { mkdirSync(dirname(resolve(path)), { recursive: true }); writeFileSync(path, contents, { flag: 'wx' }); };
    if (options['--out']) writeNew(options['--out'], JSON.stringify(report, null, 2) + '\n');
    else console.log(JSON.stringify(report, null, 2));
    if (options['--report']) writeNew(options['--report'], renderAssessmentReport(report));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
