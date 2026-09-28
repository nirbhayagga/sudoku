// Loaded on demand: validating other rule sets must not inflate startup.
import { exportBackup, backupWrites, applyStorageWrites, AUX_KEYS, readAuxiliary } from './storage.js';
import { validateSmallGame } from './small-state.js';
import { validatePracticeHistory } from './learning-history.js';

export function validateModeResults(raw) {
    if (raw === null) return {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length > 10000) return null;
    const results = {};
    for (const [id, r] of Object.entries(raw)) {
        if (!/^(?:[46]|9-(?:diagonal|hyper))-[a-f0-9]{16}$/.test(id) || !r ||
            !Number.isSafeInteger(r.elapsedMs) || r.elapsedMs < 0 || r.elapsedMs > 31536000000 ||
            !Number.isInteger(r.hints) || r.hints < 0 || r.hints > 100000 ||
            ![true, false, null].includes(r.generatedNotesUsed)) return null;
        results[id] = { elapsedMs: r.elapsedMs, hints: r.hints, generatedNotesUsed: r.generatedNotesUsed };
    }
    return results;
}
function auxiliaryWrites(data) {
    if (!data || !data.games || Object.keys(data.games).length !== 4) throw new Error('Missing saved boards.');
    const writes = [];
    for (const [track, key] of Object.entries(AUX_KEYS.games)) {
        const raw = data.games[track], game = raw === null ? null : validateSmallGame(raw);
        const geometry = { '4': '4:2x2', '6': '6:2x3', '9-diagonal': '9:3x3:diagonal', '9-hyper': '9:3x3:hyper' }[track];
        if (raw !== null && (!game || game.geometry !== geometry)) throw new Error(`Invalid saved board: ${track}.`);
        writes.push([key, game === null ? null : JSON.stringify(game)]);
    }
    const completed = data.completed;
    if (!Array.isArray(completed) || completed.length > 10000 || new Set(completed).size !== completed.length ||
        !completed.every(id => typeof id === 'string' && /^(?:[46]|9-(?:diagonal|hyper))-[a-f0-9]{16}$/.test(id))) throw new Error('Invalid completion history.');
    const practice = validatePracticeHistory(data.practice), results = validateModeResults(data.results);
    if (!practice || !results) throw new Error('Invalid learning or result history.');
    return [...writes, [AUX_KEYS.completed, JSON.stringify(completed)], [AUX_KEYS.practice, JSON.stringify(practice)], [AUX_KEYS.results, JSON.stringify(results)]];
}
export function exportCompleteBackup() {
    const backup = JSON.parse(exportBackup());
    const read = key => readAuxiliary(key, { strict: true });
    const activities = { games: Object.fromEntries(Object.entries(AUX_KEYS.games).map(([t, k]) => [t, read(k)])),
        completed: read(AUX_KEYS.completed) ?? [], practice: read(AUX_KEYS.practice) ?? {}, results: read(AUX_KEYS.results) ?? {} };
    auxiliaryWrites(activities);
    return JSON.stringify({ ...backup, version: 2, activities }, null, 2);
}
export function restoreCompleteBackup(raw) {
    try {
        if (typeof raw !== 'string' || raw.length > 4 * 1024 * 1024) throw new Error('Backup is too large or is not JSON text.');
        const backup = JSON.parse(raw);
        if (![1, 2].includes(backup?.version)) throw new Error('Unsupported backup version.');
        const writes = backupWrites(JSON.stringify({ ...backup, version: 1 }));
        if (backup.version === 2) writes.push(...auxiliaryWrites(backup.activities));
        return applyStorageWrites(writes);
    } catch (error) { return { success: false, error: error instanceof SyntaxError ? 'Invalid backup JSON.' : error.message }; }
}
