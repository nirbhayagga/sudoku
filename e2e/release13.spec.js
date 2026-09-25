import { test, expect } from '@playwright/test';
import { PUZZLES } from '../puzzle-bank.js';
import { SMALL_BANK } from '../small-bank.js';
import { VARIANT_BANK } from '../variant-bank.js';
import { PRACTICE_BANK } from '../practice-bank.js';
import { prepareExercise } from '../practice.js';
import { SudokuSolver } from '../solver.js';
import { solveSized } from '../sized-solver.js';
import { SMALL_GEOMETRIES } from '../geometry.js';

test('progression keeps the board until Next, persists entries and ignores normal play', async ({ page }, info) => {
    const item = PUZZLES.easy[0], solution = SudokuSolver.solveSudoku(item.puzzle).solution, idx = item.puzzle.indexOf('0');
    await page.goto('/');
    await page.locator('#progression-controls summary').click(); await page.locator('#btn-progression').click();
    await expect(page.locator('#status')).toContainText('Progression');
    await page.addInitScript(({item,solution,idx}) => localStorage.setItem('sudoku_saved_game_v2', JSON.stringify({
        puzzle:item.puzzle,difficulty:'easy',level:1,progression:true,userValues:solution.slice(0,idx)+'0'+solution.slice(idx+1),timerSeconds:42,
    })), {item,solution,idx});
    await page.reload(); await page.locator('#btn-resume-yes').click();
    if (info.project.name === 'desktop') await page.locator('.cell-input').nth(idx).fill(solution[idx]);
    else { await page.locator('.cell-wrapper').nth(idx).click(); await page.locator(`#numpad [data-digit="${solution[idx]}"]`).click(); }
    await expect(page.locator('#win-overlay')).toHaveClass(/active/);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sudoku_progression_v1'))['9'])).toEqual([item.id]);
    await expect(page.locator('#win-puzzle')).toContainText('Level 1');
    await page.locator('#btn-win-next').click();
    await expect(page.locator('#status')).toContainText('Easy #2');
});

test('small progression is explicit, completion stays once after undo, and next starts when requested', async ({page}) => {
    await page.goto('/'); await page.locator('#board-size').selectOption('4');
    await page.locator('#small-setup-toggle').click();
    await page.locator('#small-app .progression-controls summary').click(); await page.locator('#small-path').click();
    const item=SMALL_BANK[4][0], answer=solveSized(item.puzzle,SMALL_GEOMETRIES[4]).solutions[0];
    await expect(page.locator('#small-next')).toBeDisabled();
    for(let i=0;i<16;i++) if(item.puzzle[i]==='0') { await page.locator(`.small-cell[data-cell="${i}"]`).click(); await page.locator(`#small-pad [data-digit="${answer[i]}"]`).click(); }
    await expect(page.locator('#small-path-status')).toContainText('1 of 36');
    await page.locator('#small-undo').click(); await page.locator('#small-redo').click();
    await expect(page.locator('#small-path-status')).toContainText('1 of 36');
    await page.locator('#small-next').click(); await expect(page.locator('#small-identity')).toContainText('Challenge 2');
});

test('practice teaches a verified deduction in a keyboard-accessible dialog', async ({page}, info) => {
    await page.goto('/'); await page.locator('#progression-controls summary').click(); await page.locator('#btn-practice').click();
    await expect(page.locator('#practice-overlay')).toHaveClass(/active/);
    await page.locator('#practice-technique').selectOption('naked-pair');
    const exercise=PRACTICE_BANK.groups['naked-pair'][0], {step}=prepareExercise(exercise), move=step.removals[0];
    await page.locator(`.practice-cell[data-cell="${move.cell}"]`).click();
    await page.locator(`#practice-pad [data-digit="${move.digit}"]`).click();
    await expect(page.locator('#practice-status')).toContainText('Correct');
    await expect(page.locator('#practice-proof svg')).toBeVisible();
    await page.screenshot({path:`e2e-results/practice-${info.project.name}.png`,fullPage:true});
    await page.locator('#btn-practice-close').click(); await expect(page.locator('#practice-overlay')).not.toHaveClass(/active/);
});

for (const rule of ['diagonal','hyper']) test(`${rule} keeps its constraints through import, notes, sharing and print`, async ({page}, info) => {
    await page.goto('/'); await page.locator('#board-rule').selectOption(rule);
    await expect(page.locator('.small-cell')).toHaveCount(81);
    await expect(page.locator('#small-rules')).toContainText(rule === 'diagonal' ? 'diagonals' : 'four shaded');
    await page.locator('#small-auto').click(); await page.locator('#small-hint').click();
    await expect(page.locator('#small-status')).toContainText('Explained hint');
    await page.locator('#small-tools summary').click(); await page.locator('#small-export').click();
    await expect(page.locator('#small-text')).toHaveValue(new RegExp(`^# Sudoku rules: ${rule}`));
    await page.locator('#small-import').click(); await expect(page.locator('#small-status')).toContainText('Imported puzzle.');
    await page.locator('#small-share').click(); const link=await page.locator('#small-text').inputValue();
    expect(new URL(link).searchParams.get('rule')).toBe(rule);
    await page.locator('[data-tool="print"]').click();
    await page.locator('#small-print').click();
    await expect(page.frameLocator('.small-print-frame').locator('body')).toContainText(rule === 'diagonal' ? 'Diagonal' : 'Hyper');
    await page.goto(link); await expect(page.locator('#board-rule')).toHaveValue(rule); await expect(page.locator('.small-cell')).toHaveCount(81);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`e2e-results/variant-${rule}-${info.project.name}.png`,fullPage:true});
    expect(VARIANT_BANK[rule]).toHaveLength(24);
});

test('rejects mismatched links and restores only the selected rule', async ({page}) => {
    await page.goto(`/?size=4&box=2x2&rule=hyper&p=${SMALL_BANK[4][0].puzzle}`);
    await expect(page.locator('#status')).toContainText('invalid or unsupported board rules');
    await expect(page.locator('#small-app')).toBeHidden();
    await page.locator('#board-rule').selectOption('diagonal');
    await page.locator('#small-tools summary').click();
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('sudoku_small_v1_9-diagonal')));
    await page.locator('#board-rule').selectOption('hyper');
    await page.locator('#small-tools summary').click();
    await page.locator('[data-tool="backup"]').click();
    await page.locator('#small-restore').setInputFiles({name:'wrong-rule.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state))});
    await expect(page.locator('#small-status')).toContainText('valid backup for this board size and rules');
    await expect(page.locator('#small-title')).toContainText('Hyper');
});

test('cancels small-board work on request, edited input or board switch', async ({page}) => {
    await page.addInitScript(() => {
        window.workerCalls = {started:0,terminated:0};
        window.Worker = class {
            postMessage() { window.workerCalls.started++; }
            terminate() { window.workerCalls.terminated++; }
        };
    });
    await page.goto('/'); await page.locator('#board-size').selectOption('6');
    await page.locator('#small-tools summary').click();
    for (let i=1;i<=3;i++) {
        await page.locator('#small-generate').click();
        await expect.poll(()=>page.evaluate(()=>window.workerCalls.started)).toBe(i);
        if (i===1) await page.locator('#small-generate').click();
        if (i===2) await page.locator('#small-text').fill('input changed');
        if (i===3) await page.locator('#board-size').selectOption('4');
        await expect.poll(()=>page.evaluate(()=>window.workerCalls.terminated)).toBe(i);
        await expect(page.locator('#small-generate')).toHaveText('Generate');
    }
    await expect(page.locator('#small-title')).toContainText('4 × 4');
});

test('variant worksheets fit 1, 2, 4 and 6 puzzles within a Letter or A4 page', async ({page}) => {
    await page.goto('/'); await page.locator('#board-rule').selectOption('hyper');
    await page.locator('#small-tools summary').click();
    await page.locator('[data-tool="print"]').click();
    await page.locator('#small-print-source').selectOption('consecutive');
    await page.locator('#small-answers').check();
    for (const count of [1,2,4,6]) {
        await page.locator('#small-per-page').selectOption(String(count));
        await page.locator('#small-print-count').fill(String(count));
        await page.locator('#small-print').click();
        await page.locator('.small-print-frame').evaluate(el => el.style.width = '190mm');
        const sheets = page.frameLocator('.small-print-frame').locator('.sheet');
        await expect(sheets).toHaveCount(2);
        expect(await sheets.evaluateAll(els => els.every(el => {
            const r = el.getBoundingClientRect();
            // A4 is the narrower paper; Letter is the shorter paper.
            return r.width <= 186 * 96/25.4 + 1 && r.height <= 255.4 * 96/25.4;
        }))).toBe(true);
    }
});
