import globals from 'globals';

/**
 * Frontend files are browser ES modules; build tooling and tests are Node ESM;
 * the leaderboard API is CommonJS.
 */

const sharedRules = {
    'no-undef': 'error',
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
        ignores: ['dist/**', 'dist-standalone/**', 'node_modules/**', 'coverage/**', 'leaderboard-api/data/**'],
    },
    // Frontend: browser ES modules
    {
        files: ['*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: globals.browser,
        },
        rules: sharedRules,
    },
    // Build tooling and tests: Node ESM
    {
        files: ['scripts/**/*.js', 'tests/**/*.js', 'e2e/**/*.js', 'playwright.config.js', 'eslint.config.js', 'vitest.config.js', 'vite.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: globals.node,
        },
        rules: sharedRules,
    },
    // Leaderboard API: Node CommonJS
    {
        // Playwright callbacks run in the page; these unit files use jsdom.
        files: ['e2e/**/*.js', 'tests/printing.test.js', 'tests/share.test.js'],
        languageOptions: { globals: globals.browser },
    },
    {
        files: ['sw-template.js'],
        languageOptions: { globals: { __PRECACHE_MANIFEST__: 'readonly' } },
    },
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
