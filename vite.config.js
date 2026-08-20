import { defineConfig } from 'vite';

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

    plugins: [injectApiBase(), classicScriptOutput()],

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
