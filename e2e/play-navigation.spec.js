import { test, expect } from '@playwright/test';
import { chooseBoard, closeActivity, solver } from './flows.js';
import { SMALL_BANK } from '../small-bank.js';
import { SMALL_GEOMETRIES } from '../geometry.js';
import { newSmallGame } from '../small-state.js';
import { solveSized } from '../sized-solver.js';

const classicBoard = page => page.locator('#grid .cell-input').evaluateAll(cells => cells.map(c => c.value || '0').join(''));
const classicReady = page => expect(page.locator('#grid .given').first()).toBeVisible();
const failClipboard = () => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard unavailable'); } } });

test('New game is the single play entry and Back to game works from empty Solver', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tab-play')).toBeHidden();
    await page.locator('#nav-new-game').click();
    await expect(page.locator('#new-game-overlay')).toHaveClass(/active/);
    await closeActivity(page); await solver(page);
    await expect(page.locator('#tab-play')).toHaveText('Back to game');
    await page.locator('#tab-play').click();
    await expect(page.locator('#new-game-overlay')).toHaveClass(/active/);
    await expect(page.locator('#tab-play')).toBeHidden();
});

test('returning from Solver continues the saved Classic game after a reload', async ({ page, isMobile }) => {
    await page.goto('/'); await chooseBoard(page, 'classic'); await classicReady(page);
    const cell = page.locator('#grid .cell-wrapper:not(.locked)').first().locator('input');
    await cell.click();
    if (isMobile) await page.locator('.numpad-btn[data-digit="1"]').click();
    else await page.keyboard.press('1');
    const board = await classicBoard(page);
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    await page.reload();
    await expect(page.locator('#btn-resume-yes')).toBeVisible();
    await page.locator('#btn-resume-yes').click();
    expect(await classicBoard(page)).toBe(board);
    await solver(page); await page.locator('#tab-play').click();
    expect(await classicBoard(page)).toBe(board);
    await expect(page.locator('.resume-banner')).toHaveCount(0);
    await expect(page.locator('#status')).toContainText('Resumed:');
    await expect(page.locator('#tab-play')).toBeHidden();
    await expect(page.locator('#pause-panel')).toBeHidden();
});

test('Classic pause exposes sharing and export without losing progress', async ({ page }, info) => {
    await page.setViewportSize({ width: 375, height: 664 });
    await page.addInitScript(failClipboard);
    await page.goto('/'); await chooseBoard(page, 'classic'); await classicReady(page);
    const board = await classicBoard(page);
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    expect(await page.evaluate(() => localStorage.getItem('sudoku_saved_game_v2'))).not.toBeNull();
    await page.locator('#btn-pause').click();
    for (const id of ['btn-pause-resume', 'btn-pause-share', 'btn-pause-export', 'btn-handoff']) {
        await expect(page.locator(`#${id}`)).toBeInViewport();
    }
    await page.screenshot({ path: `e2e-results/141-pause-${info.project.name}.png`, fullPage: true });
    await page.locator('#btn-pause-share').click();
    await expect(page.locator('#share-overlay')).toHaveClass(/active/);
    await expect(page.locator('#share-text')).toHaveValue(/level=\d+/);
    await page.locator('#btn-share-close').click();
    expect(await classicBoard(page)).toBe(board);
    expect(await page.evaluate(() => localStorage.getItem('sudoku_saved_game_v2'))).not.toBeNull();
    await page.locator('#btn-pause-export').click();
    await expect(page.locator('#export-title')).toHaveText('Export & print');
    await page.locator('#btn-export-close').click();
    await page.locator('#btn-pause-resume').click();
    await expect(page.locator('#pause-panel')).toBeHidden();
});

for (const kind of ['4', '6', 'diagonal', 'hyper']) {
    test(`${kind} pause sharing has a visible clipboard fallback and keeps the save`, async ({ page }) => {
        await page.addInitScript(failClipboard);
        await page.goto('/'); await chooseBoard(page, kind);
        const cells = page.locator('#small-grid .board-value');
        const before = await cells.allTextContents();
        await expect(page.locator('#tab-play')).toBeHidden();
        await expect(page.locator('#small-pause-share')).toBeHidden();
        await page.locator('#small-pause').click();
        await page.locator('#small-pause-share').click();
        await expect(page.locator('#share-text')).toBeVisible();
        await expect(page.locator('#share-text')).toHaveValue(/size=/);
        expect(await page.locator('#share-text').inputValue()).not.toContain('resume=');
        await page.locator('#btn-share-close').click();
        const track = kind === 'diagonal' || kind === 'hyper' ? `9-${kind}` : kind;
        expect(await page.evaluate(track => localStorage.getItem(`sudoku_small_v1_${track}`), track)).not.toBeNull();
        await page.locator('#small-pause').click();
        expect(await cells.allTextContents()).toEqual(before);
        await expect(page.locator('#small-pause-share')).toBeHidden();
    });
}

test('other-board completion shares directly without opening puzzle tools', async ({ page }) => {
    const item = SMALL_BANK[4][0], g = SMALL_GEOMETRIES[4];
    const state = newSmallGame(item.puzzle, g, { id: item.id, level: 1 });
    const answer = solveSized(item.puzzle, g).solutions[0], cell = item.puzzle.indexOf('0');
    state.board = answer.slice(0, cell) + '0' + answer.slice(cell + 1);
    await page.addInitScript(failClipboard);
    await page.addInitScript(state => localStorage.setItem('sudoku_small_v1_4', JSON.stringify(state)), state);
    await page.goto('/'); await chooseBoard(page, '4');
    await page.locator(`#small-grid [data-cell="${cell}"]`).click();
    await page.locator(`#small-pad [data-digit="${answer[cell]}"]`).click();
    await page.locator('#small-result').click();
    await expect(page.locator('#other-result-tools')).toHaveText('Export & print');
    await page.locator('#other-result-share').click();
    await expect(page.locator('#share-text')).toBeVisible();
    await expect(page.locator('#puzzle-tools-overlay')).not.toHaveClass(/active/);
});

test('successful pause sharing copies the original puzzle without a dialog', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedPuzzle = text; } } }));
    await page.goto('/'); await chooseBoard(page, '6');
    await page.locator('#small-pause').click(); await page.locator('#small-pause-share').click();
    await expect(page.locator('#small-status')).toHaveText('Puzzle link copied.');
    expect(await page.evaluate(() => window.copiedPuzzle)).toContain('size=6');
    await expect(page.locator('#share-overlay')).not.toHaveClass(/active/);
    await expect(page.locator('#small-grid')).toHaveClass(/small-paused/);
});
