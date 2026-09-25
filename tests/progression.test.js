// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { progressionPosition, normalizeProgress } from '../progression.js';
import { getProgression, recordProgression, exportBackup, restoreBackup, validateGameState, restoreSmallBackup, loadSmallData, saveSmallData } from '../storage.js';
import { SMALL_GEOMETRIES } from '../geometry.js';
import { newSmallGame } from '../small-state.js';
import { PUZZLES, ALL_PUZZLES } from '../puzzle-bank.js';
import { SMALL_BANK } from '../small-bank.js';
import { gameLink, parseGameLink } from '../share.js';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
describe('content-identity progression', () => {
    it('keeps sizes separate, records each identity once, and rejects malformed IDs', () => {
        const id = PUZZLES.easy[0].id;
        recordProgression(9, id); recordProgression(9, id);
        expect(recordProgression(4, id)).toBe(false);
        recordProgression(4, SMALL_BANK[4][0].id);
        expect(getProgression()).toEqual({ 9: [id], 4: [SMALL_BANK[4][0].id], 6: [], '9-diagonal': [], '9-hyper': [] });
        expect(normalizeProgress({ 9: [null, {}, '<script>', id, id] })['9']).toEqual([id]);
    });
    it('finds the next unfinished identity after insertions, tier boundaries and full completion', () => {
        const done = PUZZLES.easy.map(p => p.id);
        expect(progressionPosition(ALL_PUZZLES, done).next.id).toBe(PUZZLES.medium[0].id);
        const items = PUZZLES.easy.slice(0, 3);
        expect(progressionPosition([items[2], ...items.slice(0, 2)], [items[0].id]).next).toEqual(items[2]);
        expect(progressionPosition(items, items.map(p => p.id))).toMatchObject({ next: null, completed: 3 });
    });
    it('round-trips progress in personal backups, preserves it on legacy restore, rejects tampering atomically', () => {
        recordProgression(9, PUZZLES.easy[0].id);
        const backup = exportBackup();
        localStorage.clear();
        expect(restoreBackup(backup).success).toBe(true);
        expect(getProgression()['9']).toEqual([PUZZLES.easy[0].id]);
        const old = JSON.parse(backup); delete old.progression;
        recordProgression(6, SMALL_BANK[6][0].id);
        expect(restoreBackup(JSON.stringify(old)).success).toBe(true);
        expect(getProgression()['6']).toHaveLength(1);
        const corrupt = JSON.parse(backup); corrupt.progression['4'] = ['invalid'];
        const before = exportBackup();
        expect(restoreBackup(JSON.stringify(corrupt)).success).toBe(false);
        expect(exportBackup()).toBe(before);
    });
    it('preserves the game activity on resume links without granting a path to daily or imported puzzles', () => {
        const puzzle = PUZZLES.easy[0].puzzle;
        const state = { puzzle, userValues: puzzle, difficulty: 'easy', progression: true };
        expect(parseGameLink(new URL(gameLink('https://example.test', state)).search).progression).toBe(true);
        expect(parseGameLink(new URL(gameLink('https://example.test', state)).search + '&rule=hyper')).toBeNull();
        expect(validateGameState({ ...state, daily: '2026-09-25' })).toBeNull();
        expect(validateGameState({ ...state, difficulty: 'imported' })).toBeNull();
        expect(validateGameState({ ...state, progression: 'true' })).toBeNull();
    });
    it('restores a small path with its game, keeps legacy paths, and rolls back failed writes', () => {
        const first = newSmallGame(SMALL_BANK[4][0].puzzle, SMALL_GEOMETRIES[4]);
        const next = newSmallGame(SMALL_BANK[4][1].puzzle, SMALL_GEOMETRIES[4]);
        const done = SMALL_BANK[4][0].id;
        saveSmallData(4, first);
        expect(restoreSmallBackup(4, next, [SMALL_BANK[6][0].id])).toBe(false);
        expect(loadSmallData(4)).toEqual(first);
        expect(restoreSmallBackup(4, next, [done])).toBe(true);
        expect(loadSmallData(4)).toEqual(next);
        expect(getProgression()['4']).toEqual([done]);
        expect(restoreSmallBackup(4, first)).toBe(true);
        expect(getProgression()['4']).toEqual([done]);
        const set = Storage.prototype.setItem;
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
            if (key === 'sudoku_progression_v1' && JSON.parse(value)['4'].length === 0) throw new Error('quota');
            return set.call(this, key, value);
        });
        expect(restoreSmallBackup(4, next, [])).toBe(false);
        expect(loadSmallData(4)).toEqual(first);
        expect(getProgression()['4']).toEqual([done]);
    });
});
