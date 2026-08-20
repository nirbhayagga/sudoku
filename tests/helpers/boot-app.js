/**
 * Boots index.html in jsdom with all four scripts executed, giving tests the
 * real DOM the app wires itself to.
 *
 * jsdom has no fetch, so checkLeaderboardHealth() fails and the app degrades to
 * its no-backend state — which is exactly the configuration most users run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { repoRoot } from './load-globals.js';

export async function bootApp({ localStorage: seed = {} } = {}) {
    // Swallow the expected "fetch is not defined" noise, surface real errors.
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', (err) => {
        if (!/fetch is not defined|Not implemented/.test(err.message)) throw err;
    });

    // Resource loading is left off and the scripts are injected by hand: jsdom
    // would otherwise try to fetch style.css and the four script tags over the
    // network. Injection also guarantees the documented load order.
    const html = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
    const dom = new JSDOM(html, {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        url: 'http://localhost/',
        virtualConsole,
    });

    // Seeded before the scripts run, since app.js reads localStorage on init.
    for (const [key, value] of Object.entries(seed)) {
        dom.window.localStorage.setItem(key, value);
    }

    // Concatenated into one script: top-level `const` is scoped per eval() call,
    // so separate evals would not see each other's globals. Browsers share a
    // global lexical scope across <script> tags, and build.js concatenates too,
    // so this matches both.
    const sources = ['solver.js', 'generator.js', 'puzzle-bank.js', 'app.js']
        .map((file) => fs.readFileSync(path.join(repoRoot, file), 'utf8'))
        .join('\n;\n');
    dom.window.eval(sources);

    const { window } = dom;
    const $ = (sel) => window.document.querySelector(sel);
    const $$ = (sel) => [...window.document.querySelectorAll(sel)];

    return {
        dom,
        window,
        $,
        $$,
        document: window.document,
        cells: () => $$('.cell-wrapper'),
        inputs: () => $$('.cell-input'),
        /** Read the grid back as an 81-char board string. */
        readGrid: () => $$('.cell-input').map((i) => i.value || '0').join(''),
        /**
         * Type a digit into a cell the way a user would. readOnly inputs are
         * left alone because browsers fire no input event for them — that is
         * how givens, hinted cells and every cell on touch devices are guarded.
         */
        type(index, digit) {
            const input = $$('.cell-input')[index];
            if (input.readOnly) return input;
            input.focus();
            input.value = digit;
            input.dispatchEvent(new window.Event('input', { bubbles: true }));
            return input;
        },
        /** Send a keydown to a focused cell. */
        press(index, key, init = {}) {
            const input = $$('.cell-input')[index];
            input.focus();
            input.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
            return input;
        },
        click(selector) {
            const el = typeof selector === 'string' ? $(selector) : selector;
            el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
            return el;
        },
        /** Let queued timers and microtasks run. */
        tick: (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms)),
        close: () => dom.window.close(),
    };
}
