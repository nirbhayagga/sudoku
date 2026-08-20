/**
 * Small formatting helpers, kept separate because they are pure and used from
 * several places (timer display, win summary, resume banner, leaderboard rows).
 */

/** Seconds as m:ss, or h:mm:ss past an hour. */
export function formatTime(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Escape a value for interpolation into innerHTML. Uses the DOM's own escaping
 * rather than a hand-rolled replace chain.
 */
export function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}
