import { afterEach, describe, expect, it } from 'vitest';
import { bootApp } from './helpers/boot-app.js';
import { SMALL_BANK } from '../small-bank.js';
import { VARIANT_BANK } from '../variant-bank.js';
import { SMALL_GEOMETRIES, VARIANT_GEOMETRIES } from '../geometry.js';
import { solveSized } from '../sized-solver.js';
import { SudokuSolver } from '../solver.js';

const apps = [];
async function boot(url = 'https://sudoku.test/?bank=2&d=easy&level=1') {
    const app = await bootApp({ url }); apps.push(app); return app;
}
function key(app, value, init = {}, target = app.document.activeElement) {
    const event = new app.window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}
const active = (app, selector) => app.$(selector).classList.contains('active');
afterEach(() => apps.splice(0).forEach(app => app.close()));

describe('Classic keyboard controls', () => {
    it('moves to row ends, clamps arrows, allows held arrows and leaves modified navigation alone', async () => {
        const app = await boot();
        app.inputs()[40].focus(); key(app, 'Home');
        expect(app.document.activeElement).toBe(app.inputs()[36]);
        key(app, 'ArrowLeft', { repeat: true });
        expect(app.document.activeElement).toBe(app.inputs()[36]);
        key(app, 'End'); expect(app.document.activeElement).toBe(app.inputs()[44]);
        key(app, 'ArrowRight'); expect(app.document.activeElement).toBe(app.inputs()[44]);
        key(app, 'ArrowUp', { repeat: true }); expect(app.document.activeElement).toBe(app.inputs()[35]);
        expect(key(app, 'Home', { ctrlKey: true }).defaultPrevented).toBe(false);
        expect(app.document.activeElement).toBe(app.inputs()[35]);
        key(app, ' '); expect(app.$('#pause-panel').hidden).toBe(false);
        key(app, 'Home'); expect(app.document.activeElement).toBe(app.inputs()[27]);
        key(app, ' ', { repeat: true }); expect(app.$('#pause-panel').hidden).toBe(false);
        key(app, ' '); expect(app.$('#pause-panel').hidden).toBe(true);
    });

    it('requires a fresh H press to reveal, with no debounce delay', async () => {
        const app = await boot(), board = app.readGrid(), cell = board.indexOf('0');
        app.inputs()[cell].focus(); key(app, 'h');
        expect(app.$('#btn-hint').textContent).toBe('Reveal number');
        for (let n = 0; n < 3; n++) key(app, 'h', { repeat: true });
        expect(app.readGrid()).toBe(board);
        expect(app.$('#btn-hint').textContent).toBe('Reveal number');
        key(app, 'h'); expect(app.readGrid()).not.toBe(board);
    });

    it('does not toggle notes or clear checked errors on held action keys', async () => {
        const app = await boot(), board = app.readGrid(), cell = board.indexOf('0');
        app.inputs()[cell].focus();
        for (const [letter, selector] of [['n', '#btn-notes-toggle'], ['a', '#btn-auto-notes']]) {
            key(app, letter); key(app, letter, { repeat: true });
            expect(app.$(selector).getAttribute('aria-pressed')).toBe('true');
            key(app, letter); expect(app.$(selector).getAttribute('aria-pressed')).toBe('false');
        }
        const answer = SudokuSolver.solveSudoku(board).solution;
        app.type(cell, answer[cell] === '1' ? '2' : '1');
        app.inputs()[cell].focus(); key(app, 'Enter'); key(app, 'Enter', { repeat: true });
        expect(app.cells()[cell].classList.contains('user-error')).toBe(true);
        expect(app.readGrid()[cell]).not.toBe('0');
        key(app, 'Enter'); expect(app.readGrid()[cell]).toBe('0');
    });

    it('opens keyboard help without changing the disclosure preference and restores focus', async () => {
        const app = await boot(); app.$('.shortcuts').open = false;
        const cell = app.inputs()[40]; cell.focus(); key(app, '?');
        expect(active(app, '#keyboard-help-overlay')).toBe(true);
        expect(app.$('#keyboard-help-content').textContent).toContain('Home');
        expect(app.document.activeElement.id).toBe('btn-keyboard-help-close');
        key(app, 'Tab'); expect(app.document.activeElement.id).toBe('btn-keyboard-help-close');
        key(app, 'Escape'); expect(app.document.activeElement).toBe(cell);
        expect(app.$('.shortcuts').open).toBe(false);
        key(app, '?', { repeat: true }); expect(active(app, '#keyboard-help-overlay')).toBe(false);
        app.click('#btn-import-play'); const input = app.$('#import-text'); input.focus();
        expect(key(app, '?').defaultPrevented).toBe(false);
        expect(active(app, '#keyboard-help-overlay')).toBe(false);
    });

    it('keeps Solver navigation and help accurate without advertising play actions', async () => {
        const app = await boot(); app.click('#tab-solver');
        app.inputs()[40].focus(); key(app, 'Home'); expect(app.document.activeElement).toBe(app.inputs()[36]);
        key(app, 'End'); expect(app.document.activeElement).toBe(app.inputs()[44]);
        key(app, '?');
        expect(app.$('#keyboard-help-content [data-shortcut="enter"]').textContent).toContain('Solve');
        expect(app.$('#keyboard-help-content [data-play-only]')).toBeNull();
        key(app, 'Escape'); expect(app.document.activeElement).toBe(app.inputs()[44]);
    });
});

const boards = [
    ['4', SMALL_GEOMETRIES[4], SMALL_BANK[4][0]],
    ['6', SMALL_GEOMETRIES[6], SMALL_BANK[6][0]],
    ['9-diagonal', VARIANT_GEOMETRIES.diagonal, VARIANT_BANK.diagonal[0]],
    ['9-hyper', VARIANT_GEOMETRIES.hyper, VARIANT_BANK.hyper[0]],
];
describe.each(boards)('%s board keyboard controls', (track, g, entry) => {
    async function setup() {
        const app = await boot(`https://sudoku.test/?size=${g.size}&box=${g.boxRows}x${g.boxCols}&rule=${g.rule}&p=${entry.puzzle}`);
        const cells = app.$$('#small-grid .small-cell');
        const saved = () => JSON.parse(app.window.localStorage.getItem(`sudoku_small_v1_${track}`));
        return { app, cells, saved };
    }
    it('uses bounded navigation, row ends and focus that matches the selected cell', async () => {
        const { app, cells, saved } = await setup();
        cells[g.size + 1].focus(); key(app, 'Home'); expect(app.document.activeElement).toBe(cells[g.size]);
        key(app, 'ArrowLeft', { repeat: true }); expect(app.document.activeElement).toBe(cells[g.size]);
        key(app, 'End'); expect(app.document.activeElement).toBe(cells[2 * g.size - 1]);
        key(app, 'ArrowRight'); expect(app.document.activeElement).toBe(cells[2 * g.size - 1]);
        key(app, 'ArrowDown', { repeat: true }); expect(app.document.activeElement).toBe(cells[3 * g.size - 1]);
        const cell = entry.puzzle.indexOf('0'); cells[cell].focus(); key(app, '2');
        expect(saved().board[cell]).toBe('2');
        key(app, '0', { ctrlKey: true }); expect(saved().board[cell]).toBe('2');
        key(app, 'Escape'); expect(app.$$('.small-selected')).toHaveLength(0);
        expect(app.$$('#small-grid [tabindex="0"]')).toHaveLength(1);
        app.click('#small-pad [data-digit="1"]'); expect(saved().board[cell]).toBe('2');
        cells[cell].focus(); expect(cells[cell].classList.contains('small-selected')).toBe(true);
    });
    it('keeps letters on controls harmless and supports Check, redo and fresh hint presses', async () => {
        const { app, cells, saved } = await setup();
        app.$('#small-pause').focus();
        for (const letter of ['n', 'a', 'h', '1', 'Home', ' ']) expect(key(app, letter).defaultPrevented).toBe(false);
        expect(app.$('#small-notes').getAttribute('aria-pressed')).toBe('false');
        expect(saved().board).toBe(entry.puzzle);
        const cell = entry.puzzle.indexOf('0'); cells[cell].focus();
        const answer = solveSized(entry.puzzle, g).solutions[0];
        const wrong = answer[cell] === '1' ? '2' : '1';
        key(app, wrong); key(app, 'Enter'); key(app, 'Enter', { repeat: true });
        expect(cells[cell].classList.contains('board-error')).toBe(true);
        expect(saved().board[cell]).toBe(wrong);
        key(app, 'Enter'); expect(saved().board[cell]).toBe('0');
        key(app, 'z', { ctrlKey: true }); expect(saved().board[cell]).toBe(wrong);
        key(app, 'y', { ctrlKey: true }); expect(saved().board[cell]).toBe('0');
        key(app, 'z', { metaKey: true }); expect(saved().board[cell]).toBe(wrong);
        key(app, 'Z', { metaKey: true, shiftKey: true }); expect(saved().board[cell]).toBe('0');
        key(app, 'h'); key(app, 'h', { repeat: true });
        expect(app.$('#small-hint').textContent).toBe('Reveal number'); expect(saved().hints).toBe(0);
        key(app, 'h'); expect(saved().hints).toBe(1);
        key(app, 'h'); key(app, 'Escape'); expect(app.$('#small-hint').textContent).toBe('Hint');
        expect(app.$$('.small-selected')).toHaveLength(0);
    });
    it('opens help and preserves pause and notes under key repeats', async () => {
        const { app, cells } = await setup(); cells[entry.puzzle.indexOf('0')].focus();
        for (const [letter, selector] of [['n', '#small-notes'], ['a', '#small-auto']]) {
            key(app, letter); key(app, letter, { repeat: true });
            expect(app.$(selector).getAttribute('aria-pressed')).toBe('true');
            key(app, letter); expect(app.$(selector).getAttribute('aria-pressed')).toBe('false');
        }
        key(app, 'p'); key(app, 'p', { repeat: true }); expect(app.$('#small-pause').textContent).toBe('Resume');
        const cell = app.document.activeElement;
        key(app, '?'); expect(active(app, '#keyboard-help-overlay')).toBe(true);
        expect(app.$('#keyboard-help-content').textContent).not.toContain('Import');
        expect(app.$('#keyboard-help-content [data-shortcut="digits"] kbd:last-of-type').textContent).toBe(String(g.size));
        key(app, 'Escape'); expect(app.document.activeElement).toBe(cell);
        expect(app.$('#small-pause').textContent).toBe('Resume');
        key(app, 'p'); expect(app.$('#small-pause').textContent).toBe('Pause');
    });
});
