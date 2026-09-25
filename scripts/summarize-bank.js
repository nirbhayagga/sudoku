#!/usr/bin/env node
// Read-only summary of the current bank and its published rating manifest.
import { readFileSync } from 'node:fs';
import { PUZZLES } from '../puzzle-bank.js';
const ranking = JSON.parse(readFileSync(new URL('../docs/bank-ranking.json', import.meta.url)));
const range = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted[Math.ceil(sorted.length * .9) - 1], sorted.at(-1)].join(' / ');
};
const lines = ['# Current bank measurements — v1.2.0', '',
    'Ranges are minimum / upper median / nearest-rank P90 / maximum. These describe the current observed human-technique paths; clue count is descriptive, not a grading input. Earlier v1.1 reports remain historical snapshots.', '',
    '| Tier | Puzzles | Clues | Elimination steps | Largest proof nodes | Total steps |', '|---|---:|---|---|---|---|'];
for (const [difficulty, list] of Object.entries(PUZZLES)) {
    const rows = ranking.tiers[difficulty];
    if (rows.length !== list.length || rows.some((r, i) => r[0] !== list[i].id)) throw new Error('Bank/ranking mismatch');
    lines.push(`| ${difficulty} | ${list.length} | ${range(list.map(p => p.puzzle.replaceAll('0', '').length))} | ${range(rows.map(r => r[6]))} | ${range(rows.map(r => r[4]))} | ${range(rows.map(r => r[8]))} |`);
}
lines.push('', 'The highest displayed challenge is Nightmare ' + PUZZLES.nightmare.length + ', identity `' + PUZZLES.nightmare.at(-1).id + '`. This is a policy ordering, not a claim that every person will find that board hardest.', '',
    'The expansion JSON records all 192 new assessments and their transformation checks. Independent Sudoku Explainer measurements in the older validation report cover the original 5,500 only; new boards have not been assigned SE grades.', '',
    'Regenerate this summary without changing the bank:', '', '```bash', 'node scripts/summarize-bank.js > e2e-results/current-bank-measurements.md', '```', '');
console.log(lines.join('\n'));
