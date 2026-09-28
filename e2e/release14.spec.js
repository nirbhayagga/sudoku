import { test, expect } from '@playwright/test';
import { setup, chooseBoard, learn, puzzleTools, notesOptions, closeActivity } from './flows.js';
import { PRACTICE_BANK } from '../practice-bank.js';
import { prepareExercise } from '../practice.js';
import { patternCells, patternDigits } from '../practice-coach.js';

test('navigation keeps small introductions in Learn and uses a single game chooser', async ({ page }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('#board-size')).toBeHidden();
    await setup(page);
    await expect(page.locator('#game-kind option')).toHaveCount(4);
    await page.locator('#level-input').fill('1'); await page.locator('#btn-new-game').click();
    await expect(page.locator('#new-game-overlay')).not.toHaveClass(/active/);
    await expect(page.locator('#grid .given').first()).toBeVisible();
    await chooseBoard(page, '6');
    await notesOptions(page, true); await page.locator('#small-fill').click();
    await page.locator('#small-undo').click();
    expect((await page.locator('#small-grid .board-notes').allTextContents()).join('')).toBe('');
    await puzzleTools(page);
    await expect(page.locator('#small-text')).toBeVisible();
    await closeActivity(page);
    await chooseBoard(page, '4'); await expect(page.locator('#small-grid .board-cell')).toHaveCount(16);
    await chooseBoard(page, 'classic'); await expect(page.locator('#grid .given').first()).toBeVisible();
    expect(errors).toEqual([]);
});

test('learn steps apply and reverse the same deduction, challenge keeps evidence hidden and records a verified answer', async ({ page }, info) => {
    await page.goto('/'); await learn(page);
    await page.locator('#practice-technique').selectOption('naked-pair');
    const prepared = prepareExercise(PRACTICE_BANK.groups['naked-pair'][0]);
    const move = prepared.step.removals[0];
    const boxes = await page.locator('#practice-grid .board-cell').evaluateAll(cells => cells.map(c => { const r = c.getBoundingClientRect(); return [r.width, r.height]; }));
    expect(boxes.every(([w, h]) => Math.abs(w - h) <= 1)).toBe(true);
    const mark = page.locator(`#practice-grid [data-cell="${move.cell}"] .board-notes [data-digit="${move.digit}"]`);
    await expect(mark).toHaveText(move.digit);
    await page.locator('#practice-forward').click(); await page.locator('#practice-forward').click();
    await expect(mark).toHaveText('');
    await page.locator('#practice-back').click(); await expect(mark).toHaveText(move.digit);
    await page.locator('#practice-mode').selectOption('challenge');
    await expect(page.locator('#practice-grid .practice-evidence')).toHaveCount(0);
    await expect(page.locator('#practice-grid .board-selected')).toHaveCount(0);
    await page.locator(`#practice-grid [data-cell="${move.cell}"]`).click();
    await page.locator(`#practice-pad [data-digit="${move.digit}"]`).click();
    await expect(page.locator('#practice-status')).toContainText('Correct');
    await expect(mark).toHaveText('');
    await page.locator('#practice-before').click(); await expect(mark).toHaveText(move.digit);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sudoku_practice_v1')));
    expect(saved[prepared.id]).toMatchObject({ attempts: 1, independent: 1, assisted: 0 });
    await page.screenshot({ path: `e2e-results/140-learning-${info.project.name}.png`, fullPage: true });
});

test('guided practice checks the pattern before its consequence and supports transfer', async ({ page }) => {
    await page.goto('/'); await learn(page);
    await page.locator('#practice-technique').selectOption('naked-pair');
    await page.locator('#practice-mode').selectOption('guided');
    const { state, step } = prepareExercise(PRACTICE_BANK.groups['naked-pair'][0]);
    for (const cell of patternCells(step)) await page.locator(`#practice-grid [data-cell="${cell}"]`).click();
    for (const digit of patternDigits(state, step)) await page.locator(`#practice-pad [data-digit="${digit}"]`).click();
    await page.locator('#practice-pattern').click(); await expect(page.locator('#practice-status')).toContainText('Pattern identified');
    const move = step.removals[0]; await page.locator(`#practice-grid [data-cell="${move.cell}"]`).click();
    await page.locator(`#practice-pad [data-digit="${move.digit}"]`).click();
    await expect(page.locator('#practice-history')).toContainText('1 assisted');
    await page.locator('#practice-transfer').click();
    await expect(page.locator('#practice-overlay')).not.toHaveClass(/active/);
    await expect(page.locator('#status')).toContainText('Imported puzzle');
});

test('other board handoff carries notes and removes the source resume copy only after confirmation', async ({ page, context }) => {
    await page.goto('/'); await chooseBoard(page, '6'); await notesOptions(page, true); await page.locator('#small-fill').click();
    const notes = await page.evaluate(() => JSON.parse(localStorage.getItem('sudoku_small_v1_6')).notes);
    await puzzleTools(page); await page.locator('#small-handoff').click();
    const link = await page.locator('#small-text').inputValue();
    await expect(page.locator('#small-tool-status')).toContainText(/Copy the resume link|Resume link ready/);
    if (await page.locator('#small-handoff-confirm').isVisible()) await page.locator('#small-handoff-confirm').click();
    expect(await page.evaluate(() => localStorage.getItem('sudoku_small_v1_6'))).toBeNull();
    const receiver = await context.newPage(); await receiver.goto(link);
    await expect(receiver.locator('#small-status')).toContainText('continued from another device');
    expect(await receiver.evaluate(() => JSON.parse(localStorage.getItem('sudoku_small_v1_6')).notes)).toEqual(notes);
    await receiver.close();
});
