// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatTime, escapeHtml, formatPuzzle, parsePuzzleText } from '../format.js';

const BOARD = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

describe('formatTime', () => {
    it('formats under a minute', () => {
        expect(formatTime(0)).toBe('0:00');
        expect(formatTime(5)).toBe('0:05');
        expect(formatTime(59)).toBe('0:59');
    });

    it('formats minutes and seconds', () => {
        expect(formatTime(60)).toBe('1:00');
        expect(formatTime(125)).toBe('2:05');
        expect(formatTime(599)).toBe('9:59');
    });

    // The previous implementation rendered an hour as "60:00", which reads as
    // sixty minutes past nothing.
    it('rolls over into hours', () => {
        expect(formatTime(3600)).toBe('1:00:00');
        expect(formatTime(3661)).toBe('1:01:01');
        expect(formatTime(7325)).toBe('2:02:05');
    });

    it('handles missing and negative input', () => {
        expect(formatTime(undefined)).toBe('0:00');
        expect(formatTime(null)).toBe('0:00');
        expect(formatTime(-10)).toBe('0:00');
    });

    it('truncates fractional seconds', () => {
        expect(formatTime(65.9)).toBe('1:05');
    });
});

describe('escapeHtml', () => {
    it('neutralises markup', () => {
        expect(escapeHtml('<img src=x onerror=alert(1)>')).not.toContain('<img');
        expect(escapeHtml('<b>hi</b>')).toBe('&lt;b&gt;hi&lt;/b&gt;');
    });

    it('escapes ampersands', () => {
        expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('leaves plain text alone', () => {
        expect(escapeHtml('Nirb')).toBe('Nirb');
    });

    it('coerces non-strings and nullish values', () => {
        expect(escapeHtml(42)).toBe('42');
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });
});

describe('formatPuzzle', () => {
    it('renders one line with dots', () => {
        expect(formatPuzzle(BOARD, 'line')).toBe(BOARD.replace(/0/g, '.'));
    });

    it('renders one line with zeros, accepting dotted input', () => {
        expect(formatPuzzle(BOARD, 'zeros')).toBe(BOARD);
        expect(formatPuzzle(BOARD.replace(/0/g, '.'), 'zeros')).toBe(BOARD);
    });

    it('renders nine rows of nine', () => {
        const rows = formatPuzzle(BOARD, 'rows').split('\n');
        expect(rows).toHaveLength(9);
        for (const row of rows) expect(row).toMatch(/^[1-9.]{9}$/);
    });

    it('renders a grid with box separators', () => {
        const lines = formatPuzzle(BOARD, 'grid').split('\n');
        expect(lines).toHaveLength(11);
        expect(lines[0]).toBe('5 3 . | . 7 . | . . .');
        expect(lines[3]).toBe('------+-------+------');
        expect(lines[7]).toBe('------+-------+------');
    });

    it('round-trips every style through parsePuzzleText', () => {
        for (const style of ['line', 'zeros', 'rows', 'grid']) {
            expect(parsePuzzleText(formatPuzzle(BOARD, style))).toBe(BOARD);
        }
    });

    it('rejects short boards and unknown styles', () => {
        expect(() => formatPuzzle('123')).toThrow();
        expect(() => formatPuzzle(BOARD, 'nope')).toThrow();
    });
});

describe('parsePuzzleText', () => {
    it('accepts digits and dots regardless of separators', () => {
        expect(parsePuzzleText(BOARD)).toBe(BOARD);
        expect(parsePuzzleText(BOARD.match(/.{9}/g).join(' | '))).toBe(BOARD);
    });

    it('accepts the common empty markers', () => {
        for (const ch of ['*', '_', '?', 'x', 'X', '-']) {
            expect(parsePuzzleText(BOARD.replace(/0/g, ch))).toBe(BOARD);
        }
    });

    // The strict pass wins first, so the dashes in a pretty grid's separator
    // lines stay separators rather than becoming twenty extra empty cells.
    it('keeps dashes as separators when digits and dots already make a board', () => {
        expect(parsePuzzleText(formatPuzzle(BOARD, 'grid'))).toBe(BOARD);
    });

    it('returns null for wrong lengths and junk', () => {
        expect(parsePuzzleText('123')).toBe(null);
        expect(parsePuzzleText('')).toBe(null);
        expect(parsePuzzleText(null)).toBe(null);
        expect(parsePuzzleText(BOARD + '1')).toBe(null);
    });
});
