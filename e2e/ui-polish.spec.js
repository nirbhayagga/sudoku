import { test, expect } from '@playwright/test';
import { PUZZLES } from '../puzzle-bank.js';

async function phone(browser, { width = 393, height = 852, reducedMotion = 'no-preference' } = {}) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, reducedMotion, serviceWorkers: 'block' });
    // Linux browser emulation has zero native insets. Model nonzero CSS env
    // values explicitly; physical installed-iPhone testing remains separate.
    await context.route('**/*.css', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: (await response.text()).replaceAll('env(safe-area-inset-top)', '59px').replaceAll('env(safe-area-inset-bottom)', '34px') });
    });
    return { context, page: await context.newPage() };
}
const linked = '/?bank=2&d=easy&level=1';
const ready = async page => {
    await expect(page.locator('body')).not.toHaveClass(/is-loading/);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(100);
};

test('safe areas survive narrow breakpoints and reduced motion preserves board size', async ({ browser }) => {
    const widths = [];
    for (const reducedMotion of ['no-preference', 'reduce']) {
        const { context, page } = await phone(browser, { width: 375, height: 812, reducedMotion });
        await page.goto(linked); await ready(page);
        const metrics = await page.evaluate(() => ({
            padding: [parseFloat(getComputedStyle(document.body).paddingTop), parseFloat(getComputedStyle(document.body).paddingBottom)],
            grid: document.querySelector('#grid').getBoundingClientRect().width,
            overflow: document.documentElement.scrollHeight - innerHeight,
        }));
        expect(metrics.padding).toEqual([59, 34]);
        expect(metrics.grid).toBeGreaterThan(250);
        expect(metrics.overflow).toBeLessThanOrEqual(1);
        widths.push(metrics.grid);
        await page.evaluate(() => dispatchEvent(new Event('resize')));
        await expect.poll(async () => (await page.locator('#grid').boundingBox()).width).toBe(metrics.grid);
        await context.close();
    }
    expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(1);
});

test('shared-puzzle startup stays stable while the bank is delayed', async ({ page }) => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/assets/puzzle-bank.*.js', async route => { await gate; await route.continue(); });
    await page.goto(linked, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loading-status')).toBeVisible();
    await expect(page.locator('#board-rule')).toBeHidden();
    await expect(page.locator('#grid')).toBeHidden();
    release(); await ready(page);
    await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();
    await expect(page.locator('#btn-hint')).toBeVisible();
    await expect(page.locator('#theme-toggle')).toBeVisible();
    await expect(page.locator('#tab-play')).toBeVisible();
    await expect(page.locator('#loading-status')).toHaveCount(0);
});

test('resume is above the board and visible on a short phone', async ({ browser }) => {
    const { context, page } = await phone(browser, { height: 664 });
    await context.addInitScript(puzzle => localStorage.setItem('sudoku_saved_game_v2', JSON.stringify({ puzzle, difficulty: 'easy', level: 1, userValues: puzzle, timerSeconds: 123 })), PUZZLES.easy[0].puzzle);
    await page.goto('/'); await ready(page);
    await expect(page.locator('#btn-resume-yes')).toBeInViewport();
    const banner = await page.locator('.resume-banner').boundingBox(), grid = await page.locator('#grid').boundingBox();
    expect(banner.y + banner.height).toBeLessThanOrEqual(grid.y);
    await expect(page.locator('.resume-banner')).toContainText('Easy #1');
    await context.close();
});

test('dialog header stays visible, background stays still, and focus excludes closed details', async ({ browser }) => {
    const { context, page } = await phone(browser, { height: 664 });
    await page.goto('/'); await ready(page);
    await page.locator('#tab-solver').click();
    await page.locator('#btn-generate').click();
    const original = await page.evaluate(() => ({ top: document.body.style.top, position: getComputedStyle(document.body).position }));
    expect(original.position).toBe('fixed');
    await page.locator('#generator-overlay .generator-advanced summary').first().click();
    await page.locator('#generator-overlay .modal-body').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(page.locator('#btn-generator-close')).toBeInViewport();
    await page.locator('#generator-overlay .generator-advanced summary').first().click();
    await page.locator('#generator-family').focus();
    for (let i = 0; i < 14; i++) {
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(() => ({ id: document.activeElement.id, inside: !!document.activeElement.closest('#generator-overlay') }));
        expect(focus.inside).toBe(true);
        expect(['generator-seed', 'generator-attempts']).not.toContain(focus.id);
    }
    expect(await page.evaluate(() => document.body.style.top)).toBe(original.top);
    await page.keyboard.press('Escape');
    await expect(page.locator('#btn-generate')).toBeFocused();
    expect(await page.evaluate(() => document.body.classList.contains('dialog-open'))).toBe(false);
    await context.close();
});

test('native select painted surface follows every theme', async ({ page }) => {
    await page.goto('/'); await ready(page);
    for (const theme of ['light','dark','midnight','sakura','ocean','forest','arctic','peony','matcha','vino']) {
        await page.locator('#theme-toggle').click();
        await page.locator(`.theme-option[data-theme="${theme}"]`).click();
        const select = page.locator('#board-size');
        const png = await select.screenshot();
        // Inspect a real painted pixel, so native WebKit chrome cannot pass
        // just by reporting a CSS background it does not actually paint.
        const painted = await page.evaluate(async base64 => {
            const img = new Image(); img.src = `data:image/png;base64,${base64}`; await img.decode();
            const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
            const pixel = [...ctx.getImageData(Math.floor(img.width / 2), Math.floor(img.height * .15), 1, 1).data].slice(0, 3);
            const expected = getComputedStyle(document.querySelector('#board-size')).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number);
            return { pixel, expected };
        }, png.toString('base64'));
        expect(painted.pixel.every((v, i) => Math.abs(v - painted.expected[i]) <= 3), theme).toBe(true);
    }
});

test('variant setup folds and its keypad stays readable on phones', async ({ browser }) => {
    const { context, page } = await phone(browser);
    await page.goto('/'); await ready(page);
    await page.locator('#board-rule').selectOption('hyper');
    await expect(page.locator('.small-cell')).toHaveCount(81);
    await expect(page.locator('#small-setup-options')).toBeHidden();
    await expect(page.locator('#small-hint')).toBeInViewport();
    await expect(page.locator('#small-pause')).toBeInViewport();
    expect(await page.locator('#small-pad button').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await page.locator('#small-setup-toggle').click();
    await expect(page.locator('#small-rules')).toBeVisible();
    await page.locator('#small-setup-toggle').click();
    await page.locator('#small-tools > summary').click();
    await page.locator('[data-tool="print"]').click();
    await expect(page.locator('#small-print-source')).toBeVisible();
    await expect(page.locator('#small-text')).toBeHidden();
    await page.locator('#board-size').selectOption('6');
    await expect(page.locator('.small-cell')).toHaveCount(36);
    await page.locator('#small-fill').click();
    const cells = await page.locator('.small-cell').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return [r.width, r.height]; }));
    expect(cells.every(([w, h]) => w >= 43 && Math.abs(w - h) <= 1)).toBe(true);
    await context.close();
});


test('switching practice, variants and small sizes leaves buttons stable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/'); await ready(page);
    await page.locator('#btn-update').evaluate(el => { el.style.display = ''; });
    await page.locator('#btn-new-game').click();
    await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();
    await page.locator('#btn-practice').click();
    await page.locator('#btn-practice-close').click();
    if (await page.locator('#btn-setup-toggle').isVisible()) await page.locator('#btn-setup-toggle').click();
    for (const rule of ['diagonal', 'hyper']) {
        await page.locator('#board-rule').selectOption(rule);
        await page.locator('#small-fill').click();
    }
    await page.locator('#board-size').selectOption('6');
    await page.locator('#small-fill').click();
    await expect(page.locator('.small-pencil').first()).toBeVisible();
    const fonts = await page.locator('.small-cell').first().evaluate(el => getComputedStyle(el).fontFamily);
    expect(fonts).toContain('JetBrains Mono');
});


test('the board and controls never overlap at the narrow split-layout boundary', async ({ page }) => {
    for (const width of [700, 720, 768, 800]) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(linked); await ready(page);
        const grid = await page.locator('#grid').boundingBox();
        const controls = await page.locator('#play-controls').boundingBox();
        expect(grid.x + grid.width + 12, `${width}px split layout`).toBeLessThanOrEqual(controls.x);
        expect(controls.x + controls.width).toBeLessThanOrEqual(width);
    }
});
