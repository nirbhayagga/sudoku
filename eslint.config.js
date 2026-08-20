import globals from 'globals';

/**
 * The frontend files are plain scripts sharing globals via <script> tags, not
 * modules — hence the explicit cross-file globals below. Build tooling, tests
 * and the leaderboard API are Node instead.
 */

// Globals each frontend file publishes for the ones loaded after it.
const appGlobals = {
    SudokuSolver: 'readonly',
    SudokuGenerator: 'readonly',
    PUZZLES: 'readonly',
    ALL_PUZZLES: 'readonly',
    DIFFICULTY_LABELS: 'readonly',
};

const sharedRules = {
    'no-unused-vars': ['error', { args: 'after-used', caughtErrors: 'none' }],
    // Several localStorage/JSON reads deliberately swallow failures.
    'no-empty': ['error', { allowEmptyCatch: true }],
    eqeqeq: ['error', 'smart'],
    'no-var': 'error',
    'prefer-const': 'error',
    'no-implicit-globals': 'error',
    'no-console': 'off',
};

export default [
    {
        ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'leaderboard-api/data/**'],
    },
    // Frontend: browser scripts (not modules)
    {
        files: ['app.js', 'solver.js', 'generator.js', 'puzzle-bank.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: { ...globals.browser, ...appGlobals },
        },
        rules: sharedRules,
    },
    // Build tooling and tests: Node ESM
    {
        files: ['build.js', 'scripts/**/*.js', 'tests/**/*.js', 'eslint.config.js', 'vitest.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: globals.node,
        },
        rules: sharedRules,
    },
    // Leaderboard API: Node CommonJS
    {
        files: ['leaderboard-api/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: globals.node,
        },
        rules: sharedRules,
    },
];
