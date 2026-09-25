import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PUZZLES } from '../puzzle-bank.js';
import { SudokuSolver } from '../solver.js';

const puzzle = PUZZLES.easy[0].puzzle;
const solution = SudokuSolver.solveSudoku(puzzle).solution;

test('imports a playable board, previews hints for free and resumes as Imported', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-import-play').click();
    await page.locator('#import-text').fill(puzzle);
    await expect(page.locator('#import-assessment')).toContainText('Solved with singles');
    await page.locator('#btn-modal-play').click();
    await expect(page.locator('#status')).toContainText('Imported puzzle');
    await page.locator('.cell-wrapper:not(.locked)').first().click();
    const before = await page.locator('.cell-input').evaluateAll(cells => cells.map(cell => cell.value));
    await page.locator('#btn-hint').click();
    await expect(page.locator('#btn-hint')).toHaveText('Reveal (+1 hint)');
    expect(await page.locator('.cell-input').evaluateAll(cells => cells.map(cell => cell.value))).toEqual(before);
    await page.locator('#btn-hint').click();
    await expect(page.locator('.cell-wrapper.hint')).toHaveCount(1);
    await page.reload(); await page.locator('#btn-resume-yes').click();
    await expect(page.locator('#status')).toContainText('Imported puzzle');
    await expect(page.locator('.cell-wrapper.hint')).toHaveCount(1);
    await page.locator('#btn-stats').click();
    await expect(page.locator('#stats-content')).toContainText('Imported');
});

async function enter(page, idx, digit, isMobile) {
    await page.locator('.cell-input').nth(idx).click();
    if (isMobile) await page.locator(`.numpad-btn[data-digit="${digit}"]`).click();
    else await page.keyboard.press(digit);
}

test('successive touch digits follow the visible selection', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Touch selection path');
    await page.goto('/?bank=2&d=easy&level=1');
    await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();
    const first = puzzle.indexOf('0');
    await enter(page, first, '1', true);
    await expect(page.locator('.cell-input').nth(first)).toHaveValue('1');
    const next = Number(await page.locator('.cell-wrapper.focused').getAttribute('data-idx'));
    expect(next).not.toBe(first);
    await page.locator('.numpad-btn[data-digit="2"]').click();
    await expect(page.locator('.cell-input').nth(first)).toHaveValue('1');
    await expect(page.locator('.cell-input').nth(next)).toHaveValue('2');
});

test('generated notes undo back to manual notes and restore on redo', async ({ page, isMobile }) => {
    await page.goto('/?bank=2&d=easy&level=1');
    await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();
    await page.locator(isMobile ? '#numpad-notes' : '#btn-notes-toggle').click();
    await enter(page, puzzle.indexOf('0'), '2', isMobile);
    const notes = () => page.locator('.note-digit.visible').evaluateAll(els => els.map(el => `${el.closest('.cell-wrapper').dataset.idx}:${el.dataset.digit}`));
    const manual = await notes();
    await page.locator('#btn-auto-notes').click(); const generated = await notes();
    expect(generated.length).toBeGreaterThan(manual.length);
    await page.locator('#btn-undo').click(); expect(await notes()).toEqual(manual);
    await expect(page.locator('#btn-auto-notes')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator(isMobile ? '#numpad-notes' : '#btn-notes-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#btn-redo').click(); expect(await notes()).toEqual(generated);
    await expect(page.locator(isMobile ? '#numpad-notes' : '#btn-notes-toggle')).toHaveAttribute('aria-pressed', 'false');
});

test('completion identifies, shares and exports the puzzle, and undo preserves one win', async ({ page, isMobile }) => {
    test.slow();
    const idx = puzzle.indexOf('0');
    await page.addInitScript(({ puzzle, solution, idx }) => {
        if (!sessionStorage.getItem('review-seeded')) {
            localStorage.setItem('sudoku_saved_game_v2', JSON.stringify({
                puzzle, solution, difficulty: 'easy', level: 1,
                userValues: solution.slice(0, idx) + '0' + solution.slice(idx + 1),
                notes: Array.from({ length: 81 }, () => []), timerSeconds: 123,
            }));
            sessionStorage.setItem('review-seeded', 'yes');
        }
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.__sharedPuzzle = text; } }, configurable: true });
    }, { puzzle, solution, idx });
    await page.goto('/'); await page.locator('#btn-resume-yes').click();
    await enter(page, idx, solution[idx], isMobile);
    await expect(page.locator('#win-overlay')).toHaveClass(/active/);
    await expect(page.locator('#win-puzzle')).toContainText('Easy · Level 1');
    await page.locator('#btn-win-export').click();
    await expect(page.locator('#export-text')).toHaveValue(puzzle.replaceAll('0', '.'));
    await page.locator('#export-source').selectOption('current');
    await expect(page.locator('#export-text')).toHaveValue(solution);
    await page.locator('#btn-export-close').click();
    await page.locator('#btn-results').click(); await page.locator('#btn-win-share').click();
    await expect.poll(() => page.evaluate(() => window.__sharedPuzzle)).toContain('level=1');
    const won = () => page.evaluate(() => JSON.parse(localStorage.getItem('sudoku_stats_v2')).easy.won);
    expect(await won()).toBe(1);
    await page.locator('#btn-undo').click(); await expect(page.locator('.cell-input').nth(idx)).toHaveValue('');
    await page.locator('#btn-redo').click(); await expect(page.locator('.cell-input').nth(idx)).toHaveValue(solution[idx]);
    expect(await won()).toBe(1);
});

test('bulk worksheet accepts a page total and consecutive levels without wrapping', async ({ page }) => {
    await page.goto('/?bank=2&d=easy&level=1');
    await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();
    await page.locator('#btn-pause').click(); await page.locator('#btn-pause-export').click();
    await page.locator('.print-options summary').click();
    await expect(page.locator('#print-bank-options')).toBeHidden();
    await page.locator('#print-source').selectOption('bank');
    await page.locator('#print-order').selectOption('consecutive');
    await page.locator('#print-unit').selectOption('pages');
    await page.locator('#print-count').fill('2');
    await page.locator('#print-layout').selectOption('4');
    await page.locator('#print-start').fill(String(PUZZLES.easy.length - 6));
    await expect(page.locator('#print-summary')).toContainText('Only 7 puzzles remain');
    await expect(page.locator('#btn-print')).toBeDisabled();
    await page.locator('#print-start').fill(String(PUZZLES.easy.length - 7));
    await page.locator('#print-answers').check();
    await expect(page.locator('#print-summary')).toHaveText('8 puzzles · 2 puzzle pages + 2 answer pages · 4 pages total.');
    const stats = await page.evaluate(() => localStorage.getItem('sudoku_stats_v2'));
    await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
    await page.locator('#btn-print').click();
    await expect.poll(() => page.evaluate(() => window.__printed)).toBe(true);
    await expect(page.locator('.worksheet-page')).toHaveCount(4);
    expect(await page.locator('.worksheet-page h2').allTextContents()).toEqual(
        Array.from({ length: 16 }, (_, i) => `Easy · Level ${PUZZLES.easy.length - 7 + i % 8}`));
    const printedBoard = await page.locator('.worksheet-grid').first().locator('span').evaluateAll(cells => cells.map(cell => cell.textContent || '0').join(''));
    expect(printedBoard).toBe(PUZZLES.easy[PUZZLES.easy.length - 8].puzzle);
    expect(await page.evaluate(() => localStorage.getItem('sudoku_stats_v2'))).toBe(stats);
});

for (const perPage of [1, 2, 4, 6]) {
    test(`worksheet layout ${perPage} has separate answer pages and no overflow`, async ({ page, browserName }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop', 'Print pagination uses desktop Chromium PDF output');
        await page.goto('/?bank=2&d=easy&level=1');
        await page.locator('#btn-pause').click(); await page.locator('#btn-pause-export').click();
        await page.locator('.print-options summary').click();
        await page.locator('#print-source').selectOption('bank');
        await page.locator('#print-count').fill(String(perPage + 1));
        await page.locator('#print-layout').selectOption(String(perPage));
        await page.locator('#print-answers').check();
        await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
        await page.locator('#btn-print').click();
        await expect.poll(() => page.evaluate(() => window.__printed)).toBe(true);
        await expect(page.locator('.worksheet-page')).toHaveCount(4);
        await page.emulateMedia({ media: 'print' });
        const overflow = await page.locator('.worksheet-page').evaluateAll(pages => pages.some(page => page.scrollHeight > page.clientHeight + 1));
        expect(overflow).toBe(false);
        if (process.env.PRINT_QA_DIR && browserName === 'chromium') {
            await mkdir(process.env.PRINT_QA_DIR, { recursive: true });
            for (const format of ['A4', 'Letter']) await page.pdf({ path: join(process.env.PRINT_QA_DIR, `sudoku-${perPage}-${format}.pdf`), format });
        }
    });
}
