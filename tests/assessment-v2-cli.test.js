import { afterAll, describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from './helpers/paths.js';
import { PUZZLES } from '../puzzle-bank.js';

const directory = mkdtempSync(join(tmpdir(), 'sudoku-v2-'));
function run(...args) {
    const result = spawnSync(process.execPath, [join(repoRoot, 'scripts/assess-v2.js'), ...args],
        { cwd: directory, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
    if (result.error) throw result.error;
    return result;
}
afterAll(() => rmSync(directory, { recursive: true, force: true }));
describe('v2 assessment CLI', () => {
    it('reproduces reports, records its policy and refuses to overwrite earlier results', () => {
        for (const name of ['one', 'two']) expect(run('--sample=2', `--out=${name}.json`, `--report=${name}.md`).status).toBe(0);
        const first = readFileSync(join(directory, 'one.json'), 'utf8');
        expect(first).toBe(readFileSync(join(directory, 'two.json'), 'utf8'));
        expect(readFileSync(join(directory, 'one.md'), 'utf8')).toBe(readFileSync(join(directory, 'two.md'), 'utf8'));
        const report = JSON.parse(first);
        expect(report.policy.version).toBe('human-v2.1');
        expect(report.summary.solved + report.summary.unresolved).toBe(12);
        expect(report.provenance.sourceHashes['chains.js']).toMatch(/^[a-f0-9]{64}$/);
        expect(run('--all', '--out=one.json').status).toBe(1);
        expect(readFileSync(join(directory, 'one.json'), 'utf8')).toBe(first);
    });
    it('accepts an unseen board and provides a trace only when requested', () => {
        const board = PUZZLES.easy[97].puzzle.replace(/[1-9]/g, d => String(10 - Number(d)));
        const plain = JSON.parse(run(`--puzzle=${board}`).stdout).assessment;
        expect(plain.status).toBe('solved');
        expect(plain).not.toHaveProperty('solution');
        expect(plain).not.toHaveProperty('trace');
        expect(JSON.parse(run(`--puzzle=${board}`, '--trace').stdout).assessment.trace.length).toBeGreaterThan(0);
    });
});
