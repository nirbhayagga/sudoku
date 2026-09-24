// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { planWorksheet, renderWorksheet } from '../printing.js';

describe('worksheet selection', () => {
    it('counts puzzle pages separately from optional answer pages', () => {
        expect(planWorksheet({ amount: 2, unit: 'pages', perPage: 4, bankSize: 500, answers: true })).toEqual({
            count: 8, puzzlePages: 2, answerPages: 2, totalPages: 4,
        });
        expect(planWorksheet({ amount: 7, perPage: 4, bankSize: 500 })).toEqual({
            count: 7, puzzlePages: 2, answerPages: 0, totalPages: 2,
        });
    });
    it('allows a range ending at the last level and rejects wrapping or partial requested pages', () => {
        const options = { amount: 2, unit: 'pages', perPage: 4, order: 'consecutive', start: 493, bankSize: 500 };
        expect(planWorksheet(options).count).toBe(8);
        expect(() => planWorksheet({ ...options, start: 494 })).toThrow(/Only 7 puzzles remain/);
        expect(() => planWorksheet({ ...options, start: 0 })).toThrow(/Start at/);
    });
    it.each([0, -1, 1.5, 25, NaN, Infinity])('rejects invalid puzzle count %s', amount => {
        expect(() => planWorksheet({ amount, bankSize: 500 })).toThrow();
    });
    it('applies the puzzle cap when choosing pages and checks the available bank', () => {
        expect(planWorksheet({ amount: 4, unit: 'pages', perPage: 6, bankSize: 500 }).count).toBe(24);
        expect(() => planWorksheet({ amount: 5, unit: 'pages', perPage: 6, bankSize: 500 })).toThrow(/1–4 puzzle pages/);
        expect(() => planWorksheet({ amount: 4, bankSize: 3 })).toThrow(/Not enough distinct/);
        expect(() => planWorksheet({ amount: 1, unit: 'sheets', bankSize: 500 })).toThrow();
    });
});

describe('print worksheets', () => {
    it.each([1, 2, 4, 6])('paginates puzzles and answers separately at %i per page', perPage => {
        const target = document.createElement('div');
        const puzzles = Array.from({ length: 7 }, (_, i) => ({ title: `Level ${i + 1}`, puzzle: '0'.repeat(81), solution: '123456789'.repeat(9) }));
        renderWorksheet(target, puzzles, { perPage, answers: true });
        expect(target.querySelectorAll('.worksheet-page')).toHaveLength(Math.ceil(7 / perPage) * 2);
        expect(target.querySelectorAll('.worksheet-grid')).toHaveLength(14);
        expect(target.querySelectorAll('.worksheet-grid span')).toHaveLength(14 * 81);
        expect(target.querySelector('.worksheet-grid').textContent).toBe('');
    });
    it('renders labels as text and rejects malformed grids and unsupported layouts', () => {
        const target = document.createElement('div');
        const puzzle = { title: '<img src=x>', puzzle: '0'.repeat(81) };
        renderWorksheet(target, [puzzle]);
        expect(target.querySelector('img')).toBeNull();
        expect(target.querySelector('h2').textContent).toBe('<img src=x>');
        expect(() => renderWorksheet(target, [puzzle], { perPage: 100 })).toThrow();
        expect(() => renderWorksheet(target, [{ ...puzzle, puzzle: '123' }])).toThrow();
    });
});
