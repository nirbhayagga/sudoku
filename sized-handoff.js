import { sizedLink } from './sized-export.js';
import { validateSmallGame } from './small-state.js';

/** A bounded snapshot, without undo history. Never trusts a supplied answer. */
export function sizedGameLink(origin, state, g) {
    const game = validateSmallGame(state);
    if (!game || game.geometry !== g.key) throw new Error('This game cannot be shared.');
    const url = new URL(sizedLink(origin, state.puzzle, g));
    const snapshot = { ...game, undo: [], redo: [] };
    // Unicode-safe encoding even for an older imported game ID.
    const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
    url.searchParams.set('resume', btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''));
    return url.href;
}
export function parseSizedGameLink(search, g, puzzle) {
    try {
        const params = new URLSearchParams(search), encoded = params.get('resume');
        if (!encoded || encoded.length > 12000 || params.getAll('resume').length !== 1 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
        const raw = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'));
        const state = validateSmallGame(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(raw, c => c.charCodeAt(0)))));
        return state?.geometry === g.key && state.puzzle === puzzle ? state : null;
    } catch { return null; }
}
