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
    return '';
})();

const HEALTH_TIMEOUT_MS = 2000;

let available = false;

export const isAvailable = () => available;

/**
 * Probe the API. Resolves to whether it answered; never throws, so callers can
 * simply hide their leaderboard UI on a false.
 */
export async function checkHealth() {
    try {
        const resp = await fetch(`${API_BASE}/api/health`, {
            signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
        });
        available = resp.ok;
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
        const resp = await fetch(`${API_BASE}/api/leaderboard/${encodeURIComponent(difficulty)}`);
        if (resp.ok) return await resp.json();
    } catch (e) { /* fall through to the empty list */ }
    return [];
}

/** Submit a score; null if it could not be recorded. */
export async function submitScore({ name, difficulty, time, hints, level }) {
    if (!available) return null;
    try {
        const resp = await fetch(`${API_BASE}/api/leaderboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, difficulty, time, hints, level }),
        });
        if (resp.ok) return await resp.json();
    } catch (e) { /* fall through to null */ }
    return null;
}
