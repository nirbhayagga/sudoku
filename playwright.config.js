import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests, covering what jsdom cannot: real layout, real touch events,
 * and the service worker. Those are precisely the areas this app has had bugs
 * in, and the areas the 460 unit tests are blind to.
 *
 * Tests run against the production build, not the dev server — the service
 * worker only exists in a build, and the dev server would hide bundling faults.
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['list']] : [['list']],

    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        {
            // A static host without a custom domain serves the site from a
            // subdirectory. This project runs the same build behind a subpath to
            // prove nothing depends on being at the domain root.
            name: 'subpath',
            testMatch: /subpath\.spec\.js/,
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'desktop',
            testIgnore: /subpath\.spec\.js/,
            use: { ...devices['Desktop Chrome'] },
        },
        {
            // The touch path is a completely separate branch in app.js: inputs
            // are readOnly, focus() is never called, and everything goes through
            // the on-screen numpad.
            name: 'mobile',
            testIgnore: /subpath\.spec\.js/,
            use: { ...devices['Pixel 5'] },
        },
    ],

    webServer: [
        {
            // --host 127.0.0.1 is required: vite preview otherwise binds to
            // "localhost", which resolves to ::1 here, and the IPv4 poll never
            // connects.
            command: 'npm run build && npx vite preview --port 4173 --strictPort --host 127.0.0.1',
            url: 'http://127.0.0.1:4173',
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
        },
        {
            // The same build, served one directory down, standing in for a
            // subdirectory deployment.
            command: 'node scripts/serve-subpath.js',
            url: 'http://127.0.0.1:4322/sudoku/',
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
        },
    ],
});
