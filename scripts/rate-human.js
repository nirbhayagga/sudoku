#!/usr/bin/env node
/**
 * Deterministic solve-through comparison against an unchanged Git baseline.
 * Usage: node scripts/rate-human.js [--all | --sample=100] [--baseline-ref=HEAD] [--details]
 * --baseline-file=/path/to/techniques.js avoids Git subprocesses in sandboxes.
 * Uses the production nextStep() chain limit for both versions; no search fills
 * a stalled board. Solver answers are used only to audit returned placements.
 * Times cover nextStep calls only, excluding answer generation and module load.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { PUZZLES } from '../puzzle-bank.js';
import { SudokuSolver } from '../solver.js';
import { nextStep } from '../techniques.js';
import { assessPuzzle } from '../rating.js';
import { parsePuzzleText } from '../format.js';

const args = process.argv.slice(2);
const puzzleFile = args.find(arg => arg.startsWith('--puzzle-file='))?.slice('--puzzle-file='.length);
const puzzleText = args.find(arg => arg.startsWith('--puzzle='))?.slice('--puzzle='.length);
if (puzzleFile !== undefined || puzzleText !== undefined) {
    const puzzle = parsePuzzleText(puzzleFile !== undefined ? readFileSync(puzzleFile, 'utf8') : puzzleText);
    if (!puzzle) throw new Error('Expected a supported 81-cell puzzle format.');
    const assessment = assessPuzzle(puzzle);
    delete assessment.solution; // An assessment should not print the answer.
    console.log(JSON.stringify({ puzzle, ...assessment, methodology: 'Production hint sequence, four eliminations per placement; approximate, not a bank tier.' }, null, 2));
    process.exit(0);
}
const all = args.includes('--all');
const includeDetails = args.includes('--details');
const sample = Number(args.find(arg => arg.startsWith('--sample='))?.split('=')[1] ?? 100);
const ref = args.find(arg => arg.startsWith('--baseline-ref='))?.slice('--baseline-ref='.length) ?? 'HEAD';
if (!Number.isSafeInteger(sample) || sample < 1) throw new Error('Sample must be a positive integer.');
const baselineFile = args.find(arg => arg.startsWith('--baseline-file='))?.slice('--baseline-file='.length);
const baselineCommit = baselineFile ? null : execFileSync('git', ['rev-parse', '--verify', ref], { encoding: 'utf8' }).trim();
const source = baselineFile ? readFileSync(baselineFile, 'utf8') : execFileSync('git', ['show', `${baselineCommit}:techniques.js`], { encoding: 'utf8' });
const { nextStep: baseline } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const result = {
    baselineCommit, baselineFile,
    sampling: all ? 'all' : 'evenly spaced, including first and last', samplePerTier: all ? null : sample,
    methodology: {
        maxEliminationsPerHint: 4,
        candidates: 'Recomputed from the visible board after each placement, as in production hints.',
        usage: 'Eliminations in returned hints only; abandoned chains at a stall are excluded.',
        searchNodes: 'Search effort for the original puzzle, reported separately from human solve-through.',
        timing: 'Single-run wall time inside nextStep; concurrent system load affects timings.',
    },
    tiers: {},
};
const distribution = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return { min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], p90: sorted[Math.ceil(sorted.length * 0.9) - 1], max: sorted.at(-1) };
};
const increment = (counts, name) => { counts[name] = (counts[name] || 0) + 1; };

for (const [difficulty, puzzles] of Object.entries(PUZZLES)) {
    const size = all ? puzzles.length : Math.min(sample, puzzles.length);
    const selected = Array.from({ length: size }, (_, i) => puzzles[size === 1 ? 0 : Math.floor(i * (puzzles.length - 1) / (size - 1))]);
    const stats = Object.fromEntries(['baseline', 'expanded'].map(name => [name, {
        solved: 0, placements: 0, calls: 0, milliseconds: 0, placementsByType: {}, eliminationsByType: {}, maxChain: 0,
    }]));
    const outcomes = { newlySolved: 0, noLongerSolved: 0 };
    const details = [];
    const searchNodes = [];
    const clues = [];
    for (const puzzle of selected) {
        const answer = SudokuSolver.solveSudoku(puzzle.puzzle).solution;
        const solved = {};
        const detail = { id: puzzle.id, level: puzzles.indexOf(puzzle) + 1, clues: puzzle.puzzle.replace(/0/g, '').length, searchNodes: SudokuSolver.rateDifficulty(puzzle.puzzle) };
        searchNodes.push(detail.searchNodes);
        clues.push(detail.clues);
        for (const [name, find] of [['baseline', baseline], ['expanded', nextStep]]) {
            const board = [...puzzle.puzzle];
            const record = stats[name];
            const used = {};
            let maxChain = 0;
            while (board.includes('0')) {
                const start = performance.now();
                const step = find(board.join(''));
                record.milliseconds += performance.now() - start;
                record.calls++;
                if (!step) break;
                if (board[step.idx] !== '0' || step.digit !== answer[step.idx]) throw new Error(`${name}: unsound placement in ${difficulty}/${puzzle.id}`);
                for (const elimination of step.eliminations || []) {
                    for (const { cell, digit } of elimination.removals) {
                        if (answer[cell] === digit) throw new Error(`${name}: unsound ${elimination.type} in ${difficulty}/${puzzle.id}`);
                    }
                }
                board[step.idx] = step.digit;
                record.placements++;
                increment(record.placementsByType, step.type.split('+').at(-1));
                maxChain = Math.max(maxChain, (step.via || []).length);
                for (const type of step.via || []) {
                    increment(record.eliminationsByType, type);
                    increment(used, type);
                }
            }
            solved[name] = !board.includes('0');
            if (solved[name]) record.solved++;
            record.maxChain = Math.max(record.maxChain, maxChain);
            detail[name] = { solved: solved[name], remaining: board.filter(d => d === '0').length, eliminationsByType: used, maxChain };
        }
        if (!solved.baseline && solved.expanded) outcomes.newlySolved++;
        if (solved.baseline && !solved.expanded) outcomes.noLongerSolved++;
        if (includeDetails) details.push(detail);
    }
    for (const record of Object.values(stats)) {
        record.milliseconds = Math.round(record.milliseconds);
        record.meanCallMs = +(record.milliseconds / record.calls).toFixed(3);
    }
    result.tiers[difficulty] = { puzzles: selected.length, ...outcomes, clues: distribution(clues), searchNodes: distribution(searchNodes), ...stats, ...(includeDetails ? { details } : {}) };
    console.error(`${difficulty}: ${stats.baseline.solved}/${selected.length} -> ${stats.expanded.solved}/${selected.length}; ${stats.baseline.milliseconds}ms -> ${stats.expanded.milliseconds}ms`);
}
console.log(JSON.stringify(result, null, 2));
