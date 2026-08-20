import { test, expect } from '@playwright/test';

/** Start a specific bank puzzle so assertions are deterministic. */
async function startGame(page, { difficulty = 'easy', level = 1 } = {}) {
    await page.goto('/');
    await page.locator(`.diff-btn[data-diff="${difficulty}"]`).click();
    await page.locator('#level-input').fill(String(level));
    await page.locator('#btn-new-game').click();
    await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();
}

test.describe('the grid', () => {
    test('renders 81 cells that fit inside the viewport', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.cell-wrapper')).toHaveCount(81);

        // jsdom has no layout, so this is the first check that the board is
        // actually on screen rather than merely present in the DOM.
        const grid = await page.locator('#grid').boundingBox();
        const viewport = page.viewportSize();
        expect(grid.width).toBeGreaterThan(0);
        expect(grid.width).toBeLessThanOrEqual(viewport.width);
        expect(grid.x).toBeGreaterThanOrEqual(0);
    });

    test('never scrolls the page sideways', async ({ page }) => {
        await page.goto('/');
        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(1); // sub-pixel rounding only
    });

    test('draws cells as squares', async ({ page }) => {
        await page.goto('/');
        const box = await page.locator('.cell-wrapper').first().boundingBox();
        expect(Math.abs(box.width - box.height)).toBeLessThan(2);
    });
});

test.describe('playing', () => {
    test('loads the requested puzzle and accepts a digit', async ({ page }, testInfo) => {
        await startGame(page);

        const given = await page.locator('.cell-wrapper.locked').count();
        expect(given).toBeGreaterThan(20);

        const empty = page.locator('.cell-wrapper:not(.locked) .cell-input').first();
        if (testInfo.project.name === 'mobile') {
            await empty.click();
            await page.locator('.numpad-btn[data-digit="5"]').click();
        } else {
            await empty.click();
            await page.keyboard.press('5');
        }
        await expect(empty).toHaveValue('5');
    });

    test('flags a conflicting digit', async ({ page }, testInfo) => {
        await startGame(page);

        // Put the same digit twice in one row.
        const row = page.locator('.cell-wrapper[data-row="0"]:not(.locked)');
        const count = await row.count();
        test.skip(count < 2, 'row has fewer than two empty cells');

        for (const i of [0, 1]) {
            const cell = row.nth(i);
            await cell.locator('.cell-input').click();
            if (testInfo.project.name === 'mobile') {
                await page.locator('.numpad-btn[data-digit="9"]').click();
            } else {
                await page.keyboard.press('9');
            }
        }
        await expect(row.nth(1)).toHaveClass(/conflict/);
    });

    test('runs the timer', async ({ page }) => {
        await startGame(page);
        await expect(page.locator('#game-timer')).toHaveText(/0:0\d/);
        await page.waitForTimeout(1600);
        await expect(page.locator('#game-timer')).not.toHaveText('0:00');
    });

    test('reveals a hint for the cell you pick', async ({ page }) => {
        await startGame(page);

        // Selecting a cell asks for the answer there, so it reveals on one
        // press. With nothing selected the first press only nudges, which is
        // covered separately below.
        await page.locator('.cell-wrapper:not(.locked)').first().click();
        await page.locator('#btn-hint').click();

        await expect(page.locator('.cell-wrapper.hint')).toHaveCount(1);
        await expect(page.locator('#status')).toHaveText(/R\d+C\d+/);
    });
});

test.describe('themes', () => {
    test('applies a theme and repaints', async ({ page }) => {
        await page.goto('/');
        const before = await page.locator('body').evaluate(
            (el) => getComputedStyle(el).backgroundColor
        );

        await page.locator('#theme-toggle').click();
        await page.locator('.theme-option[data-theme="sakura"]').click();

        await expect(page.locator('html')).toHaveAttribute('data-theme', 'sakura');
        const after = await page.locator('body').evaluate(
            (el) => getComputedStyle(el).backgroundColor
        );
        expect(after).not.toBe(before);
    });

    test('remembers the theme across a reload', async ({ page }) => {
        await page.goto('/');
        await page.locator('#theme-toggle').click();
        await page.locator('.theme-option[data-theme="forest"]').click();
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');
    });
});

test.describe('explaining hints', () => {
    test('dims the board and highlights the reasoning before revealing', async ({ page }) => {
        await startGame(page);
        // Click somewhere neutral so no cell is selected.
        await page.locator('.status-bar').click();
        await page.locator('#btn-hint').click();

        await expect(page.locator('.cell-wrapper.hint-target')).toHaveCount(1);
        await expect(page.locator('#btn-hint')).toHaveText('Reveal');

        // The dimming is CSS, so only a real browser can confirm it applied.
        // Polled rather than sampled once: opacity is transitioned, so an
        // immediate read catches it before it has moved.
        const dimmed = page.locator('.cell-wrapper:not(.hint-target):not(.hint-evidence)').first();
        await expect
            .poll(async () => Number(await dimmed.evaluate((el) => getComputedStyle(el).opacity)))
            .toBeLessThan(1);

        const target = page.locator('.cell-wrapper.hint-target');
        await expect(target.locator('.cell-input')).toHaveValue('');

        await page.locator('#btn-hint').click();
        await expect(page.locator('.cell-wrapper.hint')).toHaveCount(1);
        await expect(page.locator('#btn-hint')).toHaveText('Hint');

        await expect
            .poll(async () => Number(await dimmed.evaluate((el) => getComputedStyle(el).opacity)))
            .toBe(1);
    });
});
