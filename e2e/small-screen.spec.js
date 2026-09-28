import { setup } from './flows.js';
import { test, expect } from '@playwright/test';

/**
 * Short screens, where the layout has to scroll.
 *
 * The mobile project runs at a phone's full height, which hides this entirely:
 * a real iPhone reports 100-180px less once Safari's toolbars are showing, and
 * that is where the bottom row of controls goes under the fold. It shipped
 * unreachable — the page could not be scrolled at all, because a touchmove
 * handler was cancelling every drag.
 *
 * Layout runs in Chromium and WebKit. Only native drag injection requires
 * Chromium CDP; actual iOS toolbar and keyboard behavior still needs a device.
 */
const SCREENS = [
    { name: 'iPhone SE, toolbars showing', width: 375, height: 553 },
    { name: 'iPhone 16, toolbars showing', width: 393, height: 664 },
    { name: 'iPhone 16, installed', width: 393, height: 852 },
    { name: 'iPhone 16 Pro, toolbars showing', width: 402, height: 686 },
    { name: 'iPhone 16 Pro, installed', width: 402, height: 874 },
    { name: 'very short landscape', width: 740, height: 320 },
];

/** Screens the board is expected to fit on entirely, with no scrolling. */
const SHOULD_FIT = new Set([
    'iPhone 16, toolbars showing',
    'iPhone 16, installed',
    'iPhone 16 Pro, toolbars showing',
    'iPhone 16 Pro, installed',
]);

/** Drag a finger up the screen, the way a person scrolls. */
async function touchDrag(context, page, width, height) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart', touchPoints: [{ x: width / 2, y: height - 60 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: width / 2, y: 80 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(350);
}

for (const screen of SCREENS) {
    test.describe(screen.name, () => {
        test('every control can be reached', async ({ browser }) => {
            const context = await browser.newContext({
                viewport: { width: screen.width, height: screen.height },
                hasTouch: true, isMobile: true, deviceScaleFactor: 3,
            });
            const page = await context.newPage();
            await page.goto('/');

            const overflows = await page.evaluate(
                () => document.documentElement.scrollHeight > window.innerHeight
            );
            if (overflows && browser.browserType().name() === 'chromium') {
                await touchDrag(context, page, screen.width, screen.height);
            }

            // Reachable means "some scroll position shows it fully" — not
            // "everything fits at once", which is impossible on a short screen
            // and would be a broken assertion rather than a broken layout.
            const unreachable = await page.evaluate(async () => {
                const settle = () => new Promise((r) => setTimeout(r, 120));
                const out = [];

                for (const id of ['nav-new-game', 'nav-learn', 'nav-tools', 'btn-hint', 'btn-check']) {
                    const el = document.getElementById(id);
                    if (!el || getComputedStyle(el).display === 'none') continue;

                    el.scrollIntoView({ block: 'center' });
                    await settle();

                    const box = el.getBoundingClientRect();
                    if (box.bottom > window.innerHeight + 1 || box.top < -1) {
                        out.push(`${id} bottom=${Math.round(box.bottom)} top=${Math.round(box.top)} vh=${window.innerHeight}`);
                    }
                }
                return out;
            });

            expect(unreachable).toEqual([]);
            await context.close();
        });

        test('Random, update, System and backup controls fit and remain reachable', async ({ browser }) => {
            const context = await browser.newContext({
                viewport: { width: screen.width, height: screen.height },
                hasTouch: true, isMobile: true,
            });
            const page = await context.newPage();
            await page.goto('/');
            await page.locator('#btn-update').evaluate(el => { el.style.display = ''; });
            await page.evaluate(() => window.dispatchEvent(new Event('resize')));
            async function reachable(selector) {
                const el = page.locator(selector);
                await expect(el).toBeVisible();
                await el.scrollIntoViewIfNeeded();
                const box = await el.boundingBox();
                expect(box.x, selector).toBeGreaterThanOrEqual(-1);
                expect(box.x + box.width, selector).toBeLessThanOrEqual(screen.width + 1);
                expect(box.y, selector).toBeGreaterThanOrEqual(-1);
                expect(box.y + box.height, selector).toBeLessThanOrEqual(screen.height + 1);
            }
            await setup(page); await reachable('#btn-random'); await page.locator('#new-game-overlay [data-close]').click();
            await reachable('#btn-update');
            await page.locator('#theme-toggle').click();
            await reachable('.theme-option[data-theme="system"]');
            await reachable('.theme-option[data-theme="vino"]');
            await page.locator('.theme-option[data-theme="system"]').click();
            await page.locator('#btn-stats').click();
            for (const id of ['btn-backup', 'btn-restore', 'btn-stats-reset', 'btn-stats-close']) {
                await reachable(`#${id}`);
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
            await context.close();
        });

        // Cancelling touchmove to stop rubber-banding also cancels scrolling.
        // overscroll-behavior does the former without the latter.
        test('a touch drag actually scrolls when content overflows', async ({ browser }) => {
            test.skip(browser.browserType().name() !== 'chromium', 'Native drag injection uses Chromium CDP; WebKit still checks layout and reachable controls.');
            const context = await browser.newContext({
                viewport: { width: screen.width, height: screen.height },
                hasTouch: true, isMobile: true, deviceScaleFactor: 3,
            });
            const page = await context.newPage();
            await page.goto('/');

            const overflows = await page.evaluate(
                () => document.documentElement.scrollHeight > window.innerHeight
            );
            test.skip(!overflows, 'content fits, nothing to scroll');

            await touchDrag(context, page, screen.width, screen.height);
            expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
            await context.close();
        });

        if (SHOULD_FIT.has(screen.name)) {
            // The board is sized from measured free space, so on a phone of
            // this height the whole app should sit on one screen. It used to be
            // sized by a media query subtracting a guessed constant, which is
            // how the bottom controls ended up off the bottom.
            test('fits without scrolling while playing', async ({ browser }) => {
                const context = await browser.newContext({
                    viewport: { width: screen.width, height: screen.height },
                    hasTouch: true, isMobile: true, deviceScaleFactor: 3,
                });
                const page = await context.newPage();
                await page.goto('/');

                // The playing state is the one that has to fit — setup is
                // deliberately on screen beforehand, and folds once a game
                // starts.
                await setup(page); await page.locator('#level-input').fill('1');
                await setup(page); await page.locator('#btn-new-game').click();
                await page.locator('.cell-wrapper.locked').first().waitFor();
                await page.waitForTimeout(300);

                const overflow = await page.evaluate(
                    () => document.documentElement.scrollHeight - window.innerHeight
                );
                expect(overflow).toBeLessThanOrEqual(1);
                await context.close();
            });
        }

        test('sizes the board to the space available', async ({ browser }) => {
            const context = await browser.newContext({
                viewport: { width: screen.width, height: screen.height },
                hasTouch: true, isMobile: true, deviceScaleFactor: 3,
            });
            const page = await context.newPage();
            await page.goto('/');
            await page.waitForTimeout(250);

            // A resolved pixel value, not the stylesheet's calc() expression:
            // if fitBoard bailed out, this would still be unresolved.
            const cell = await page.evaluate(
                () => getComputedStyle(document.documentElement).getPropertyValue('--cell-size').trim()
            );
            expect(cell).toMatch(/^\d+px$/);
            expect(parseInt(cell, 10)).toBeGreaterThanOrEqual(26);
            await context.close();
        });

        test('never scrolls sideways', async ({ browser }) => {
            const context = await browser.newContext({
                viewport: { width: screen.width, height: screen.height },
                hasTouch: true, isMobile: true, deviceScaleFactor: 3,
            });
            const page = await context.newPage();
            await page.goto('/');

            const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth
            );
            expect(overflow).toBeLessThanOrEqual(1);
            await context.close();
        });
    });
}

test('the document is never height-clamped on touch devices', async ({ browser }) => {
    // A fixed height on <html> leaves content taller than the screen with
    // nowhere to go, which is how the controls became unreachable.
    const context = await browser.newContext({
        viewport: { width: 375, height: 553 }, hasTouch: true, isMobile: true,
    });
    const page = await context.newPage();
    await page.goto('/');

    const clamped = await page.evaluate(() => {
        const html = document.documentElement;
        return html.scrollHeight > window.innerHeight
            && getComputedStyle(html).height === `${window.innerHeight}px`
            && getComputedStyle(html).overflowY === 'hidden';
    });
    expect(clamped).toBe(false);
    await context.close();
});

test.describe('game setup is separate from the active board', () => {
    for (const viewport of [{ width: 393, height: 664 }, { width: 1440, height: 1200 }]) {
        test(`chooser preserves a game at ${viewport.width}px`, async ({ page }) => {
            await page.setViewportSize(viewport); await page.goto('/');
            await setup(page); await page.locator('#level-input').fill('1'); await page.locator('#btn-new-game').click();
            await expect(page.locator('#grid .given').first()).toBeVisible();
            await expect(page.locator('#setup-controls')).toBeHidden();
            const before = await page.locator('#grid').textContent();
            await page.locator('#nav-new-game').click();
            await expect(page.locator('#difficulty-selector')).toBeVisible();
            await expect(page.locator('#game-kind')).toBeVisible();
            await page.locator('#new-game-overlay [data-close]').click();
            await expect(page.locator('#grid')).toHaveText(before);
            await expect(page.locator('#btn-pause-resume')).toBeVisible();
            await page.locator('#btn-pause-resume').click();
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        });
    }
});
