import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Emit a build that still runs from the filesystem.
 *
 * Vite writes `<script type="module" crossorigin>`, and browsers refuse to load
 * ES modules over file:// — which would have cost this project its "just open
 * index.html" property. Building the bundle as a single IIFE and then stripping
 * the module attributes gives a classic script that works either way; served
 * over HTTP nothing changes.
 */
function classicScriptOutput() {
    return {
        name: 'classic-script-output',
        enforce: 'post',
        apply: 'build',
        transformIndexHtml(html) {
            return html
                .replace(/\s+type="module"/g, '')
                .replace(/\s+crossorigin/g, '');
        },
    };
}

/**
 * Generate dist/sw.js with the built asset names baked in.
 *
 * Runs after the output directory is complete and reads it, rather than
 * inspecting the rollup bundle: the extracted CSS is emitted too late to appear
 * there, and everything copied from public/ never appears there at all. Reading
 * the finished directory means new icons or static files are picked up with no
 * change here.
 *
 * The file list doubles as the cache version, so a rebuild that changes nothing
 * produces an identical service worker and clients are not churned needlessly.
 */
function pwa() {
    let outDir;

    /** Every emitted file, as paths relative to outDir. */
    function walk(dir, base = '') {
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const rel = base ? `${base}/${entry.name}` : entry.name;
            return entry.isDirectory()
                ? walk(path.join(dir, entry.name), rel)
                : [rel];
        });
    }

    return {
        name: 'pwa',
        apply: 'build',
        configResolved(config) {
            outDir = path.resolve(config.root, config.build.outDir);
        },
        closeBundle() {
            const files = walk(outDir)
                // index.html is covered by './'; sw.js must not cache itself;
                // _headers is a host directive with nothing to serve offline.
                .filter((f) => !['index.html', 'sw.js', '_headers'].includes(f))
                .sort()
                .map((f) => `./${f}`);

            const precache = ['./', ...files];
            const version = createHash('sha256')
                .update(precache.join('|'))
                .digest('hex')
                .slice(0, 12);

            const template = fs.readFileSync(path.resolve('sw-template.js'), 'utf8');
            fs.writeFileSync(
                path.join(outDir, 'sw.js'),
                template
                    .replace('__CACHE_VERSION__', `sudoku-${version}`)
                    .replace('__PRECACHE_MANIFEST__', JSON.stringify(precache, null, 4))
            );
        },
    };
}

/**
 * Let a static deployment point at a leaderboard hosted elsewhere, the same way
 * the previous build script did.
 */
function injectApiBase() {
    return {
        name: 'inject-api-base',
        apply: 'build',
        transformIndexHtml(html) {
            const base = process.env.SUDOKU_API_BASE;
            if (!base) return html;
            return html.replace(
                '</head>',
                `  <script>window.SUDOKU_API_BASE=${JSON.stringify(base)};</script>\n</head>`
            );
        },
    };
}

export default defineConfig({
    // public/ is copied verbatim into dist/ — that is how _headers (cache rules
    // for Cloudflare Pages and Netlify) reaches the build.
    // Relative asset URLs, so the build works from a subpath (GitHub Pages
    // serves at /<repo>/) and from the filesystem.
    base: './',

    plugins: [injectApiBase(), classicScriptOutput(), pwa()],

    server: {
        port: 8000,
        // Mirror what nginx does in production so local dev matches.
        proxy: {
            '/api': {
                target: `http://localhost:${process.env.API_PORT || 3001}`,
                changeOrigin: true,
            },
        },
    },

    build: {
        outDir: 'dist',
        emptyOutDir: true,
        assetsDir: 'assets',
        // The puzzle bank is ~435 kB of irreducible data, so the default 500 kB
        // chunk warning fires on every build and means nothing here. The real
        // guard is the gzipped payload budget asserted in tests/build.test.js.
        chunkSizeWarningLimit: 900,
        cssCodeSplit: false,
        // Single self-contained IIFE — see classicScriptOutput above.
        rollupOptions: {
            output: {
                format: 'iife',
                inlineDynamicImports: true,
                entryFileNames: 'assets/[name].[hash].js',
                assetFileNames: 'assets/[name].[hash].[ext]',
            },
        },
    },
});
