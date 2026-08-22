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
 * Drop `crossorigin` from the module build's tags.
 *
 * These are same-origin assets, so the attribute buys nothing — but it makes
 * the browser send an `Origin` header, and against a server that replies
 * `Vary: Origin` that turns every service worker cache lookup into a miss.
 * The worker also passes ignoreVary, so this is belt and braces.
 */
function sameOriginAssets() {
    return {
        name: 'same-origin-assets',
        enforce: 'post',
        apply: 'build',
        transformIndexHtml(html) {
            return html.replace(/\s+crossorigin/g, '');
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
 * Rewrite link-preview URLs to absolute ones.
 *
 * og:image in particular must be absolute — most crawlers will not resolve a
 * relative path, and a preview with no image is the difference between a card
 * and a bare line of text. The source keeps them relative so the file works
 * from any host, or from the filesystem, when SUDOKU_SITE_URL is not set.
 */
function absolutePreviewUrls() {
    return {
        name: 'absolute-preview-urls',
        apply: 'build',
        transformIndexHtml(html) {
            const site = process.env.SUDOKU_SITE_URL;
            if (!site) return html;

            const base = site.replace(/\/+$/, '') + '/';
            return html
                .replace(/(<meta property="og:image" content=")\.\/([^"]*)/, `$1${base}$2`)
                .replace(/(<meta name="twitter:image" content=")\.\/([^"]*)/, `$1${base}$2`)
                .replace(/(<meta property="og:url" content=")\.\/([^"]*)/, `$1${base}$2`);
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

/**
 * Two build targets, because they want opposite things:
 *
 *   default     ES modules with code splitting, so the puzzle bank loads on
 *               demand and first load is ~10 kB instead of ~123 kB. For any
 *               HTTP deployment: Docker, Pages, Netlify.
 *
 *   standalone  A single classic-script IIFE with everything inlined, which is
 *               the only shape that runs from file://. Browsers apply CORS to
 *               module scripts and file:// has an opaque origin, so a modular
 *               build cannot be opened from disk.
 *
 * Rollup can only code-split in ES module format, so no single build does both.
 */
export default defineConfig(({ mode }) => {
const standalone = mode === 'standalone';

return {
    // public/ is copied verbatim into dist/ — that is how _headers (cache rules
    // for Cloudflare Pages and Netlify) reaches the build.
    // Relative asset URLs, so the build works from a subpath (a static host
    // without a custom domain serves from a subdirectory) and from the
    // filesystem.
    base: './',

    // The standalone build is for file://, where service workers do not exist,
    // so it ships none. Its script must stay a classic script.
    plugins: standalone
        ? [injectApiBase(), classicScriptOutput()]
        : [injectApiBase(), absolutePreviewUrls(), sameOriginAssets(), pwa()],

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
        outDir: standalone ? 'dist-standalone' : 'dist',
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
                // iife cannot code-split, so dynamic imports are inlined back
                // into the single file — which is exactly what standalone wants.
                format: standalone ? 'iife' : 'es',
                inlineDynamicImports: standalone,
                entryFileNames: 'assets/[name].[hash].js',
                chunkFileNames: 'assets/[name].[hash].js',
                assetFileNames: 'assets/[name].[hash].[ext]',
            },
        },
    },
};
});
