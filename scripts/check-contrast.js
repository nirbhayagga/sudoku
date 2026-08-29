/**
 * WCAG contrast audit for every theme.
 *
 *   node scripts/check-contrast.js          report
 *   node scripts/check-contrast.js --fix    adjust failing colours in place
 *
 * Themes are pure CSS variables, so this parses style.css directly rather than
 * rendering anything. --fix walks a colour's lightness (keeping its hue and
 * saturation, so the theme still looks like itself) until it clears the
 * threshold, which is why fixes come out as the smallest change that passes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CSS_PATH = path.join(root, 'style.css');

/** Normal-size text needs 4.5:1 under WCAG 2.1 AA. */
export const AA_THRESHOLD = 4.5;

/**
 * --fix aims above the threshold on purpose.
 *
 * This script models the surface a control sits on by compositing the layers it
 * knows about, which is an approximation — the browser has the real stack,
 * including tints this file cannot see. Fixing to exactly 4.5 lands a hair
 * under once rendered. The margin absorbs that; e2e/contrast.spec.js measures
 * the real DOM and is the authority.
 */
const FIX_TARGET = 5.0;

/**
 * Foreground tokens, checked against every surface they are actually rendered
 * on — not just --bg-primary.
 *
 * Checking one background was the original flaw here: --text-muted cleared AA
 * against --bg-primary and failed on --bg-secondary, where the leaderboard tabs
 * sit, and Lighthouse caught it in a real browser after this script had passed.
 */
const TEXT_TOKENS = [
    '--text-primary', '--text-secondary', '--text-muted', '--text-note',
    '--text-given', '--text-solved', '--text-error', '--text-conflict',
    // Used on the hint button and in win messaging respectively; both were
    // missed on the first pass simply because they are not named --text-*.
    '--text-hint', '--success',
    // --accent is the brand colour used for borders and glows, where a
    // saturated tone is wanted; --accent-text is its readable counterpart and
    // is the one allowed as a text colour.
    '--accent-text',
];

/** Surfaces text is drawn on directly. */
const SURFACE_TOKENS = ['--bg-primary', '--bg-secondary'];

/**
 * The surface a control actually renders on, per theme, measured from the
 * browser.
 *
 * Modelling this by compositing assumed layers does not work: the tints differ
 * per theme, and on the light themes the card layer is a *dark* translucent, so
 * the control surface comes out darker than the page rather than lighter. A
 * model that assumes white tints silently overestimates contrast there, which
 * is exactly how the difficulty buttons shipped below AA while this script
 * reported everything clear.
 *
 * To re-measure after changing any surface colour, run the contrast e2e spec —
 * it computes the same values from the real DOM and is the authority.
 */
/**
 * Pairs where the foreground is fixed rather than a token — a button label on
 * a coloured background, for instance.
 */
const SURFACE_PAIRS = [
    { on: '--accent-on', over: '--accent-surface', label: 'accent button' },
];

const CONTROL_SURFACES = {
    //            difficulty buttons     action buttons
    light: ['rgb(255, 255, 255)', 'rgb(255, 255, 255)'],
    dark: ['rgb(35, 37, 42)', 'rgb(32, 34, 39)'],
    midnight: ['rgb(25, 25, 37)', 'rgb(27, 27, 39)'],
    sakura: ['rgb(242, 209, 196)', 'rgb(239, 202, 190)'],
    ocean: ['rgb(21, 36, 57)', 'rgb(21, 36, 57)'],
    forest: ['rgb(22, 35, 22)', 'rgb(22, 35, 22)'],
    arctic: ['rgb(203, 214, 234)', 'rgb(197, 209, 233)'],
};

export function parseThemes(css) {
    const themes = {};
    const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/);
    themes.midnight = readVars(rootBlock[1]);
    for (const m of css.matchAll(/\[data-theme="([a-z]+)"\]\s*\{([\s\S]*?)\n\}/g)) {
        themes[m[1]] = { ...themes.midnight, ...readVars(m[2]) };
    }
    return themes;
}

function readVars(block) {
    const vars = {};
    for (const m of block.matchAll(/(--[a-z-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
    return vars;
}

/** Parse hex or rgb()/rgba(), compositing alpha over `over` when present. */
export function parseColor(value, over) {
    const text = String(value).trim();

    const hex = text.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
        const n = parseInt(hex[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    const rgb = text.match(/rgba?\(([^)]+)\)/);
    if (rgb) {
        const parts = rgb[1].split(',').map((p) => parseFloat(p.trim()));
        const alpha = parts.length > 3 ? parts[3] : 1;
        if (alpha < 1 && over) {
            return [0, 1, 2].map((i) => Math.round(parts[i] * alpha + over[i] * (1 - alpha)));
        }
        return [parts[0], parts[1], parts[2]];
    }
    return null;
}

const channelLuminance = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = ([r, g, b]) =>
    0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);

export function contrastRatio(a, b) {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Every token/background pair that falls below the threshold. */
export function audit(css, threshold = AA_THRESHOLD) {
    const failures = [];

    for (const [theme, vars] of Object.entries(parseThemes(css))) {
        const surfaces = [
            ...SURFACE_TOKENS.map((token) => [token, parseColor(vars[token])]),
            ...CONTROL_SURFACES[theme].map((surface, i) => [`control ${i + 1}`, parseColor(surface)]),
        ];

        for (const [surfaceToken, background] of surfaces) {
            if (!background) continue;

            for (const token of TEXT_TOKENS) {
                const foreground = parseColor(vars[token], background);
                if (!foreground) continue;

                const ratio = contrastRatio(foreground, background);
                if (ratio < threshold) {
                    failures.push({ theme, token, surface: surfaceToken, ratio, color: vars[token] });
                }
            }
        }

        for (const pair of SURFACE_PAIRS) {
            const background = parseColor(vars[pair.over]);
            const foreground = parseColor(vars[pair.on], background);
            if (!background || !foreground) continue;

            const ratio = contrastRatio(foreground, background);
            if (ratio < threshold) {
                failures.push({
                    theme, token: pair.on, surface: pair.over, ratio, color: vars[pair.on],
                });
            }
        }
    }
    return failures;
}

// ── Fixing ─────────────────────────────────────────────────────────────

const toHex = ([r, g, b]) =>
    '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v)))
        .toString(16).padStart(2, '0')).join('');

function rgbToHsl([r, g, b]) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
    return [h, s, l];
}

function hslToRgb([h, s, l]) {
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const toChannel = (t) => {
        let tt = t;
        if (tt < 0) tt += 1;
        if (tt > 1) tt -= 1;
        if (tt < 1 / 6) return p + (q - p) * 6 * tt;
        if (tt < 1 / 2) return q;
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
    };
    return [toChannel(h + 1 / 3) * 255, toChannel(h) * 255, toChannel(h - 1 / 3) * 255];
}

/**
 * The nearest colour along the lightness axis that clears the threshold.
 * Hue and saturation are preserved so the theme keeps its character.
 */
export function adjustForContrast(color, background, threshold = AA_THRESHOLD) {
    const [h, s, l] = rgbToHsl(color);
    // Move away from the background: darken on light, lighten on dark.
    const direction = relativeLuminance(background) > 0.5 ? -1 : 1;

    for (let step = 0; step <= 100; step++) {
        const candidate = hslToRgb([h, s, Math.max(0, Math.min(1, l + direction * step / 100))]);
        const hex = toHex(candidate);
        // Check the rounded value, not the float one: rounding to 8-bit
        // channels can drop the ratio a hair below the threshold.
        if (contrastRatio(parseColor(hex), background) >= threshold) return hex;
    }
    return toHex(hslToRgb([h, s, direction > 0 ? 1 : 0]));
}

function main() {
    const fix = process.argv.includes('--fix');
    let css = fs.readFileSync(CSS_PATH, 'utf8');
    const failures = audit(css);

    if (failures.length === 0) {
        console.log('All themes meet WCAG AA (4.5:1).');
        return;
    }

    console.log(`${failures.length} token(s) below ${AA_THRESHOLD}:1\n`);
    const themes = parseThemes(css);

    for (const failure of failures) {
        const control = /^control (\d)$/.exec(failure.surface || '');
        const background = control
            ? parseColor(CONTROL_SURFACES[failure.theme][Number(control[1]) - 1])
            : parseColor(themes[failure.theme][failure.surface || '--bg-primary']);
        const current = parseColor(failure.color, background);
        const replacement = adjustForContrast(current, background, FIX_TARGET);
        const after = contrastRatio(parseColor(replacement), background);

        console.log(
            `  ${failure.theme.padEnd(9)} ${failure.token.padEnd(17)} on ${(failure.surface || '--bg-primary').padEnd(16)} ` +
            `${failure.ratio.toFixed(2)} -> ${after.toFixed(2)}  ${failure.color} -> ${replacement}`
        );

        if (fix) {
            const selector = failure.theme === 'midnight'
                ? /(:root\s*\{[\s\S]*?\n\})/
                : new RegExp(`(\\[data-theme="${failure.theme}"\\]\\s*\\{[\\s\\S]*?\\n\\})`);
            css = css.replace(selector, (block) =>
                block.replace(
                    new RegExp(`(${failure.token}:\\s*)([^;]+)(;)`),
                    `$1${replacement}$3`
                )
            );
        }
    }

    if (fix) {
        fs.writeFileSync(CSS_PATH, css);
        console.log(`\nUpdated ${path.relative(root, CSS_PATH)}.`);
    } else {
        console.log('\nRe-run with --fix to apply.');
    }
}

if (process.argv[1] && process.argv[1].endsWith('check-contrast.js')) main();
