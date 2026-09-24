// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseShareLink, bankLink, puzzleLink, dailyLink, copyToClipboard, gameLink, parseGameLink } from '../share.js';
import { BANK_SIZES } from '../difficulties.js';

const ORIGIN = 'https://sudoku.example.com/';

describe('parseShareLink', () => {
    it('returns null with no parameters', () => {
        expect(parseShareLink('')).toBeNull();
        expect(parseShareLink('?other=1')).toBeNull();
    });

    describe('bank links', () => {
        it('reads a difficulty and level', () => {
            expect(parseShareLink('?d=evil&level=42')).toEqual({
                kind: 'bank', difficulty: 'evil', level: 42,
            });
        });

        it('accepts a difficulty without a level', () => {
            expect(parseShareLink('?d=hard')).toEqual({
                kind: 'bank', difficulty: 'hard', level: null,
            });
        });

        it('ignores a level outside the bank', () => {
            expect(parseShareLink(`?d=easy&level=${BANK_SIZES.easy + 1}`).level).toBeNull();
            expect(parseShareLink('?d=easy&level=0').level).toBeNull();
            expect(parseShareLink('?d=easy&level=-5').level).toBeNull();
        });

        it('ignores a non-integer level', () => {
            expect(parseShareLink('?d=easy&level=abc').level).toBeNull();
            expect(parseShareLink('?d=easy&level=1.5').level).toBeNull();
        });

        it('rejects an unknown difficulty', () => {
            expect(parseShareLink('?d=impossible&level=1')).toBeNull();
        });
    });

    describe('raw puzzle links', () => {
        const board = '5'.padEnd(81, '0');

        it('reads an 81-digit board', () => {
            expect(parseShareLink(`?p=${board}`)).toEqual({ kind: 'puzzle', puzzle: board });
        });

        it('accepts dots for empty cells', () => {
            const dotted = '5'.padEnd(81, '.');
            expect(parseShareLink(`?p=${dotted}`).puzzle).toBe(board);
        });

        it('rejects a board of the wrong length', () => {
            expect(parseShareLink('?p=123')).toBeNull();
            expect(parseShareLink(`?p=${'0'.repeat(82)}`)).toBeNull();
        });

        it('rejects a board with letters', () => {
            expect(parseShareLink(`?p=${'a'.repeat(81)}`)).toBeNull();
        });
    });

    describe('daily links', () => {
        it('reads a date', () => {
            expect(parseShareLink('?daily=2026-08-20')).toEqual({
                kind: 'daily', dayKey: '2026-08-20',
            });
        });

        it('rejects a malformed date', () => {
            expect(parseShareLink('?daily=tomorrow')).toBeNull();
            expect(parseShareLink('?daily=2026-8-2')).toBeNull();
        });
    });

    it('prefers a daily link over the others', () => {
        expect(parseShareLink('?daily=2026-08-20&d=evil&level=1').kind).toBe('daily');
    });
});

describe('link building', () => {
    it('builds a bank link', () => {
        expect(bankLink(ORIGIN, 'evil', 42)).toBe('https://sudoku.example.com/?d=evil&level=42');
    });

    it('omits a missing level', () => {
        expect(bankLink(ORIGIN, 'hard', null)).toBe('https://sudoku.example.com/?d=hard');
    });

    it('builds a puzzle link', () => {
        const board = '5'.padEnd(81, '0');
        expect(puzzleLink(ORIGIN, board)).toBe(`https://sudoku.example.com/?p=${board}`);
    });

    it('builds a daily link', () => {
        expect(dailyLink(ORIGIN, '2026-08-20')).toBe('https://sudoku.example.com/?daily=2026-08-20');
    });

    // Sharing from a page already carrying a link must not stack parameters.
    it('replaces existing query parameters', () => {
        const from = 'https://sudoku.example.com/?d=easy&level=9';
        expect(bankLink(from, 'evil', 3)).toBe('https://sudoku.example.com/?d=evil&level=3');
    });

    it('preserves a subpath, as GitHub Pages needs', () => {
        expect(bankLink('https://me.github.io/sudoku/', 'easy', 1))
            .toBe('https://me.github.io/sudoku/?d=easy&level=1');
    });
});

describe('round trip', () => {
    it('parses back what it builds', () => {
        expect(parseShareLink(new URL(bankLink(ORIGIN, 'expert', 7)).search))
            .toEqual({ kind: 'bank', difficulty: 'expert', level: 7 });

        const board = '9'.padEnd(81, '0');
        expect(parseShareLink(new URL(puzzleLink(ORIGIN, board)).search))
            .toEqual({ kind: 'puzzle', puzzle: board });

        expect(parseShareLink(new URL(dailyLink(ORIGIN, '2026-08-20')).search))
            .toEqual({ kind: 'daily', dayKey: '2026-08-20' });
    });
});

describe('copyToClipboard', () => {
    // file:// and insecure origins have no clipboard, so callers need a
    // visible fallback rather than a silent failure.
    it('reports failure when the clipboard is unavailable', async () => {
        expect(await copyToClipboard('text')).toBe(false);
    });

    it('reports success when the write goes through', async () => {
        const writes = [];
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: async (t) => writes.push(t) },
            configurable: true,
        });

        expect(await copyToClipboard('a-link')).toBe(true);
        expect(writes).toEqual(['a-link']);
    });

    it('reports failure when the write is refused', async () => {
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: async () => { throw new Error('denied'); } },
            configurable: true,
        });
        expect(await copyToClipboard('a-link')).toBe(false);
    });
});

describe('game links', () => {
    const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
    const state = () => ({
        puzzle,
        userValues: puzzle.replace(/0/, '4'),
        notes: Array.from({ length: 81 }, (_, i) => (i === 2 ? ['1', '2', '9'] : i === 80 ? ['7'] : [])),
        hintCells: Array.from({ length: 81 }, (_, i) => i === 2),
        timerSeconds: 754,
        hintsUsed: 1,
        mistakes: 2,
        difficulty: 'hard',
        level: 42,
        daily: null,
        autoNotes: true,
        autoNotesUsed: true,
    });

    it('round-trips the whole save state', () => {
        const link = gameLink('https://sudoku.example.com/play/', state());
        const parsed = parseGameLink(new URL(link).search);
        expect(parsed).toMatchObject({
            puzzle,
            userValues: state().userValues,
            timerSeconds: 754,
            hintsUsed: 1,
            mistakes: 2,
            difficulty: 'hard',
            level: 42,
            daily: null,
            autoNotes: true,
            autoNotesUsed: true,
        });
        expect(parsed.notes[2]).toEqual(['1', '2', '9']);
        expect(parsed.notes[80]).toEqual(['7']);
        expect(parsed.notes[5]).toEqual([]);
        expect(parsed.hintCells[2]).toBe(true);
        expect(parsed.hintCells.filter(Boolean)).toHaveLength(1);
        // Locked is givens plus revealed hints — what the app needs to rebuild.
        expect(parsed.lockedCells[2]).toBe(true);
        expect(parsed.lockedCells[0]).toBe(true);
        expect(parsed.lockedCells[3]).toBe(false);
    });

    it('carries a daily key', () => {
        const link = gameLink('https://sudoku.example.com/', { ...state(), daily: '2026-08-29', level: null });
        expect(parseGameLink(new URL(link).search).daily).toBe('2026-08-29');
    });

    it('stays short enough to paste anywhere', () => {
        expect(gameLink('https://sudoku.example.com/', state()).length).toBeLessThan(500);
    });

    it('replaces any existing query so links cannot stack', () => {
        const link = gameLink('https://sudoku.example.com/?d=evil&level=3', state());
        expect(new URL(link).searchParams.get('d')).toBeNull();
    });

    // The puzzle-link parser must not read a game link as a bank puzzle.
    it('is invisible to parseShareLink', () => {
        const link = gameLink('https://sudoku.example.com/', state());
        expect(parseShareLink(new URL(link).search)).toBeNull();
    });

    it('rejects anything malformed rather than half-loading it', () => {
        const good = new URL(gameLink('https://sudoku.example.com/', state())).searchParams;
        const tweak = (key, value) => {
            const p = new URLSearchParams(good);
            if (value === null) p.delete(key); else p.set(key, value);
            return `?${p}`;
        };
        expect(parseGameLink('')).toBeNull();
        expect(parseGameLink(tweak('g', '2'))).toBeNull();
        expect(parseGameLink(tweak('b', 'x'.repeat(81)))).toBeNull();
        expect(parseGameLink(tweak('v', null))).toBeNull();
        // A given changed is a different puzzle, not this game.
        expect(parseGameLink(tweak('v', '9' + good.get('v').slice(1)))).toBeNull();
        expect(parseGameLink(tweak('x', 'insane'))).toBeNull();
        expect(parseGameLink(tweak('l', '999999'))).toBeNull();
        expect(parseGameLink(tweak('t', '-5'))).toBeNull();
        expect(parseGameLink(tweak('t', '9007199254740992'))).toBeNull();
        expect(parseGameLink(tweak('k', '9007199254740992'))).toBeNull();
        expect(parseGameLink(tweak('n', 'not-base64!'))).toBeNull();
        expect(parseGameLink(tweak('n', 'AAAA'))).toBeNull();
        expect(parseGameLink(tweak('day', '29/08/2026'))).toBeNull();
        expect(parseGameLink(tweak('n', null))).not.toBeNull();
    });
});

describe('untrusted share inputs', () => {
    it.each(['constructor', '__proto__', 'toString'])('rejects inherited difficulty %s', difficulty => {
        expect(parseShareLink(`?d=${difficulty}&level=1`)).toBeNull();
        expect(() => bankLink(ORIGIN, difficulty, 1)).toThrow(TypeError);
        expect(parseGameLink(`?g=1&x=${difficulty}&b=${'0'.repeat(81)}&v=${'0'.repeat(81)}`)).toBeNull();
    });

    it.each(['2026-02-29', '2026-04-31', '1900-02-29', '2026-00-10', '2026-01-00', '0000-01-01'])('rejects impossible date %s', day => {
        expect(parseShareLink(`?daily=${day}`)).toBeNull();
        expect(() => dailyLink(ORIGIN, day)).toThrow(TypeError);
    });

    it('accepts actual leap days', () => {
        expect(parseShareLink('?daily=2000-02-29')).toEqual({ kind: 'daily', dayKey: '2000-02-29' });
    });

    const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
    const state = () => ({
        puzzle, userValues: puzzle, difficulty: 'easy', notes: Array.from({ length: 81 }, () => []),
        timerSeconds: 86401, mistakes: 1000,
    });

    it.each([82, 86401, 99999999, Number.MAX_SAFE_INTEGER])('round-trips safe large time/mistake/hint counters %s', value => {
        const parsed = parseGameLink(new URL(gameLink(ORIGIN, { ...state(), timerSeconds: value, mistakes: value, hintsUsed: value })).search);
        expect(parsed).toMatchObject({ timerSeconds: value, mistakes: value, hintsUsed: value });
    });

    it('refuses to build links that cannot be resumed', () => {
        for (const invalid of [
            { ...state(), timerSeconds: -1 }, { ...state(), mistakes: Number.MAX_SAFE_INTEGER + 1 },
            { ...state(), difficulty: '__proto__' }, { ...state(), userValues: '0'.repeat(81) },
            { ...state(), puzzle: '1'.repeat(81), userValues: '1'.repeat(81) },
        ]) expect(() => gameLink(ORIGIN, invalid)).toThrow(TypeError);
    });

    it('rejects bad flags, dates, duplicate parameters, and incorrect hints', () => {
        const url = new URL(gameLink(ORIGIN, state()));
        for (const [key, value] of [['a', 'true'], ['u', '2'], ['day', '2026-02-30'], ['t', '1e2'], ['m', ''], ['t', '1.5']]) {
            const params = new URLSearchParams(url.search);
            params.set(key, value);
            expect(parseGameLink(`?${params}`)).toBeNull();
        }
        expect(parseGameLink(url.search + '&x=hard')).toBeNull();
        const hinted = {
            ...state(), userValues: puzzle.slice(0, 2) + '4' + puzzle.slice(3), hintsUsed: 1,
            hintCells: Array.from({ length: 81 }, (_, i) => i === 2),
        };
        const badHint = new URL(gameLink(ORIGIN, hinted));
        badHint.searchParams.set('v', puzzle.slice(0, 2) + '1' + puzzle.slice(3));
        expect(parseGameLink(badHint.search)).toBeNull();
    });
});
