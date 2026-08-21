import { test, expect } from '@playwright/test';

/**
 * Without a custom domain, a static host serves the site from a subdirectory
 * rather than the domain root. Every
 * asset URL, the manifest, the icons and the service worker scope have to work
 * from there — an absolute path anywhere would 404 in production while looking
 * perfect locally.
 *
 * The build is served under a subpath here and driven for real.
 */
const SUBPATH = '/sudoku/';

test.use({ baseURL: 'http://127.0.0.1:4322' });

test.describe('served from a subpath', () => {
    test('loads and plays', async ({ page }) => {
        await page.goto(SUBPATH);
        await expect(page.locator('.cell-wrapper')).toHaveCount(81);

        await page.locator('.diff-btn[data-diff="easy"]').click();
        await page.locator('#level-input').fill('1');
        await page.locator('#btn-new-game').click();
        await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();
    });

    test('requests no asset from the domain root', async ({ page }) => {
        const missed = [];
        page.on('response', (r) => {
            const { pathname } = new URL(r.url());
            // The leaderboard probe is expected to 404 with no backend behind
            // it — that is how the app decides to hide the feature.
            if (r.status() === 404 && !pathname.includes('/api/')) missed.push(pathname);
        });

        await page.goto(SUBPATH);
        await page.waitForTimeout(800);
        expect(missed).toEqual([]);
    });

    // An absolute /api/ would miss a leaderboard proxied alongside the app.
    test('probes the leaderboard relative to the page', async ({ page }) => {
        const probes = [];
        page.on('request', (r) => {
            const { pathname } = new URL(r.url());
            if (pathname.includes('/api/')) probes.push(pathname);
        });

        await page.goto(SUBPATH);
        await page.waitForTimeout(800);

        expect(probes.length).toBeGreaterThan(0);
        for (const probe of probes) expect(probe.startsWith(SUBPATH)).toBe(true);
    });

    test('registers the service worker scoped to the subpath', async ({ page }) => {
        await page.goto(SUBPATH);
        await page.waitForFunction(
            () => navigator.serviceWorker && navigator.serviceWorker.controller !== null,
            null,
            { timeout: 15_000 }
        );

        const scope = await page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            return reg.scope;
        });
        expect(scope).toContain(SUBPATH);
    });

    test('shares links that keep the subpath', async ({ page }) => {
        const copied = [];
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } },
                configurable: true,
            });
        });

        await page.goto(SUBPATH);
        await page.locator('.diff-btn[data-diff="easy"]').click();
        await page.locator('#level-input').fill('9');
        await page.locator('#btn-new-game').click();
        await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();

        await page.locator('#btn-share').click();
        await page.waitForTimeout(300);

        const link = await page.evaluate(() => window.__copied || document.getElementById('share-text').value);
        copied.push(link);
        expect(link).toContain(SUBPATH);
        expect(link).toContain('level=9');
    });
});
