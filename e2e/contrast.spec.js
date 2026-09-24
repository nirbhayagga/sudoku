import { test, expect } from '@playwright/test';

/**
 * Contrast as actually rendered, in every theme.
 *
 * scripts/check-contrast.js reasons about CSS variables, which is fast but only
 * as good as the surface pairings it knows about. It passed while the
 * leaderboard tabs failed in a real browser, because those sit on
 * --bg-secondary and the script only compared against --bg-primary. This runs
 * computed solid layers over the real DOM. Gradients, shadows, backdrop blur
 * and pseudo-elements are not sampled; this is a regression check, not a
 * complete WCAG certification.
 */
const THEMES = ['light', 'dark', 'midnight', 'sakura', 'ocean', 'forest', 'arctic', 'peony', 'matcha', 'vino'];

/** Visible text nodes and form values below AA against computed solid layers. */
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
        // A modal covers and tints the page; its backdrop is not an ancestor
        // of the board and therefore cannot be composited by this checker.
        const root = document.querySelector('.modal-overlay.active, .win-overlay.active') || document;
        for (const element of root.querySelectorAll('*')) {
            const hasText = [...element.childNodes]
                .some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
            const value = element.matches('input, textarea') ? element.value : '';
            if (!hasText && !value) continue;
            if (element.closest('.visually-hidden')) continue;

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
                    + `"${(value || element.textContent).trim().slice(0, 20)}" `
                    + `${measured.toFixed(2)} < ${required}`
                );
            }
        }
        return failures;
    });
}

for (const theme of THEMES) {
    test(`${theme} populated controls and states pass solid-layer contrast`, async ({ page }, testInfo) => {
        testInfo.annotations.push({ type: 'coverage', description: 'Computed solid backgrounds; gradients, blur and pseudo-elements require visual review.' });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');
        await page.evaluate((name) => {
            localStorage.setItem('sudoku-theme', name);
        }, theme);
        await page.reload();
        await page.locator('#btn-update').evaluate(el => { el.style.display = ''; });
        await page.locator('#theme-toggle').click();
        expect(await contrastFailures(page), 'theme picker and update notice').toEqual([]);
        await page.locator('#theme-toggle').click();

        // Play state has the most on screen: locked givens, status, controls.
        await page.locator('.diff-btn[data-diff="easy"]').click();
        await page.locator('#level-input').fill('1');
        await page.locator('#btn-new-game').click();
        await expect(page.locator('.cell-wrapper.locked').first()).toBeVisible();

        // State fixtures deliberately exercise CSS combinations independently of
        // the solving logic (real input/hint/resume flows live in play.spec.js).
        await page.evaluate(() => {
            const cells = [...document.querySelectorAll('.cell-wrapper')];
            const states = ['', 'given', 'focused', 'hint', 'user-error', 'conflict', 'solved', 'digit-highlight', 'peer-highlight', 'hint-evidence'];
            states.forEach((state, i) => {
                cells[i].className = `cell-wrapper ${state}`;
                cells[i].querySelector('input').value = String(i % 9 + 1);
                const noteCell = cells[i + 18];
                noteCell.className = `cell-wrapper ${state}`;
                noteCell.querySelector('input').value = '';
                noteCell.querySelectorAll('.note-digit').forEach(el => el.classList.add('visible'));
            });
        });
        await page.mouse.move(0, 0);
        expect(await contrastFailures(page), 'board values and visible notes').toEqual([]);

        // Use the actual dialog markup with representative populated content.
        // This avoids an optional backend or a full win becoming prerequisites
        // for checking every theme's dialog surfaces.
        for (const id of ['modal-overlay', 'generator-overlay', 'export-overlay', 'stats-overlay', 'leaderboard-overlay', 'win-overlay', 'share-overlay']) {
            await page.evaluate((id) => {
                const overlay = document.getElementById(id);
                overlay.classList.add('active');
                overlay.querySelectorAll('input:not([type="file"]), textarea').forEach(el => { el.value = '123456789'; });
                if (id === 'modal-overlay') document.getElementById('import-error').textContent = 'Expected 81 cells.';
                if (id === 'win-overlay') {
                    document.getElementById('win-details').textContent = 'Easy · 1:23 · 2 hints';
                    document.getElementById('win-submit').style.display = '';
                }
                if (id === 'leaderboard-overlay') document.getElementById('leaderboard-content').innerHTML = '<table class="lb-table"><thead><tr><th>Player</th><th>Time</th></tr></thead><tbody><tr><td>Player One</td><td>1:23</td></tr></tbody></table>';
                if (id === 'stats-overlay') document.getElementById('stats-content').innerHTML = '<table class="stats-table"><thead><tr><th>Difficulty</th><th>Won</th></tr></thead><tbody><tr><td>Easy</td><td>12</td></tr></tbody></table>';
            }, id);
            expect(await contrastFailures(page), id).toEqual([]);
            await page.locator(`#${id}`).evaluate(el => el.classList.remove('active'));
        }
    });
}

test('the landing state passes solid-layer contrast', async ({ page }) => {
    // Lighthouse audits the page as loaded, before any game starts — a
    // different set of controls is on screen than in play.
    await page.goto('/');
    await expect(page.locator('#btn-new-game')).toBeVisible();
    expect(await contrastFailures(page)).toEqual([]);
});

test('the stats dialog passes solid-layer contrast', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-stats').click();
    await expect(page.locator('#stats-overlay')).toHaveClass(/active/);
    expect(await contrastFailures(page)).toEqual([]);
});
