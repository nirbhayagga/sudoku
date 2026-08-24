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
 * Network-first with a deadline.
 *
 * The network request is never cancelled — if it lands after losing the race it
 * still refreshes the cached document, so the next launch is current.
 */
function navigationResponse(request) {
    const network = fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
    });

    // The losing branch is deliberately left running; swallow its rejection so
    // it cannot surface as an unhandled one.
    network.catch(() => {});

    const cached = () => caches.match(request, MATCH_OPTIONS).then(
        (hit) => hit || caches.match(PRECACHE[0], MATCH_OPTIONS)
    );

    const settled = network.then(() => 'network', () => 'failed');
    const expired = new Promise((resolve) => {
        setTimeout(() => resolve('timeout'), NAV_TIMEOUT_MS);
    });

    return Promise.race([settled, expired]).then((outcome) => {
        if (outcome === 'network') return network;
        // Failed or too slow. Serve the cached page if there is one; with
        // nothing cached there is nothing better to wait for than the network,
        // whose rejection is then the honest answer.
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
                if (response.ok && response.type === 'basic') {
                    const copy = response.clone();
                    caches.open(CACHE).then((cache) => cache.put(request, copy));
                }
                return response;
            });
        })
    );
});
