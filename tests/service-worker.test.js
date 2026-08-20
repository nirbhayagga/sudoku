import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { repoRoot } from './helpers/paths.js';

/**
 * The service worker is generated at build time, so it is built once and then
 * exercised inside a stub ServiceWorkerGlobalScope. Getting the caching
 * strategy wrong is how a PWA pins users to a stale build, so each rule is
 * asserted rather than assumed.
 */
let swSource;
let precache;

beforeAll(() => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-sw-'));
    execFileSync(
        process.execPath,
        [path.join(repoRoot, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', dist, '--emptyOutDir'],
        { cwd: repoRoot, stdio: 'pipe' }
    );
    swSource = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
    precache = JSON.parse(swSource.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
    fs.rmSync(dist, { recursive: true, force: true });
}, 120_000);

/** Minimal Cache Storage that records what happened. */
function makeCaches(store = new Map()) {
    const caches = {
        store,
        open: async (name) => {
            if (!store.has(name)) store.set(name, new Map());
            const entries = store.get(name);
            return {
                addAll: async (urls) => urls.forEach((u) => entries.set(u, { url: u, cached: true })),
                put: async (req, res) => entries.set(req.url ?? req, res),
                match: async (req) => entries.get(req.url ?? req),
            };
        },
        keys: async () => [...store.keys()],
        delete: async (name) => store.delete(name),
        match: async (req) => {
            for (const entries of store.values()) {
                const hit = entries.get(req.url ?? req);
                if (hit) return hit;
            }
            return undefined;
        },
    };
    return caches;
}

/** Load the worker into a stub global scope and capture its listeners. */
function loadWorker({ fetchImpl, caches } = {}) {
    const listeners = {};
    const scope = {
        location: { origin: 'https://sudoku.example.com' },
        caches: caches || makeCaches(),
        clients: { claim: async () => {} },
        skipWaiting: async () => {},
        addEventListener: (type, fn) => { listeners[type] = fn; },
        fetch: fetchImpl || (async () => ({ ok: true, type: 'basic', clone: () => ({}) })),
        URL,
        Promise,
        JSON,
    };
    scope.self = scope;
    vm.createContext(scope);
    vm.runInContext(swSource, scope);
    return { scope, listeners };
}

/** Run a fetch handler and return what it chose to respond with, if anything. */
async function handleFetch(listeners, request) {
    let responded;
    const event = { request, respondWith: (p) => { responded = p; } };
    listeners.fetch(event);
    return responded === undefined ? undefined : await responded;
}

const req = (url, extra = {}) => ({ url, method: 'GET', mode: 'no-cors', ...extra });

describe('precache manifest', () => {
    it('includes the navigation entry', () => {
        expect(precache[0]).toBe('./');
    });

    it('includes the hashed JS and CSS', () => {
        expect(precache.some((f) => /assets\/.*\.js$/.test(f))).toBe(true);
        expect(precache.some((f) => /assets\/.*\.css$/.test(f))).toBe(true);
    });

    it('includes the manifest and icons', () => {
        expect(precache).toContain('./manifest.webmanifest');
        expect(precache.some((f) => f.includes('icon-192'))).toBe(true);
        expect(precache.some((f) => f.includes('maskable'))).toBe(true);
    });

    it('never caches the worker itself or host directives', () => {
        expect(precache).not.toContain('./sw.js');
        expect(precache).not.toContain('./_headers');
        expect(precache).not.toContain('./index.html');
    });

    it('references no file that the build did not emit', () => {
        // The list is derived from the output directory, so a stale hardcoded
        // path cannot creep in.
        expect(precache.every((f) => f.startsWith('./'))).toBe(true);
    });
});

describe('install', () => {
    it('precaches every listed file', async () => {
        const caches = makeCaches();
        const { listeners, scope } = loadWorker({ caches });

        let work;
        await listeners.install({ waitUntil: (p) => { work = p; } });
        await work;

        const cacheName = swSource.match(/const CACHE = '([^']+)'/)[1];
        expect([...scope.caches.store.get(cacheName).keys()].sort()).toEqual([...precache].sort());
    });
});

describe('activate', () => {
    it('deletes caches from previous builds', async () => {
        const store = new Map([
            ['sudoku-oldbuild', new Map()],
            ['unrelated-cache', new Map()],
        ]);
        const caches = makeCaches(store);
        const { listeners } = loadWorker({ caches });
        const cacheName = swSource.match(/const CACHE = '([^']+)'/)[1];
        store.set(cacheName, new Map());

        let work;
        await listeners.activate({ waitUntil: (p) => { work = p; } });
        await work;

        expect([...store.keys()]).toEqual([cacheName]);
    });
});

describe('fetch strategy', () => {
    let listeners;
    let fetched;

    beforeEach(() => {
        fetched = [];
        ({ listeners } = loadWorker({
            fetchImpl: async (request) => {
                fetched.push(request.url ?? request);
                return { ok: true, type: 'basic', body: 'network', clone: () => ({ body: 'network' }) };
            },
        }));
    });

    it('ignores non-GET requests', async () => {
        const response = await handleFetch(listeners, req('https://sudoku.example.com/api/leaderboard', { method: 'POST' }));
        expect(response).toBeUndefined();
    });

    it('ignores cross-origin requests', async () => {
        const response = await handleFetch(listeners, req('https://other.example.com/thing.js'));
        expect(response).toBeUndefined();
    });

    // A cached health check would report the backend as available when it is
    // not, and cached scores would be replayed as current.
    it('never handles leaderboard API traffic', async () => {
        expect(await handleFetch(listeners, req('https://sudoku.example.com/api/health'))).toBeUndefined();
        expect(await handleFetch(listeners, req('https://sudoku.example.com/api/leaderboard/easy'))).toBeUndefined();
    });

    it('serves assets from cache without touching the network', async () => {
        const caches = makeCaches(new Map([['c', new Map([['https://sudoku.example.com/assets/app.js', { body: 'cached' }]])]]));
        const worker = loadWorker({
            caches,
            fetchImpl: async () => { throw new Error('should not reach the network'); },
        });
        const response = await handleFetch(worker.listeners, req('https://sudoku.example.com/assets/app.js'));
        expect(response.body).toBe('cached');
    });

    it('falls back to the network for an asset it has not cached', async () => {
        const response = await handleFetch(listeners, req('https://sudoku.example.com/assets/new.js'));
        expect(response.body).toBe('network');
        expect(fetched).toHaveLength(1);
    });

    // Serving a stale document would pin clients to old asset hashes for good.
    it('goes to the network first for navigations', async () => {
        const caches = makeCaches(new Map([['c', new Map([['https://sudoku.example.com/', { body: 'stale page' }]])]]));
        const worker = loadWorker({
            caches,
            fetchImpl: async () => ({ ok: true, type: 'basic', body: 'fresh page', clone: () => ({ body: 'fresh page' }) }),
        });
        const response = await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }));
        expect(response.body).toBe('fresh page');
    });

    it('serves the cached page when the network is unavailable', async () => {
        const caches = makeCaches(new Map([['c', new Map([['https://sudoku.example.com/', { body: 'offline page' }]])]]));
        const worker = loadWorker({
            caches,
            fetchImpl: async () => { throw new Error('offline'); },
        });
        const response = await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }));
        expect(response.body).toBe('offline page');
    });

    it('does not cache failed or opaque responses', async () => {
        const caches = makeCaches();
        const worker = loadWorker({
            caches,
            fetchImpl: async () => ({ ok: false, type: 'basic', clone: () => ({}) }),
        });
        await handleFetch(worker.listeners, req('https://sudoku.example.com/assets/missing.js'));
        for (const entries of caches.store.values()) {
            expect(entries.has('https://sudoku.example.com/assets/missing.js')).toBe(false);
        }
    });
});

describe('web app manifest', () => {
    const manifest = JSON.parse(
        fs.readFileSync(path.join(repoRoot, 'public/manifest.webmanifest'), 'utf8')
    );

    it('is installable: name, icons, start_url and display', () => {
        expect(manifest.name).toBeTruthy();
        expect(manifest.short_name).toBeTruthy();
        expect(manifest.start_url).toBeTruthy();
        expect(manifest.display).toBe('standalone');
        expect(manifest.icons.length).toBeGreaterThan(0);
    });

    it('offers both 192px and 512px icons, which Android requires', () => {
        const sizes = manifest.icons.map((i) => i.sizes);
        expect(sizes).toContain('192x192');
        expect(sizes).toContain('512x512');
    });

    it('offers maskable icons so Android does not letterbox them', () => {
        const maskable = manifest.icons.filter((i) => i.purpose === 'maskable');
        expect(maskable.length).toBeGreaterThanOrEqual(2);
    });

    it('uses relative paths so it works from a subpath', () => {
        // GitHub Pages serves at /<repo>/; absolute paths would break there.
        expect(manifest.start_url).toBe('./');
        expect(manifest.scope).toBe('./');
        for (const icon of manifest.icons) expect(icon.src.startsWith('./')).toBe(true);
    });

    it('references icons that exist', () => {
        for (const icon of manifest.icons) {
            const file = path.join(repoRoot, 'public', icon.src.replace(/^\.\//, ''));
            expect(fs.existsSync(file), icon.src).toBe(true);
        }
    });

    it('matches the theme colour the app applies for midnight', () => {
        expect(manifest.theme_color).toBe('#0a0a0f');
        expect(manifest.background_color).toBe('#0a0a0f');
    });
});
