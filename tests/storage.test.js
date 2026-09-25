import { BANK_SIZES } from '../difficulties.js';
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as store from '../storage.js';
import { SudokuSolver } from '../solver.js';
import { isDifficulty } from '../difficulties.js';

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const gameState = () => ({
    puzzle, userValues: puzzle, difficulty: 'easy', timerSeconds: 42,
    notes: Array.from({ length: 81 }, () => []),
});

beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe('bank revision reset', () => {
    it('leaves previous data untouched without loading it as the new bank', () => {
        localStorage.setItem('sudoku_saved_game', JSON.stringify(gameState()));
        localStorage.setItem('sudoku_stats', JSON.stringify({ easy: { won: 3 } }));
        localStorage.setItem('played_easy', '["e01"]');
        localStorage.setItem('sudoku_daily_done', '["2026-09-24"]');
        store.setTheme('matcha'); store.setPlayerName('Player');
        expect(store.loadSavedGame()).toBeNull(); expect(store.getStats()).toEqual({});
        expect(store.getPlayed('easy')).toEqual([]); expect(store.getDailyDone()).toEqual([]);
        expect(store.getTheme()).toBe('matcha'); expect(store.getPlayerName()).toBe('Player');
        expect(localStorage.getItem('played_easy')).toBe('["e01"]');
    });
    it('rejects a personal backup from the earlier bank before writing', () => {
        store.recordStart('hard');
        const before = store.exportBackup();
        const old = JSON.parse(before); delete old.bankVersion;
        expect(store.restoreBackup(JSON.stringify(old)).success).toBe(false);
        expect(store.exportBackup()).toBe(before);
    });
});

describe('saved game', () => {
    it('round-trips a game state', () => {
        const state = gameState();
        expect(store.saveGameState(state)).toBe(true);
        expect(store.loadSavedGame()).toMatchObject(state);
    });

    it('returns null when nothing is saved', () => {
        expect(store.loadSavedGame()).toBeNull();
    });

    it('deletes a saved game', () => {
        store.saveGameState({ puzzle: 'x' });
        store.deleteSavedGame();
        expect(store.loadSavedGame()).toBeNull();
    });

    it('returns null rather than throwing on corrupt data', () => {
        localStorage.setItem('sudoku_saved_game_v2', 'not json{{{');
        expect(store.loadSavedGame()).toBeNull();
    });
});

describe('stats', () => {
    it('starts empty', () => {
        expect(store.getStats()).toEqual({});
    });

    it('records a first win', () => {
        const stats = store.recordWin('easy', 120, 2);
        expect(stats.easy).toMatchObject({ played: 1, won: 1, bestTime: 120, totalTime: 120, totalHints: 2 });
    });

    it('accumulates across games', () => {
        store.recordWin('easy', 120, 1);
        const stats = store.recordWin('easy', 200, 3);
        expect(stats.easy).toMatchObject({ played: 2, totalTime: 320, totalHints: 4 });
    });

    it('keeps the fastest time as the best', () => {
        store.recordWin('easy', 120, 0);
        expect(store.recordWin('easy', 90, 0).easy.bestTime).toBe(90);
        expect(store.recordWin('easy', 300, 0).easy.bestTime).toBe(90);
    });

    it('tracks difficulties independently', () => {
        store.recordWin('easy', 100, 0);
        store.recordWin('evil', 900, 0);
        const stats = store.getStats();
        expect(stats.easy.played).toBe(1);
        expect(stats.evil.bestTime).toBe(900);
    });

    it('accumulates mistakes', () => {
        store.recordWin('easy', 120, 0, false, new Date(), 2);
        const stats = store.recordWin('easy', 120, 0, false, new Date(), 3);
        expect(stats.easy.totalMistakes).toBe(5);
    });

    // Stats saved before the field existed have no totalMistakes.
    it('tolerates stats saved without a mistake count', () => {
        localStorage.setItem('sudoku_stats_v2', JSON.stringify({
            easy: { started: 1, played: 1, won: 1, bestTime: 50, totalTime: 50, totalHints: 0, autoNotesGames: 0 },
        }));
        expect(store.recordWin('easy', 60, 0, false, new Date(), 1).easy.totalMistakes).toBe(1);
    });

    it('persists across reads', () => {
        store.recordWin('hard', 250, 1);
        expect(store.getStats().hard.played).toBe(1);
    });

    it('resets', () => {
        store.recordWin('easy', 100, 0);
        store.resetStats();
        expect(store.getStats()).toEqual({});
    });

    it('recovers from corrupt stats', () => {
        localStorage.setItem('sudoku_stats_v2', '{{{');
        expect(store.getStats()).toEqual({});
        expect(() => store.recordWin('easy', 10, 0)).not.toThrow();
    });
});

describe('preferences', () => {
    it('falls back to a default theme', () => {
        expect(store.getTheme()).toBe('midnight');
        expect(store.getTheme('ocean')).toBe('ocean');
    });

    it('round-trips a theme', () => {
        store.setTheme('forest');
        expect(store.getTheme()).toBe('forest');
    });

    it('round-trips a player name', () => {
        expect(store.getPlayerName()).toBe('');
        store.setPlayerName('Nirb');
        expect(store.getPlayerName()).toBe('Nirb');
    });
});

describe('played tracking', () => {
    it('starts empty and accumulates', () => {
        expect(store.getPlayed('easy')).toEqual([]);
        store.markPlayed('easy', 'p0000000000000001');
        store.markPlayed('easy', 'p0000000000000002');
        expect(store.getPlayed('easy')).toEqual(['p0000000000000001', 'p0000000000000002']);
    });

    it('keeps difficulties separate', () => {
        store.markPlayed('easy', 'p0000000000000001');
        expect(store.getPlayed('evil')).toEqual([]);
    });

    it('clears', () => {
        store.markPlayed('easy', 'p0000000000000001');
        store.clearPlayed('easy');
        expect(store.getPlayed('easy')).toEqual([]);
    });

    it('recovers if the stored value is not an array', () => {
        localStorage.setItem('played_v2_easy', '"nonsense"');
        expect(store.getPlayed('easy')).toEqual([]);
    });
});

// Safari private mode, a full quota, or disabled site data all throw. A puzzle
// game must never break because of it.
describe('when storage is unavailable', () => {
    beforeEach(() => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });
    });

    it('reports a failed write instead of throwing', () => {
        expect(store.saveGameState({ puzzle: 'x' })).toBe(false);
    });

    it('returns defaults instead of throwing on read', () => {
        expect(store.loadSavedGame()).toBeNull();
        expect(store.getStats()).toEqual({});
        expect(store.getPlayed('easy')).toEqual([]);
        expect(store.getTheme()).toBe('midnight');
        expect(store.getPlayerName()).toBe('');
    });

    it('never throws from a write helper', () => {
        expect(() => store.setTheme('ocean')).not.toThrow();
        expect(() => store.setPlayerName('Nirb')).not.toThrow();
        expect(() => store.markPlayed('easy', 'p0000000000000001')).not.toThrow();
        expect(() => store.recordWin('easy', 10, 0)).not.toThrow();
    });
});

describe('auto-notes in stats', () => {
    it('counts games that used it', () => {
        store.recordWin('easy', 100, 0, true);
        expect(store.getStats().easy.autoNotesGames).toBe(1);
    });

    it('does not count games that did not', () => {
        store.recordWin('easy', 100, 0, false);
        store.recordWin('easy', 120, 0);
        expect(store.getStats().easy.autoNotesGames).toBe(0);
    });

    it('accumulates alongside plays', () => {
        store.recordWin('easy', 100, 0, true);
        store.recordWin('easy', 110, 0, false);
        store.recordWin('easy', 120, 0, true);
        const easy = store.getStats().easy;
        expect(easy.played).toBe(3);
        expect(easy.autoNotesGames).toBe(2);
    });

    it('upgrades stats saved before the field existed', () => {
        localStorage.setItem('sudoku_stats_v2', JSON.stringify({
            easy: { played: 5, won: 5, bestTime: 90, totalTime: 600, totalHints: 2 },
        }));
        expect(store.recordWin('easy', 80, 0, true).easy.autoNotesGames).toBe(1);
    });
});

describe('starts and win rate', () => {
    it('counts a start without a win', () => {
        store.recordStart('easy');
        expect(store.getStats().easy.started).toBe(1);
        expect(store.getStats().easy.won).toBe(0);
    });

    // Previously `played` only moved on a win, so the win rate was always 100%.
    it('computes a win rate from starts, not wins', () => {
        store.recordStart('easy');
        store.recordStart('easy');
        store.recordStart('easy');
        store.recordWin('easy', 100, 0);
        expect(store.getSummary().winRate).toBeCloseTo(1 / 3);
    });

    it('reports a zero win rate before anything is solved', () => {
        store.recordStart('easy');
        expect(store.getSummary().winRate).toBe(0);
    });

    it('never exceeds 100% for stats saved before starts were tracked', () => {
        localStorage.setItem('sudoku_stats_v2', JSON.stringify({
            easy: { played: 4, won: 4, bestTime: 60, totalTime: 400, totalHints: 0 },
        }));
        store.recordWin('easy', 50, 0);
        expect(store.getSummary().winRate).toBeLessThanOrEqual(1);
    });

    it('totals across difficulties', () => {
        store.recordStart('easy');
        store.recordWin('easy', 100, 1);
        store.recordStart('evil');
        store.recordWin('evil', 500, 2);
        const summary = store.getSummary();
        expect(summary.won).toBe(2);
        expect(summary.totalTime).toBe(600);
        expect(summary.totalHints).toBe(3);
    });
});

describe('daily streak', () => {
    const at = (iso) => new Date(`${iso}T12:00:00`);

    it('starts at one on a first win', () => {
        expect(store.recordWin('easy', 60, 0, false, at('2026-03-01')).easy.won).toBe(1);
        expect(store.getStreak()).toMatchObject({ current: 1, best: 1, lastWin: '2026-03-01' });
    });

    it('extends across consecutive days', () => {
        store.recordWin('easy', 60, 0, false, at('2026-03-01'));
        store.recordWin('easy', 60, 0, false, at('2026-03-02'));
        store.recordWin('easy', 60, 0, false, at('2026-03-03'));
        expect(store.getStreak().current).toBe(3);
    });

    // A streak counts days returned to, not games played.
    it('counts several wins in one day once', () => {
        store.recordWin('easy', 60, 0, false, at('2026-03-01'));
        store.recordWin('easy', 70, 0, false, at('2026-03-01'));
        store.recordWin('easy', 80, 0, false, at('2026-03-01'));
        expect(store.getStreak().current).toBe(1);
    });

    it('restarts after a missed day', () => {
        store.recordWin('easy', 60, 0, false, at('2026-03-01'));
        store.recordWin('easy', 60, 0, false, at('2026-03-02'));
        store.recordWin('easy', 60, 0, false, at('2026-03-05'));
        expect(store.getStreak().current).toBe(1);
    });

    it('remembers the best streak after one is broken', () => {
        for (const day of ['01', '02', '03', '04']) {
            store.recordWin('easy', 60, 0, false, at(`2026-03-${day}`));
        }
        store.recordWin('easy', 60, 0, false, at('2026-03-10'));
        expect(store.getStreak()).toMatchObject({ current: 1, best: 4 });
    });

    it('handles a month boundary', () => {
        store.recordWin('easy', 60, 0, false, at('2026-03-31'));
        store.recordWin('easy', 60, 0, false, at('2026-04-01'));
        expect(store.getStreak().current).toBe(2);
    });

    it('is cleared by a stats reset', () => {
        store.recordWin('easy', 60, 0, false, at('2026-03-01'));
        store.resetStats();
        expect(store.getStreak()).toMatchObject({ current: 0, best: 0 });
    });
});

describe('dayKey', () => {
    it('formats a local calendar day', () => {
        expect(store.dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    });

    it('pads months and days', () => {
        expect(store.dayKey(new Date(2026, 8, 9))).toBe('2026-09-09');
    });
});

describe('untrusted personal data', () => {
    it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty', '<b>evil</b>'])('rejects difficulty %s at every storage boundary', difficulty => {
        expect(isDifficulty(difficulty)).toBe(false);
        expect(store.recordStart(difficulty)).toEqual({});
        expect(store.recordWin(difficulty, 10, 0)).toEqual({});
        expect(store.markPlayed(difficulty, 'p0000000000000001')).toEqual([]);
        store.clearPlayed(difficulty);
        expect(store.getPlayed(difficulty)).toEqual([]);
        expect(store.saveGameState({ ...gameState(), difficulty })).toBe(false);
        expect(localStorage.length).toBe(0);
        expect(Object.prototype).not.toHaveProperty('started');
    });

    it('normalizes stats and drops unexpected keys without poisoning prototypes', () => {
        localStorage.setItem('sudoku_stats_v2', '{"__proto__":{"started":8},"constructor":{"won":9},"easy":{"won":2,"totalTime":"oops","totalHints":-4},"evil":null}');
        expect(store.getStats()).toEqual({ easy: {
            started: 2, played: 0, won: 2, bestTime: null, totalTime: 0,
            totalHints: 0, totalMistakes: 0, autoNotesGames: 0,
        } });
        expect(store.getSummary().won).toBe(2);
        expect(store.recordStart('easy').easy.started).toBe(3);
    });

    it('normalizes malformed streaks, daily dates and played ids', () => {
        localStorage.setItem('sudoku_streak', '{"current":"oops","best":-5,"lastWin":"2026-02-30"}');
        expect(store.getStreak()).toEqual({ current: 0, best: 0, lastWin: null });
        localStorage.setItem('sudoku_daily_done_v2', '["2026-02-30","2024-02-29","2024-02-29",null,{}]');
        expect(store.getDailyDone()).toEqual(['2024-02-29']);
        expect(store.markDailyDone('2026-02-29')).toEqual(['2024-02-29']);
        localStorage.setItem('played_v2_easy', '["p0000000000000001","p0000000000000001","p0000000000000500","e501","v01","__proto__",1,{}]');
        expect(store.getPlayed('easy')).toEqual(['p0000000000000001', 'p0000000000000500']);
        expect(store.markPlayed('easy', 'p0000000000000001')).toEqual(['p0000000000000001', 'p0000000000000500']);
    });

    it('keeps counters safe at their upper bound', () => {
        store.saveStats({ easy: { started: Number.MAX_SAFE_INTEGER, totalTime: Number.MAX_SAFE_INTEGER } });
        store.recordStart('easy');
        store.recordWin('easy', 3, 0);
        expect(store.getStats().easy.started).toBe(Number.MAX_SAFE_INTEGER);
        expect(store.getStats().easy.totalTime).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('clears a theme for system mode without affecting other settings', () => {
        store.setTheme('forest');
        store.setPlayerName('Nirb');
        store.clearTheme();
        expect(store.getTheme(null)).toBeNull();
        expect(store.getPlayerName()).toBe('Nirb');
        store.setTheme('constructor');
        expect(store.getTheme(null)).toBeNull();
    });
});

describe('saved game validation', () => {
    const load = state => {
        localStorage.setItem('sudoku_saved_game_v2', JSON.stringify(state));
        return store.loadSavedGame();
    };

    it('repairs the solution and preserves valid old fields', () => {
        const state = { ...gameState(), timestamp: 1234, level: 4, solution: '1'.repeat(81) };
        const restored = load(state);
        expect(restored).toMatchObject({ ...gameState(), timestamp: 1234, level: 4, mistakes: 0, autoNotesUsed: false });
        expect(SudokuSolver.validateSolution(restored.solution)).toBe(true);
        expect(restored.lockedCells[0]).toBe(true);
        expect(restored.lockedCells[2]).toBe(false);
    });

    it('upgrades a pre-notes save without dropping progress or timestamps', () => {
        const old = gameState();
        delete old.notes;
        old.userValues = puzzle.slice(0, 2) + '4' + puzzle.slice(3);
        old.timestamp = 12345;
        const restored = load(old);
        expect(restored).toMatchObject(old);
        expect(restored.notes).toEqual(Array.from({ length: 81 }, () => []));
        expect(restored.lockedCells[2]).toBe(false);
        expect(restored.autoNotes).toBe(false);
        expect(restored.mistakes).toBe(0);
        expect(load({ ...old, notes: null })).toBeNull();
    });

    it.each([82, Number.MAX_SAFE_INTEGER])('preserves cumulative hint counts of %s', hintsUsed => {
        const state = { ...gameState(), hintsUsed };
        expect(store.saveGameState(state)).toBe(true);
        expect(store.loadSavedGame().hintsUsed).toBe(hintsUsed);
        expect(store.restoreBackup(store.exportBackup()).success).toBe(true);
        expect(store.loadSavedGame().hintsUsed).toBe(hintsUsed);
    });

    it('does not recompute solutions on move saves', () => {
        const solve = vi.spyOn(SudokuSolver, 'solveSudoku');
        expect(store.saveGameState(gameState())).toBe(true);
        expect(solve).not.toHaveBeenCalled();
        expect(store.loadSavedGame()).not.toBeNull();
        expect(solve).toHaveBeenCalledTimes(1);
    });

    it.each([
        null, [], 42, {},
        { ...gameState(), puzzle: '1'.repeat(81), userValues: '1'.repeat(81) },
        { ...gameState(), userValues: '0'.repeat(81) },
        { ...gameState(), notes: [] },
        { ...gameState(), notes: Array(81).fill(['<b>']) },
        { ...gameState(), notes: Array(81).fill(['1', '1']) },
        { ...gameState(), hintCells: Array(81).fill(0) },
        { ...gameState(), lockedCells: Array(81).fill(false) },
        { ...gameState(), timerSeconds: -1 },
        { ...gameState(), timerSeconds: Number.MAX_SAFE_INTEGER + 1 },
        { ...gameState(), mistakes: '2' },
        { ...gameState(), autoNotes: 1 },
        { ...gameState(), level: BANK_SIZES.easy + 1 },
        { ...gameState(), daily: '2026-04-31' },
    ])('rejects malformed save %#', state => {
        expect(load(state)).toBeNull();
    });

    it('rejects incorrect hints but allows mistakes in editable cells', () => {
        const wrong = { ...gameState(), userValues: puzzle.slice(0, 2) + '1' + puzzle.slice(3) };
        expect(load(wrong)).not.toBeNull();
        expect(load({ ...wrong, hintsUsed: 1, hintCells: Array.from({ length: 81 }, (_, i) => i === 2) })).toBeNull();
    });
});

describe('personal backup API', () => {
    const seed = () => {
        store.recordStart('easy');
        store.recordWin('easy', 80, 1, true, new Date(2026, 8, 19), 2);
        store.setTheme('forest');
        store.setPlayerName('Nirb');
        store.markPlayed('easy', 'p0000000000000001');
        store.markDailyDone('2026-09-19');
        store.saveGameState(gameState());
    };
    const snapshot = () => Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]));

    it('round-trips all personal data and a validated saved game', () => {
        seed();
        const backup = store.exportBackup();
        expect(typeof backup).toBe('string');
        localStorage.clear();
        localStorage.setItem('unrelated', 'keep');
        expect(store.restoreBackup(backup)).toEqual({ success: true });
        expect(store.exportBackup()).toEqual(backup);
        expect(localStorage.getItem('unrelated')).toBe('keep');
    });

    it('can omit a game, and distinguishes omission from an explicit clear', () => {
        seed();
        const backup = store.exportBackup({ includeSavedGame: false });
        const original = localStorage.getItem('sudoku_saved_game_v2');
        expect(store.restoreBackup(backup).success).toBe(true);
        expect(localStorage.getItem('sudoku_saved_game_v2')).toBe(original);
        const parsed = JSON.parse(backup);
        parsed.savedGame = null;
        parsed.settings.theme = null;
        expect(store.restoreBackup(JSON.stringify(parsed)).success).toBe(true);
        expect(store.loadSavedGame()).toBeNull();
        expect(store.getTheme(null)).toBeNull();
    });

    it.each([
        data => { data.version = 2; },
        data => { data.stats = { constructor: { started: 5 } }; },
        data => { data.settings.theme = '__proto__'; },
        data => { data.settings.playerName = 42; },
        data => { data.played.easy = ['__proto__']; },
        data => { data.streak.current = -1; },
        data => { data.dailyDone = ['2026-02-30']; },
        data => { data.savedGame.userValues = '0'.repeat(81); },
    ])('validates the whole backup before any writes %#', corrupt => {
        seed();
        const backup = JSON.parse(store.exportBackup());
        corrupt(backup);
        const before = snapshot();
        const write = vi.spyOn(Storage.prototype, 'setItem');
        const remove = vi.spyOn(Storage.prototype, 'removeItem');
        expect(store.restoreBackup(JSON.stringify(backup)).success).toBe(false);
        expect(write).not.toHaveBeenCalled();
        expect(remove).not.toHaveBeenCalled();
        expect(snapshot()).toEqual(before);
    });

    it('rejects malformed JSON and missing required sections', () => {
        expect(store.restoreBackup('{{').success).toBe(false);
        expect(store.restoreBackup('{}').success).toBe(false);
        expect(store.restoreBackup(null).success).toBe(false);
        expect(store.restoreBackup('{"format":"sudoku-backup","version":1}').success).toBe(false);
    });

    it('restores the old data after a partial write fails', () => {
        seed();
        const backup = store.exportBackup();
        localStorage.clear();
        store.setTheme('dark');
        const before = snapshot();
        const setItem = Storage.prototype.setItem;
        let calls = 0;
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
            if (++calls === 5) throw new Error('quota');
            return setItem.call(this, key, value);
        });
        expect(store.restoreBackup(backup)).toMatchObject({ success: false, rollbackFailed: false });
        expect(snapshot()).toEqual(before);
    });

    it('reports rollback failure explicitly', () => {
        seed();
        const backup = store.exportBackup();
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
        expect(store.restoreBackup(backup)).toMatchObject({ success: false, rollbackFailed: true });
    });

    it('reports unreadable storage rather than exporting an empty backup', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
        expect(() => store.exportBackup()).toThrow();
    });

    it('reports a settings-only read failure instead of silently defaulting it', () => {
        seed();
        const getItem = Storage.prototype.getItem;
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
            if (key === 'sudoku-theme') throw new Error('denied');
            return getItem.call(this, key);
        });
        expect(() => store.exportBackup()).toThrow();
    });

    it('does not write when the rollback snapshot cannot be read', () => {
        seed();
        const backup = store.exportBackup();
        const write = vi.spyOn(Storage.prototype, 'setItem');
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
        expect(store.restoreBackup(backup).success).toBe(false);
        expect(write).not.toHaveBeenCalled();
    });

    it('can recover personal data while excluding a corrupt save', () => {
        seed();
        localStorage.setItem('sudoku_saved_game_v2', '{}');
        expect(() => store.exportBackup()).toThrow();
        expect(typeof store.exportBackup({ includeSavedGame: false })).toBe('string');
    });
});
