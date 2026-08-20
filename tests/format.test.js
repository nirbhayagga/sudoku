// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatTime, escapeHtml } from '../format.js';

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
