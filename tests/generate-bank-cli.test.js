import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from './helpers/paths.js';
import { PUZZLES } from '../puzzle-bank.js';
import { patchBank } from '../scripts/generate-bank.js';

const temporary = mkdtempSync(join(tmpdir(), 'sudoku-bank-'));
const bankPath = join(repoRoot, 'puzzle-bank.js');
const before = readFileSync(bankPath, 'utf8');
const run = (...args) => {
    const result = spawnSync(process.execPath, [join(repoRoot, 'scripts/generate-bank.js'), ...args], { cwd: temporary, encoding: 'utf8', timeout: 30000 });
    if (result.error) throw result.error;
    return result;
};
afterAll(() => {
    expect(readFileSync(bankPath, 'utf8')).toBe(before);
    rmSync(temporary, { recursive: true, force: true });
});

describe('bank maintenance CLI', () => {
    it('loads real ES modules and generates a dry-run output without changing the bank', () => {
        const result = run('--difficulty', 'easy', '--count', '1', '--pool', '1', '--out', 'generated.json');
        expect(result.status, result.stderr).toBe(0);
        expect(JSON.parse(readFileSync(join(temporary, 'generated.json')))).toHaveLength(1);
        const retry = run('--difficulty', 'easy', '--count', '1', '--pool', '1', '--out', 'generated.json');
        expect(retry.error).toBeUndefined();
        expect(retry.status).toBe(1);
        expect(retry.stderr).toContain('EEXIST');
    });
    it('imports only unique, valid boards and deduplicates a catalogue', () => {
        const source = join(temporary, 'catalogue.txt');
        writeFileSync(source, [PUZZLES.easy[0].puzzle, PUZZLES.easy[0].puzzle, '0'.repeat(81), 'bad'].join('\n'));
        const result = run('--difficulty', 'easy', '--import', source, '--count', '1', '--out', 'import.json');
        expect(result.status, result.stderr).toBe(0);
        expect(JSON.parse(readFileSync(join(temporary, 'import.json')))[0].puzzle).toBe(PUZZLES.easy[0].puzzle);
    });
    it('patches only the selected bare-string tier in a disposable fixture and rejects unsound inputs', () => {
        const file = join(temporary, 'bank.js');
        writeFileSync(file, `before\n    easy: [\n        '${PUZZLES.easy[0].puzzle}',\n    ],\nafter\n`);
        patchBank('easy', [{ puzzle: PUZZLES.easy[1].puzzle }], file);
        const expected = `before\n    easy: [\n        '${PUZZLES.easy[1].puzzle}',\n    ],\nafter\n`;
        expect(readFileSync(file, 'utf8')).toBe(expected);
        expect(() => patchBank('easy', [{ puzzle: '0'.repeat(81) }], file)).toThrow('non-unique');
        expect(readFileSync(file, 'utf8')).toBe(expected);
    });
    it.each([['--count', '0'], ['--difficulty', 'invalid'], ['--typo'], ['--out'], ['--count', '1', '--write'], ['--import', 'x', '--reorder']])('rejects bad arguments %j', (...args) => {
        expect(run(...args).status).toBe(1);
    });
});
