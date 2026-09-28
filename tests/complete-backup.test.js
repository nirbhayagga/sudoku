// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { exportCompleteBackup, restoreCompleteBackup } from '../complete-backup.js';
import { exportBackup, saveSmallData, loadSmallData, AUX_KEYS } from '../storage.js';
import { SMALL_GEOMETRIES, VARIANT_GEOMETRIES } from '../geometry.js';
import { SMALL_BANK } from '../small-bank.js';
import { VARIANT_BANK } from '../variant-bank.js';
import { newSmallGame } from '../small-state.js';
import { recordPractice, practiceHistory } from '../learning-history.js';
import { prepareExercise } from '../practice.js';
import { PRACTICE_BANK } from '../practice-bank.js';

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
const seed = () => {
    for (const size of ['4', '6']) saveSmallData(size, newSmallGame(SMALL_BANK[size][0].puzzle, SMALL_GEOMETRIES[size]));
    for (const rule of ['diagonal', 'hyper']) saveSmallData(`9-${rule}`, newSmallGame(VARIANT_BANK[rule][0].puzzle, VARIANT_GEOMETRIES[rule]));
    recordPractice(prepareExercise(PRACTICE_BANK.groups['naked-pair'][0]).id, { mode: 'challenge', assisted: false });
};
it('round-trips every geometry and learning history in one document', () => {
    seed(); const backup = exportCompleteBackup(); localStorage.clear();
    expect(restoreCompleteBackup(backup)).toEqual({ success: true });
    expect(exportCompleteBackup()).toBe(backup);
    expect(Object.values(practiceHistory())[0].independent).toBe(1);
});
it('legacy personal backups leave newer games and learning history intact', () => {
    seed(); const before = loadSmallData('6'), history = practiceHistory();
    expect(restoreCompleteBackup(exportBackup()).success).toBe(true);
    expect(loadSmallData('6')).toEqual(before); expect(practiceHistory()).toEqual(history);
});
it('rejects mismatched geometry, malformed history and missing games before any writes', () => {
    seed(); const before = exportCompleteBackup();
    for (const corrupt of [b => { b.activities.games['4'] = b.activities.games['6']; }, b => { b.activities.practice = { invalid: {} }; }, b => { delete b.activities.games['9-hyper']; }]) {
        const b = JSON.parse(before); corrupt(b);
        expect(restoreCompleteBackup(JSON.stringify(b)).success).toBe(false);
        expect(exportCompleteBackup()).toBe(before);
    }
});
it('rolls all data back when writing a later game fails', () => {
    seed(); const incoming = exportCompleteBackup(); localStorage.clear(); localStorage.setItem('sudoku-player-name', 'Before');
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
        if (key === AUX_KEYS.games['9-hyper']) throw new Error('quota');
        return original.call(this, key, value);
    });
    expect(restoreCompleteBackup(incoming)).toMatchObject({ success: false, rollbackFailed: false });
    expect(localStorage.getItem('sudoku-player-name')).toBe('Before');
    expect(loadSmallData('4')).toBeNull(); expect(Object.keys(practiceHistory())).toHaveLength(0);
});
it('reports unreadable auxiliary storage instead of exporting an empty history', () => {
    for (const key of [AUX_KEYS.practice, AUX_KEYS.completed, AUX_KEYS.results]) {
        for (const corrupt of ['{invalid', '0', 'false', '""']) {
            localStorage.setItem(key, corrupt);
            expect(() => exportCompleteBackup()).toThrow();
        }
        localStorage.removeItem(key);
    }
});
