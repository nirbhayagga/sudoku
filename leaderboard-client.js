/**
 * Client for the optional leaderboard API.
 *
 * The backend is genuinely optional — the app is often opened with nothing
 * behind it — so every call fails soft and reports "unavailable" rather than
 * throwing. Once `checkHealth()` has come back negative, later calls short
 * circuit instead of retrying a host that is not there.
 */

/**
 * Where the API lives, in priority order:
 *   1. window.SUDOKU_API_BASE — injected at build time from $SUDOKU_API_BASE,
 *      so a static deployment (Pages, Netlify, S3) can reach a leaderboard
 *      hosted elsewhere. Needs a matching CORS_ORIGIN on the API.
 *   2. file:// — a local dev leaderboard on the default port.
 *   3. Same origin — the Docker setup, where nginx proxies /api/.
 */
export const API_BASE = (() => {
    if (typeof window.SUDOKU_API_BASE === 'string') {
        return window.SUDOKU_API_BASE.replace(/\/$/, '');
    }
    if (window.location.protocol === 'file:') return 'http://localhost:3001';

    // Same origin, but relative to the page rather than the domain root: a
    // project site served from /sudoku/ must probe /sudoku/api/, and an
    // absolute /api/ would miss a proxy mounted alongside the app.
    return new URL('.', window.location.href).href.replace(/\/$/, '');
})();

const REQUEST_TIMEOUT_MS = 2000;

// Cover both response headers and JSON body consumption, and release the timer.
async function requestJSON(url, options = {}) {
    const controller = new AbortController();
    let timer;
    try {
        return await Promise.race([
            (async () => {
                const response = await fetch(url, { ...options, signal: controller.signal });
                if (!response.ok) throw new Error('Leaderboard request failed');
                return await response.json();
            })(),
            new Promise((resolve, reject) => {
                timer = setTimeout(() => {
                    controller.abort();
                    reject(new Error('Leaderboard request timed out'));
                }, REQUEST_TIMEOUT_MS);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

let available = false;

export const isAvailable = () => available;

/**
 * Probe the API. Resolves to whether it answered; never throws, so callers can
 * simply hide their leaderboard UI on a false.
 */
export async function checkHealth() {
    try {
        const body = await requestJSON(`${API_BASE}/api/health`);
        available = body !== null && typeof body === 'object' && !Array.isArray(body) && body.status === 'ok';
    } catch (e) {
        // No backend, no network, or no fetch at all (file://, jsdom).
        available = false;
    }
    return available;
}

/** Top scores for a difficulty; an empty list if the API is unreachable. */
export async function fetchLeaderboard(difficulty) {
    if (!available) return [];
    try {
        const body = await requestJSON(`${API_BASE}/api/leaderboard/${encodeURIComponent(difficulty)}`);
        return Array.isArray(body) ? body : [];
    } catch (e) { /* fall through to the empty list */ }
    return [];
}

/** Submit a score; null on failure. Success may be unranked (ranked: false, rank: null). */
export async function submitScore({ name, difficulty, time, hints, level, mistakes, autoNotes }) {
    if (!available) return null;
    try {
        const body = await requestJSON(`${API_BASE}/api/leaderboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, difficulty, time, hints, level, mistakes, autoNotes }),
        });
        if (body?.success === true && (Number.isInteger(body.rank) && body.rank > 0
            || body.ranked === false && body.rank === null)) return body;
    } catch (e) { /* fall through to null */ }
    return null;
}
