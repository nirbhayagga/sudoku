import { test, expect } from '@playwright/test';

test('shortcut visibility follows the device and preserves an explicit choice', async ({ page, isMobile }) => {
    await page.goto('/');
    const shortcuts = page.locator('.shortcuts');
    await expect(shortcuts).toHaveJSProperty('open', !isMobile);
    await shortcuts.locator('summary').click();
    await expect(shortcuts).toHaveJSProperty('open', isMobile);
    // Native details queues its toggle event after changing the open property.
    await expect.poll(() => page.evaluate(() => localStorage.getItem('sudoku-shortcuts-open')))
        .toBe(JSON.stringify(isMobile));
    await page.reload();
    await expect(shortcuts).toHaveJSProperty('open', isMobile);
});

test('keyboard preview, notes, undo/redo, pause and Escape are safe', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Real grid keyboard path uses desktop; touch controls have separate tests.');
    await page.goto('/?bank=2&d=easy&level=1');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();
    const cell = page.locator('.cell-wrapper:not(.locked) .cell-input').first();
    await cell.click(); await page.keyboard.press('2');
    await page.keyboard.press('Control+z'); await expect(cell).toHaveValue('');
    await page.keyboard.press('Control+Shift+Z'); await expect(cell).toHaveValue('2');
    await cell.click(); await page.keyboard.press('Escape'); await expect(cell).toHaveValue('2');
    await cell.click(); await page.keyboard.press('f');
    expect(await page.locator('.note-digit.visible').count()).toBeGreaterThan(0);
    await page.keyboard.press('Control+z'); await expect(page.locator('.note-digit.visible')).toHaveCount(0);
    await page.keyboard.press('p'); await expect(page.locator('#pause-panel')).toBeVisible();
    await page.keyboard.press('9'); await expect(cell).toHaveValue('2');
    await page.keyboard.press('p'); await expect(page.locator('#pause-panel')).toBeHidden();
    await page.keyboard.press('h'); await expect(page.locator('#btn-hint')).toHaveText('Reveal (+1 hint)');
    await page.keyboard.press('Escape'); await expect(page.locator('#btn-hint')).toHaveText('Hint (free)');
    await cell.click(); await page.keyboard.press('Control+i');
    await expect(page.locator('#modal-overlay')).toHaveClass(/active/);
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.locator('#import-text').fill('nhafp');
    await expect(page.locator('#import-text')).toHaveValue('nhafp');
    await page.keyboard.press('Escape'); await expect(cell).toHaveValue('2');
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('daily status identifies its bank level during play', async ({ page }) => {
    await page.goto('/'); await page.locator('#btn-daily').click();
    await expect(page.locator('#status')).toHaveText(/Daily puzzle — .+ · (Easy|Medium|Hard|Expert|Evil|Nightmare) #\d+/);
});
