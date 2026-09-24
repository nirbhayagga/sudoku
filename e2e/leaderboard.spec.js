import { test, expect } from '@playwright/test';

// These are mocked UI responses. Worker-backed requests can bypass Playwright
// routing; worker/API exclusions are covered by the offline and worker suites.
test.use({ serviceWorkers: 'block' });

test('optional leaderboard displays scores and the latest selected tier', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok' } }));
    const entry = name => ({ name, time: 123, hints: 2, mistakes: 3, autoNotes: true, date: '2026-09-24T00:00:00Z' });
    let releaseEasy;
    let requests = 0;
    await page.route('**/api/leaderboard/easy', async route => {
        if (++requests > 1) await new Promise(resolve => { releaseEasy = resolve; });
        await route.fulfill({ json: [entry('Easy player')] });
    });
    await page.route('**/api/leaderboard/hard', route => route.fulfill({ json: [entry('Hard player')] }));
    await page.goto('/');
    await page.locator('#btn-leaderboard').click();
    await expect(page.getByRole('cell', { name: 'Easy player', exact: true })).toBeVisible();
    await page.locator('.lb-tab[data-diff="easy"]').click();
    await expect.poll(() => Boolean(releaseEasy)).toBe(true);
    await page.locator('.lb-tab[data-diff="hard"]').click();
    await expect(page.getByRole('cell', { name: 'Hard player', exact: true })).toBeVisible();
    const lateResponse = page.waitForResponse(response => response.url().endsWith('/api/leaderboard/easy'));
    releaseEasy();
    await (await lateResponse).finished();
    // Let the late response's fetch/JSON continuation render if it is unguarded.
    await page.waitForTimeout(100);
    await expect(page.getByRole('cell', { name: 'Easy player', exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
});
