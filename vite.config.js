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
 * the module attributes gives a classic script. Preserve deferred execution so
 * the head script waits for the controls to exist. Served
 * over HTTP nothing changes.
 */
function classicScriptOutput() {
    return {
        name: 'classic-script-output',
        enforce: 'post',
        apply: 'build',
        transformIndexHtml(html) {
            return html
                .replace(/\s+type="module"/g, ' defer')
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
 * The file names and contents determine the cache version, so an unchanged rebuild
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
            const hash = createHash('sha256');
            for (const file of ['index.html', ...files.map((f) => f.slice(2))]) {
                const bytes = fs.readFileSync(path.join(outDir, file));
                hash.update(JSON.stringify([file, bytes.length])).update(bytes);
            }
            const version = hash.digest('hex').slice(0, 12);
            const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
            const entryTag = html.match(/<script\b[^>]*\bsrc="([^"<>]+\.js)"[^>]*>/);
            const entry = entryTag?.[1];
            const entryType = entryTag?.[0].match(/\btype="([^"]*)"/)?.[1] || '';
            if (!['', 'module'].includes(entryType)) throw new Error('Unsupported PWA entry script type');
            if (!entry || !files.includes(entry)) throw new Error('PWA entry script is missing from precache');

            const template = fs.readFileSync(path.resolve('sw-template.js'), 'utf8');
            fs.writeFileSync(
                path.join(outDir, 'sw.js'),
                template
                    .replace('__CACHE_VERSION__', version)
                    .replace('__ENTRY_ASSET__', entry)
                    .replace('__ENTRY_TYPE__', entryType)
                    .replace('__PRECACHE_MANIFEST__', JSON.stringify(precache, null, 4))
            );
        },
    };
}

/**
 * The site's own public URL, which has to appear absolutely in the markup:
 * canonical, og:url and og:image are all read by scrapers that will not resolve
 * a relative path.
 *
 * Source carries the production URL as a real default, so the HTML is correct
 * as authored — no build, no configuration, nothing to forget. Any other
 * deployment overrides it.
 */
const DEFAULT_SITE_URL = 'https://sudoku.nirbhay.dev';

/** Trailing slashes stripped so joins cannot double up. */
const SITE_URL = (process.env.SUDOKU_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');

/**
 * Substitute the site URL when it differs from the default.
 *
 * The alternative — leaving relative URLs and rewriting only when a variable is
 * set — fails silently: an unset variable ships a relative og:image and the
 * shared link quietly stops rendering a card. A default cannot fail that way,
 * and the resolved value is logged so a wrong one is visible instead.
 */
function siteUrl() {
    return {
        name: 'site-url',
        apply: 'build',
        transformIndexHtml(html) {
            if (SITE_URL === DEFAULT_SITE_URL) return html;
            return html.split(DEFAULT_SITE_URL).join(SITE_URL);
        },
        closeBundle() {
            const suffix = SITE_URL === DEFAULT_SITE_URL ? ' (default)' : ' (from SUDOKU_SITE_URL)';
            console.log(`  site url: ${SITE_URL}${suffix}`);
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

    // Standalone keeps its classic script for file://; its worker is used only
    // when served over HTTP(S), where app registration is enabled.
    // siteUrl applies to both targets: a self-hosted or standalone copy should
    // not advertise the public site as its canonical URL either.
    plugins: standalone
        ? [injectApiBase(), siteUrl(), classicScriptOutput(), pwa()]
        : [injectApiBase(), siteUrl(), sameOriginAssets(), pwa()],

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
        // The single classic bundle has no module chunks to preload.
        modulePreload: !standalone,
        // Single self-contained IIFE — see classicScriptOutput above.
        rolldownOptions: {
            // Vite 8 still injects its preload helper with modulePreload:false.
            // All imports are inlined here, so its module metadata is unused.
            // Rolldown documents this transform for non-ESM output; keep it
            // standalone-only rather than hiding EMPTY_IMPORT_META warnings.
            transform: standalone ? { define: { 'import.meta': '{}' } } : undefined,
            output: {
                // iife cannot code-split, so dynamic imports are inlined back
                // into the single file — which is exactly what standalone wants.
                format: standalone ? 'iife' : 'es',
                codeSplitting: !standalone,
                entryFileNames: 'assets/[name].[hash].js',
                chunkFileNames: 'assets/[name].[hash].js',
                assetFileNames: 'assets/[name].[hash].[ext]',
            },
        },
    },
};
});
