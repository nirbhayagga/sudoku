import { PUZZLES } from '../puzzle-bank.js';
import { afterEach, describe, expect, it } from 'vitest';
import { bootApp } from './helpers/boot-app.js';
import { SudokuSolver } from '../solver.js';
import { puzzleLink, parseShareLink, gameLink, parseGameLink } from '../share.js';

const apps = [];
async function boot(options) { const app = await bootApp(options); apps.push(app); return app; }
async function start(app, level = '1') {
    app.$('#level-input').value = level;
    app.click('#btn-new-game');
    await app.tick();
    return app.readGrid();
}
function save(app) {
    app.window.dispatchEvent(new app.window.Event('pagehide'));
    return JSON.parse(app.window.localStorage.getItem('sudoku_saved_game_v2'));
}
afterEach(() => { apps.splice(0).forEach(app => app.close()); });

describe('audit gameplay regressions', () => {
    it('shows shortcuts by default on desktop, collapses on touch and remembers a choice', async () => {
        const desktop = await boot(); expect(desktop.$('.shortcuts').open).toBe(true);
        const phone = await boot({ touch: true }); expect(phone.$('.shortcuts').open).toBe(false);
        desktop.$('.shortcuts').open = false; await desktop.tick();
        const restored = await boot({ localStorage: { 'sudoku-shortcuts-open': desktop.window.localStorage.getItem('sudoku-shortcuts-open') } });
        expect(restored.$('.shortcuts').open).toBe(false);
    });
    it('supports uppercase Cmd+Shift+Z, keeps Escape non-destructive and preserves modified digits', async () => {
        const app = await boot(); const board = await start(app); const a = board.indexOf('0');
        app.type(a, '2'); app.press(a, 'Z', { metaKey: true }); expect(app.readGrid()[a]).toBe('0');
        app.press(a, 'Z', { metaKey: true, shiftKey: true }); expect(app.readGrid()[a]).toBe('2');
        app.press(a, 'Escape'); expect(app.readGrid()[a]).toBe('2');
        app.press(a, '0', { ctrlKey: true }); expect(app.readGrid()[a]).toBe('2');
        app.press(a, 'F'); expect(save(app).autoNotesUsed).toBe(true);
        app.press(a, 'P'); expect(app.$('#pause-panel').hidden).toBe(false);
        app.press(a, 'P'); expect(app.$('#pause-panel').hidden).toBe(true);
        app.press(a, 'H'); expect(app.$('#btn-hint').textContent).toBe('Reveal (+1 hint)');
        app.press(a, 'Escape'); expect(app.$('#btn-hint').textContent).toBe('Hint (free)');
        expect(save(app).hintsUsed).toBe(0);
    });
    it('plays imported puzzles with separate stats, notes, hints, resume and share', async () => {
        const source = await boot(); const board = await start(source);
        const app = await boot();
        app.click('#btn-import-play'); app.$('#import-text').value = board;
        app.click('#btn-modal-play'); await app.tick();
        expect(save(app)).toMatchObject({ difficulty: 'imported', level: null, daily: null, puzzle: board });
        expect(app.$('#status').textContent).toContain('Imported puzzle');
        expect(JSON.parse(app.window.localStorage.getItem('sudoku_stats_v2')).imported.started).toBe(1);
        app.click('#btn-fill-notes'); app.click('#btn-hint');
        expect(app.$('#status').textContent).toContain('free');
        expect(save(app).hintsUsed).toBe(0);
        app.click('#btn-hint'); const snapshot = save(app);
        expect(snapshot.hintsUsed).toBe(1);
        expect(parseGameLink(new URL(gameLink('https://example.test/', snapshot)).search)).toMatchObject({ difficulty: 'imported', puzzle: board });
        const restored = await boot({ localStorage: { sudoku_saved_game_v2: JSON.stringify(snapshot) } });
        restored.click('#btn-resume-yes'); expect(save(restored).difficulty).toBe('imported');
        const link = puzzleLink('https://example.test/', board, { play: true });
        expect(parseShareLink(new URL(link).search)).toEqual({ kind: 'puzzle', puzzle: board, play: true });
        const shared = await boot({ url: link }); await shared.tick();
        expect(save(shared)).toMatchObject({ difficulty: 'imported', puzzle: board, hintsUsed: 0 });
        const solution = SudokuSolver.solveSudoku(board).solution;
        for (let i = 0; i < 81; i++) if (board[i] === '0') app.type(i, solution[i]);
        expect(app.$('#win-puzzle').textContent).toBe('Imported puzzle');
        expect(app.$('#win-submit').style.display).toBe('none');
        expect(JSON.parse(app.window.localStorage.getItem('sudoku_stats_v2')).imported.won).toBe(1);
        app.click('#btn-stats'); expect(app.$('#stats-content').textContent).toContain('Imported');
    });
    it('rejects ambiguous imports for Play but still opens them in Solver', async () => {
        const app = await boot(); app.click('#btn-import-play');
        app.$('#import-text').value = '0'.repeat(81); app.click('#btn-modal-play'); await app.tick();
        expect(app.$('#import-error').textContent).toContain('Multiple solutions');
        expect(save(app)).toBeNull();
        app.click('#btn-modal-import');
        expect(app.$('#tab-solver').getAttribute('aria-pressed')).toBe('true');
        expect(app.$('#modal-overlay').classList.contains('active')).toBe(false);
    });
    it('routes successive touch digits to the visibly advanced selection even after native focus', async () => {
        const app = await boot({ touch: true }); const board = await start(app); const a = board.indexOf('0');
        app.inputs()[a].focus();
        app.click(app.cells()[a]);
        app.click('.numpad-btn[data-digit="1"]');
        const next = Number(app.$('.cell-wrapper.focused').dataset.idx);
        expect(next).not.toBe(a);
        app.click('.numpad-btn[data-digit="2"]');
        expect(app.readGrid()[a]).toBe('1'); expect(app.readGrid()[next]).toBe('2');
    });
    it('undoes live auto-notes and restores the exact manual notes, including redo', async () => {
        const app = await boot(); const board = await start(app); const a = board.indexOf('0');
        app.click('#btn-notes-toggle'); app.type(a, '2');
        const manual = save(app).notes;
        app.click('#btn-auto-notes'); const generated = save(app).notes;
        app.click('#btn-undo');
        expect(save(app).notes).toEqual(manual); expect(save(app).autoNotes).toBe(false);
        expect(app.$('#btn-notes-toggle').getAttribute('aria-pressed')).toBe('true');
        expect(app.$('#numpad-notes').getAttribute('aria-pressed')).toBe('true');
        expect(save(app).autoNotesUsed).toBe(true);
        app.click('#btn-redo'); expect(save(app).notes).toEqual(generated); expect(save(app).autoNotes).toBe(true);
        expect(app.$('#btn-notes-toggle').getAttribute('aria-pressed')).toBe('false');
        expect(app.$('#numpad-notes').getAttribute('aria-pressed')).toBe('false');
    });
    it('resets both manual Notes controls when a new game starts on touch', async () => {
        const app = await boot({ touch: true }); await start(app);
        app.click('#numpad-notes');
        expect(app.$('#numpad-notes').classList.contains('notes-active')).toBe(true);
        await start(app, '2');
        for (const selector of ['#numpad-notes', '#btn-notes-toggle']) {
            expect(app.$(selector).getAttribute('aria-pressed')).toBe('false');
            expect(app.$(selector).classList.contains('notes-active')).toBe(false);
        }
    });
    it('fills notes once as an undoable action and leaves them editable', async () => {
        const app = await boot(); const board = await start(app); const a = board.indexOf('0');
        app.click('#btn-fill-notes'); const filled = save(app).notes;
        expect(filled.some(notes => notes.length > 1)).toBe(true);
        expect(save(app).autoNotes).toBe(false);
        app.click('#btn-notes-toggle'); app.type(a, filled[a][0]);
        expect(save(app).notes[a]).not.toContain(filled[a][0]);
        app.click('#btn-undo'); expect(save(app).notes).toEqual(filled);
        app.click('#btn-undo'); expect(save(app).notes.every(notes => notes.length === 0)).toBe(true);
        app.click('#btn-redo'); expect(save(app).notes).toEqual(filled);
    });
    it('reviews and re-solves a completed puzzle without counting another win, including reload', async () => {
        const app = await boot(); const board = await start(app); const solution = SudokuSolver.solveSudoku(board).solution;
        for (let i = 0; i < 81; i++) if (board[i] === '0') app.type(i, solution[i]);
        expect(app.$('#win-puzzle').textContent).toContain('Easy · Level 1');
        expect(app.$('#btn-results').style.display).toBe('');
        const stats = app.window.localStorage.getItem('sudoku_stats_v2');
        const result = app.$('#win-details').textContent;
        app.click('#btn-undo'); const review = save(app);
        expect(review.completion).not.toBeNull(); expect(review.userValues).not.toBe(solution);
        app.click('#btn-redo');
        expect(app.readGrid()).toBe(solution);
        expect(app.window.localStorage.getItem('sudoku_stats_v2')).toBe(stats);
        expect(app.$('#win-details').textContent).toBe(result);
        app.click('#btn-win-review');
        app.click('#btn-results');
        expect(app.$('#win-overlay').classList.contains('active')).toBe(true);
        app.click('#btn-win-review');
        expect(app.$('#win-overlay').classList.contains('active')).toBe(false);
        const edited = board.indexOf('0');
        app.type(edited, solution[edited] === '1' ? '2' : '1');
        app.click('#btn-undo');
        expect(app.readGrid()).toBe(solution);
        expect(app.window.localStorage.getItem('sudoku_stats_v2')).toBe(stats);
        const restored = await boot({ localStorage: { sudoku_saved_game_v2: JSON.stringify(review) } });
        restored.click('#btn-resume-yes');
        const missing = restored.readGrid().indexOf('0'); restored.type(missing, solution[missing]);
        expect(restored.$('#win-details').textContent).toBe(result);
        expect(JSON.parse(restored.window.localStorage.getItem('sudoku_stats_v2') || '{}').easy?.won || 0).toBe(0);
    });
    it('keeps random draws random, with the current level in the status', async () => {
        const app = await boot();
        const first = await start(app, '');
        expect(app.$('#level-input').value).toBe('');
        expect(app.$('#status').textContent).toMatch(/Easy #\d+/);
        app.click('#btn-new-game'); await app.tick();
        expect(app.readGrid()).not.toBe(first);
        expect(save(app).level).toBeGreaterThan(0);
    });
    it('Random ignores a filled level selector', async () => {
        const app = await boot();
        await start(app);
        app.$('#level-input').value = '1';
        app.click('#btn-random'); await app.tick();
        expect(app.$('#level-input').value).toBe('');
        expect(save(app).puzzle).toHaveLength(81);
    });
    it('removes an old resume offer when a new game starts', async () => {
        const original = await boot(); await start(original); const saved = save(original);
        const app = await boot({ localStorage: { sudoku_saved_game_v2: JSON.stringify(saved) } });
        expect(app.$('#btn-resume-yes')).not.toBeNull();
        await start(app, '2');
        expect(app.$('.resume-banner')).toBeNull();
        expect(save(app).level).toBe(2);
    });
    it('restores peer pencil marks as part of undo and removes them again on redo', async () => {
        const app = await boot(); const board = await start(app);
        const row = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c).filter(i => board[i] === '0')).find(a => a.length >= 2);
        const [a, b] = row;
        app.click('#btn-notes-toggle'); app.type(b, '1'); app.click('#btn-notes-toggle');
        app.type(a, '1'); expect(save(app).notes[b]).toEqual([]);
        app.click('#btn-undo'); expect(save(app).notes[b]).toEqual(['1']);
        expect(app.readGrid()[a]).toBe('0');
        app.click('#btn-redo'); expect(save(app).notes[b]).toEqual([]);
        expect(app.readGrid()[a]).toBe('1');
    });
    it('undo restores a replaced digit as well as notes', async () => {
        const app = await boot(); const board = await start(app); const i = board.indexOf('0');
        app.type(i, '1'); app.type(i, '2'); app.click('#btn-undo');
        expect(app.readGrid()[i]).toBe('1');
    });
    it('can undo and redo a revealed hint without leaving an empty locked cell', async () => {
        const app = await boot(); const board = await start(app); const i = board.indexOf('0');
        app.inputs()[i].focus(); app.click('#btn-hint'); app.click('#btn-hint');
        expect(app.inputs()[i].readOnly).toBe(true);
        app.click('#btn-undo'); expect(app.readGrid()[i]).toBe('0'); expect(app.inputs()[i].readOnly).toBe(false);
        app.click('#btn-redo'); expect(app.inputs()[i].readOnly).toBe(true);
        expect(save(app).hintsUsed).toBe(1); // Knowing the answer remains an assist.
    });
    it('reset after a win restores saving, timer, and future win detection', async () => {
        const app = await boot(); const board = await start(app); const solution = SudokuSolver.solveSudoku(board).solution;
        for (let i = 0; i < 81; i++) if (board[i] === '0') app.type(i, solution[i]);
        app.click('#btn-reset');
        expect(app.readGrid()).toBe(board);
        expect(save(app).puzzle).toBe(board);
        const clock = app.useFakeClock(); clock.advance(5000); expect(save(app).timerSeconds).toBeGreaterThanOrEqual(5); clock.restore();
        for (let i = 0; i < 81; i++) if (board[i] === '0') app.type(i, solution[i]);
        const stats = JSON.parse(app.window.localStorage.getItem('sudoku_stats_v2'));
        expect(stats.easy.won).toBe(2); expect(stats.easy.started).toBe(2);
    });
    it('mode switches cancel pending puzzle starts', async () => {
        const app = await boot(); app.click('#btn-new-game'); app.click('#tab-solver'); await app.tick();
        expect(app.$('#tab-solver').getAttribute('aria-pressed')).toBe('true');
        expect(app.readGrid()).toBe('0'.repeat(81)); expect(save(app)).toBeNull();
    });
    it('changing the next difficulty does not relabel the active game', async () => {
        const app = await boot(); await start(app); app.click('.diff-btn[data-diff="evil"]');
        expect(save(app).difficulty).toBe('easy');
    });
    it('clipboard fallback preserves the save until explicit handoff confirmation', async () => {
        const app = await boot(); await start(app); app.click('#btn-pause'); app.click('#btn-handoff'); await app.tick();
        expect(save(app)).not.toBeNull();
        app.click('#btn-share-close'); expect(save(app)).not.toBeNull();
        app.click('#btn-handoff'); await app.tick(); app.click('#btn-handoff-confirm'); expect(save(app)).toBeNull();
    });
    it('returns an explicit theme to System without persisting the resolved color', async () => {
        const app = await boot({ prefersDark: true });
        app.click('.theme-option[data-theme="light"]'); app.click('.theme-option[data-theme="system"]');
        expect(app.document.documentElement.dataset.theme).toBe('dark');
        expect(app.window.localStorage.getItem('sudoku-theme')).toBeNull();
        expect(app.$('.theme-option[data-theme="system"]').getAttribute('aria-pressed')).toBe('true');
    });
    it('exposes a safe update action only after an existing controller changes', async () => {
        const listeners = {};
        const app = await boot({ serviceWorker: { controller: {}, addEventListener: (event, fn) => { listeners[event] = fn; }, register: async () => ({}) } });
        expect(app.$('#btn-update').style.display).toBe('none'); listeners.controllerchange();
        expect(app.$('#btn-update').style.display).toBe('');
    });
    it('ignores first installation but offers a later update in the same tab', async () => {
        const listeners = {};
        const app = await boot({ serviceWorker: { controller: null, addEventListener: (event, fn) => { listeners[event] = fn; }, register: async () => ({}) } });
        listeners.controllerchange();
        expect(app.$('#btn-update').style.display).toBe('none');
        listeners.controllerchange();
        expect(app.$('#btn-update').style.display).toBe('');
    });
});


describe('reclassified puzzle links', () => {
    it('opens the board identity even when the URL carries an unrelated level', async () => {
        const target = PUZZLES.nightmare[0];
        const app = await boot({ url: `http://localhost/?id=${target.id}&d=easy&level=1` });
        await app.tick();
        expect(app.readGrid()).toBe(target.puzzle);
        expect(app.$('#status').textContent).toContain('Nightmare #1');
    });
    it('explains an old bank link without starting an unrelated game', async () => {
        const app = await boot({ url: 'http://localhost/?d=nightmare&level=3000' });
        expect(app.readGrid()).toBe('0'.repeat(81));
        expect(app.$('#status').textContent).toContain('puzzle bank has changed');
    });
});
