import { describe, it, expect, beforeAll } from 'vitest';
import { loadSudoku } from './helpers/load-globals.js';

let SudokuSolver, PUZZLES, ALL_PUZZLES, DIFFICULTY_LABELS;

beforeAll(() => {
    ({ SudokuSolver, PUZZLES, ALL_PUZZLES, DIFFICULTY_LABELS } = loadSudoku());
});

const EXPECTED_COUNTS = {
    easy: 500,
    medium: 500,
    hard: 500,
    expert: 500,
    evil: 500,
    nightmare: 3000,
};

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
            expect(DIFFICULTY_LABELS[difficulty]).toBeTruthy();
        }
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

    // app.js selects a level as bankList[level - 1], so a puzzle's position in
    // its array is its user-visible level number, and that number is stored in
    // leaderboard entries. Reordering this file silently invalidates old scores.
    // Ids encode that position (e01..e500, n00001..n03000), so they must stay
    // numerically sequential and aligned with the array index.
    it('numbers ids sequentially from 1, matching their array index', () => {
        const misnumbered = [];
        for (const [difficulty, list] of Object.entries(PUZZLES)) {
            list.forEach((entry, index) => {
                const number = Number(entry.id.replace(/^[a-z]/, ''));
                if (number !== index + 1) {
                    misnumbered.push(`${difficulty}[${index}] = ${entry.id}, expected ${index + 1}`);
                }
            });
        }
        expect(misnumbered).toEqual([]);
    });

    it('gives each difficulty its own id prefix', () => {
        const prefixes = new Map();
        for (const [difficulty, list] of Object.entries(PUZZLES)) {
            const seen = new Set(list.map((p) => p.id[0]));
            expect(seen.size, difficulty).toBe(1);
            prefixes.set(difficulty, [...seen][0]);
        }
        expect(new Set(prefixes.values()).size).toBe(prefixes.size);
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

describe('clue counts', () => {
    const averageClues = (difficulty) => {
        const list = PUZZLES[difficulty];
        const total = list.reduce((n, p) => n + p.puzzle.replace(/0/g, '').length, 0);
        return total / list.length;
    };

    // Only asserted up to expert. Beyond that, tiers are selected by measured
    // solving effort rather than clue count, and the two genuinely diverge: the
    // evil tier averages slightly MORE clues than expert while being far harder
    // (0% vs 39% solvable by pure logic). Requiring monotonic clue counts here
    // would re-encode the assumption that produced two identical tiers.
    it('decrease monotonically from easy through expert', () => {
        const order = ['easy', 'medium', 'hard', 'expert'];
        const averages = order.map(averageClues);
        for (let i = 1; i < averages.length; i++) {
            expect(averages[i], order[i]).toBeLessThan(averages[i - 1]);
        }
    });

    it('keeps evil in the same clue neighbourhood as expert', () => {
        expect(Math.abs(averageClues('evil') - averageClues('expert'))).toBeLessThan(3);
    });

    it('gives nightmare far fewer clues than any other tier', () => {
        for (const difficulty of ['easy', 'medium', 'hard', 'expert', 'evil']) {
            expect(averageClues('nightmare'), difficulty)
                .toBeLessThan(averageClues(difficulty));
        }
    });

    it('gives every nightmare puzzle exactly 17 clues', () => {
        const wrong = PUZZLES.nightmare
            .filter((p) => p.puzzle.replace(/0/g, '').length !== 17)
            .map((p) => `${p.id}: ${p.puzzle.replace(/0/g, '').length} clues`);
        expect(wrong).toEqual([]);
    });
});

describe('difficulty ladder', () => {
    // Clue count alone does not make a ladder — the expert and evil tiers once
    // had near-identical clue counts and were the same difficulty. These assert
    // the property that actually matters: each tier demands more solving effort.
    //
    // 'nightmare' is deliberately excluded. Its 17-clue puzzles come from a
    // published catalogue and are a different kind of hard: few givens make them
    // long and scan-heavy for a human, but a large fraction need no search at
    // all, so they do not sit on this scale.
    const LADDER = ['easy', 'medium', 'hard', 'expert', 'evil'];
    const SAMPLE = 120;

    /** Evenly spaced sample, so the measurement is reproducible. */
    function rate(difficulty) {
        const list = PUZZLES[difficulty];
        const step = Math.max(1, Math.floor(list.length / SAMPLE));
        const nodes = [];
        for (let i = 0; i < list.length && nodes.length < SAMPLE; i += step) {
            nodes.push(SudokuSolver.rateDifficulty(list[i].puzzle));
        }
        nodes.sort((a, b) => a - b);
        return {
            median: nodes[Math.floor(nodes.length / 2)],
            pureLogic: nodes.filter((n) => n === 0).length / nodes.length,
        };
    }

    it('never needs less search effort as difficulty rises', () => {
        const medians = LADDER.map((d) => rate(d).median);
        for (let i = 1; i < medians.length; i++) {
            expect(medians[i], `${LADDER[i]} vs ${LADDER[i - 1]}`)
                .toBeGreaterThanOrEqual(medians[i - 1]);
        }
    });

    it('solves fewer puzzles by pure logic as difficulty rises', () => {
        const shares = LADDER.map((d) => rate(d).pureLogic);
        for (let i = 1; i < shares.length; i++) {
            expect(shares[i], `${LADDER[i]} vs ${LADDER[i - 1]}`)
                .toBeLessThanOrEqual(shares[i - 1]);
        }
    });

    // The specific regression that started this: evil must be meaningfully
    // harder than expert, not statistically identical to it.
    it('makes evil distinctly harder than expert', () => {
        const expert = rate('expert');
        const evil = rate('evil');
        expect(evil.median).toBeGreaterThan(expert.median);
        expect(evil.pureLogic).toBeLessThan(expert.pureLogic);
    });
});
