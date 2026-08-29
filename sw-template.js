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
const CACHE = '__CACHE_VERSION__';
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

/**
 * The hashed assets this worker actually holds, as they appear in a document.
 *
 * PRECACHE entries are root-relative ("./assets/index.DLHzd0x1.js") while the
 * markup may name them any number of ways, so both sides are reduced to the
 * "assets/<file>" tail that the content hash makes unique anyway.
 */
const PRECACHED_ASSETS = new Set(
    PRECACHE.filter((p) => p.includes('assets/'))
        .map((p) => p.slice(p.indexOf('assets/')))
);

/**
 * Whether this worker can actually back the document it is about to serve.
 *
 * The document and its assets ship as one build but are cached as separate
 * entries, and network-first opens a seam between them: from a deploy until the
 * new worker finishes installing, the network hands back the *new* index.html
 * while this worker still holds only the *old* build's assets. Every hashed
 * filename in it then misses the cache and goes to the network — and on the
 * connection that made us race in the first place, that is a blank screen with
 * no way back.
 *
 * PRECACHE is the exact asset list of this worker's own build, so the question
 * is just whether the document names anything missing from it. If it does, the
 * build it belongs to has a worker already installing; serving the cached page
 * for one more load lets that install finish and swap document and assets
 * together, which is the only way they were ever safe to swap.
 *
 * Note this only has to cover what the *markup* names. The entry script is one
 * of those, and a cached entry script can only ever import the chunk hashes it
 * was built with — which are precached alongside it.
 */
function isBackedByPrecache(html) {
    const referenced = html.match(/assets\/[A-Za-z0-9._-]+/g) || [];
    return referenced.every((name) => PRECACHED_ASSETS.has(name));
}

/** Store a response, ignoring a cache that refuses it (opaque, over quota). */
function cacheResponse(request, response) {
    const copy = response.clone();
    caches.open(CACHE)
        .then((cache) => cache.put(request, copy))
        .catch(() => { /* the response is still served; only the copy is lost */ });
}

/**
 * Network-first with a deadline.
 *
 * The network request is never cancelled — if it lands after losing the race it
 * still refreshes the cached document, so the next launch is current.
 */
function navigationResponse(request) {
    const network = fetch(request);

    // The losing branch is deliberately left running; swallow its rejection so
    // it cannot surface as an unhandled one.
    network.catch(() => {});

    const cached = () => caches.match(request, MATCH_OPTIONS).then(
        (hit) => hit || caches.match(PRECACHE[0], MATCH_OPTIONS)
    );

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
                if (!isBackedByPrecache(html)) return 'unbacked';
                cacheResponse(request, response);
                return 'network';
            },
            // A body we cannot read is not evidence of a bad document.
            () => { cacheResponse(request, response); return 'network'; }
        );
    }, () => 'failed');

    const expired = new Promise((resolve) => {
        setTimeout(() => resolve('timeout'), NAV_TIMEOUT_MS);
    });

    return Promise.race([verdict, expired]).then((outcome) => {
        if (outcome === 'network') return network;
        // Failed, unbacked, rejected or too slow. Serve the cached page if
        // there is one; with nothing cached — a first visit — there is nothing
        // better to offer than whatever the network says, and the assets it
        // names are then fetched over the same working connection.
        return cached().then((hit) => hit || network);
    });
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(PRECACHE))
            // Take over promptly; navigations are network-first, so an outdated
            // controller cannot pin anyone to a stale build.
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Only GET is cacheable, and only our own origin is ours to serve.
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Leaderboard traffic always goes to the network.
    if (url.pathname.includes('/api/')) return;

    if (request.mode === 'navigate') {
        event.respondWith(navigationResponse(request));
        return;
    }

    event.respondWith(
        caches.match(request, MATCH_OPTIONS).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                // Only store complete, same-origin successes.
                if (isUsable(response)) cacheResponse(request, response);
                return response;
            });
        })
    );
});
