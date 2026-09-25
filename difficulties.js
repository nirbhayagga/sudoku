import metadata from './leaderboard-api/bank-meta.json' with { type: 'json' };
export const BANK_VERSION = metadata.version;

/**
 * Difficulty metadata.
 *
 * Deliberately separate from puzzle-bank.js: the bank is ~450 kB of puzzle
 * strings loaded on demand, while these few constants are needed the moment the
 * page opens (difficulty buttons, the level range, the resume banner). Keeping
 * them here is what lets the bank stay out of the initial bundle.
 */

export const DIFFICULTY_LABELS = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    expert: 'Expert',
    evil: 'Evil',
    nightmare: 'Nightmare',
};

/**
 * Puzzles per difficulty, i.e. the highest selectable level. Stated here rather
 * than read from the bank so the level input can be set up before the bank has
 * loaded; a test asserts these match the bank exactly.
 */
export const BANK_SIZES = Object.freeze(metadata.sizes);

/** Accept only published difficulty keys, never inherited object properties. */
export const isDifficulty = (value) => typeof value === 'string' && Object.hasOwn(BANK_SIZES, value);

// Imported games have their own statistics, never a bank tier or leaderboard.
export const GAME_LABELS = { ...DIFFICULTY_LABELS, imported: 'Imported' };
export const isGameDifficulty = value => isDifficulty(value) || value === 'imported';
