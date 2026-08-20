// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseShareLink, bankLink, puzzleLink, dailyLink, copyToClipboard } from '../share.js';
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
