import { test } from '@playwright/test';
test('inspect dimming', async ({ page }) => {
    await page.goto('/');
    await page.locator('.diff-btn[data-diff="easy"]').click();
    await page.locator('#level-input').fill('1');
    await page.locator('#btn-new-game').click();
    await page.locator('.cell-wrapper.locked').first().waitFor();
    await page.locator('.status-bar').click();
    await page.locator('#btn-hint').click();

    const info = await page.evaluate(() => {
        const grid = document.getElementById('grid');
        const first = [...document.querySelectorAll('.cell-wrapper')]
            .find((c) => !c.classList.contains('hint-target') && !c.classList.contains('hint-evidence'));
        return {
            gridClass: grid.className,
            targets: document.querySelectorAll('.hint-target').length,
            evidence: document.querySelectorAll('.hint-evidence').length,
            firstClass: first ? first.className : null,
            firstOpacity: first ? getComputedStyle(first).opacity : null,
            matches: first ? first.matches('.grid-container.hint-explaining .cell-wrapper:not(.hint-target):not(.hint-evidence)') : null,
        };
    });
    console.log(JSON.stringify(info, null, 1));
});
