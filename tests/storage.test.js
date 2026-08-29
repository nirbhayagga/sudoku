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

    it('accumulates mistakes', () => {
        store.recordWin('easy', 120, 0, false, new Date(), 2);
        const stats = store.recordWin('easy', 120, 0, false, new Date(), 3);
        expect(stats.easy.totalMistakes).toBe(5);
    });

    // Stats saved before the field existed have no totalMistakes.
    it('tolerates stats saved without a mistake count', () => {
        localStorage.setItem('sudoku_stats', JSON.stringify({
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
        localStorage.setItem('sudoku_stats', JSON.stringify({
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
