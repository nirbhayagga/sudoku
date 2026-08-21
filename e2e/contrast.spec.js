import { test, expect } from '@playwright/test';

/**
 * Contrast as actually rendered, in every theme.
 *
 * scripts/check-contrast.js reasons about CSS variables, which is fast but only
 * as good as the surface pairings it knows about. It passed while the
 * leaderboard tabs failed in a real browser, because those sit on
 * --bg-secondary and the script only compared against --bg-primary. This runs
 * the same rule the browser does, over the real DOM, and needs no such list.
 */
const THEMES = ['midnight', 'sakura', 'ocean', 'forest', 'arctic', 'naruto', 'wicked'];

/** Every visible text node whose contrast falls under the WCAG AA threshold. */
async function contrastFailures(page) {
    return page.evaluate(() => {
        const luminance = ([r, g, b]) => {
            const channel = (v) => {
                const c = v / 255;
                return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        };

        const parse = (value) => {
            const match = value.match(/rgba?\(([^)]+)\)/);
            if (!match) return null;
            const parts = match[1].split(',').map(Number);
            return { rgb: [parts[0], parts[1], parts[2]], alpha: parts.length > 3 ? parts[3] : 1 };
        };

        const over = (fg, bg) => fg.rgb.map((v, i) => Math.round(v * fg.alpha + bg[i] * (1 - fg.alpha)));

        const ratio = (a, b) => {
            const [x, y] = [luminance(a), luminance(b)];
            return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        };

        /**
         * Effective background, compositing every translucent layer down onto
         * the first opaque one — which is what axe does, and what a naive
         * "first opaque ancestor" check gets wrong. A button tinted
         * rgba(255,255,255,0.04) over a dark card is measurably lighter than
         * the card, so ignoring the tint overstates contrast.
         */
        function backgroundOf(element) {
            const layers = [];
            for (let node = element; node; node = node.parentElement) {
                const colour = parse(getComputedStyle(node).backgroundColor);
                if (!colour || colour.alpha === 0) continue;
                layers.push(colour);
                if (colour.alpha === 1) break;
            }

            let base = [255, 255, 255];
            for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
            return base;
        }

        const failures = [];
        for (const element of document.querySelectorAll('*')) {
            const hasText = [...element.childNodes]
                .some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
            if (!hasText) continue;

            // Hidden anywhere up the tree counts as hidden: the overlays are
            // dismissed with opacity, not display, so their contents are laid
            // out and measurable while being completely invisible.
            let hidden = false;
            for (let node = element; node && node !== document.body; node = node.parentElement) {
                const s = getComputedStyle(node);
                if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) {
                    hidden = true;
                    break;
                }
            }
            if (hidden) continue;

            const style = getComputedStyle(element);

            const box = element.getBoundingClientRect();
            if (box.width === 0 || box.height === 0) continue;

            const foreground = parse(style.color);
            if (!foreground) continue;

            const background = backgroundOf(element);
            const measured = ratio(over(foreground, background), background);

            // WCAG allows 3:1 for large text.
            const size = parseFloat(style.fontSize);
            const bold = Number(style.fontWeight) >= 700;
            const required = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;

            if (measured < required) {
                failures.push(
                    `${element.tagName.toLowerCase()}${element.id ? '#' + element.id : ''} `
                    + `"${element.textContent.trim().slice(0, 20)}" `
                    + `${measured.toFixed(2)} < ${required}`
                );
            }
        }
        return failures;
    });
}

for (const theme of THEMES) {
    test(`${theme} meets WCAG AA as rendered`, async ({ page }) => {
        await page.goto('/');
        await page.evaluate((name) => {
            localStorage.setItem('sudoku-theme', name);
        }, theme);
        await page.reload();

        // Play state has the most on screen: locked givens, status, controls.
        await page.locator('.diff-btn[data-diff="easy"]').click();
        await page.locator('#level-input').fill('1');
        await page.locator('#btn-new-game').click();
        await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();

        expect(await contrastFailures(page)).toEqual([]);
    });
}

test('the landing state meets WCAG AA', async ({ page }) => {
    // Lighthouse audits the page as loaded, before any game starts — a
    // different set of controls is on screen than in play.
    await page.goto('/');
    await expect(page.locator('#btn-new-game')).toBeVisible();
    expect(await contrastFailures(page)).toEqual([]);
});

test('dialogs meet WCAG AA too', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-stats').click();
    await expect(page.locator('#stats-overlay')).toHaveClass(/active/);
    expect(await contrastFailures(page)).toEqual([]);
});
