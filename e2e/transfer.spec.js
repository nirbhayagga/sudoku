import { test, expect } from '@playwright/test';

const PUZZLE = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

async function enter(page, cell, digit, isMobile) {
    await cell.click();
    if (isMobile) await page.locator(`.numpad-btn[data-digit="${digit}"]`).click();
    else await page.keyboard.press(digit);
}

test('imports a puzzle, exports each format and imports it again', async ({ page }) => {
    test.slow(); // Five complete modal export/import roundtrips.
    await page.goto('/');
    await page.locator('#tab-solver').click();
    // The import button opens the real parser dialog.
    await page.locator('#btn-paste').click();
    await page.locator('#import-text').fill(PUZZLE);
    await page.locator('#btn-modal-import').click();
    const board = () => page.locator('.cell-input').evaluateAll(cells => cells.map(el => el.value || '0').join(''));
    await expect.poll(board).toBe(PUZZLE);
    for (const format of ['line', 'zeros', 'rows', 'grid', 'chat']) {
        await page.locator('#btn-export').click();
        await page.locator('#export-format').selectOption(format);
        const exported = await page.locator('#export-text').inputValue();
        expect(exported.length).toBeGreaterThanOrEqual(81);
        await page.locator('#btn-export-close').click();
        await page.locator('#btn-paste').click();
        await page.locator('#import-text').fill(exported);
        await page.locator('#btn-modal-import').click();
        await expect.poll(board).toBe(PUZZLE);
    }
});

test('resumes saved digits and notes, then undo and redo work', async ({ page, isMobile }) => {
    await page.goto('/');
    await page.locator('#level-input').fill('1');
    await page.locator('#btn-new-game').click();
    await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();
    const cells = page.locator('.cell-wrapper:not(.locked)');
    await enter(page, cells.nth(0), '6', isMobile);
    await page.locator(isMobile ? '#numpad-notes' : '#btn-notes-toggle').click();
    await enter(page, cells.nth(1), '4', isMobile);
    await expect(cells.nth(1).locator('.note-digit[data-digit="4"]')).toHaveClass(/visible/);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();
    await page.locator('#btn-resume-yes').click();
    await expect(cells.nth(0).locator('input')).toHaveValue('6');
    await expect(cells.nth(1).locator('.note-digit[data-digit="4"]')).toHaveClass(/visible/);
    // Undo history starts afresh on resume; verify a new move's history.
    if (await page.locator('#btn-notes-toggle').getAttribute('aria-pressed') === 'true') {
        await page.locator(isMobile ? '#numpad-notes' : '#btn-notes-toggle').click();
    }
    await enter(page, cells.nth(2), '3', isMobile);
    await page.locator('#btn-undo').click();
    await expect(cells.nth(2).locator('input')).toHaveValue('');
    await page.locator('#btn-redo').click();
    await expect(cells.nth(2).locator('input')).toHaveValue('3');
});
