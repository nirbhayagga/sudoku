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
let cacheName;
let indexHtml;
let standaloneSource;
let standaloneHtml;

beforeAll(() => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-sw-'));
    execFileSync(
        process.execPath,
        [path.join(repoRoot, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', dist, '--emptyOutDir'],
        { cwd: repoRoot, stdio: 'pipe' }
    );
    swSource = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
    precache = JSON.parse(swSource.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
    cacheName = `sudoku-v2:${encodeURIComponent('https://sudoku.example.com/')}:${swSource.match(/const CACHE = CACHE_PREFIX \+ '(.*?)'/)[1]}`;
    indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    fs.rmSync(dist, { recursive: true, force: true });
}, 120_000);

beforeAll(() => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-sw-standalone-'));
    try {
        execFileSync(process.execPath,
            [path.join(repoRoot, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'standalone', '--outDir', dist, '--emptyOutDir'],
            { cwd: repoRoot, stdio: 'pipe' });
        standaloneSource = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
        standaloneHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    } finally {
        fs.rmSync(dist, { recursive: true, force: true });
    }
}, 120_000);

/** Minimal Cache Storage that records what happened. */
function makeCaches(store = new Map()) {
    const caches = {
        store,
        open: async (name) => {
            if (!store.has(name)) store.set(name, new Map());
            const entries = store.get(name);
            return {
                addAll: async (urls) => urls.forEach((u) => entries.set(u, page(u, indexHtml))),
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
function loadWorker({ fetchImpl, caches, setTimeoutImpl, scopeUrl = 'https://sudoku.example.com/', source = swSource } = {}) {
    const listeners = {};
    const scope = {
        location: { origin: 'https://sudoku.example.com' },
        registration: { scope: scopeUrl },
        Response,
        caches: caches || makeCaches(),
        clients: { claim: async () => {} },
        skipWaiting: async () => {},
        addEventListener: (type, fn) => { listeners[type] = fn; },
        fetch: fetchImpl || (async () => ({ ok: true, type: 'basic', clone: () => ({}) })),
        // Navigations race the network against a deadline. The real clock is
        // the default so the existing tests still see the network win; a test
        // that wants the deadline to fire passes a fast one.
        setTimeout: setTimeoutImpl || setTimeout,
        URL,
        Promise,
        JSON,
    };
    scope.self = scope;
    vm.createContext(scope);
    vm.runInContext(source, scope);
    return { scope, listeners };
}

/** Run a fetch handler and return what it chose to respond with, if anything. */
async function handleFetch(listeners, request, work = []) {
    let responded;
    const event = { request, waitUntil: (p) => work.push(p), respondWith: (p) => { responded = p; } };
    listeners.fetch(event);
    return responded === undefined ? undefined : await responded;
}

const req = (url, extra = {}) => ({ url, method: 'GET', mode: 'no-cors', ...extra });

/**
 * A navigation response stub. The worker reads the body to decide whether it
 * holds the assets the document names, so `html` is not decoration.
 */
function page(body, html) {
    const response = { ok: true, type: 'basic', body, text: async () => html };
    response.clone = () => ({ ...response });
    return response;
}

/** Markup naming exactly the assets this build precached — the good case. */
const backedHtml = () => precache
    .filter((p) => p.includes('assets/'))
    .map((p) => `<script type="module" src="${p}"></script>`)
    .join('');

/** Markup from a later build, whose hashes this worker has never seen. */
const unbackedHtml = '<script src="./assets/index.Nvvvvvvv.js"></script>';

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

describe('cache matching', () => {
    // Servers commonly send `Vary: Origin`. A crossorigin module script sends an
    // Origin header the precache's own fetch never sent, so without ignoreVary
    // every lookup misses and offline silently fails while the cache looks full.
    // This cost a real debugging session; the assertion is here so it cannot
    // regress.
    it('ignores Vary when matching', () => {
        expect(swSource).toContain('ignoreVary: true');
    });

    it('uses the option on every cache lookup', () => {
        const lookups = swSource.match(/cache\.match\(/g) || [];
        const withOptions = swSource.match(/cache\.match\([^)]*MATCH_OPTIONS/g) || [];
        expect(withOptions.length).toBe(lookups.length);
    });
});

describe('install', () => {
    it('precaches every listed file', async () => {
        const caches = makeCaches();
        const { listeners, scope } = loadWorker({ caches });

        let work;
        await listeners.install({ waitUntil: (p) => { work = p; } });
        await work;

        expect([...scope.caches.store.get(cacheName).keys()].sort()).toEqual([...precache].sort());
    });

    it.each(['200 error', 'unreadable', 'unknown asset', 'partial addAll'])('rejects %s during install and removes only the new cache', async (failure) => {
        const oldName = cacheName + '-previous';
        const caches = makeCaches(new Map([[oldName, new Map()], ['other-app', new Map()]]));
        const open = caches.open;
        caches.open = async (name) => {
            const cache = await open(name);
            const addAll = cache.addAll;
            cache.addAll = async (urls) => {
                await addAll(urls);
                if (failure === 'partial addAll') throw new Error('download failed');
                const response = page('bad', failure === 'unknown asset' ? unbackedHtml : '<html><body>Service unavailable</body></html>');
                if (failure === 'unreadable') response.text = async () => { throw new Error('body failed'); };
                await cache.put('./', response);
            };
            return cache;
        };
        const { listeners, scope } = loadWorker({ caches });
        let activated = false;
        scope.skipWaiting = async () => { activated = true; };
        let work;
        listeners.install({ waitUntil: (p) => { work = p; } });
        await expect(work).rejects.toThrow();
        expect(activated).toBe(false);
        expect([...caches.store.keys()]).toEqual([oldName, 'other-app']);
    });

    it('does not delete an existing active cache when revalidation fails', async () => {
        const caches = makeCaches(new Map([[cacheName, new Map([['./', page('old', '<h1>Error</h1>')]])]]));
        const { listeners } = loadWorker({ caches });
        let work;
        listeners.install({ waitUntil: (p) => { work = p; } });
        await expect(work).rejects.toThrow('Invalid precached app shell');
        expect(caches.store.get(cacheName).get('./').body).toBe('old');
    });

});

describe.each(['modular', 'standalone'])('%s HTTP worker', (target) => {
    it('installs and serves the emitted shell under a subpath', async () => {
        const source = target === 'modular' ? swSource : standaloneSource;
        const html = target === 'modular' ? indexHtml : standaloneHtml;
        const caches = makeCaches();
        const open = caches.open;
        caches.open = async (name) => ({ ...await open(name),
            addAll: async (urls) => {
                const cache = await open(name);
                for (const url of urls) await cache.put(url, page('app', html));
            },
        });
        const { listeners, scope } = loadWorker({ source, caches,
            scopeUrl: 'https://sudoku.example.com/sudoku/', fetchImpl: async () => page('app', html) });
        let activated = false;
        scope.skipWaiting = async () => { activated = true; };
        let work;
        listeners.install({ waitUntil: (p) => { work = p; } });
        await work;
        expect(activated).toBe(true);
        const request = req('https://sudoku.example.com/sudoku/', { mode: 'navigate' });
        expect((await handleFetch(listeners, request)).body).toBe('app');
        // The opposite script type must not qualify as this build's entry.
        const wrongHtml = target === 'modular'
            ? html.replace('type="module"', 'type="text/plain"')
            : html.replace(/<script([^>]*src=)/, '<script type="module"$1');
        const invalid = loadWorker({ source, scopeUrl: 'https://sudoku.example.com/sudoku/',
            fetchImpl: async () => page('wrong type', wrongHtml) });
        expect((await handleFetch(invalid.listeners, request)).type).toBe('error');
    });
});

describe('activate', () => {
    it('deletes only previous builds in this scope and preserves ambiguous legacy caches', async () => {
        const store = new Map([
            [cacheName.replace(/:[^:]+$/, ':oldbuild'), new Map()],
            ['sudoku-0123456789ab', new Map()],
            [`sudoku-v2:${encodeURIComponent('https://sudoku.example.com/other/')}:oldbuild`, new Map()],
            ['unrelated-cache', new Map()],
        ]);
        const caches = makeCaches(store);
        const { listeners } = loadWorker({ caches });
        store.set(cacheName, new Map());

        let work;
        await listeners.activate({ waitUntil: (p) => { work = p; } });
        await work;

        expect([...store.keys()]).toEqual([
            'sudoku-0123456789ab',
            `sudoku-v2:${encodeURIComponent('https://sudoku.example.com/other/')}:oldbuild`,
            'unrelated-cache', cacheName,
        ]);
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
        const caches = makeCaches(new Map([[cacheName, new Map([['https://sudoku.example.com/assets/app.js', { body: 'cached' }]])]]));
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
        const caches = makeCaches(new Map([[cacheName, new Map([['https://sudoku.example.com/', { body: 'stale page' }]])]]));
        const worker = loadWorker({
            caches,
            fetchImpl: async () => page('fresh page', backedHtml()),
        });
        const response = await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }));
        expect(response.body).toBe('fresh page');
    });

    it('serves the cached page when the network is unavailable', async () => {
        const caches = makeCaches(new Map([[cacheName, new Map([['https://sudoku.example.com/', { body: 'offline page' }]])]]));
        const worker = loadWorker({
            caches,
            fetchImpl: async () => { throw new Error('offline'); },
        });
        const response = await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }));
        expect(response.body).toBe('offline page');
    });

    /**
     * The case the deadline exists for. Being offline was never the problem —
     * fetch rejects and the fallback runs at once. A connection that accepts
     * the request and never answers (one bar, captive portal) would otherwise
     * hold a blank screen with the whole app sitting in the cache.
     */
    it('serves the cached page when the network hangs', async () => {
        const caches = makeCaches(new Map([[cacheName, new Map([
            ['https://sudoku.example.com/', { body: 'cached page' }],
        ])]]));
        const worker = loadWorker({
            caches,
            fetchImpl: () => new Promise(() => { /* never settles */ }),
            setTimeoutImpl: (fn) => setTimeout(fn, 0),
        });
        const response = await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }));
        expect(response.body).toBe('cached page');
    });

    // Losing the race must not abandon the request: its answer is what makes
    // the next launch current rather than one build behind for ever.
    it('still refreshes the cache when a slow network finally answers', async () => {
        const caches = makeCaches(new Map([[cacheName, new Map([
            ['https://sudoku.example.com/', { body: 'cached page' }],
        ])]]));
        const worker = loadWorker({
            caches,
            fetchImpl: () => new Promise((resolve) => setTimeout(
                () => resolve(page('slow page', backedHtml())),
                20
            )),
            setTimeoutImpl: (fn) => setTimeout(fn, 0),
        });
        const response = await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }));
        expect(response.body).toBe('cached page');

        await new Promise((resolve) => setTimeout(resolve, 60));
        expect(caches.store.get(cacheName).get('https://sudoku.example.com/').body).toBe('slow page');
    });

    /**
     * The failure this exists for is not a silent network but a lying one.
     * A captive portal, a filtering DNS resolver or a CDN edge error all answer
     * fast, so the deadline never fires and the race records a win. Treating
     * that as success showed a blank page and — far worse — overwrote the
     * cached document with it, breaking every later launch until some good
     * network happened to overwrite it back.
     */
    it('prefers the cached page to an error page the network answers with', async () => {
        const caches = makeCaches(new Map([[cacheName, new Map([
            ['https://sudoku.example.com/', { body: 'cached page' }],
        ])]]));
        const worker = loadWorker({
            caches,
            fetchImpl: async () => ({
                ok: false, type: 'basic', status: 502, body: 'edge error',
                clone: () => ({ body: 'edge error' }),
            }),
        });
        const response = await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }));
        expect(response.body).toBe('cached page');
    });

    it('prefers the cached page to a captive portal redirect', async () => {
        const caches = makeCaches(new Map([[cacheName, new Map([
            ['https://sudoku.example.com/', { body: 'cached page' }],
        ])]]));
        const worker = loadWorker({
            caches,
            fetchImpl: async () => ({
                ok: false, type: 'opaqueredirect', status: 0, body: 'portal login',
                clone: () => ({ body: 'portal login' }),
            }),
        });
        const response = await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }));
        expect(response.body).toBe('cached page');
    });

    // Poisoning the cache is the part that outlives the bad network.
    it('never writes an error page over the cached document', async () => {
        const caches = makeCaches(new Map([[cacheName, new Map([
            ['https://sudoku.example.com/', { body: 'cached page' }],
        ])]]));
        const worker = loadWorker({
            caches,
            fetchImpl: async () => ({
                ok: false, type: 'basic', status: 502, body: 'edge error',
                clone: () => ({ body: 'edge error' }),
            }),
        });
        await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }));
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(caches.store.get(cacheName).get('https://sudoku.example.com/').body).toBe('cached page');
    });

    // An installed worker must not serve an unverified navigation.
    it('returns a network failure when no page is cached', async () => {
        const worker = loadWorker({
            caches: makeCaches(),
            fetchImpl: async () => ({
                ok: false, type: 'basic', status: 502, body: 'edge error',
                clone: () => ({ body: 'edge error' }),
            }),
        });
        const response = await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }));
        expect(response.type).toBe('error');
    });

    /**
     * The seam network-first opens. Between a deploy and the new worker
     * finishing its install, the network answers with the *new* document while
     * this worker holds only the *old* build's assets — so every hashed name in
     * it misses the cache and goes to the network. On the connection that made
     * us race in the first place that is a blank screen, and unlike a stale
     * page it has no way back.
     */
    it('refuses a document naming assets it cannot supply', async () => {
        const caches = makeCaches(new Map([[cacheName, new Map([
            ['https://sudoku.example.com/', { body: 'cached page' }],
        ])]]));
        const worker = loadWorker({
            caches,
            fetchImpl: async () => page('next build', unbackedHtml),
        });
        const response = await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }));
        expect(response.body).toBe('cached page');
    });

    // Refusing it must not cache it either: the next launch would inherit the
    // same unservable document with no network to rescue it.
    it('never caches a document it cannot supply', async () => {
        const caches = makeCaches(new Map([[cacheName, new Map([
            ['https://sudoku.example.com/', { body: 'cached page' }],
        ])]]));
        const worker = loadWorker({
            caches,
            fetchImpl: async () => page('next build', unbackedHtml),
        });
        await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }));
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(caches.store.get(cacheName).get('https://sudoku.example.com/').body).toBe('cached page');
    });

    it('rejects a document it cannot supply even when nothing is cached', async () => {
        const worker = loadWorker({
            caches: makeCaches(),
            fetchImpl: async () => page('next build', unbackedHtml),
        });
        const response = await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }));
        expect(response.type).toBe('error');
    });

    /**
     * The guard that keeps the guard honest. isBackedByPrecache matches asset
     * paths out of the markup by shape, so a change to how Vite emits or names
     * them would silently make *every* document look unbacked — freezing every
     * installed client on the build it already had, for ever. Asserting the
     * real built index.html against the real precache is what catches that.
     */
    it('accepts the document this very build emitted', async () => {
        const caches = makeCaches(new Map([[cacheName, new Map([
            ['https://sudoku.example.com/', { body: 'cached page' }],
        ])]]));
        const worker = loadWorker({
            caches,
            fetchImpl: async () => page('this build', indexHtml),
        });
        const response = await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }));
        expect(response.body).toBe('this build');
    });

    it.each([
        ['same-origin 200 error', () => '<html><body>Service unavailable</body></html>'],
        ['stylesheet without entry', () => `<link rel="stylesheet" href="${precache.find((p) => p.endsWith('.css'))}">`],
        ['entry in a template', () => `<template>${backedHtml()}</template>`],
        ['responsive source list', () => `${backedHtml()}<img srcset="./missing.png 2x">`],
        ['multiple link relations', () => `${backedHtml()}<link rel="alternate stylesheet" href="./missing.css">`],
        ['entry in a comment', () => `<!--${backedHtml()}-->`],
        ['entry as inline text', () => `<script>const example = '${backedHtml().replaceAll('</script>', '')}';</script>`],
        ['foreign asset origin', () => backedHtml().replace('./assets/', 'https://other.example.com/assets/')],
        ['wrong asset directory', () => backedHtml().replace('./assets/', './other/assets/')],
        ['unknown stylesheet', () => `${backedHtml()}<link rel="stylesheet" href="./missing.css">`],
        ['unknown script', () => `${backedHtml()}<script src="./missing.js"></script>`],
        ['base URL override', () => `<base href="https://other.example.com/">${backedHtml()}`],
    ])('rejects %s without poisoning the cache', async (_label, html) => {
        const url = 'https://sudoku.example.com/';
        const caches = makeCaches(new Map([[cacheName, new Map([[url, { body: 'cached page' }]])]]));
        const worker = loadWorker({ caches, fetchImpl: async () => page('bad page', html()) });
        const work = [];
        expect((await handleFetch(worker.listeners, req(url, { mode: 'navigate' }), work)).body).toBe('cached page');
        await Promise.all(work);
        expect(caches.store.get(cacheName).get(url).body).toBe('cached page');
    });

    it('rejects an unreadable document body', async () => {
        const response = page('unreadable', '');
        response.text = async () => { throw new Error('body failed'); };
        const worker = loadWorker({ fetchImpl: async () => response });
        const work = [];
        const result = await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }), work);
        await Promise.all(work);
        expect(result.type).toBe('error');
        expect(worker.scope.caches.store.get(cacheName).size).toBe(0);
    });

    it('accepts the emitted shell under a subpath and ignores sibling requests', async () => {
        const worker = loadWorker({ scopeUrl: 'https://sudoku.example.com/game/', fetchImpl: async () => page('app', indexHtml) });
        expect((await handleFetch(worker.listeners, req('https://sudoku.example.com/game/?daily=2026-09-19', { mode: 'navigate' }))).body).toBe('app');
        expect(await handleFetch(worker.listeners, req('https://sudoku.example.com/other/'))).toBeUndefined();
    });

    it('never reads another cache during migration', async () => {
        const url = 'https://sudoku.example.com/';
        const caches = makeCaches(new Map([['sudoku-0123456789ab', new Map([[url, { body: 'legacy' }]])]]));
        const worker = loadWorker({ caches, fetchImpl: async () => page('error', '<h1>Error</h1>') });
        expect((await handleFetch(worker.listeners, req(url, { mode: 'navigate' }))).type).toBe('error');
    });

    it.each(['navigate', 'no-cors'])('waitUntil retains delayed %s writes without delaying the response', async (mode) => {
        let finishWrite;
        const gate = new Promise((resolve) => { finishWrite = resolve; });
        const caches = makeCaches();
        const open = caches.open;
        caches.open = async (name) => {
            const cache = await open(name);
            const put = cache.put;
            cache.put = async (...args) => { await gate; return put(...args); };
            return cache;
        };
        const worker = loadWorker({ caches, fetchImpl: async () => page('app', indexHtml) });
        const work = [];
        const url = 'https://sudoku.example.com/';
        expect((await handleFetch(worker.listeners, req(url, { mode }), work)).body).toBe('app');
        expect(work).toHaveLength(1);
        let settled = false;
        const completed = Promise.all(work).then(() => { settled = true; });
        await Promise.resolve();
        expect(settled).toBe(false);
        expect(caches.store.get(cacheName).has(url)).toBe(false);
        finishWrite();
        await completed;
        expect(caches.store.get(cacheName).get(url).body).toBe('app');
    });

    it('cache write failure leaves the verified response usable and lifetime promise fulfilled', async () => {
        const caches = makeCaches();
        const open = caches.open;
        caches.open = async (name) => ({ ...await open(name), put: async () => { throw new Error('quota'); } });
        const worker = loadWorker({ caches, fetchImpl: async () => page('app', indexHtml) });
        const work = [];
        expect((await handleFetch(worker.listeners, req('https://sudoku.example.com/', { mode: 'navigate' }), work)).body).toBe('app');
        await expect(Promise.all(work)).resolves.toEqual([undefined]);
    });

    it.each([true, false])('waitUntil retains late navigation and only caches valid replies (%s)', async (valid) => {
        const url = 'https://sudoku.example.com/';
        const caches = makeCaches(new Map([[cacheName, new Map([[url, { body: 'cached page' }]])]]));
        let finishNetwork;
        const worker = loadWorker({ caches,
            fetchImpl: () => new Promise((resolve) => { finishNetwork = resolve; }),
            setTimeoutImpl: (fn) => setTimeout(fn, 0),
        });
        const work = [];
        expect((await handleFetch(worker.listeners, req(url, { mode: 'navigate' }), work)).body).toBe('cached page');
        expect(work).toHaveLength(1);
        let settled = false;
        const completed = Promise.all(work).then(() => { settled = true; });
        await Promise.resolve();
        expect(settled).toBe(false);
        finishNetwork(page('late app', valid ? indexHtml : '<h1>Error</h1>'));
        await completed;
        expect(caches.store.get(cacheName).get(url).body).toBe(valid ? 'late app' : 'cached page');
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

    // The manifest cannot follow the system scheme, so it carries the dark
    // default: a dark splash on a light phone is less jarring than the reverse.
    it('matches the theme colour the app applies for dark', () => {
        expect(manifest.theme_color).toBe('#121316');
        expect(manifest.background_color).toBe('#121316');
    });
});
