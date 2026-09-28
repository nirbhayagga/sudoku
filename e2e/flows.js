import { expect } from '@playwright/test';

export async function closeActivity(page) {
    const close = page.locator('.modal-overlay.active [data-close]');
    if (await close.count()) await close.first().click();
}
export async function setup(page) {
    if (!await page.locator('#new-game-overlay').evaluate(el => el.classList.contains('active'))) {
        await closeActivity(page); await page.locator('#nav-new-game').click();
    }
    await page.locator('#game-kind').selectOption('classic');
}
export async function chooseBoard(page, kind, { fresh = false, level = 1 } = {}) {
    await closeActivity(page);
    if (kind === '4') {
        await page.locator('#nav-learn').click(); await page.locator('#learn-intro').click();
    } else {
        await page.locator('#nav-new-game').click();
        const label = { classic: 'Classic 9×9', '9': 'Classic 9×9', '6': 'Quick 6×6', diagonal: 'Diagonal 9×9', hyper: 'Hyper 9×9' }[kind];
        const saved = page.locator('#resume-list button').filter({ hasText: label });
        if (!fresh && await saved.count()) {
            if (!await page.locator('#resume-choices').evaluate(el => el.open)) await page.locator('#resume-choices summary').click();
            await saved.click();
        } else if (kind === 'classic' || kind === '9') {
            await page.locator('#game-kind').selectOption('classic'); await page.locator('#btn-new-game').click();
        } else {
            await page.locator('#game-kind').selectOption(kind); await page.locator('#other-level').fill(String(level)); await page.locator('#other-start').click();
        }
    }
    await expect(page.locator(kind === 'classic' || kind === '9' ? '#grid' : '#small-grid')).toBeVisible();
}
export async function learn(page) {
    await closeActivity(page); await page.locator('#nav-learn').click(); await page.locator('#btn-practice').click();
    await expect(page.locator('#practice-grid')).toBeVisible();
}
export async function solver(page) {
    await closeActivity(page); await page.locator('#nav-tools').click(); await page.locator('#tab-solver').click();
}
export async function puzzleTools(page) {
    await closeActivity(page);
    const player = await page.locator('body').evaluate(el => el.classList.contains('small-board-active')) ? '#small-app' : '#app';
    await page.locator(player).getByRole('button', { name: 'Puzzle tools', exact: true }).click();
}
export async function notesOptions(page, small = false) {
    const details = page.locator(`${small ? '#small-app' : '#app'} .notes-options`);
    if (!await details.evaluate(el => el.open)) await details.locator('summary').click();
}
