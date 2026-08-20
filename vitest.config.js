import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        // The puzzle-bank integrity suite solves thousands of puzzles.
        testTimeout: 30_000,
        coverage: {
            include: ['solver.js', 'generator.js', 'app.js', 'leaderboard-api/server.js'],
            reporter: ['text', 'html'],
        },
    },
});
