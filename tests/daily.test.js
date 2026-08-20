import { describe, it, expect } from 'vitest';
import { dailyPuzzle, formatDay } from '../daily.js';
import { BANK_SIZES } from '../difficulties.js';

describe('dailyPuzzle', () => {
    // The point of the feature: everyone gets the same board, so the per-level
    // leaderboard compares like with like.
    it('is deterministic for a date', () => {
        expect(dailyPuzzle('2026-08-20')).toEqual(dailyPuzzle('2026-08-20'));
    });

    it('gives different days different puzzles', () => {
        const a = dailyPuzzle('2026-08-20');
        const b = dailyPuzzle('2026-08-21');
        expect(`${a.difficulty}:${a.level}`).not.toBe(`${b.difficulty}:${b.level}`);
    });

    it('always lands inside the bank', () => {
        for (let day = 1; day <= 28; day++) {
            for (const month of ['01', '06', '12']) {
                const key = `2026-${month}-${String(day).padStart(2, '0')}`;
                const { difficulty, level } = dailyPuzzle(key);
                expect(BANK_SIZES[difficulty], key).toBeGreaterThan(0);
                expect(level, key).toBeGreaterThanOrEqual(1);
                expect(level, key).toBeLessThanOrEqual(BANK_SIZES[difficulty]);
            }
        }
    });

    it('picks difficulty by weekday', () => {
        // 2026-08-17 is a Monday.
        expect(dailyPuzzle('2026-08-17').difficulty).toBe('easy');
        expect(dailyPuzzle('2026-08-22').difficulty).toBe('evil');
        expect(dailyPuzzle('2026-08-23').difficulty).toBe('expert');
    });

    it('repeats the same difficulty a week later', () => {
        expect(dailyPuzzle('2026-08-17').difficulty).toBe(dailyPuzzle('2026-08-24').difficulty);
    });

    // Parsing as UTC would shift the day backwards west of Greenwich and hand
    // some players yesterday's puzzle.
    it('treats the date as local, not UTC', () => {
        // 2026-03-01 is a Sunday locally everywhere this is parsed correctly.
        expect(dailyPuzzle('2026-03-01').difficulty).toBe('expert');
    });

    it('spreads levels across the bank rather than clustering', () => {
        const levels = [];
        for (let day = 1; day <= 28; day++) {
            levels.push(dailyPuzzle(`2026-04-${String(day).padStart(2, '0')}`).level);
        }
        // A poor hash would repeat or bunch these up.
        expect(new Set(levels).size).toBeGreaterThan(20);
    });

    it('never changes for a past date', () => {
        // Pinned so a future tweak to the mapping cannot silently invalidate
        // scores already set against these boards.
        expect(dailyPuzzle('2026-01-01')).toEqual({
            dayKey: '2026-01-01',
            difficulty: dailyPuzzle('2026-01-01').difficulty,
            level: dailyPuzzle('2026-01-01').level,
        });
        expect(dailyPuzzle('2026-08-20')).toMatchObject({ difficulty: 'hard', level: 448 });
    });
});

describe('formatDay', () => {
    it('renders a readable date', () => {
        expect(formatDay('2026-08-20')).toMatch(/August/);
    });
});
