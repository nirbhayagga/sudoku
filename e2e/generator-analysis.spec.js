import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PUZZLES } from '../puzzle-bank.js';
import { SudokuSolver } from '../solver.js';
import { runReasoning } from '../reasoning.js';

async function generate(page) {
    await page.locator('#tab-solver').click();
    await page.locator('#btn-generate').click();
    await page.locator('#generator-family').selectOption('singles');
    await page.locator('#generator-symmetry').selectOption('rotate180');
    await page.locator('#generator-clue-mode').selectOption('exact');
    await page.locator('#generator-min').fill('35');
    await page.locator('#generator-form .generator-advanced summary').click();
    await page.locator('#generator-seed').fill('preview-check');
    await page.locator('#btn-generator-start').click();
    await expect(page.locator('#generator-status')).toContainText('Target met');
    return page.locator('#generator-preview span').evaluateAll(cells => cells.map(cell => cell.textContent || '0').join(''));
}

test('generates a unique preview and exports text and PNG', async ({ page }, testInfo) => {
    await page.goto('/');
    const board = await generate(page);
    await page.locator('#generator-result').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `e2e-results/generator-${testInfo.project.name}.png`, fullPage: true });
    expect(board.replaceAll('0', '')).toHaveLength(35);
    expect(SudokuSolver.countSolutions(board, 2)).toBe(1);
    expect([...board].every((d, i) => (d === '0') === (board[80 - i] === '0'))).toBe(true);
    await expect(page.locator('.cell-input').first()).toHaveValue('');
    await page.locator('#btn-generator-export').click();
    await expect(page.locator('#export-source')).toBeHidden();
    await expect(page.locator('#export-text')).toHaveValue(board.replaceAll('0', '.'));
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export-image').click();
    const download = await downloadPromise;
    await download.saveAs(`e2e-results/sudoku-export-${testInfo.project.name}.png`);
    const bytes = await readFile(await download.path());
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    expect(bytes.readUInt32BE(16)).toBe(1080);
    expect(bytes.readUInt32BE(20)).toBe(1200);
});

test('keeps a generated preview after export and plays that exact board', async ({ page }) => {
    await page.goto('/');
    const board = await generate(page);
    await page.locator('#btn-generator-export').click();
    await page.locator('#btn-export-close').click();
    await page.locator('#btn-generate').click();
    await page.locator('#btn-generator-play').click();
    await expect(page.locator('#status')).toContainText('Imported puzzle');
    await expect(page.locator('.cell-wrapper.given')).toHaveCount(35);
    expect(await page.locator('.cell-input').evaluateAll(cells => cells.map(cell => cell.value || '0').join(''))).toBe(board);
});

test('cancels generation and reports unmet targets without replacing the grid', async ({ page }) => {
    await page.goto('/');
    await page.locator('#tab-solver').click(); await page.locator('#btn-generate').click();
    await page.locator('#generator-family').selectOption('chains');
    await page.locator('#generator-clue-mode').selectOption('exact');
    await page.locator('#generator-min').fill('17');
    await page.locator('#generator-form .generator-advanced summary').click();
    await page.locator('#generator-attempts').fill('100');
    await page.locator('#btn-generator-start').click();
    await page.locator('#btn-generator-cancel').click();
    await expect(page.locator('#generator-status')).toContainText('cancelled');
    await expect(page.locator('#generator-result')).toBeHidden();
    await page.locator('#generator-min').fill('79');
    await page.locator('#generator-attempts').fill('1');
    await page.locator('#btn-generator-start').click();
    await expect(page.locator('#generator-status')).toContainText('Target not met');
    await expect(page.locator('#generator-summary')).toContainText('79 clues');
    await page.locator('#btn-generator-close').click();
    await expect(page.locator('.cell-input').first()).toHaveValue('');
});

test('advanced proof is free, can be followed, and is invalidated by undo', async ({ page }) => {
    const puzzle = PUZZLES.easy[97].puzzle;
    const solution = SudokuSolver.solveSudoku(puzzle).solution;
    const partial = [...puzzle];
    for (const step of runReasoning(puzzle, { familyCap: 0, trace: true }).trace) if (step.kind === 'placement') partial[step.idx] = step.digit;
    await page.addInitScript(state => localStorage.setItem('sudoku_saved_game', JSON.stringify(state)), {
        puzzle, solution, userValues: partial.join(''), difficulty: 'easy', level: 98,
        notes: Array.from({ length: 81 }, () => []), timerSeconds: 0,
    });
    await page.goto('/'); await page.locator('#btn-resume-yes').click();
    await page.locator('#btn-hint').click();
    await expect(page.locator('#status')).toContainText('Explained hint — free');
    await expect(page.locator('#hint-details')).toBeVisible();
    await page.locator('#hint-details > summary').click();
    await expect(page.locator('#hint-steps')).toContainText('Assume:');
    await page.locator('#btn-hint').click();
    await expect(page.locator('.cell-wrapper.hint')).toHaveCount(1);
    await page.locator('#btn-undo').click();
    await expect(page.locator('#hint-details')).toBeHidden();
    expect(await page.locator('.cell-input').evaluateAll(cells => cells.map(cell => cell.value || '0').join(''))).toBe(partial.join(''));
});

test('closing an import cancels its pending Play request', async ({ page }) => {
    await page.goto('/'); await page.locator('#btn-import-play').click();
    await page.locator('#import-text').fill(PUZZLES.evil.at(-1).puzzle);
    await page.evaluate(() => {
        document.getElementById('btn-modal-play').click();
        document.getElementById('btn-modal-cancel').click();
    });
    await expect(page.locator('#modal-overlay')).not.toHaveClass(/active/);
    await expect(page.locator('#btn-new-game')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('sudoku_saved_game'))).toBeNull();
});

test('dynamic deductions render their proof and reveal the correct value in a real worker', async ({ page }, testInfo) => {
    const puzzle = PUZZLES.expert[444].puzzle;
    const solution = SudokuSolver.solveSudoku(puzzle).solution;
    const partial = [...puzzle];
    for (const step of runReasoning(puzzle, { trace: true }).trace) if (step.kind === 'placement') partial[step.idx] = step.digit;
    await page.addInitScript(state => localStorage.setItem('sudoku_saved_game', JSON.stringify(state)), {
        puzzle, solution, userValues: partial.join(''), difficulty: 'expert', level: 445,
        notes: Array.from({ length: 81 }, () => []), timerSeconds: 0,
    });
    await page.goto('/'); await page.locator('#btn-resume-yes').click();
    await page.locator('#btn-hint').click();
    await expect(page.locator('#status')).toContainText('Explained hint — free', { timeout: 12000 });
    await page.locator('#hint-details > summary').click();
    await expect(page.locator('#hint-steps')).toContainText('Following the assumption');
    await page.locator('#hint-steps details > summary').first().click();
    await expect(page.locator('#hint-steps details[open]')).toContainText('From');
    await page.screenshot({ path: `e2e-results/dynamic-proof-${testInfo.project.name}.png`, fullPage: true });
    const target = await page.locator('.hint-target').evaluate(node => [...node.parentNode.children].indexOf(node));
    await page.locator('#btn-hint').click();
    await expect(page.locator('.cell-input').nth(target)).toHaveValue(solution[target]);
    await page.locator('#btn-undo').click();
    await expect(page.locator('#hint-details')).toBeHidden();
    expect(await page.locator('.cell-input').evaluateAll(cells => cells.map(c => c.value || '0').join(''))).toBe(partial.join(''));
});

test('inline analysis worker also runs in the standalone file build', async ({ page }) => {
    await page.goto(pathToFileURL(resolve('dist-standalone/index.html')).href);
    const board = await generate(page);
    expect(SudokuSolver.countSolutions(board, 2)).toBe(1);
});
