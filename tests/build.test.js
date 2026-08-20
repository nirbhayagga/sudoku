import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { repoRoot } from './helpers/paths.js';

/** Build into a temp directory so the developer's own dist/ is untouched. */
function runBuild(outDir, env = {}) {
    execFileSync(
        process.execPath,
        [path.join(repoRoot, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', outDir, '--emptyOutDir'],
        { cwd: repoRoot, stdio: 'pipe', env: { ...process.env, ...env } }
    );
}

const assetsOf = (dist) => fs.readdirSync(path.join(dist, 'assets'));
const jsBundle = (dist) => assetsOf(dist).find((f) => f.endsWith('.js'));

let dist;
let indexHtml;

beforeAll(() => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-build-'));
    runBuild(dist);
    indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
}, 120_000);

afterAll(() => {
    fs.rmSync(dist, { recursive: true, force: true });
});

describe('build output', () => {
    it('emits index.html, one JS bundle and one CSS file', () => {
        expect(fs.existsSync(path.join(dist, 'index.html'))).toBe(true);
        expect(assetsOf(dist).filter((f) => f.endsWith('.js'))).toHaveLength(1);
        expect(assetsOf(dist).filter((f) => f.endsWith('.css'))).toHaveLength(1);
    });

    it('content-hashes asset filenames', () => {
        for (const asset of assetsOf(dist)) {
            expect(asset).toMatch(/\.[A-Za-z0-9_-]{8,}\.(js|css)$/);
        }
    });

    it('points index.html at the hashed assets', () => {
        for (const asset of assetsOf(dist)) expect(indexHtml).toContain(asset);
    });

    it('leaves no reference to the unbundled sources', () => {
        for (const source of ['solver.js', 'generator.js', 'puzzle-bank.js', '/app.js', '/style.css']) {
            expect(indexHtml).not.toContain(`"${source}"`);
        }
    });

    // CSS must stay a separate file. Inlined into a ~500 kB bundle it would only
    // apply once all of that JS had parsed, flashing unstyled content on mobile.
    it('keeps CSS out of the JS bundle', () => {
        const bundle = fs.readFileSync(path.join(dist, 'assets', jsBundle(dist)), 'utf8');
        expect(bundle).not.toContain('--bg-primary');
        const css = fs.readFileSync(
            path.join(dist, 'assets', assetsOf(dist).find((f) => f.endsWith('.css'))),
            'utf8'
        );
        expect(css).toContain('--bg-primary');
    });

    // ES modules are blocked over file://, so a module script would cost the
    // project its "just open index.html" property. The bundle is a single IIFE
    // and the module attributes are stripped for exactly this reason.
    it('emits a classic script so the build still opens from the filesystem', () => {
        expect(indexHtml).toMatch(/<script[^>]+src="[^"]+\.js"/);
        expect(indexHtml).not.toContain('type="module"');
        expect(indexHtml).not.toContain('crossorigin');
    });

    it('uses relative asset paths so it works from a subpath', () => {
        // GitHub Pages serves at /<repo>/, so absolute /assets/... would 404.
        expect(indexHtml).not.toMatch(/(src|href)="\/assets\//);
        expect(indexHtml).toMatch(/(src|href)="\.\/assets\//);
    });

    it('copies _headers for static hosts', () => {
        expect(fs.existsSync(path.join(dist, '_headers'))).toBe(true);
    });

    it('emits the service worker and PWA assets', () => {
        expect(fs.existsSync(path.join(dist, 'sw.js'))).toBe(true);
        expect(fs.existsSync(path.join(dist, 'manifest.webmanifest'))).toBe(true);
        expect(fs.existsSync(path.join(dist, 'icons/icon-192.png'))).toBe(true);
    });

    // A payload budget, so bloat has to be a deliberate decision. The bank
    // dominates: 5,500 puzzles of 81 characters is ~435 kB of irreducible data.
    it('stays within the gzipped payload budget', () => {
        const assets = assetsOf(dist).map((f) => path.join(dist, 'assets', f));
        const total = [...assets, path.join(dist, 'sw.js')].reduce(
            (n, f) => n + gzipSync(fs.readFileSync(f)).length,
            0
        );
        expect(total).toBeLessThan(150 * 1024);
    });

    it('produces the same asset names when rebuilt', () => {
        const before = assetsOf(dist).sort();
        runBuild(dist);
        expect(assetsOf(dist).sort()).toEqual(before);
    });
});

describe('built page', () => {
    it('boots and renders a playable grid', async () => {
        const virtualConsole = new VirtualConsole();
        virtualConsole.on('jsdomError', (err) => {
            if (!/fetch is not defined|Not implemented/.test(err.message)) throw err;
        });

        const dom = new JSDOM(indexHtml, {
            runScripts: 'dangerously',
            pretendToBeVisual: true,
            url: 'http://localhost/',
            virtualConsole,
        });
        dom.window.eval(fs.readFileSync(path.join(dist, 'assets', jsBundle(dist)), 'utf8'));

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
        const other = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-build-api-'));
        try {
            runBuild(other, { SUDOKU_API_BASE: 'https://api.example.com' });
            const html = fs.readFileSync(path.join(other, 'index.html'), 'utf8');
            expect(html).toContain('window.SUDOKU_API_BASE="https://api.example.com"');
        } finally {
            fs.rmSync(other, { recursive: true, force: true });
        }
    });
});
