import { test, expect } from '@playwright/test';
import { chooseBoard, puzzleTools, closeActivity } from './flows.js';
import { SMALL_BANK } from '../small-bank.js';
import { SMALL_GEOMETRIES } from '../geometry.js';
import { newSmallGame } from '../small-state.js';
import { solveSized } from '../sized-solver.js';

test('a delayed clipboard response cannot hand off a different active game', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: () => new Promise(resolve => { window.finishClipboard = resolve; }),
    } }));
    await page.goto('/'); await chooseBoard(page, '6'); await puzzleTools(page);
    await page.locator('#small-handoff').click();
    await expect(page.locator('#small-text')).toHaveValue(/resume=/);
    await chooseBoard(page, '4');
    await expect(page.locator('#small-title')).toHaveText('Introduction · 4 × 4');
    const savedSizes = () => page.evaluate(() => [4, 6].map(size => JSON.parse(localStorage.getItem(`sudoku_small_v1_${size}`))?.size));
    await expect.poll(savedSizes).toEqual([4, 6]);
    await page.evaluate(() => window.finishClipboard());
    expect(await savedSizes()).toEqual([4, 6]);
});

test('other-board results keep their original values and expose puzzle tools after review', async ({ page }) => {
    const item = SMALL_BANK[4][0], g = SMALL_GEOMETRIES[4];
    const s = newSmallGame(item.puzzle, g, { id: item.id, level: 1 });
    const answer = solveSized(item.puzzle, g).solutions[0], cell = item.puzzle.indexOf('0');
    s.board = answer.slice(0, cell) + '0' + answer.slice(cell + 1); s.hints = 2; s.elapsedMs = 42000;
    await page.clock.setFixedTime(new Date('2026-09-28T12:00:00Z'));
    await page.addInitScript(s => localStorage.setItem('sudoku_small_v1_4', JSON.stringify(s)), s);
    await page.goto('/'); await chooseBoard(page, '4');
    await page.locator(`#small-grid [data-cell="${cell}"]`).click(); await page.locator(`#small-pad [data-digit="${answer[cell]}"]`).click();
    await page.locator('#small-result').click();
    await expect(page.locator('#other-result-details')).toContainText('Time: 0:42 — 2 hints used');
    await page.locator('#other-result-review').click(); await page.locator('#small-undo').click();
    await page.clock.setFixedTime(new Date('2026-09-28T12:02:00Z'));
    await page.locator('#small-result').click();
    await expect(page.locator('#other-result-details')).toContainText('Time: 0:42 — 2 hints used');
    await page.locator('#other-result-tools').click(); await expect(page.locator('#small-export')).toBeVisible();
    await closeActivity(page);
});

test('clearing errors after handoff resumes saving the local game', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } }));
    await page.goto('/'); await chooseBoard(page, '6');
    const { puzzle } = SMALL_BANK[6][0], answer = solveSized(puzzle, SMALL_GEOMETRIES[6]).solutions[0];
    const cell = puzzle.indexOf('0'), wrong = String(Number(answer[cell]) % 6 + 1);
    await page.locator(`#small-grid [data-cell="${cell}"]`).click();
    await page.locator(`#small-pad [data-digit="${wrong}"]`).click();
    await page.locator('#small-check').click();
    await expect(page.locator('#small-check')).toHaveText('Clear errors');
    await puzzleTools(page); await page.locator('#small-handoff').click();
    await expect(page.locator('#small-tool-status')).toContainText('Resume link ready');
    expect(await page.evaluate(() => localStorage.getItem('sudoku_small_v1_6'))).toBeNull();
    await closeActivity(page); await page.locator('#small-pause').click();
    await page.locator('#small-check').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sudoku_small_v1_6')));
    expect(saved.board[cell]).toBe('0');
    await page.locator('#small-undo').click();
    await expect(page.locator(`#small-grid [data-cell="${cell}"] .board-value`)).toHaveText(wrong);
});
