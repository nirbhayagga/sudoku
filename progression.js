/** Content identities, rather than display levels, survive bank insertions. */
export const PROGRESSION_TRACKS = Object.freeze(['9', '4', '6', '9-diagonal', '9-hyper']);
export function validProgressId(track, id) {
    return typeof id === 'string' && (track === '9' ? /^p[0-9a-f]{16}$/.test(id)
        : ['4', '6', '9-diagonal', '9-hyper'].includes(track) && new RegExp(`^${track}-[0-9a-f]{16}$`).test(id));
}
export function normalizeProgress(raw) {
    return Object.fromEntries(PROGRESSION_TRACKS.map(track => [track,
        Array.isArray(raw?.[track]) ? [...new Set(raw[track].filter(id => validProgressId(track, id)))].slice(0, 20000) : [],
    ]));
}
/** First unfinished puzzle in the documented order; no clock-based advance. */
export function progressionPosition(items, completed) {
    const done = new Set(completed);
    const nextIndex = items.findIndex(item => !done.has(item.id));
    return { next: nextIndex < 0 ? null : items[nextIndex], nextIndex,
        completed: items.filter(item => done.has(item.id)).length, total: items.length };
}
