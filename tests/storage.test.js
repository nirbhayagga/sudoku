// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as store from '../storage.js';

beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe('saved game', () => {
    it('round-trips a game state', () => {
        const state = { puzzle: '0'.repeat(81), difficulty: 'easy', timerSeconds: 42 };
        expect(store.saveGameState(state)).toBe(true);
        expect(store.loadSavedGame()).toEqual(state);
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
        localStorage.setItem('sudoku_saved_game', 'not json{{{');
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
        localStorage.setItem('sudoku_stats', '{{{');
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
        store.markPlayed('easy', 'e01');
        store.markPlayed('easy', 'e02');
        expect(store.getPlayed('easy')).toEqual(['e01', 'e02']);
    });

    it('keeps difficulties separate', () => {
        store.markPlayed('easy', 'e01');
        expect(store.getPlayed('evil')).toEqual([]);
    });

    it('clears', () => {
        store.markPlayed('easy', 'e01');
        store.clearPlayed('easy');
        expect(store.getPlayed('easy')).toEqual([]);
    });

    it('recovers if the stored value is not an array', () => {
        localStorage.setItem('played_easy', '"nonsense"');
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
        expect(() => store.markPlayed('easy', 'e01')).not.toThrow();
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
        localStorage.setItem('sudoku_stats', JSON.stringify({
            easy: { played: 5, won: 5, bestTime: 90, totalTime: 600, totalHints: 2 },
        }));
        expect(store.recordWin('easy', 80, 0, true).easy.autoNotesGames).toBe(1);
    });
});
