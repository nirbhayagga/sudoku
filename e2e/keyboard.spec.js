import { test, expect } from '@playwright/test';
import { SMALL_BANK } from '../small-bank.js';
import { VARIANT_BANK } from '../variant-bank.js';
import { learn } from './flows.js';

const boards = [
    { name: 'Classic', size: 9, url: '/?bank=2&d=easy&level=1', cells: '#grid .cell-input', hint: '#btn-hint', notes: '#btn-notes-toggle' },
    ...[4, 6].map(size => ({ name: `${size}x${size}`, size, url: `/?size=${size}&box=2x${size / 2}&p=${SMALL_BANK[size][0].puzzle}` })),
    ...['diagonal', 'hyper'].map(rule => ({ name: rule, size: 9, url: `/?size=9&box=3x3&rule=${rule}&p=${VARIANT_BANK[rule][0].puzzle}` })),
].map(board => ({ cells: '#small-grid .small-cell', hint: '#small-hint', notes: '#small-notes', ...board }));

test('practice shares row navigation without replacing its open lesson with help', async ({ page }) => {
    await page.goto('/'); await learn(page);
    const cells = page.locator('#practice-grid .practice-cell');
    await cells.nth(40).focus();
    await page.keyboard.press('Home'); await expect(cells.nth(36)).toBeFocused();
    await page.keyboard.press('End'); await expect(cells.nth(44)).toBeFocused();
    await page.keyboard.press('ArrowRight'); await expect(cells.nth(44)).toBeFocused();
    await page.keyboard.press('?');
    await expect(page.locator('#keyboard-help-overlay')).not.toHaveClass(/active/);
    await expect(page.locator('#practice-grid')).toBeVisible();
});

for (const board of boards) {
    test(`${board.name}: row navigation, held arrows, keyboard help and normal button keys`, async ({ page }, info) => {
        await page.goto(board.url);
        const cells = page.locator(board.cells);
        await expect(cells).toHaveCount(board.size ** 2);
        await cells.nth(board.size + 1).focus();
        await page.keyboard.press('Home'); await expect(cells.nth(board.size)).toBeFocused();
        await page.keyboard.press('ArrowLeft'); await expect(cells.nth(board.size)).toBeFocused();
        await page.keyboard.press('End'); await expect(cells.nth(2 * board.size - 1)).toBeFocused();
        await page.keyboard.press('ArrowRight'); await expect(cells.nth(2 * board.size - 1)).toBeFocused();
        await page.keyboard.down('ArrowLeft'); await page.keyboard.down('ArrowLeft'); await page.keyboard.up('ArrowLeft');
        const selected = cells.nth(2 * board.size - 3);
        await expect(selected).toBeFocused();
        await page.keyboard.press('?');
        await expect(page.locator('#keyboard-help-overlay')).toHaveClass(/active/);
        await expect(page.locator('#keyboard-help-content')).toContainText('Home');
        await expect(page.locator('#keyboard-help-content [data-shortcut="digits"] kbd').last()).toHaveText(String(board.size));
        await expect(page.locator('#btn-keyboard-help-close')).toBeInViewport();
        expect(await page.locator('#keyboard-help-overlay .modal').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        if (board.name === 'Classic') await page.screenshot({ path: `e2e-results/keyboard-help-${info.project.name}.png` });
        await page.keyboard.press('Tab'); await expect(page.locator('#btn-keyboard-help-close')).toBeFocused();
        await page.keyboard.press('Escape'); await expect(selected).toBeFocused();
        await page.locator('#nav-new-game').focus();
        await page.keyboard.press('n'); await expect(page.locator(board.notes)).toHaveAttribute('aria-pressed', 'false');
        await page.keyboard.press('Space'); await expect(page.locator('#new-game-overlay')).toHaveClass(/active/);
    });
}

for (const board of [boards[0], boards[2]]) {
    test(`${board.name}: held H never turns a preview into a reveal`, async ({ page }) => {
        await page.goto(board.url);
        const cells = page.locator(board.cells);
        await expect(cells).toHaveCount(board.size ** 2);
        const values = page.locator(board.name === 'Classic' ? '#grid .cell-input' : '#small-grid .board-value');
        const read = () => values.evaluateAll(els => els.map(el => (el instanceof HTMLInputElement ? el.value : el.textContent) || '0').join(''));
        const before = await read(); await cells.nth(before.indexOf('0')).focus();
        await page.keyboard.down('h'); await expect(page.locator(board.hint)).toHaveText('Reveal number');
        await page.keyboard.down('h'); await page.keyboard.down('h');
        expect(await read()).toBe(before);
        await page.keyboard.up('h'); await page.keyboard.press('h');
        await expect.poll(read).not.toBe(before);
    });
}
