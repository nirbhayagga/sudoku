import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
    audit, parseThemes, parseColor, contrastRatio, adjustForContrast, AA_THRESHOLD,
} from '../scripts/check-contrast.js';
import { repoRoot } from './helpers/paths.js';

const css = fs.readFileSync(path.join(repoRoot, 'style.css'), 'utf8');
const themes = parseThemes(css);

describe('theme contrast', () => {
    // Every theme failed this before it was measured: --text-muted was as low
    // as 2.09:1, and the two light themes failed across several tokens.
    it('meets WCAG AA on every text token in every theme', () => {
        const failures = audit(css).map(
            (f) => `${f.theme} ${f.token} ${f.ratio.toFixed(2)}:1`
        );
        expect(failures).toEqual([]);
    });

    it('covers all seven themes', () => {
        expect(Object.keys(themes).sort()).toEqual(
            ['arctic', 'forest', 'midnight', 'naruto', 'ocean', 'sakura', 'wicked']
        );
    });

    it('gives every theme a readable accent', () => {
        for (const [name, vars] of Object.entries(themes)) {
            expect(vars['--accent-text'], name).toBeTruthy();
            const bg = parseColor(vars['--bg-primary']);
            expect(contrastRatio(parseColor(vars['--accent-text'], bg), bg), name)
                .toBeGreaterThanOrEqual(AA_THRESHOLD);
        }
    });

    // --accent stays the saturated brand colour for borders and glows; only
    // --accent-text is safe as a text colour.
    it('never uses the raw accent as a text colour', () => {
        expect(css).not.toMatch(/\n\s*color: var\(--accent\);/);
    });

    it('defines a background for every theme', () => {
        for (const [name, vars] of Object.entries(themes)) {
            expect(parseColor(vars['--bg-primary']), name).not.toBeNull();
        }
    });
});

describe('contrast maths', () => {
    it('matches known WCAG ratios', () => {
        expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 1);
        expect(contrastRatio([0, 0, 0], [0, 0, 0])).toBeCloseTo(1, 5);
        // #767676 on white is the canonical 4.5:1 boundary.
        expect(contrastRatio([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 1);
    });

    it('is symmetric', () => {
        const a = [30, 40, 50];
        const b = [200, 210, 220];
        expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
    });

    it('composites alpha over the background', () => {
        // 50% white over black is mid grey, not white.
        expect(parseColor('rgba(255,255,255,0.5)', [0, 0, 0])).toEqual([128, 128, 128]);
    });

    it('parses hex and rgb', () => {
        expect(parseColor('#ff8800')).toEqual([255, 136, 0]);
        expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30]);
    });

    it('returns null for something it cannot read', () => {
        expect(parseColor('rebeccapurple')).toBeNull();
    });
});

describe('adjustForContrast', () => {
    it('lightens against a dark background', () => {
        const fixed = adjustForContrast([70, 85, 105], [10, 10, 15]);
        expect(contrastRatio(parseColor(fixed), [10, 10, 15])).toBeGreaterThanOrEqual(AA_THRESHOLD);
    });

    it('darkens against a light background', () => {
        const fixed = adjustForContrast([176, 136, 152], [245, 225, 216]);
        expect(contrastRatio(parseColor(fixed), [245, 225, 216])).toBeGreaterThanOrEqual(AA_THRESHOLD);
    });

    it('leaves a passing colour close to where it was', () => {
        const background = [10, 10, 15];
        const already = [255, 255, 255];
        expect(adjustForContrast(already, background)).toBe('#ffffff');
    });
});
