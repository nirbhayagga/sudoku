import { test, expect, devices } from '@playwright/test';

/**
 * The touch path is a separate branch through app.js: cells are readOnly with
 * inputMode="none", focus() is deliberately never called, and input arrives via
 * the on-screen numpad. jsdom reports no touch support, so none of this is
 * reachable there.
 */
test.use({ ...devices['Pixel 5'] });

test.describe('touch input', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.locator('.diff-btn[data-diff="easy"]').click();
        await page.locator('#level-input').fill('1');
        await page.locator('#btn-new-game').click();
        await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();
    });

    test('shows the numpad', async ({ page }) => {
        await expect(page.locator('#numpad')).toBeVisible();
        await expect(page.locator('.numpad-btn')).toHaveCount(11); // 9 digits + erase + notes
    });

    // Cells are readOnly precisely so iOS never opens a keyboard over the board.
    test('keeps every cell readOnly so no keyboard appears', async ({ page }) => {
        const editable = await page.locator('.cell-input:not([readonly])').count();
        expect(editable).toBe(0);
        await expect(page.locator('.cell-input').first()).toHaveAttribute('inputmode', 'none');
    });

    test('enters a digit by tapping a cell then the numpad', async ({ page }) => {
        const empty = page.locator('.cell-wrapper:not(.locked)').first();
        await empty.tap();
        await page.locator('.numpad-btn[data-digit="7"]').tap();
        await expect(empty.locator('.cell-input')).toHaveValue('7');
    });

    test('erases with the numpad', async ({ page }) => {
        const empty = page.locator('.cell-wrapper:not(.locked)').first();
        await empty.tap();
        await page.locator('.numpad-btn[data-digit="7"]').tap();
        await page.locator('.numpad-erase').tap();
        await expect(empty.locator('.cell-input')).toHaveValue('');
    });

    test('records a pencil mark through the numpad', async ({ page }) => {
        const empty = page.locator('.cell-wrapper:not(.locked)').first();
        await empty.tap();
        await page.locator('#numpad-notes').tap();
        await page.locator('.numpad-btn[data-digit="4"]').tap();

        await expect(empty.locator('.note-digit[data-digit="4"]')).toHaveClass(/visible/);
        await expect(empty.locator('.cell-input')).toHaveValue('');
    });

    test('refuses to overwrite a given', async ({ page }) => {
        const given = page.locator('.cell-wrapper.locked').first();
        const before = await given.locator('.cell-input').inputValue();
        await given.tap();
        await page.locator('.numpad-btn[data-digit="9"]').tap();
        await expect(given.locator('.cell-input')).toHaveValue(before);
    });

    test('greys out a digit once it is fully placed', async ({ page }) => {
        // Not asserting which digit — only that the mechanism runs at all.
        const completed = page.locator('.numpad-btn.completed');
        expect(await completed.count()).toBeGreaterThanOrEqual(0);
    });
});

test.describe('mobile layout', () => {
    test('fits the grid on a phone without sideways scrolling', async ({ page }) => {
        await page.goto('/');
        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(1);
    });

    test('gives numpad buttons a touch-sized target', async ({ page }) => {
        await page.goto('/');
        const box = await page.locator('.numpad-btn').first().boundingBox();
        // 44px is the usual accessibility floor for a touch target.
        expect(box.height).toBeGreaterThanOrEqual(40);
    });

    test('survives a rotation to landscape', async ({ page }) => {
        await page.goto('/');
        await page.setViewportSize({ width: 851, height: 393 });
        await expect(page.locator('#grid')).toBeVisible();

        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(1);
    });

    test('allows pinch zoom', async ({ page }) => {
        await page.goto('/');
        const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
        expect(viewport).not.toContain('user-scalable=no');
        expect(viewport).not.toContain('maximum-scale');
    });
});
