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
    { name: 'iPhone 13, toolbars showing', width: 390, height: 664 },
    { name: 'iPhone 13, installed', width: 390, height: 844 },
    { name: 'very short landscape', width: 740, height: 320 },
];

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
