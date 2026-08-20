/**
 * Build script — bundles the app into dist/ with content-hashed filenames.
 *
 * The source tree stays directly runnable (open index.html, no build needed);
 * this only produces an optimized copy for deployment.
 *
 *   node build.js
 *   SUDOKU_API_BASE=https://sudoku-api.example.com node build.js
 *
 * Content hashing is what makes long-lived caching safe: asset filenames change
 * whenever their bytes do, so index.html (served no-cache) always points at the
 * current files and stale CSS/JS on a client becomes impossible.
 */
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'assets');

// Load order matters — each file relies on globals from the previous ones.
const JS_SOURCES = ['solver.js', 'generator.js', 'puzzle-bank.js', 'app.js'];
const CSS_SOURCE = 'style.css';
const HTML_SOURCE = 'index.html';

const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const hash = (content) => createHash('sha256').update(content).digest('hex').slice(0, 8);
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

function report(label, raw, out) {
    const gz = gzipSync(out).length;
    const saved = ((1 - out.length / raw) * 100).toFixed(0);
    console.log(`  ${label.padEnd(28)} ${kb(raw).padStart(9)} → ${kb(out.length).padStart(9)}  (${saved}% smaller, ${kb(gz)} gzipped)`);
}

async function build() {
    console.log('Building...\n');
    fs.rmSync(dist, { recursive: true, force: true });
    fs.mkdirSync(assets, { recursive: true });

    // ── JS ────────────────────────────────────────────────────────────
    // Concatenated in load order and wrapped in an IIFE. The wrapper turns
    // what are currently globals (SudokuSolver, PUZZLES, ...) into locals,
    // which lets esbuild rename them and cuts the bundle down further.
    const jsRaw = JS_SOURCES.map(read).join('\n;\n');
    const jsWrapped = `(() => {\n${jsRaw}\n})();`;
    const js = await esbuild.transform(jsWrapped, {
        minify: true,
        target: ['es2020'],
        legalComments: 'none',
    });
    const jsName = `app.${hash(js.code)}.js`;
    fs.writeFileSync(path.join(assets, jsName), js.code);
    report('js (4 files bundled)', Buffer.byteLength(jsRaw), Buffer.from(js.code));

    // ── CSS ───────────────────────────────────────────────────────────
    const cssRaw = read(CSS_SOURCE);
    const css = await esbuild.transform(cssRaw, {
        loader: 'css',
        minify: true,
        target: ['es2020'],
    });
    const cssName = `style.${hash(css.code)}.css`;
    fs.writeFileSync(path.join(assets, cssName), css.code);
    report('css', Buffer.byteLength(cssRaw), Buffer.from(css.code));

    // ── HTML ──────────────────────────────────────────────────────────
    let html = read(HTML_SOURCE);
    html = html.replace(
        /<link rel="stylesheet" href="style\.css">/,
        `<link rel="stylesheet" href="assets/${cssName}">`
    );
    // Collapse the four script tags into the single bundle.
    html = html.replace(
        /\s*<script src="(?:solver|generator|puzzle-bank)\.js"><\/script>/g,
        ''
    );
    html = html.replace(
        /<script src="app\.js"><\/script>/,
        `<script src="assets/${jsName}"></script>`
    );

    // Optional: point a static deployment at a leaderboard hosted elsewhere.
    const apiBase = process.env.SUDOKU_API_BASE;
    if (apiBase) {
        html = html.replace(
            '</head>',
            `  <script>window.SUDOKU_API_BASE=${JSON.stringify(apiBase)};</script>\n</head>`
        );
        console.log(`\n  leaderboard API base       ${apiBase}`);
    }

    if (html.includes('src="app.js"') || html.includes('href="style.css"')) {
        throw new Error('index.html asset rewriting failed — tags did not match expected form');
    }
    fs.writeFileSync(path.join(dist, 'index.html'), html);

    // ── Static host headers (Cloudflare Pages / Netlify read this) ────
    fs.copyFileSync(path.join(root, '_headers'), path.join(dist, '_headers'));

    const total = fs.readdirSync(assets).reduce(
        (n, f) => n + fs.statSync(path.join(assets, f)).size,
        fs.statSync(path.join(dist, 'index.html')).size
    );
    console.log(`\n  ${'total'.padEnd(28)} ${kb(total).padStart(9)}`);
    console.log(`\nWrote dist/ (${jsName}, ${cssName})`);
}

build().catch((err) => {
    console.error(err);
    process.exit(1);
});
