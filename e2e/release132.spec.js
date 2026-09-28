import { chooseBoard, learn, solver, notesOptions } from './flows.js';
import { test, expect } from '@playwright/test';
import { SMALL_GEOMETRIES, VARIANT_GEOMETRIES } from '../geometry.js';
import { SMALL_BANK } from '../small-bank.js';
import { VARIANT_BANK } from '../variant-bank.js';
import { newSmallGame } from '../small-state.js';
import { solveSized } from '../sized-solver.js';

for (const track of ['4', '9-hyper']) test(`${track} keeps its first result after undo, another reveal and reload`, async ({ page }) => {
    const variant = track === '9-hyper', g = variant ? VARIANT_GEOMETRIES.hyper : SMALL_GEOMETRIES[4];
    const item = variant ? VARIANT_BANK.hyper[0] : SMALL_BANK[4][0];
    const answer = solveSized(item.puzzle, g).solutions[0], cell = item.puzzle.indexOf('0');
    const s = newSmallGame(item.puzzle, g, { id: item.id, level: 1, progression: true });
    s.board = answer.slice(0, cell) + '0' + answer.slice(cell + 1);
    s.elapsedMs = 42000; s.hints = 2; s.generatedNotesUsed = true;
    const key = `sudoku_small_v1_${track}`;
    await page.clock.setFixedTime(new Date('2026-09-28T12:00:00Z'));
    await page.addInitScript(({ key, s }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s));
    }, { key, s });
    const choose = async () => {
        if (variant) await chooseBoard(page, 'hyper');
        else await chooseBoard(page, '4');
        await expect(page.locator('.small-cell')).toHaveCount(g.count);
    };
    await page.goto('/'); await choose();
    await page.locator(`.small-cell[data-cell="${cell}"]`).click();
    await page.locator(`#small-pad [data-digit="${answer[cell]}"]`).click();
    await expect(page.locator('#small-status')).toContainText('Completed');
    const firstMessage = await page.locator('#small-status').textContent();
    await page.locator('#small-undo').click();
    await page.clock.setFixedTime(new Date('2026-09-28T12:05:00Z'));
    await expect(page.locator('#small-status')).toContainText('Reviewing completed');
    await page.locator('#small-hint').click();
    await expect(page.locator('#small-hint')).toHaveText('Reveal number');
    await page.locator('#small-hint').click();
    await expect(page.locator('#small-status')).toHaveText(firstMessage);
    await page.reload(); await choose();
    await expect(page.locator('#small-status')).toHaveText(firstMessage);
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    expect(saved).toMatchObject({ elapsedMs: 42000, hints: 3,
        completion: { elapsedMs: 42000, hints: 2, generatedNotesUsed: true } });
    expect(await page.evaluate(track => JSON.parse(localStorage.getItem('sudoku_progression_v1'))[track], track)).toEqual([item.id]);
});

test('Practice and Classic Solver are reachable from another board without losing its game', async ({ page }) => {
    await page.goto('/'); await chooseBoard(page, '6');
    await notesOptions(page, true); await page.locator('#small-fill').click();
    const before = await page.locator('#small-grid').textContent();
    await learn(page);
    await expect(page.locator('#practice-overlay')).toHaveClass(/active/);
    await page.locator('#btn-practice-close').click();
    await expect(page.locator('#small-pause')).toHaveText('Resume');
    await page.locator('#small-pause').click();
    await expect(page.locator('#small-grid')).toHaveText(before);
    await solver(page);
    await expect(page.locator('#small-app')).toBeHidden();
    await expect(page.locator('#board-size')).toHaveValue('9');
    await expect(page.locator('#board-rule')).toHaveValue('classic');
    await expect(page.locator('#status')).toContainText('Classic 9×9 solver');
    await chooseBoard(page, '6');
    await expect(page.locator('#tab-play')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#small-grid')).toHaveText(before);
});

test('variants keep readable boards and practice controls fit phone and desktop views', async ({ page }, info) => {
    await page.goto('/'); await chooseBoard(page, 'hyper');
    for (const viewport of [{ width: 1280, height: 800 }, { width: 820, height: 1180 }, { width: 393, height: 700 }, { width: 320, height: 480 }, { width: 740, height: 350 }]) {
        await page.setViewportSize(viewport);
        await expect.poll(async () => (await page.locator('#small-grid').boundingBox()).width).toBeGreaterThanOrEqual(viewport.width >= 820 ? 390 : 288);
        await page.locator('#small-hint').scrollIntoViewIfNeeded();
        await expect(page.locator('#small-hint')).toBeInViewport();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `e2e-results/132-hyper-${viewport.width}-${info.project.name}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 393, height: 700 });
    await learn(page);
    await page.locator('#practice-technique').selectOption('naked-pair');
    await page.locator('#practice-mode').selectOption('challenge');
    await expect(page.locator('#practice-grid')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#practice-pad')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `e2e-results/132-practice-${info.project.name}.png`, fullPage: true });
});
