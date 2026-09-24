import { test, expect } from '@playwright/test';
import { SMALL_BANK } from '../small-bank.js';
import { SMALL_GEOMETRIES } from '../geometry.js';
import { solveSized } from '../sized-solver.js';

test('plays, pauses, restores notes and resumes each board size separately', async ({page}) => {
    await page.goto('/'); await page.locator('#board-size').selectOption('6');
    await expect(page.locator('.small-cell')).toHaveCount(36);
    await page.locator('#small-auto').click();
    await expect(page.locator('#small-auto')).toHaveAttribute('aria-pressed','true');
    await page.locator('#small-undo').click();
    await expect(page.locator('#small-auto')).toHaveAttribute('aria-pressed','false');
    const p=SMALL_BANK[6][0].puzzle, cell=p.indexOf('0'), answer=solveSized(p,SMALL_GEOMETRIES[6]).solutions[0];
    await page.locator(`.small-cell[data-cell="${cell}"]`).click();
    await page.locator('#small-pause').click();
    await page.locator(`#small-pad [data-digit="${answer[cell]}"]`).click();
    await expect(page.locator(`.small-cell[data-cell="${cell}"]`)).toHaveText('');
    await page.locator('#small-pause').click();
    await page.locator(`#small-pad [data-digit="${answer[cell]}"]`).click();
    await page.locator('#board-size').selectOption('4');
    await expect(page.locator('.small-cell')).toHaveCount(16);
    await page.locator('#board-size').selectOption('6');
    await expect(page.locator(`.small-cell[data-cell="${cell}"]`)).toHaveText(answer[cell]);
    await page.reload(); await page.locator('#board-size').selectOption('6');
    await expect(page.locator(`.small-cell[data-cell="${cell}"]`)).toHaveText(answer[cell]);
});

test('imports, completes, exports, shares and undoes a small puzzle', async ({page}, info) => {
    const p=SMALL_BANK[4][0].puzzle, answer=solveSized(p,SMALL_GEOMETRIES[4]).solutions[0];
    await page.goto(`/?size=4&box=2x2&p=${p}`);
    await expect(page.locator('.small-cell')).toHaveCount(16);
    await page.locator('#small-tools summary').click();
    await page.locator('#small-text').fill('0'.repeat(16)); await page.locator('#small-import').click();
    await expect(page.locator('#small-status')).toContainText('exactly one solution');
    await page.locator('#small-text').fill(p); await page.locator('#small-import').click();
    for(let i=0;i<16;i++) if(p[i]==='0') {
        await page.locator(`.small-cell[data-cell="${i}"]`).click();
        await page.locator(`#small-pad [data-digit="${answer[i]}"]`).click();
    }
    await expect(page.locator('#small-status')).toContainText('Completed 4×4');
    await page.locator('#small-undo').click();
    expect(await page.locator('.small-cell').allTextContents()).toContain('');
    await page.locator('#small-export').click();
    await expect(page.locator('#small-text')).toHaveValue(p.replaceAll('0','.').match(/.{4}/g).join('\n'));
    const downloaded=page.waitForEvent('download'); await page.locator('#small-png').click();
    await (await downloaded).saveAs(`e2e-results/small-${info.project.name}.png`);
    await page.locator('#small-share').click();
    const link=await page.locator('#small-text').inputValue(); expect(new URL(link).searchParams.get('p')).toBe(p);
    await page.locator('#small-print-source').selectOption('consecutive');
    await page.locator('#small-print-count').fill('5'); await page.locator('#small-per-page').selectOption('2');
    await page.locator('#small-answers').check(); await page.locator('#small-print').click();
    await expect(page.frameLocator('.small-print-frame').locator('article')).toHaveCount(10);
    await page.locator('#small-tools summary').click();
    await page.screenshot({path:`e2e-results/small-board-${info.project.name}.png`,fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('small boards work from the standalone disk build', async ({page}) => {
    const { pathToFileURL } = await import('node:url');
    const { resolve } = await import('node:path');
    await page.goto(pathToFileURL(resolve('dist-standalone/index.html')).href);
    await page.locator('#board-size').selectOption('6');
    await expect(page.locator('.small-cell')).toHaveCount(36);
    await page.locator('#small-hint').click();
    await expect(page.locator('#small-status')).toContainText('free');
});

test('small boards remain reachable on narrow and landscape screens', async ({page}) => {
    await page.goto('/'); await page.locator('#board-size').selectOption('6');
    for(const viewport of [{width:320,height:480},{width:740,height:350}]) {
        await page.setViewportSize(viewport);
        await page.locator('#small-tools summary').scrollIntoViewIfNeeded();
        await expect(page.locator('#small-tools summary')).toBeInViewport();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
});
