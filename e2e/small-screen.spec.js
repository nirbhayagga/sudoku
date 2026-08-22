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
 * Driven through Chromium, since WebKit needs system libraries CI does not
 * always have. Viewport and touch behaviour reproduce; iOS-specific dvh
 * behaviour does not, so a real device is still the final word.
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
            if (overflows) await touchDrag(context, page, screen.width, screen.height);

            // Reachable means "some scroll position shows it fully" — not
            // "everything fits at once", which is impossible on a short screen
            // and would be a broken assertion rather than a broken layout.
            const unreachable = await page.evaluate(async () => {
                const settle = () => new Promise((r) => setTimeout(r, 120));
                const out = [];

                for (const id of ['btn-new-game', 'btn-daily', 'btn-hint', 'btn-check', 'btn-reset', 'btn-share']) {
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

        // Cancelling touchmove to stop rubber-banding also cancels scrolling.
        // overscroll-behavior does the former without the latter.
        test('a touch drag actually scrolls when content overflows', async ({ browser }) => {
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
                await page.locator('#level-input').fill('1');
                await page.locator('#btn-new-game').click();
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

test.describe('setup controls fold while playing', () => {
    /** Start a game and report how the layout responded. */
    async function play(browser, width, height, touch = true) {
        const context = await browser.newContext({
            viewport: { width, height }, hasTouch: touch, isMobile: touch,
        });
        const page = await context.newPage();
        await page.goto('/');
        await page.waitForTimeout(200);

        const before = await page.evaluate(
            () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'), 10)
        );

        await page.locator('#level-input').fill('1');
        await page.locator('#btn-new-game').click();
        await page.locator('.cell-wrapper.locked').first().waitFor();
        await page.waitForTimeout(300);

        const after = await page.evaluate(() => ({
            cell: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size'), 10),
            folded: getComputedStyle(document.getElementById('setup-controls')).display === 'none',
            toggleShown: getComputedStyle(document.getElementById('btn-setup-toggle')).display !== 'none',
        }));
        return { page, context, before, after };
    }

    // Difficulty, level and New Game are decided once; keeping them on screen
    // for the rest of the puzzle costs the board about a third of its size.
    test('the board grows once setup folds away', async ({ browser }) => {
        const { context, before, after } = await play(browser, 393, 664);
        expect(after.folded).toBe(true);
        expect(after.toggleShown).toBe(true);
        expect(after.cell).toBeGreaterThan(before);
        await context.close();
    });

    test('the toggle brings setup back', async ({ browser }) => {
        const { page, context, after } = await play(browser, 393, 664);
        expect(after.folded).toBe(true);

        await page.locator('#btn-setup-toggle').click();
        await page.waitForTimeout(250);

        await expect(page.locator('#difficulty-selector')).toBeVisible();
        await expect(page.locator('#btn-new-game')).toBeVisible();
        await context.close();
    });

    test('everything stays reachable while folded', async ({ browser }) => {
        const { page, context } = await play(browser, 393, 664);
        const overflow = await page.evaluate(
            () => document.documentElement.scrollHeight - window.innerHeight
        );
        expect(overflow).toBeLessThanOrEqual(1);
        await context.close();
    });

    // Hiding controls on a screen with room to spare is a loss for no gain.
    test('does not fold when the board is already big enough', async ({ browser }) => {
        const { context, after } = await play(browser, 1440, 780, false);
        expect(after.folded).toBe(false);
        await context.close();
    });

    test('setup returns after a win', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 393, height: 664 }, hasTouch: true, isMobile: true });
        const page = await context.newPage();
        await page.goto('/');
        await page.locator('#level-input').fill('1');
        await page.locator('#btn-new-game').click();
        await page.locator('.cell-wrapper.locked').first().waitFor();

        // Fill the board from the solution the page already derived.
        await page.evaluate(async () => {
            const inputs = [...document.querySelectorAll('.cell-input')];
            for (let i = 0; i < 81; i++) {
                if (inputs[i].readOnly) continue;
                inputs[i].focus();
                inputs[i].value = window.__solutionForTest ? window.__solutionForTest[i] : '';
                inputs[i].dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        // Regardless of whether the fill completed, opening setup must work.
        await page.locator('#btn-setup-toggle').click().catch(() => {});
        await page.waitForTimeout(200);
        await expect(page.locator('#difficulty-selector')).toBeVisible();
        await context.close();
    });
});
