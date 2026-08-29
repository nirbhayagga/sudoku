import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { repoRoot } from './helpers/paths.js';

/** Build into a temp directory so the developer's own dist/ is untouched. */
function runBuild(outDir, { mode, env = {} } = {}) {
    const args = [
        path.join(repoRoot, 'node_modules/vite/bin/vite.js'),
        'build', '--outDir', outDir, '--emptyOutDir',
    ];
    if (mode) args.push('--mode', mode);
    execFileSync(process.execPath, args, { cwd: repoRoot, stdio: 'pipe', env: { ...process.env, ...env } });
}

const assetsOf = (dist) => fs.readdirSync(path.join(dist, 'assets'));
const scriptsOf = (dist) => assetsOf(dist).filter((f) => f.endsWith('.js'));
const stylesOf = (dist) => assetsOf(dist).filter((f) => f.endsWith('.css'));
const read = (dist, f) => fs.readFileSync(path.join(dist, f), 'utf8');
const gzipKb = (dist, f) => gzipSync(fs.readFileSync(path.join(dist, f))).length / 1024;

/**
 * The two targets deliberately differ, so both are built and asserted:
 * modular ships ES modules with the bank split out; standalone ships one
 * classic-script IIFE that runs from file://.
 */
let modular;
let standalone;

beforeAll(() => {
    modular = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-modular-'));
    standalone = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-standalone-'));
    runBuild(modular);
    runBuild(standalone, { mode: 'standalone' });
}, 180_000);

afterAll(() => {
    fs.rmSync(modular, { recursive: true, force: true });
    fs.rmSync(standalone, { recursive: true, force: true });
});

/** Boot a built page and play a move, to prove the output actually works. */
async function bootBuilt(dist, scripts) {
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', (err) => {
        if (!/fetch is not defined|Not implemented/.test(err.message)) throw err;
    });
    const dom = new JSDOM(read(dist, 'index.html'), {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        url: 'http://localhost/',
        virtualConsole,
    });
    for (const script of scripts) dom.window.eval(read(dist, `assets/${script}`));
    return dom;
}

describe.each([
    ['modular', () => modular],
    ['standalone', () => standalone],
])('%s build', (_name, dist) => {
    it('emits index.html and exactly one stylesheet', () => {
        expect(fs.existsSync(path.join(dist(), 'index.html'))).toBe(true);
        expect(stylesOf(dist())).toHaveLength(1);
    });

    it('content-hashes every asset filename', () => {
        for (const asset of assetsOf(dist())) {
            expect(asset).toMatch(/\.[A-Za-z0-9_-]{8,}\.(js|css|woff2)$/);
        }
    });

    it('uses relative asset paths so it works from a subpath', () => {
        // GitHub Pages serves at /<repo>/, so absolute /assets/... would 404.
        const html = read(dist(), 'index.html');
        expect(html).not.toMatch(/(src|href)="\/assets\//);
        expect(html).toMatch(/(src|href)="\.\/assets\//);
    });

    // Inlined into the bundle, CSS would only apply once all the JS had parsed.
    it('keeps CSS out of the JS bundles', () => {
        for (const script of scriptsOf(dist())) {
            expect(read(dist(), `assets/${script}`)).not.toContain('--bg-primary');
        }
        expect(read(dist(), `assets/${stylesOf(dist())[0]}`)).toContain('--bg-primary');
    });

    it('leaves no reference to the unbundled sources', () => {
        const html = read(dist(), 'index.html');
        for (const source of ['solver.js', 'generator.js', '/app.js', '/style.css']) {
            expect(html).not.toContain(`"${source}"`);
        }
    });

    it('copies _headers for static hosts', () => {
        expect(fs.existsSync(path.join(dist(), '_headers'))).toBe(true);
    });

    it('produces the same asset names when rebuilt', () => {
        const before = assetsOf(dist()).sort();
        runBuild(dist(), { mode: _name === 'standalone' ? 'standalone' : undefined });
        expect(assetsOf(dist()).sort()).toEqual(before);
    });
});

describe('modular build', () => {
    it('splits the puzzle bank into its own chunk', () => {
        const scripts = scriptsOf(modular);
        expect(scripts).toHaveLength(2);
        expect(scripts.some((f) => f.startsWith('puzzle-bank.'))).toBe(true);
    });

    // The whole point of the split: the bank is >90% of the payload and is not
    // needed to draw the grid, resume a saved game, or use solver mode.
    it('keeps the initial chunk far smaller than the bank', () => {
        const entry = scriptsOf(modular).find((f) => !f.startsWith('puzzle-bank.'));
        const bank = scriptsOf(modular).find((f) => f.startsWith('puzzle-bank.'));
        expect(gzipKb(modular, `assets/${entry}`)).toBeLessThan(20);
        expect(gzipKb(modular, `assets/${bank}`)).toBeGreaterThan(80);
    });

    it('loads the entry as a module', () => {
        expect(read(modular, 'index.html')).toContain('type="module"');
    });

    // crossorigin makes the browser send an Origin header; against a server
    // replying `Vary: Origin` that turns every service worker cache lookup into
    // a miss. These are same-origin assets, so the attribute buys nothing.
    it('does not mark same-origin assets crossorigin', () => {
        expect(read(modular, 'index.html')).not.toContain('crossorigin');
    });

    it('does not reference the bank chunk from the HTML', () => {
        // It must be fetched on demand, not preloaded up front.
        const bank = scriptsOf(modular).find((f) => f.startsWith('puzzle-bank.'));
        expect(read(modular, 'index.html')).not.toContain(bank);
    });

    it('emits the service worker and PWA assets', () => {
        expect(fs.existsSync(path.join(modular, 'sw.js'))).toBe(true);
        expect(fs.existsSync(path.join(modular, 'manifest.webmanifest'))).toBe(true);
        expect(fs.existsSync(path.join(modular, 'icons/icon-192.png'))).toBe(true);
    });

    it('precaches the bank so offline play still works', () => {
        const bank = scriptsOf(modular).find((f) => f.startsWith('puzzle-bank.'));
        expect(read(modular, 'sw.js')).toContain(bank);
    });

    // The budget covers everything the worker precaches. The two self-hosted
    // fonts are ~80 kB of it and do not compress (woff2 already is); before
    // they moved in-repo the same bytes came from Google Fonts and were simply
    // not counted here.
    it('stays within the gzipped payload budget', () => {
        const total = [...assetsOf(modular).map((f) => `assets/${f}`), 'sw.js']
            .reduce((n, f) => n + gzipKb(modular, f), 0);
        expect(total).toBeLessThan(240);
    });
});

describe('standalone build', () => {
    // ES modules are blocked over file://, so a module script would cost this
    // target its entire reason to exist.
    it('emits a classic script, not a module', () => {
        const html = read(standalone, 'index.html');
        expect(html).toMatch(/<script[^>]+src="[^"]+\.js"/);
        expect(html).not.toContain('type="module"');
        expect(html).not.toContain('crossorigin');
    });

    it('inlines everything into a single bundle', () => {
        expect(scriptsOf(standalone)).toHaveLength(1);
    });

    it('ships no service worker, which file:// cannot use anyway', () => {
        expect(fs.existsSync(path.join(standalone, 'sw.js'))).toBe(false);
    });

    it('runs a game with no further network access', async () => {
        const dom = await bootBuilt(standalone, scriptsOf(standalone));
        const { document } = dom.window;
        expect(document.querySelectorAll('.cell-wrapper')).toHaveLength(81);

        document.getElementById('level-input').value = '1';
        document.getElementById('btn-new-game')
            .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 80));

        const filled = [...document.querySelectorAll('.cell-input')].filter((i) => i.value).length;
        expect(filled).toBeGreaterThan(20);
        dom.window.close();
    });
});

describe('api base injection', () => {
    it('inlines SUDOKU_API_BASE when the env var is set', () => {
        const other = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-build-api-'));
        try {
            runBuild(other, { env: { SUDOKU_API_BASE: 'https://api.example.com' } });
            expect(read(other, 'index.html')).toContain('window.SUDOKU_API_BASE="https://api.example.com"');
        } finally {
            fs.rmSync(other, { recursive: true, force: true });
        }
    });
});

describe('link previews', () => {
    // A shared link with no og:image renders as a bare line of text rather than
    // a card, and most crawlers will not resolve a relative image path.
    it('declares Open Graph and Twitter cards', () => {
        const html = read(modular, 'index.html');
        for (const tag of [
            'property="og:title"', 'property="og:description"', 'property="og:image"',
            'property="og:type"', 'name="twitter:card"', 'name="twitter:image"',
        ]) {
            expect(html, tag).toContain(tag);
        }
    });

    it('ships the preview image at the size crawlers expect', () => {
        const file = path.join(modular, 'og-image.png');
        expect(fs.existsSync(file)).toBe(true);

        const html = read(modular, 'index.html');
        expect(html).toContain('content="1200"');
        expect(html).toContain('content="630"');

        // PNG header carries the dimensions at a fixed offset.
        const header = fs.readFileSync(file).subarray(16, 24);
        expect(header.readUInt32BE(0)).toBe(1200);
        expect(header.readUInt32BE(4)).toBe(630);
    });

    it('describes the image for screen readers', () => {
        expect(read(modular, 'index.html')).toContain('property="og:image:alt"');
    });

    // A default rather than a relative path, because an unset variable would
    // otherwise ship a relative og:image and silently degrade every shared
    // link from a card to a line of text.
    it('uses the production URL by default, with no build configuration', () => {
        const html = read(modular, 'index.html');
        expect(html).toContain('rel="canonical" href="https://sudoku.nirbhay.dev/"');
        expect(html).toContain('content="https://sudoku.nirbhay.dev/og-image.png"');
        expect(html).not.toContain('content="./og-image.png"');
    });

    it('declares a canonical URL', () => {
        expect(read(modular, 'index.html')).toMatch(/<link rel="canonical" href="https?:\/\/[^"]+"/);
    });

    it('tolerates a trailing slash on the site URL', () => {
        const other = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-og2-'));
        try {
            runBuild(other, { env: { SUDOKU_SITE_URL: 'https://sudoku.example.com/' } });
            const html = read(other, 'index.html');
            expect(html).toContain('content="https://sudoku.example.com/og-image.png"');
            expect(html).not.toContain('//og-image.png');
        } finally {
            fs.rmSync(other, { recursive: true, force: true });
        }
    });

    /**
     * The likely bug in a substitution like this is a partial one — some tags
     * updated, others left pointing at the default. It reads as correct at a
     * glance, so it is asserted directly: after an override, the default must
     * not survive anywhere in the document.
     */
    it('leaves no trace of the default after an override', () => {
        const other = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-og3-'));
        try {
            runBuild(other, { env: { SUDOKU_SITE_URL: 'https://elsewhere.example.com' } });
            expect(read(other, 'index.html')).not.toContain('sudoku.nirbhay.dev');
        } finally {
            fs.rmSync(other, { recursive: true, force: true });
        }
    });

    // A self-hosted copy advertising the public site as canonical would tell
    // search engines the real version lives somewhere else.
    it('overrides the standalone build too', () => {
        const other = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-og4-'));
        try {
            runBuild(other, { mode: 'standalone', env: { SUDOKU_SITE_URL: 'https://selfhosted.example.com' } });
            const html = read(other, 'index.html');
            expect(html).toContain('https://selfhosted.example.com/');
            expect(html).not.toContain('sudoku.nirbhay.dev');
        } finally {
            fs.rmSync(other, { recursive: true, force: true });
        }
    });
});
