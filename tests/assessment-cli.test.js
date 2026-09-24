import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from './helpers/paths.js';
import { PUZZLES } from '../puzzle-bank.js';

const temporary = mkdtempSync(join(tmpdir(), 'sudoku-assessment-'));
const run = (...args) => spawnSync(process.execPath, [join(repoRoot, 'scripts/assess-difficulty.js'), ...args], { cwd: temporary, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
afterAll(() => rmSync(temporary, { recursive: true, force: true }));

describe('repeatable assessment CLI', () => {
    it('reproduces JSON and review reports byte for byte and protects old outputs', () => {
        for (const name of ['first', 'second']) {
            const result = run('--sample=2', `--out=${name}.json`, `--report=${name}.md`);
            expect(result.error).toBeUndefined();
            expect(result.status, result.stderr).toBe(0);
        }
        const first = readFileSync(join(temporary, 'first.json'), 'utf8');
        expect(first).toBe(readFileSync(join(temporary, 'second.json'), 'utf8'));
        expect(readFileSync(join(temporary, 'first.md'), 'utf8')).toBe(readFileSync(join(temporary, 'second.md'), 'utf8'));
        const report = JSON.parse(first);
        expect(report.summary.total).toBe(12);
        expect(report.summary.solved + report.summary.unresolved).toBe(12);
        expect(report.summary.reviewCases.length).toBeGreaterThan(0);
        expect(report.provenance.inputSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(report.provenance.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(first).not.toContain(temporary);
        const retry = run('--all', '--out=first.json', '--report=must-not-write.md');
        expect(retry.status).toBe(1);
        expect(retry.stderr).toContain('already exists');
        expect(readFileSync(join(temporary, 'first.json'), 'utf8')).toBe(first);
        expect(readdirSync(temporary)).not.toContain('must-not-write.md');
    });
    it('supports exported single puzzles without giving away an answer', () => {
        const result = run('--puzzle=' + PUZZLES.easy[0].puzzle.replaceAll('0', '.'));
        expect(result.status, result.stderr).toBe(0);
        const report = JSON.parse(result.stdout);
        expect(report.assessment).toMatchObject({ status: 'solved', family: 'singles' });
        expect(report.assessment).not.toHaveProperty('solution');
        expect(report.assessment).not.toHaveProperty('trace');
    });
    it.each([[], ['--sample=0'], ['--all', '--sample=2'], ['--all', '--trace'], ['--all', '--typo'], ['--all', '--out=same', '--report=same']].map(args => ({ args })))('rejects invalid options $args', ({ args }) => {
        const result = run(...args);
        expect(result.status).toBe(1);
        expect(result.stdout).toBe('');
    });
});
