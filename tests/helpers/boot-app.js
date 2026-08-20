/**
 * Boots index.html in jsdom with the app running against it.
 *
 * app.js is an ES module now, and jsdom cannot execute module graphs, so the
 * source is bundled in-memory with esbuild and evaluated as a classic script —
 * the same shape the production build ships. Bundling is done once and reused
 * across boots, which keeps it to a few milliseconds per test.
 *
 * jsdom has no fetch, so checkLeaderboardHealth() fails and the app degrades to
 * its no-backend state — which is exactly the configuration most users run.
 */
import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { JSDOM, VirtualConsole } from 'jsdom';
import { repoRoot } from './paths.js';

let bundledApp = null;

/** Bundle app.js and its imports into one classic script. */
function appBundle() {
    if (bundledApp === null) {
        const result = esbuild.buildSync({
            entryPoints: [path.join(repoRoot, 'app.js')],
            bundle: true,
            format: 'iife',
            target: ['es2020'],
            write: false,
            logLevel: 'silent',
        });
        bundledApp = result.outputFiles[0].text;
    }
    return bundledApp;
}

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

    dom.window.eval(appBundle());

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
        /**
         * Take over the page's clock. The app derives elapsed time from
         * Date.now(), so this lets time-based behaviour be tested exactly and
         * instantly rather than by waiting on real seconds. jsdom gives each
         * window its own Date, so this must patch window.Date, not the global.
         */
        useFakeClock() {
            const real = window.Date.now.bind(window.Date);
            let now = real();
            window.Date.now = () => now;
            return {
                advance: (ms) => { now += ms; },
                restore: () => { window.Date.now = real; },
            };
        },
        close: () => dom.window.close(),
    };
}
