import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('downloads a backup, rejects invalid JSON, then restores settings and the saved game', async ({ page, isMobile }) => {
    test.slow(); // Download, two file uploads and a reload on mobile WebKit.
    await page.goto('/');
    await page.locator('#theme-toggle').click();
    await page.locator('.theme-option[data-theme="forest"]').click();
    await page.locator('#level-input').fill('1');
    await page.locator('#btn-new-game').click();
    await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();
    const empty = page.locator('.cell-wrapper:not(.locked) input').first();
    await empty.click();
    if (isMobile) await page.locator('.numpad-btn[data-digit="6"]').click();
    else await page.keyboard.press('6');
    await expect(empty).toHaveValue('6');
    await page.locator('#btn-pause').click();
    await page.locator('#btn-stats').click();

    const downloadEvent = page.waitForEvent('download');
    await page.locator('#btn-backup').click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(/^sudoku-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const bytes = await readFile(await download.path());
    const backup = JSON.parse(bytes.toString());
    expect(backup).toMatchObject({ format: 'sudoku-backup', version: 1, settings: { theme: 'forest' } });
    expect(backup.savedGame).toBeTruthy();
    const originalSave = await page.evaluate(() => JSON.parse(localStorage.getItem('sudoku_saved_game_v2')));

    async function upload(buffer, name) {
        page.once('dialog', dialog => dialog.accept());
        const chooserEvent = page.waitForEvent('filechooser');
        await page.locator('#btn-restore').click();
        await (await chooserEvent).setFiles({ name, mimeType: 'application/json', buffer });
    }
    await upload(Buffer.from('{ broken JSON'), 'broken.json');
    await expect(page.locator('#backup-status')).toContainText('Invalid backup JSON');
    const afterInvalidImport = await page.evaluate(() => JSON.parse(localStorage.getItem('sudoku_saved_game_v2')));
    // The pending autosave or file chooser's visibility change may refresh the
    // timestamp. Invalid input must preserve every field of the paused game.
    expect(afterInvalidImport).toEqual({ ...originalSave, timestamp: expect.any(Number) });
    expect(afterInvalidImport.timestamp).toBeGreaterThanOrEqual(originalSave.timestamp);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');

    await page.locator('#btn-stats-close').click();
    await page.locator('#theme-toggle').click();
    await page.locator('.theme-option[data-theme="light"]').click();
    await page.locator('#btn-stats').click();
    const reloaded = page.waitForEvent('load');
    await upload(bytes, 'restore.json');
    await reloaded;
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');
    await page.locator('#btn-resume-yes').click();
    await expect(empty).toHaveValue('6');
});
