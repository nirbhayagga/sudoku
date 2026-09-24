import { SudokuGenerator } from './generator.js';
import { assessPuzzleV2 } from './assessment.js';
import { REASONING_FAMILIES, REASONING_VERSION } from './reasoning.js';

export const GENERATOR_VERSION = 'seeded-human-v1';
const DEFAULT_CLUES = [[34, 40], [28, 34], [25, 30], [23, 28], [22, 27]];

/** Local PRNG: seed + engine/policy + attempt budget, never wall time, define a run. */
export function seededRandom(seed) {
    let state = 2166136261;
    for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

export function generationOptions(input = {}) {
    const family = input.family || 'any';
    if (family !== 'any' && !REASONING_FAMILIES.includes(family)) throw new Error('Choose a supported technique level.');
    const defaults = family === 'any' ? [30, 36] : DEFAULT_CLUES[REASONING_FAMILIES.indexOf(family)];
    const minClues = input.minClues === undefined ? defaults[0] : Number(input.minClues);
    const maxClues = input.maxClues === undefined ? defaults[1] : Number(input.maxClues);
    if (!Number.isInteger(minClues) || !Number.isInteger(maxClues) || minClues < 17 || maxClues > 80 || minClues > maxClues) throw new Error('Clues must be a count or range from 17 to 80.');
    const symmetry = input.symmetry || 'none';
    if (!['none', 'rotate180'].includes(symmetry)) throw new Error('Choose a supported symmetry.');
    const maxAttempts = input.maxAttempts === undefined ? 30 : Number(input.maxAttempts);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 1000) throw new Error('Attempts must be between 1 and 1000.');
    const seed = String(input.seed ?? 'sudoku');
    if (!seed.length || seed.length > 100) throw new Error('Seed must contain 1–100 characters.');
    return { family, minClues, maxClues, symmetry, maxAttempts, seed };
}

/** One board at a time; caller owns cancellation (worker termination in browsers). */
export function generatePuzzle(input = {}, onProgress = () => {}) {
    const options = generationOptions(input);
    const random = seededRandom(options.seed);
    const targetRank = REASONING_FAMILIES.indexOf(options.family);
    let best = null;
    let bestPenalty = Infinity;
    let attempts = 0;
    for (; attempts < options.maxAttempts; attempts++) {
        const completed = SudokuGenerator.generateSolvedBoard(random);
        if (!completed) continue;
        const targetClues = options.minClues + Math.floor(random() * (options.maxClues - options.minClues + 1));
        const { puzzle, clues } = SudokuGenerator.dig(completed, targetClues, random, options.symmetry);
        const assessment = assessPuzzleV2(puzzle);
        if (!assessment.playable) throw new Error('Generator produced an invalid puzzle.');
        const cluePenalty = Math.max(0, options.minClues - clues, clues - options.maxClues);
        const familyPenalty = options.family === 'any' ? 0 : assessment.family === null ? 10
            : Math.abs(targetRank - REASONING_FAMILIES.indexOf(assessment.family));
        const penalty = cluePenalty * 20 + familyPenalty;
        if (penalty < bestPenalty) { best = { puzzle, clues, assessment }; bestPenalty = penalty; }
        onProgress({ attempts: attempts + 1, maxAttempts: options.maxAttempts, closestClues: best.clues });
        if (!penalty) { attempts++; break; }
    }
    if (!best) throw new Error('No valid puzzle was generated.');
    return { ...best, version: GENERATOR_VERSION, ratingVersion: REASONING_VERSION,
        options, attempts, targetMet: bestPenalty === 0 };
}
