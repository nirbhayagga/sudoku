import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { puzzleId } from '../puzzle-id.js';
import { FAMILY_TIERS, difficultyFor, ratingKey, compareRatingKeys } from '../rating-policy.js';
import { assessPuzzleEnhanced } from '../enhanced-assessment.js';
const ranking = JSON.parse(readFileSync(new URL('../docs/bank-ranking.json', import.meta.url)));
const apiIds = JSON.parse(readFileSync(new URL('../leaderboard-api/bank-ids.json', import.meta.url)));
import { describe, it, expect } from 'vitest';
import { SudokuSolver } from '../solver.js';
import { PUZZLES, ALL_PUZZLES } from '../puzzle-bank.js';
import { DIFFICULTY_LABELS, BANK_SIZES } from '../difficulties.js';

const EXPECTED_COUNTS = { easy: 1493, medium: 1570, hard: 997, expert: 256, evil: 992, nightmare: 192 };

// Solving all 5,500 puzzles takes a few seconds. Sample by default; CI sets
// FULL_BANK_CHECK=1 to verify every shipped puzzle.
const FULL = process.env.FULL_BANK_CHECK === '1';
const SAMPLE_SIZE = 100;
const SCOPE = FULL ? 'every' : 'each sampled';

/** Deterministic evenly-spaced sample, so failures are reproducible. */
function sample(list) {
    if (FULL || list.length <= SAMPLE_SIZE) return list;
    const step = Math.floor(list.length / SAMPLE_SIZE);
    return Array.from({ length: SAMPLE_SIZE }, (_, i) => list[i * step]);
}

describe('bank structure', () => {
    it('contains the expected difficulties', () => {
        expect(Object.keys(PUZZLES).sort()).toEqual(Object.keys(EXPECTED_COUNTS).sort());
    });

    it('has a label for every difficulty', () => {
        for (const difficulty of Object.keys(PUZZLES)) {
            expect(DIFFICULTY_LABELS[difficulty], difficulty).toBeTruthy();
        }
    });

    // BANK_SIZES drives the level input before the bank has loaded, so a
    // mismatch would offer levels that do not exist.
    it('matches the sizes declared in difficulties.js', () => {
        for (const [difficulty, list] of Object.entries(PUZZLES)) {
            expect(BANK_SIZES[difficulty], difficulty).toBe(list.length);
        }
        expect(Object.keys(BANK_SIZES).sort()).toEqual(Object.keys(PUZZLES).sort());
    });

    for (const [difficulty, count] of Object.entries(EXPECTED_COUNTS)) {
        it(`has ${count} ${difficulty} puzzles`, () => {
            expect(PUZZLES[difficulty]).toHaveLength(count);
        });
    }

    it('flattens every puzzle into ALL_PUZZLES with its difficulty attached', () => {
        const total = Object.values(EXPECTED_COUNTS).reduce((a, b) => a + b, 0);
        expect(ALL_PUZZLES).toHaveLength(total);
        for (const entry of ALL_PUZZLES) {
            expect(PUZZLES[entry.difficulty]).toBeDefined();
        }
    });

    it('uses globally unique ids', () => {
        const ids = ALL_PUZZLES.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('contains no duplicate puzzles', () => {
        const strings = ALL_PUZZLES.map((p) => p.puzzle);
        expect(new Set(strings).size).toBe(strings.length);
    });

    it('identifies boards independently of their display position', () => {
        for (const entry of ALL_PUZZLES) {
            expect(entry.id).toBe(puzzleId(entry.puzzle));
            expect(PUZZLES[entry.difficulty][entry.level - 1].puzzle).toBe(entry.puzzle);
        }
    });
});

describe('puzzle format', () => {
    it('every puzzle is 81 characters of digits', () => {
        const malformed = ALL_PUZZLES.filter((p) => !/^[0-9]{81}$/.test(p.puzzle)).map((p) => p.id);
        expect(malformed).toEqual([]);
    });

    // Checked directly rather than through the solver so all 5,500 puzzles are
    // covered in milliseconds; the solver-based uniqueness checks below are the
    // expensive ones and so are sampled. Failures are collected and asserted
    // once at the end — a per-cell expect() would mean >1M assertions.
    it('every puzzle has no duplicate given in any row, column or box', () => {
        const conflicts = [];

        for (const { id, puzzle } of ALL_PUZZLES) {
            const rows = Array.from({ length: 9 }, () => new Set());
            const cols = Array.from({ length: 9 }, () => new Set());
            const boxes = Array.from({ length: 9 }, () => new Set());

            for (let i = 0; i < 81; i++) {
                const digit = puzzle[i];
                if (digit === '0') continue;
                const row = Math.floor(i / 9);
                const col = i % 9;
                const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);

                if (rows[row].has(digit)) conflicts.push(`${id}: ${digit} twice in row ${row}`);
                if (cols[col].has(digit)) conflicts.push(`${id}: ${digit} twice in col ${col}`);
                if (boxes[box].has(digit)) conflicts.push(`${id}: ${digit} twice in box ${box}`);

                rows[row].add(digit);
                cols[col].add(digit);
                boxes[box].add(digit);
            }
        }

        expect(conflicts).toEqual([]);
    });
});

describe(`puzzle validity (${FULL ? 'full bank' : `${SAMPLE_SIZE}/difficulty sample`})`, () => {
    for (const difficulty of Object.keys(EXPECTED_COUNTS)) {
        it(`${SCOPE} ${difficulty} puzzle has exactly one solution`, () => {
            for (const { id, puzzle } of sample(PUZZLES[difficulty])) {
                expect(SudokuSolver.countSolutions(puzzle, 2), id).toBe(1);
            }
        });

        it(`${SCOPE} ${difficulty} puzzle solves to a valid grid`, () => {
            for (const { id, puzzle } of sample(PUZZLES[difficulty])) {
                const { solution } = SudokuSolver.solveSudoku(puzzle);
                expect(solution, id).not.toBeNull();
                expect(SudokuSolver.validateSolution(solution), id).toBe(true);
            }
        });
    }
});

describe('published human-technique order', () => {
    it('keeps the exact original board collection and all 3,000 catalogue boards', () => {
        const boards = ALL_PUZZLES.map(p => p.puzzle).sort();
        expect(createHash('sha256').update(boards.join('\n')).digest('hex'))
            .toBe('aa7715daeb96aad1621bc767fdf511819566fc51b887c3cdd1856b8bda270440');
        expect(boards.filter(p => p.replaceAll('0', '').length === 17)).toHaveLength(3000);
    });
    it('matches the published assessment manifest and independent API identity list', () => {
        for (const [difficulty, list] of Object.entries(PUZZLES)) {
            const ranks = ranking.tiers[difficulty];
            expect(ranks.map(r => r[0])).toEqual(list.map(p => p.id));
            expect(apiIds[difficulty]).toEqual(list.map(p => p.id));
            expect(ranks.every(r => FAMILY_TIERS[r[1]] === difficulty)).toBe(true);
            for (let i = 1; i < ranks.length; i++) expect(compareRatingKeys(ranks[i - 1].slice(1), ranks[i].slice(1))).toBeLessThanOrEqual(0);
        }
    });
    it('rechecks representative tier boundaries with the production maintenance engine', () => {
        for (const [difficulty, list] of Object.entries(PUZZLES)) {
            for (const index of [0, list.length - 1]) {
                const result = assessPuzzleEnhanced(list[index].puzzle);
                expect(difficultyFor(result), `${difficulty} ${index + 1}`).toBe(difficulty);
                expect(ratingKey(result)).toEqual(ranking.tiers[difficulty][index].slice(1));
            }
        }
    }, 120000);
});
