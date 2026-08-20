import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { repoRoot } from './helpers/load-globals.js';

/**
 * Builds into a temp copy of the repo so the developer's own dist/ is untouched,
 * then boots the built page to prove the bundle actually runs.
 */
let dist;
let indexHtml;
let workdir;

beforeAll(() => {
    workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-build-'));
    for (const file of [
        'index.html', 'style.css', 'solver.js', 'generator.js',
        'puzzle-bank.js', 'app.js', 'build.js', '_headers', 'package.json',
    ]) {
        fs.copyFileSync(path.join(repoRoot, file), path.join(workdir, file));
    }
    fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(workdir, 'node_modules'));

    execFileSync(process.execPath, ['build.js'], { cwd: workdir, stdio: 'pipe' });

    dist = path.join(workdir, 'dist');
    indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
}, 60_000);

afterAll(() => {
    fs.rmSync(workdir, { recursive: true, force: true });
});

describe('build output', () => {
    it('emits index.html, one JS bundle and one CSS file', () => {
        expect(fs.existsSync(path.join(dist, 'index.html'))).toBe(true);
        const assets = fs.readdirSync(path.join(dist, 'assets'));
        expect(assets.filter((f) => f.endsWith('.js'))).toHaveLength(1);
        expect(assets.filter((f) => f.endsWith('.css'))).toHaveLength(1);
    });

    it('content-hashes asset filenames', () => {
        const assets = fs.readdirSync(path.join(dist, 'assets'));
        expect(assets).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/^app\.[a-f0-9]{8}\.js$/),
                expect.stringMatching(/^style\.[a-f0-9]{8}\.css$/),
            ])
        );
    });

    it('points index.html at the hashed assets', () => {
        const assets = fs.readdirSync(path.join(dist, 'assets'));
        for (const asset of assets) expect(indexHtml).toContain(`assets/${asset}`);
    });

    it('leaves no reference to the unbundled sources', () => {
        for (const source of ['solver.js', 'generator.js', 'puzzle-bank.js', 'app.js', 'style.css']) {
            expect(indexHtml).not.toContain(`"${source}"`);
        }
    });

    it('copies _headers for static hosts', () => {
        expect(fs.existsSync(path.join(dist, '_headers'))).toBe(true);
    });

    it('actually shrinks the payload', () => {
        const built = fs.statSync(path.join(dist, 'assets', fs.readdirSync(path.join(dist, 'assets')).find((f) => f.endsWith('.js')))).size;
        const sources = ['solver.js', 'generator.js', 'puzzle-bank.js', 'app.js']
            .reduce((n, f) => n + fs.statSync(path.join(repoRoot, f)).size, 0);
        expect(built).toBeLessThan(sources);
    });

    it('produces a byte-identical bundle when rebuilt', () => {
        const before = fs.readdirSync(path.join(dist, 'assets')).sort();
        execFileSync(process.execPath, ['build.js'], { cwd: workdir, stdio: 'pipe' });
        expect(fs.readdirSync(path.join(dist, 'assets')).sort()).toEqual(before);
    });
});

describe('built page', () => {
    it('boots and renders a playable grid', async () => {
        const virtualConsole = new VirtualConsole();
        virtualConsole.on('jsdomError', (err) => {
            if (!/fetch is not defined|Not implemented/.test(err.message)) throw err;
        });

        const bundleName = fs.readdirSync(path.join(dist, 'assets')).find((f) => f.endsWith('.js'));
        const dom = new JSDOM(indexHtml, {
            runScripts: 'dangerously',
            pretendToBeVisual: true,
            url: 'http://localhost/',
            virtualConsole,
        });
        dom.window.eval(fs.readFileSync(path.join(dist, 'assets', bundleName), 'utf8'));

        const { document } = dom.window;
        expect(document.querySelectorAll('.cell-wrapper')).toHaveLength(81);

        // Drive a real game to prove minification kept the app working.
        document.querySelector('.diff-btn[data-diff="easy"]')
            .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        document.getElementById('level-input').value = '1';
        document.getElementById('btn-new-game')
            .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 60));

        const filled = [...document.querySelectorAll('.cell-input')].filter((i) => i.value).length;
        expect(filled).toBeGreaterThan(20);
        expect(document.querySelectorAll('.cell-wrapper.locked').length).toBe(filled);

        dom.window.close();
    });

    it('inlines SUDOKU_API_BASE when the env var is set', () => {
        execFileSync(process.execPath, ['build.js'], {
            cwd: workdir,
            stdio: 'pipe',
            env: { ...process.env, SUDOKU_API_BASE: 'https://api.example.com' },
        });
        const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
        expect(html).toContain('window.SUDOKU_API_BASE="https://api.example.com"');
    });
});
