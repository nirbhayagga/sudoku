import { test, expect } from '@playwright/test';

/** Enter a digit the way this platform actually allows. */
async function enterDigit(page, projectName, cell, digit) {
    await cell.click();
    if (projectName === 'mobile') {
        await page.locator(`.numpad-btn[data-digit="${digit}"]`).click();
    } else {
        await page.keyboard.press(digit);
    }
}

/**
 * Service worker behaviour against a real browser.
 *
 * The unit tests exercise the worker's logic in a stub scope, which proves the
 * strategy is right but not that the browser installs it, caches the right
 * things, or actually serves a page with the network cut.
 */

/** Wait until a service worker has taken control of the page. */
async function waitForServiceWorker(page) {
    await page.waitForFunction(
        () => navigator.serviceWorker && navigator.serviceWorker.controller !== null,
        null,
        { timeout: 15_000 }
    );
}

test.describe('service worker', () => {
    test('registers and takes control', async ({ page }) => {
        await page.goto('/');
        await waitForServiceWorker(page);

        const scriptUrl = await page.evaluate(
            () => navigator.serviceWorker.controller.scriptURL
        );
        expect(scriptUrl).toContain('sw.js');
    });

    test('precaches the app and the puzzle bank', async ({ page }) => {
        await page.goto('/');
        await waitForServiceWorker(page);

        const cached = await page.evaluate(async () => {
            const names = await caches.keys();
            const cache = await caches.open(names[0]);
            return (await cache.keys()).map((r) => new URL(r.url).pathname);
        });

        expect(cached.some((p) => /assets\/index\..*\.js$/.test(p))).toBe(true);
        expect(cached.some((p) => /assets\/puzzle-bank\..*\.js$/.test(p))).toBe(true);
        expect(cached.some((p) => p.endsWith('.css'))).toBe(true);
        expect(cached.some((p) => p.endsWith('manifest.webmanifest'))).toBe(true);
    });

    test('keeps only one cache', async ({ page }) => {
        await page.goto('/');
        await waitForServiceWorker(page);
        const names = await page.evaluate(() => caches.keys());
        expect(names).toHaveLength(1);
        expect(names[0]).toMatch(/^sudoku-/);
    });
});

test.describe('offline', () => {
    // The reason the PWA exists: play on a plane, on the underground, anywhere.
    test('loads and plays a full game with the network cut', async ({ page, context }, testInfo) => {
        await page.goto('/');
        await waitForServiceWorker(page);

        // Pull the bank into the cache before going offline.
        await page.locator('#btn-new-game').click();
        await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();

        await context.setOffline(true);
        await page.reload();

        await expect(page.locator('.cell-wrapper')).toHaveCount(81);

        await page.locator('.diff-btn[data-diff="easy"]').click();
        await page.locator('#level-input').fill('3');
        await page.locator('#btn-new-game').click();
        await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();

        const empty = page.locator('.cell-wrapper:not(.locked) .cell-input').first();
        await enterDigit(page, testInfo.project.name, empty, '5');
        await expect(empty).toHaveValue('5');

        await context.setOffline(false);
    });

    test('hides the leaderboard rather than hanging when the API is unreachable', async ({ page, context }) => {
        await page.goto('/');
        await waitForServiceWorker(page);
        await context.setOffline(true);
        await page.reload();

        await expect(page.locator('.cell-wrapper')).toHaveCount(81);
        await expect(page.locator('#btn-leaderboard')).toBeHidden();
        await context.setOffline(false);
    });

    test('keeps a saved game across an offline reload', async ({ page, context }, testInfo) => {
        await page.goto('/');
        await waitForServiceWorker(page);

        await page.locator('.diff-btn[data-diff="easy"]').click();
        await page.locator('#level-input').fill('1');
        await page.locator('#btn-new-game').click();
        await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();

        const empty = page.locator('.cell-wrapper:not(.locked) .cell-input').first();
        await enterDigit(page, testInfo.project.name, empty, '6');

        // visibilitychange flushes the debounced save.
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        await page.waitForTimeout(300);

        await context.setOffline(true);
        await page.reload();
        await expect(page.locator('.resume-banner')).toBeVisible();
        await context.setOffline(false);
    });
});

test.describe('installability', () => {
    test('serves a manifest the browser can parse', async ({ page, request }) => {
        await page.goto('/');
        const href = await page.locator('link[rel="manifest"]').getAttribute('href');

        const response = await request.get(new URL(href, page.url()).toString());
        expect(response.ok()).toBe(true);

        const manifest = await response.json();
        expect(manifest.name).toBeTruthy();
        expect(manifest.icons.length).toBeGreaterThan(0);
    });

    test('serves every icon the manifest names', async ({ page, request }) => {
        await page.goto('/');
        const href = await page.locator('link[rel="manifest"]').getAttribute('href');
        const manifestUrl = new URL(href, page.url()).toString();
        const manifest = await (await request.get(manifestUrl)).json();

        for (const icon of manifest.icons) {
            const response = await request.get(new URL(icon.src, manifestUrl).toString());
            expect(response.ok(), icon.src).toBe(true);
        }
    });
});
