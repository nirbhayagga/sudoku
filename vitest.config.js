import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        // The puzzle-bank integrity suite solves thousands of puzzles.
        testTimeout: 30_000,
        coverage: {
            include: [
                'solver.js', 'generator.js', 'storage.js', 'format.js',
                'daily.js', 'share.js', 'difficulties.js', 'leaderboard-api/server.js',
            ],
            // app.js, dialogs.js, theme.js and leaderboard-client.js are exercised
            // through tests/app.dom.test.js, which esbuild-bundles them and evals
            // the result inside jsdom — coverage cannot instrument that, so they
            // would report 0% despite being the most heavily tested code here.
            // Listing them would make the headline number meaningless.
            reporter: ['text', 'html'],
            thresholds: {
                statements: 90,
                branches: 85,
                functions: 90,
                lines: 90,
            },
        },
    },
});
