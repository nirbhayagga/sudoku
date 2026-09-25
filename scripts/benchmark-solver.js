#!/usr/bin/env node
/** Offline solver robustness benchmark. Search cost is NOT a human grade. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { SudokuSolver } from '../solver.js';
import { solveSized } from '../sized-solver.js';
import { geometry } from '../geometry.js';
import { PUZZLES } from '../puzzle-bank.js';
const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const input = arg('input'), out = arg('out'), limit = Number(arg('limit') || 120);
if (!out || fs.existsSync(out) || !Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error('Use --out=NEW.json [--input=puzzles.txt] [--limit=120] [--cross-check]');
const boards = input ? fs.readFileSync(input, 'utf8').split(/\r?\n/).filter(s => s.trim() && !s.startsWith('#')).map(s => s.slice(0,81).replaceAll('.', '0'))
    : Object.values(PUZZLES).flatMap(bank => Array.from({ length: Math.min(20, bank.length) }, (_, i) => bank[Math.floor(i * (bank.length - 1) / 19)].puzzle));
if (!boards.length || boards.some(p => !/^[0-9]{81}$/.test(p))) throw new Error('Expected at least one 81-cell puzzle, one per line');
const source = [...new Set(boards)].slice(0, limit);
const transforms = {
    identity: p => p,
    digits: p => p.replace(/[1-9]/g, d => String(10 - Number(d))),
    transpose: p => Array.from({ length: 81 }, (_, i) => p[i % 9 * 9 + Math.floor(i / 9)]).join(''),
    rows: p => p.slice(9,18) + p.slice(0,9) + p.slice(18),
};
const rows = [], failures = [], crossCheck = process.argv.includes('--cross-check');
for (const original of source) {
    const reference = SudokuSolver.solveSudoku(original).solution;
    for (const [transform, apply] of Object.entries(transforms)) {
        const puzzle = apply(original);
        SudokuSolver.solveSudoku(puzzle); // fixed warmup, timing is advisory
        const start = performance.now(), count = SudokuSolver.countSolutions(puzzle, 2), solved = SudokuSolver.solveSudoku(puzzle);
        const milliseconds = performance.now() - start;
        const valid = count === 1 && reference && solved.solution === apply(reference) && SudokuSolver.validateSolution(solved.solution);
        const independent = crossCheck ? solveSized(puzzle, geometry(), { maxNodes: 200000 }) : null;
        const agrees = !independent || independent.status === 'budget-exhausted' ? null : independent.count === count && independent.solutions[0] === solved.solution;
        const id = createHash('sha256').update(puzzle).digest('hex');
        if (!valid || agrees === false) failures.push({ id, transform, count, agrees });
        rows.push({ id, transform, count, milliseconds, valid: Boolean(valid), ...(independent ? { independent: { status: independent.status, count: independent.count, nodes: independent.nodes, agreement: agrees } } : {}) });
    }
}
const sorted = rows.map(r => r.milliseconds).sort((a,b) => a-b);
const fileHash = file => createHash('sha256').update(fs.readFileSync(new URL(file, import.meta.url))).digest('hex');
const report = { version: 1, purpose: 'Solver correctness and transformation robustness; not human difficulty',
    sourceSha256: createHash('sha256').update(source.join('\n')).digest('hex'),
    engineSha256: fileHash('../solver.js'), benchmarkSha256: fileHash('./benchmark-solver.js'),
    ...(crossCheck ? { independentSha256: fileHash('../sized-solver.js'), geometrySha256: fileHash('../geometry.js') } : {}),
    node: process.version, puzzles: source.length, cases: rows.length, transforms: Object.keys(transforms),
    timingMs: { median: sorted[Math.floor(sorted.length/2)], p95: sorted[Math.floor(sorted.length*.95)], max: sorted.at(-1) }, failures, rows };
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ puzzles: report.puzzles, cases: report.cases, timingMs: report.timingMs, failures: failures.length }));
if (failures.length) process.exitCode = 1;
