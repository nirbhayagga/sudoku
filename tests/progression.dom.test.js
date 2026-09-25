import { afterEach, expect, it } from 'vitest';
import { bootApp } from './helpers/boot-app.js';
import { PUZZLES } from '../puzzle-bank.js';
import { SudokuSolver } from '../solver.js';

let app;
afterEach(() => app?.window.close());
const finish = puzzle => {
    const solution = SudokuSolver.solveSudoku(puzzle).solution;
    for (let i = 0; i < 81; i++) if (puzzle[i] === '0') app.type(i, solution[i]);
};
it('starts at Easy 1, waits after completion, and advances only on explicit Next', async () => {
    app = await bootApp(); app.click('#btn-progression'); await app.tick(60);
    const first = PUZZLES.easy[0];
    expect(app.readGrid()).toBe(first.puzzle);
    expect(app.$('#status').textContent).toContain('Progression');
    finish(first.puzzle);
    expect(JSON.parse(app.window.localStorage.getItem('sudoku_progression_v1'))['9']).toEqual([first.id]);
    expect(app.readGrid()).toBe(SudokuSolver.solveSudoku(first.puzzle).solution);
    app.click('#btn-win-review'); app.click('#btn-undo'); app.click('#btn-redo');
    expect(JSON.parse(app.window.localStorage.getItem('sudoku_progression_v1'))['9']).toEqual([first.id]);
    app.click('#btn-win-next'); await app.tick(60);
    expect(app.readGrid()).toBe(PUZZLES.easy[1].puzzle);
});
it('ordinary games do not advance progression', async () => {
    app = await bootApp(); app.$('#level-input').value = '1'; app.click('#btn-new-game'); await app.tick(60);
    finish(PUZZLES.easy[0].puzzle);
    expect(app.window.localStorage.getItem('sudoku_progression_v1')).toBeNull();
    expect(app.$('#btn-win-next').hidden).toBe(true);
});
it('resumes unfinished progression with its entries after reload', async () => {
    app = await bootApp(); app.click('#btn-progression'); await app.tick(60);
    const puzzle = PUZZLES.easy[0].puzzle, idx = puzzle.indexOf('0');
    app.type(idx, SudokuSolver.solveSudoku(puzzle).solution[idx]);
    app.window.dispatchEvent(new app.window.Event('pagehide'));
    const saved = app.window.localStorage.getItem('sudoku_saved_game_v2');
    expect(JSON.parse(saved).progression).toBe(true);
    app.window.close(); app = await bootApp({ localStorage: { sudoku_saved_game_v2: saved } });
    app.click('#btn-progression'); await app.tick(60);
    expect(app.inputs()[idx].value).toBe(SudokuSolver.solveSudoku(puzzle).solution[idx]);
    expect(app.$('#status').textContent).toContain('Progression');
});
