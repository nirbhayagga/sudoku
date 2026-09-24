/**
 * Service worker — offline play.
 *
 * Generated into dist/sw.js at build time by the pwa() plugin in
 * vite.config.js, which substitutes the cache version and precache list. It is
 * not shipped as-is: the asset filenames are content-hashed and only known
 * after the bundle is built.
 *
 * Caching strategy, and why:
 *   - Navigations are NETWORK-FIRST, falling back to the cached page. Serving a
 *     stale document would pin clients to old asset hashes indefinitely, and a
 *     bad deploy could not be recovered by reloading. The network gets a
 *     deadline though — see NAV_TIMEOUT_MS.
 *   - Hashed assets are CACHE-FIRST. Their filename changes whenever their
 *     bytes do, so a cached copy can never be wrong.
 *   - A navigation is only served when this worker holds the assets it names —
 *     see isBackedByPrecache. Document and assets are versioned together and
 *     cached separately, and that is the seam a bad network falls through.
 *   - /api/ is never cached. Leaderboard responses must not be replayed, and a
 *     cached health check would misreport the backend as available.
 */
const CACHE_PREFIX = `sudoku-v2:${encodeURIComponent(self.registration.scope)}:`;
const CACHE = CACHE_PREFIX + '__CACHE_VERSION__';
const ENTRY = '__ENTRY_ASSET__';
const ENTRY_TYPE = '__ENTRY_TYPE__';
const PRECACHE = __PRECACHE_MANIFEST__;

/**
 * ignoreVary is essential, not a nicety.
 *
 * Servers commonly send `Vary: Origin` (nginx with CORS, most CDNs), and a
 * module script marked crossorigin sends an `Origin` header that the precache's
 * own fetch never sent. Cache matching honours Vary, so without this every
 * asset lookup misses, falls through to the network, and offline mode fails
 * while appearing to be correctly cached.
 */
const MATCH_OPTIONS = { ignoreVary: true };

/**
 * How long a navigation waits for the network before the cache wins.
 *
 * Being *offline* was never the problem: fetch rejects at once and the fallback
 * runs in milliseconds. A *hanging* connection is — one bar on a train, or a
 * captive portal that completes the TCP handshake and then never answers. There
 * the request can stall for tens of seconds, and until it does the user is
 * looking at a blank screen with a fully cached app sitting right there.
 */
const NAV_TIMEOUT_MS = 2000;

/**
 * Whether a response is really ours and really the thing that was asked for.
 *
 * A hostile network does not only stall — it *answers*. Captive portals,
 * corporate DNS filters and CDN edge errors all resolve fetch() promptly with a
 * redirect, a 5xx or someone else's HTML. Without this check the race below
 * reads that as success twice over: the user is shown a blank page, and the
 * reply is written over the cached document, so every later launch is broken
 * too until some good network happens to overwrite it again.
 */
function isUsable(response) {
    return response.ok && response.type === 'basic';
}

/** Resolve whole URLs: matching only an assets/ tail accepts other origins/paths. */
const PRECACHED_URLS = new Set(PRECACHE.map((p) => new URL(p, self.registration.scope).href));
const ENTRY_URL = new URL(ENTRY, self.registration.scope).href;

/**
 * Conservative validation of our generated shell, not a general HTML parser.
 * Require the executable entry tag and reject resource URLs outside this build.
 * Comments and inline script text cannot stand in for a real entry tag. A base
 * element would change browser URL resolution, so it is never accepted.
 */
function isBackedByPrecache(html, documentUrl) {
    const markup = html.replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(template|textarea|title|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi, '$1</script>');
    if (/<base\b/i.test(markup)) return false;
    let hasEntry = false;
    for (const match of markup.matchAll(/<(script|link|img|source)\b([^>]*)>/gi)) {
        const tag = match[1].toLowerCase();
        const attrs = new Map();
        const attributes = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
        for (const attr of match[2].matchAll(attributes)) {
            const name = attr[1].toLowerCase();
            if (attrs.has(name)) return false;
            attrs.set(name, attr[2] ?? attr[3] ?? attr[4] ?? '');
        }
        // Canonical and other metadata links do not fetch app resources.
        if (tag === 'link' && !(attrs.get('rel') || '').toLowerCase().split(/\s+/)
            .some((rel) => ['stylesheet', 'modulepreload', 'preload', 'icon', 'apple-touch-icon', 'manifest'].includes(rel))) continue;
        // This build emits no responsive source lists; do not silently skip one.
        if (attrs.has('srcset')) return false;
        const source = attrs.get(tag === 'link' ? 'href' : 'src');
        if (source === undefined) continue;
        let url;
        try { url = new URL(source, documentUrl).href; } catch { return false; }
        if (!PRECACHED_URLS.has(url)) return false;
        if (tag === 'script' && (attrs.get('type') || '') === ENTRY_TYPE && !attrs.has('nomodule') && url === ENTRY_URL) hasEntry = true;
    }
    return hasEntry;
}

/** Store a response, ignoring a cache that refuses it (opaque, over quota). */
function cacheResponse(request, response) {
    const copy = response.clone();
    return caches.open(CACHE)
        .then((cache) => cache.put(request, copy))
        .catch(() => { /* the response is still served; only the copy is lost */ });
}

/**
 * Network-first with a deadline.
 *
 * The network request is never cancelled — if it lands after losing the race it
 * still refreshes the cached document, so the next launch is current.
 */
function navigationResponse(request, event) {
    const network = fetch(request);

    // The losing branch is deliberately left running; swallow its rejection so
    // it cannot surface as an unhandled one.
    network.catch(() => {});

    const cached = () => caches.open(CACHE).then(async (cache) =>
        await cache.match(request, MATCH_OPTIONS) || await cache.match(PRECACHE[0], MATCH_OPTIONS)
    );
    let write = Promise.resolve();

    /**
     * Whether the answer is worth showing — which is what the race waits on,
     * not the bare response. An unusable or unbacked answer counts as a loss:
     * a cached app beats a portal login page, an error document, or a fresh
     * page whose scripts this worker cannot supply.
     */
    const verdict = network.then((response) => {
        if (!isUsable(response)) return 'failed';
        return response.clone().text().then(
            (html) => {
                if (!isBackedByPrecache(html, response.url || request.url)) return 'unbacked';
                write = cacheResponse(request, response);
                return 'network';
            },
            () => 'failed'
        );
    }, () => 'failed').catch(() => 'failed');

    // Registered synchronously, retaining both a late response and its write.
    event.waitUntil(verdict.then(() => write));

    const expired = new Promise((resolve) => {
        setTimeout(() => resolve('timeout'), NAV_TIMEOUT_MS);
    });

    return Promise.race([verdict, expired]).then((outcome) => {
        if (outcome === 'network') return network;
        // Failed, unbacked, rejected or too slow. Serve the cached page if
        // there is one. Without one, never serve an unverified 200 document.
        return cached().then((hit) => hit || verdict.then((result) =>
            result === 'network' ? network : Response.error()
        ));
    });
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const existed = (await caches.keys()).includes(CACHE);
        try {
            const cache = await caches.open(CACHE);
            // A worker-only update can reuse an active cache. Never overwrite
            // or delete that cache while the replacement is still installing.
            if (!existed) await cache.addAll(PRECACHE);
            const shell = await cache.match(PRECACHE[0], MATCH_OPTIONS);
            if (!shell || !isUsable(shell) || !isBackedByPrecache(
                await shell.text(), shell.url || self.registration.scope
            )) throw new Error('Invalid precached app shell');
            for (const asset of PRECACHE.slice(1)) {
                const response = await cache.match(asset, MATCH_OPTIONS);
                if (!response || !isUsable(response)) throw new Error('Missing precached app asset');
            }
        } catch (error) {
            if (!existed) await caches.delete(CACHE);
            throw error;
        }
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                // Unscoped legacy sudoku-* caches have no reliable owner. Leave
                // them intact during migration and never read from them.
                keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only GET is cacheable, and only our own origin is ours to serve.
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

    // Leaderboard traffic always goes to the network.
    if (url.pathname.includes('/api/')) return;

    if (request.mode === 'navigate') {
        event.respondWith(navigationResponse(request, event));
        return;
    }

    let write = Promise.resolve();
    const response = caches.open(CACHE).then((cache) => cache.match(request, MATCH_OPTIONS)).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
            if (isUsable(response)) write = cacheResponse(request, response);
            return response;
        });
    });
    event.waitUntil(response.then(() => write).catch(() => {}));
    event.respondWith(response);
});
