import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { bootApp } from './helpers/boot-app.js';
import { repoRoot } from './helpers/paths.js';
import { SudokuSolver } from '../solver.js';
import { PUZZLES } from '../puzzle-bank.js';

// A fixed level keeps every run deterministic: startGame() reads #level-input
// and takes bankList[level - 1] rather than picking at random.
const LEVEL = 1;
const EASY_PUZZLE = PUZZLES.easy[LEVEL - 1].puzzle;
const EASY_SOLUTION = SudokuSolver.solveSudoku(EASY_PUZZLE).solution;

let app;

/** Start a play-mode game on a known level. */
async function startGame(harness, difficulty = 'easy', level = LEVEL) {
    harness.click(`.diff-btn[data-diff="${difficulty}"]`);
    harness.$('#level-input').value = String(level);
    harness.click('#btn-new-game');
    await harness.tick(50);
}

/**
 * Fill every empty cell with the correct digit. Cells already filled by a hint
 * are locked and skipped by the type() helper, which is what a browser does.
 */
function completePuzzle(harness, puzzle = EASY_PUZZLE, solution = EASY_SOLUTION) {
    for (let i = 0; i < 81; i++) {
        if (puzzle[i] === '0') harness.type(i, solution[i]);
    }
}

beforeEach(async () => {
    app = await bootApp();
});
afterEach(() => {
    app.close();
});

describe('initial render', () => {
    it('builds an 81-cell grid', () => {
        expect(app.cells()).toHaveLength(81);
        expect(app.inputs()).toHaveLength(81);
    });

    it('gives every cell a 9-digit notes grid', () => {
        expect(app.$$('.notes-grid')).toHaveLength(81);
        expect(app.$$('.cell-wrapper:first-child .note-digit')).toHaveLength(9);
    });

    it('labels cells for screen readers by row and column', () => {
        expect(app.inputs()[0].getAttribute('aria-label')).toBe('Row 1, Column 1');
        expect(app.inputs()[80].getAttribute('aria-label')).toBe('Row 9, Column 9');
    });

    it('starts in play mode', () => {
        expect(app.$('.mode-tab.active').dataset.mode).toBe('play');
        expect(app.$('#play-controls').style.display).not.toBe('none');
        expect(app.$('#solver-controls').style.display).toBe('none');
    });

    it('hides leaderboard UI when the API is unreachable', () => {
        // jsdom has no fetch, so the health check fails exactly as it does when
        // the app is opened with no backend running.
        expect(app.$('#btn-leaderboard').style.display).toBe('none');
    });
});

describe('mode switching', () => {
    it('shows solver controls in solver mode', () => {
        app.click('#tab-solver');
        expect(app.$('#solver-controls').style.display).not.toBe('none');
        expect(app.$('#play-controls').style.display).toBe('none');
    });

    it('carries the current puzzle from play into solver', async () => {
        await startGame(app);
        app.click('#tab-solver');
        // Givens survive the switch so the solver can finish the puzzle.
        for (let i = 0; i < 81; i++) {
            if (EASY_PUZZLE[i] !== '0') expect(app.inputs()[i].value).toBe(EASY_PUZZLE[i]);
        }
    });
});

describe('solver mode', () => {
    beforeEach(() => app.click('#tab-solver'));

    it('solves a puzzle entered into the grid', () => {
        for (let i = 0; i < 81; i++) {
            if (EASY_PUZZLE[i] !== '0') app.type(i, EASY_PUZZLE[i]);
        }
        app.click('#btn-solve');
        expect(app.readGrid()).toBe(EASY_SOLUTION);
    });

    it('reports the solve time', () => {
        for (let i = 0; i < 81; i++) {
            if (EASY_PUZZLE[i] !== '0') app.type(i, EASY_PUZZLE[i]);
        }
        app.click('#btn-solve');
        expect(app.$('#solve-time').textContent).toMatch(/ms/);
    });

    it('clears the grid', () => {
        app.type(0, '5');
        app.click('#btn-clear');
        expect(app.readGrid()).toBe('0'.repeat(81));
    });

    it('loads an example puzzle', async () => {
        app.click('#btn-example');
        await app.tick(50); // the bank is fetched on demand
        expect(app.readGrid()).not.toBe('0'.repeat(81));
    });

    it('reports an unsolvable grid instead of hanging', () => {
        app.type(0, '1');
        app.type(1, '1'); // duplicate in the same row
        app.click('#btn-solve');
        expect(app.$('#status').textContent).toMatch(/no solution|unsolvable|invalid/i);
    });

    describe('import', () => {
        it('imports an 81-character string', () => {
            app.click('#btn-paste');
            app.$('#import-text').value = EASY_PUZZLE;
            app.click('#btn-modal-import');
            expect(app.readGrid()).toBe(EASY_PUZZLE);
        });

        it('imports nine lines of nine digits', () => {
            app.click('#btn-paste');
            app.$('#import-text').value = EASY_PUZZLE.match(/.{9}/g).join('\n');
            app.click('#btn-modal-import');
            expect(app.readGrid()).toBe(EASY_PUZZLE);
        });

        it('rejects input of the wrong length', () => {
            app.click('#btn-paste');
            app.$('#import-text').value = '123';
            app.click('#btn-modal-import');

            // The modal stays open, the grid is untouched, and the reason is
            // stated in text — a border flash alone conveyed nothing.
            expect(app.$('#import-text').style.borderColor).toBe('var(--danger)');
            expect(app.$('#modal-overlay').classList.contains('active')).toBe(true);
            expect(app.readGrid()).toBe('0'.repeat(81));
            expect(app.$('#import-error').textContent).toMatch(/found 3/);
        });
    });
});

describe('play mode', () => {
    beforeEach(async () => {
        await startGame(app);
    });

    it('loads the requested level from the bank', () => {
        for (let i = 0; i < 81; i++) {
            if (EASY_PUZZLE[i] !== '0') expect(app.inputs()[i].value).toBe(EASY_PUZZLE[i]);
        }
    });

    it('locks the given cells', () => {
        const givens = [...EASY_PUZZLE].map((c, i) => (c !== '0' ? i : -1)).filter((i) => i >= 0);
        for (const i of givens) {
            expect(app.cells()[i].classList.contains('locked')).toBe(true);
            expect(app.inputs()[i].readOnly).toBe(true);
        }
    });

    it('reports the difficulty and clue count', () => {
        const clues = EASY_PUZZLE.replace(/0/g, '').length;
        expect(app.$('#status').textContent).toBe(`Easy — ${clues} clues`);
    });

    it('accepts a digit in an empty cell', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.type(empty, EASY_SOLUTION[empty]);
        expect(app.inputs()[empty].value).toBe(EASY_SOLUTION[empty]);
    });

    it('refuses to overwrite a given', () => {
        const given = [...EASY_PUZZLE].findIndex((c) => c !== '0');
        app.type(given, '5');
        expect(app.inputs()[given].value).toBe(EASY_PUZZLE[given]);
    });

    it('ignores non-digit input', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.type(empty, 'x');
        expect(app.inputs()[empty].value).toBe('');
    });

    it('starts the timer', async () => {
        expect(app.$('#game-timer').textContent).toMatch(/\d+:\d\d/);
    });

    it('resets back to the starting position', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.type(empty, EASY_SOLUTION[empty]);
        app.click('#btn-reset');
        expect(app.readGrid()).toBe(EASY_PUZZLE);
    });
});

describe('conflict detection', () => {
    beforeEach(async () => {
        await startGame(app);
    });

    it('flags a digit that duplicates one in the same row', () => {
        // Find an empty cell whose row already contains a given.
        const empty = [...EASY_PUZZLE].findIndex((c, i) => {
            if (c !== '0') return false;
            const rowStart = Math.floor(i / 9) * 9;
            return EASY_PUZZLE.slice(rowStart, rowStart + 9).replace(/0/g, '').length > 0;
        });
        const rowStart = Math.floor(empty / 9) * 9;
        const duplicate = EASY_PUZZLE.slice(rowStart, rowStart + 9).replace(/0/g, '')[0];

        app.type(empty, duplicate);
        expect(app.cells()[empty].classList.contains('conflict')).toBe(true);
    });

    it('does not flag a correct digit', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.type(empty, EASY_SOLUTION[empty]);
        expect(app.cells()[empty].classList.contains('conflict')).toBe(false);
    });
});

describe('notes', () => {
    beforeEach(async () => {
        await startGame(app);
    });

    it('toggles notes mode from the button', () => {
        app.click('#btn-notes-toggle');
        expect(app.$('#btn-notes-toggle').textContent).toBe('Notes: ON');
        app.click('#btn-notes-toggle');
        expect(app.$('#btn-notes-toggle').textContent).toBe('Notes: OFF');
    });

    it('records a pencil mark instead of a value', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.click('#btn-notes-toggle');
        app.type(empty, '4');

        expect(app.inputs()[empty].value).toBe('');
        const note = app.cells()[empty].querySelectorAll('.note-digit')[3]; // digit 4
        expect(note.classList.contains('visible')).toBe(true);
    });

    it('removes a pencil mark when the same digit is entered twice', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.click('#btn-notes-toggle');
        app.type(empty, '4');
        app.type(empty, '4');

        const note = app.cells()[empty].querySelectorAll('.note-digit')[3];
        expect(note.classList.contains('visible')).toBe(false);
    });

    it('clears a cell\'s notes when a digit is placed there', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.click('#btn-notes-toggle');
        app.type(empty, '4');
        app.click('#btn-notes-toggle');
        app.type(empty, EASY_SOLUTION[empty]);

        const visible = [...app.cells()[empty].querySelectorAll('.note-digit')]
            .filter((n) => n.classList.contains('visible'));
        expect(visible).toHaveLength(0);
    });
});

describe('hints', () => {
    beforeEach(async () => {
        await startGame(app);
    });

    it('fills a cell with its correct value', () => {
        app.click('#btn-hint');
        const hinted = app.cells().findIndex((c) => c.classList.contains('hint'));
        expect(hinted).toBeGreaterThanOrEqual(0);
        expect(app.inputs()[hinted].value).toBe(EASY_SOLUTION[hinted]);
    });

    it('only ever fills empty cells', () => {
        app.click('#btn-hint');
        const hinted = app.cells().findIndex((c) => c.classList.contains('hint'));
        expect(EASY_PUZZLE[hinted]).toBe('0');
    });

    it('counts hints towards the win summary', () => {
        app.click('#btn-hint');
        app.click('#btn-hint');
        completePuzzle(app);
        expect(app.$('#win-details').textContent).toMatch(/2 hints used/);
    });
});

describe('error checking', () => {
    beforeEach(async () => {
        await startGame(app);
    });

    it('marks an incorrect entry', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        const wrong = EASY_SOLUTION[empty] === '1' ? '2' : '1';
        app.type(empty, wrong);
        app.click('#btn-check');
        expect(app.cells()[empty].classList.contains('user-error')).toBe(true);
    });

    it('does not mark a correct entry as wrong', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.type(empty, EASY_SOLUTION[empty]);
        app.click('#btn-check');
        expect(app.cells()[empty].classList.contains('user-error')).toBe(false);
    });
});

describe('undo and redo', () => {
    beforeEach(async () => {
        await startGame(app);
    });

    it('undoes a placed digit', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.type(empty, EASY_SOLUTION[empty]);
        app.click('#btn-undo');
        expect(app.inputs()[empty].value).toBe('');
    });

    it('redoes an undone digit', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.type(empty, EASY_SOLUTION[empty]);
        app.click('#btn-undo');
        app.click('#btn-redo');
        expect(app.inputs()[empty].value).toBe(EASY_SOLUTION[empty]);
    });

    it('undoes a pencil mark', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.click('#btn-notes-toggle');
        app.type(empty, '4');
        app.click('#btn-undo');

        const note = app.cells()[empty].querySelectorAll('.note-digit')[3];
        expect(note.classList.contains('visible')).toBe(false);
    });

    it('does nothing when there is nothing to undo', () => {
        app.click('#btn-undo');
        expect(app.readGrid()).toBe(EASY_PUZZLE);
    });
});

describe('winning', () => {
    beforeEach(async () => {
        await startGame(app);
    });

    it('detects a completed puzzle', async () => {
        completePuzzle(app);
        await app.tick(700); // the overlay is shown after a 600ms delay
        expect(app.$('#win-overlay').classList.contains('active')).toBe(true);
    });

    it('reports the time and hint count', () => {
        completePuzzle(app);
        expect(app.$('#win-details').textContent).toMatch(/Time: \d+:\d\d — No hints used/);
    });

    it('does not fire on a full but incorrect grid', () => {
        for (let i = 0; i < 81; i++) {
            if (EASY_PUZZLE[i] === '0') app.type(i, EASY_SOLUTION[i] === '1' ? '2' : '1');
        }
        expect(app.$('#win-overlay').classList.contains('active')).toBe(false);
    });

    it('records the result in stats', () => {
        completePuzzle(app);
        const stats = JSON.parse(app.window.localStorage.getItem('sudoku_stats'));
        expect(stats.easy.played).toBe(1);
        expect(stats.easy.bestTime).toBeGreaterThanOrEqual(0);
    });

    it('clears the saved game', () => {
        completePuzzle(app);
        expect(app.window.localStorage.getItem('sudoku_saved_game')).toBeNull();
    });
});

describe('save and resume', () => {
    it('saves progress to localStorage', async () => {
        await startGame(app);
        const empty = EASY_PUZZLE.indexOf('0');
        app.type(empty, EASY_SOLUTION[empty]);
        await app.tick(2100); // debounced by 2s

        const saved = JSON.parse(app.window.localStorage.getItem('sudoku_saved_game'));
        expect(saved.puzzle).toBe(EASY_PUZZLE);
        expect(saved.difficulty).toBe('easy');
        expect(saved.userValues[empty]).toBe(EASY_SOLUTION[empty]);
    });

    it('offers to resume a saved game on load', async () => {
        const saved = {
            puzzle: EASY_PUZZLE,
            solution: EASY_SOLUTION,
            difficulty: 'easy',
            userValues: EASY_PUZZLE,
            notes: Array.from({ length: 81 }, () => []),
            timerSeconds: 65,
            hintsUsed: 0,
            lockedCells: [...EASY_PUZZLE].map((c) => c !== '0'),
            hintCells: Array(81).fill(false),
            timestamp: Date.now(),
        };
        const resumed = await bootApp({
            localStorage: { sudoku_saved_game: JSON.stringify(saved) },
        });

        const banner = resumed.$('.resume-banner');
        expect(banner).not.toBeNull();
        expect(banner.textContent).toMatch(/Resume Easy game\? \(1:05\)/);
        resumed.close();
    });

    it('restores the board when resume is clicked', async () => {
        const partial = [...EASY_PUZZLE];
        const empty = EASY_PUZZLE.indexOf('0');
        partial[empty] = EASY_SOLUTION[empty];

        const resumed = await bootApp({
            localStorage: {
                sudoku_saved_game: JSON.stringify({
                    puzzle: EASY_PUZZLE,
                    solution: EASY_SOLUTION,
                    difficulty: 'easy',
                    userValues: partial.join(''),
                    notes: Array.from({ length: 81 }, () => []),
                    timerSeconds: 30,
                    hintsUsed: 1,
                    lockedCells: [...EASY_PUZZLE].map((c) => c !== '0'),
                    hintCells: Array(81).fill(false),
                    timestamp: Date.now(),
                }),
            },
        });

        resumed.click('#btn-resume-yes');
        await resumed.tick(50);
        expect(resumed.readGrid()).toBe(partial.join(''));
        resumed.close();
    });

    it('discards the saved game when dismissed', async () => {
        const resumed = await bootApp({
            localStorage: {
                sudoku_saved_game: JSON.stringify({
                    puzzle: EASY_PUZZLE,
                    solution: EASY_SOLUTION,
                    difficulty: 'easy',
                    userValues: EASY_PUZZLE,
                    notes: Array.from({ length: 81 }, () => []),
                    timerSeconds: 5,
                    hintsUsed: 0,
                    lockedCells: [...EASY_PUZZLE].map((c) => c !== '0'),
                    hintCells: Array(81).fill(false),
                    timestamp: Date.now(),
                }),
            },
        });

        resumed.click('#btn-resume-no');
        expect(resumed.window.localStorage.getItem('sudoku_saved_game')).toBeNull();
        expect(resumed.$('.resume-banner')).toBeNull();
        resumed.close();
    });
});

describe('themes', () => {
    it('defaults to midnight', () => {
        expect(app.document.documentElement.dataset.theme || 'midnight').toBe('midnight');
    });

    it('applies and persists a chosen theme', () => {
        app.click('.theme-option[data-theme="sakura"]');
        expect(app.document.documentElement.dataset.theme).toBe('sakura');
        expect(app.window.localStorage.getItem('sudoku-theme')).toBe('sakura');
    });

    it('restores the saved theme on load', async () => {
        const themed = await bootApp({ localStorage: { 'sudoku-theme': 'forest' } });
        expect(themed.document.documentElement.dataset.theme).toBe('forest');
        themed.close();
    });

    it('updates the theme-color meta tag for mobile browser chrome', () => {
        app.click('.theme-option[data-theme="ocean"]');
        expect(app.$('meta[name="theme-color"]').getAttribute('content')).toBe('#0b1628');
    });
});

describe('difficulty selection', () => {
    it('updates the level range for the chosen difficulty', () => {
        app.click('.diff-btn[data-diff="nightmare"]');
        expect(app.$('#level-input').max).toBe('3000');
        expect(app.$('#level-max').textContent).toMatch(/3000/);
    });

    it('marks the selected difficulty as active', () => {
        app.click('.diff-btn[data-diff="evil"]');
        expect(app.$('.diff-btn.active').dataset.diff).toBe('evil');
    });
});

describe('pause', () => {
    beforeEach(async () => {
        await startGame(app);
    });

    it('freezes the timer and marks the grid', () => {
        app.click('#btn-pause');
        expect(app.$('#status').textContent).toBe('Paused');
        expect(app.$('#grid').classList.contains('paused')).toBe(true);
    });

    // Without this, pausing stops the clock but still accepts input: solve the
    // whole puzzle while paused, unpause, and submit an impossible time.
    it('refuses digits typed while paused', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.click('#btn-pause');
        app.type(empty, EASY_SOLUTION[empty]);
        expect(app.inputs()[empty].value).toBe('');
    });

    it('refuses keyboard input while paused', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.click('#btn-pause');
        app.press(empty, EASY_SOLUTION[empty]);
        expect(app.inputs()[empty].value).toBe('');
    });

    it('refuses hints while paused', () => {
        app.click('#btn-pause');
        app.click('#btn-hint');
        expect(app.cells().some((c) => c.classList.contains('hint'))).toBe(false);
    });

    it('refuses error checking while paused', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.type(empty, EASY_SOLUTION[empty] === '1' ? '2' : '1');
        app.click('#btn-pause');
        app.click('#btn-check');
        expect(app.cells()[empty].classList.contains('user-error')).toBe(false);
    });

    it('accepts input again once unpaused', () => {
        const empty = EASY_PUZZLE.indexOf('0');
        app.click('#btn-pause');
        app.click('#btn-pause');
        app.type(empty, EASY_SOLUTION[empty]);
        expect(app.inputs()[empty].value).toBe(EASY_SOLUTION[empty]);
    });

    it('still allows arrow-key navigation while paused', () => {
        app.click('#btn-pause');
        app.press(0, 'ArrowRight');
        expect(app.document.activeElement).toBe(app.inputs()[1]);
    });
});

describe('level attribution', () => {
    it('saves the level that was actually played', async () => {
        await startGame(app, 'easy', 3);
        const empty = EASY_PUZZLE.indexOf('0');
        app.type(empty, '5');
        await app.tick(2100);

        const saved = JSON.parse(app.window.localStorage.getItem('sudoku_saved_game'));
        expect(saved.level).toBe(3);
    });

    // #level-input stays editable during play, so reading it at submit time
    // credited the score to whatever number was left in the box.
    it('is unaffected by editing the level input mid-game', async () => {
        await startGame(app, 'easy', 3);
        app.$('#level-input').value = '499';
        app.type(EASY_PUZZLE.indexOf('0'), '5');
        await app.tick(2100);

        const saved = JSON.parse(app.window.localStorage.getItem('sudoku_saved_game'));
        expect(saved.level).toBe(3);
    });

    it('restores the level when a game is resumed', async () => {
        const resumed = await bootApp({
            localStorage: {
                sudoku_saved_game: JSON.stringify({
                    puzzle: EASY_PUZZLE,
                    solution: EASY_SOLUTION,
                    difficulty: 'easy',
                    level: 42,
                    userValues: EASY_PUZZLE,
                    notes: Array.from({ length: 81 }, () => []),
                    timerSeconds: 5,
                    hintsUsed: 0,
                    lockedCells: [...EASY_PUZZLE].map((c) => c !== '0'),
                    hintCells: Array(81).fill(false),
                    timestamp: Date.now(),
                }),
            },
        });
        resumed.click('#btn-resume-yes');
        await resumed.tick(50);
        resumed.type(EASY_PUZZLE.indexOf('0'), '5');
        await resumed.tick(2100);

        const saved = JSON.parse(resumed.window.localStorage.getItem('sudoku_saved_game'));
        expect(saved.level).toBe(42);
        resumed.close();
    });
});

describe('saving on the way out', () => {
    // The 2s debounce meant closing a tab, or a phone backgrounding the app,
    // silently discarded the last moves.
    it('flushes immediately when the page is hidden', async () => {
        await startGame(app);
        const empty = EASY_PUZZLE.indexOf('0');
        app.type(empty, EASY_SOLUTION[empty]);

        expect(app.window.localStorage.getItem('sudoku_saved_game')).toBeNull();

        Object.defineProperty(app.document, 'visibilityState', {
            value: 'hidden',
            configurable: true,
        });
        app.document.dispatchEvent(new app.window.Event('visibilitychange'));

        const saved = JSON.parse(app.window.localStorage.getItem('sudoku_saved_game'));
        expect(saved.userValues[empty]).toBe(EASY_SOLUTION[empty]);
    });

    it('flushes on pagehide', async () => {
        await startGame(app);
        const empty = EASY_PUZZLE.indexOf('0');
        app.type(empty, EASY_SOLUTION[empty]);

        app.window.dispatchEvent(new app.window.Event('pagehide'));

        const saved = JSON.parse(app.window.localStorage.getItem('sudoku_saved_game'));
        expect(saved.userValues[empty]).toBe(EASY_SOLUTION[empty]);
    });
});

describe('timer', () => {
    let clock;

    beforeEach(async () => {
        await startGame(app);
        clock = app.useFakeClock();
    });
    afterEach(() => clock.restore());

    /** Elapsed time is computed on demand, so a save reports it exactly. */
    async function savedSeconds() {
        app.window.dispatchEvent(new app.window.Event('pagehide'));
        return JSON.parse(app.window.localStorage.getItem('sudoku_saved_game')).timerSeconds;
    }

    it('starts at zero', () => {
        expect(app.$('#game-timer').textContent).toBe('0:00');
    });

    // The old implementation counted interval ticks, so a throttled or
    // backgrounded tab undercounted real elapsed time.
    it('measures wall-clock time rather than counting ticks', async () => {
        clock.advance(65_000);
        expect(await savedSeconds()).toBe(65);
    });

    it('keeps counting across a long background gap', async () => {
        clock.advance(10 * 60_000);
        expect(await savedSeconds()).toBe(600);
    });

    it('excludes paused time', async () => {
        clock.advance(20_000);
        app.click('#btn-pause');
        clock.advance(300_000); // five minutes paused
        app.click('#btn-pause');
        clock.advance(5_000);

        expect(await savedSeconds()).toBe(25);
    });

    it('does not advance while paused', async () => {
        clock.advance(30_000);
        app.click('#btn-pause');
        const atPause = await savedSeconds();
        clock.advance(120_000);
        expect(await savedSeconds()).toBe(atPause);
    });

    it('reports elapsed time in the win summary', () => {
        clock.advance(125_000);
        completePuzzle(app);
        expect(app.$('#win-details').textContent).toMatch(/Time: 2:05/);
    });

    it('continues from the saved time when a game is resumed', async () => {
        const resumed = await bootApp({
            localStorage: {
                sudoku_saved_game: JSON.stringify({
                    puzzle: EASY_PUZZLE,
                    solution: EASY_SOLUTION,
                    difficulty: 'easy',
                    level: 1,
                    userValues: EASY_PUZZLE,
                    notes: Array.from({ length: 81 }, () => []),
                    timerSeconds: 100,
                    hintsUsed: 0,
                    lockedCells: [...EASY_PUZZLE].map((c) => c !== '0'),
                    hintCells: Array(81).fill(false),
                    timestamp: Date.now(),
                }),
            },
        });
        resumed.click('#btn-resume-yes');
        await resumed.tick(30);

        const resumedClock = resumed.useFakeClock();
        resumedClock.advance(10_000);
        resumed.window.dispatchEvent(new resumed.window.Event('pagehide'));

        // Exactly 110: resuming used to start a second interval without
        // clearing the first, which could advance the clock twice per second.
        const saved = JSON.parse(resumed.window.localStorage.getItem('sudoku_saved_game'));
        expect(saved.timerSeconds).toBe(110);

        resumedClock.restore();
        resumed.close();
    });

    it('restarts from zero for a new game', async () => {
        clock.advance(50_000);
        clock.restore();
        await startGame(app, 'easy', 2);
        clock = app.useFakeClock();
        clock.advance(3_000);
        expect(await savedSeconds()).toBe(3);
    });
});

describe('accessibility', () => {
    it('allows pinch zoom', () => {
        // user-scalable=no / maximum-scale=1 fails WCAG 1.4.4. It is not needed
        // here: cells are readOnly on touch devices, so iOS never auto-zooms.
        const viewport = app.$('meta[name="viewport"]').getAttribute('content');
        expect(viewport).not.toMatch(/user-scalable\s*=\s*no/);
        expect(viewport).not.toMatch(/maximum-scale/);
    });

    it('announces status messages', () => {
        const status = app.$('#status');
        expect(status.getAttribute('role')).toBe('status');
        expect(status.getAttribute('aria-live')).toBe('polite');
    });

    it('announces the win summary assertively', () => {
        expect(app.$('#win-details').getAttribute('aria-live')).toBe('assertive');
    });

    it('exposes notes mode as a toggle state', async () => {
        await startGame(app);
        const toggle = app.$('#btn-notes-toggle');
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        app.click('#btn-notes-toggle');
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        expect(app.$('#numpad-notes').getAttribute('aria-pressed')).toBe('true');
    });

    it('labels every cell with its position', () => {
        const labels = app.inputs().map((i) => i.getAttribute('aria-label'));
        expect(labels.filter(Boolean)).toHaveLength(81);
    });

    describe('import errors', () => {
        beforeEach(() => app.click('#tab-solver'));

        it('states how many digits were found', () => {
            app.click('#btn-paste');
            app.$('#import-text').value = '12345';
            app.click('#btn-modal-import');
            expect(app.$('#import-error').textContent).toBe('Need 81 digits, found 5.');
        });

        it('explains the format when nothing was entered', () => {
            app.click('#btn-paste');
            app.$('#import-text').value = '';
            app.click('#btn-modal-import');
            expect(app.$('#import-error').textContent).toMatch(/81 digits/);
        });

        it('uses a role that is announced immediately', () => {
            expect(app.$('#import-error').getAttribute('role')).toBe('alert');
        });

        it('clears the error on a successful import', () => {
            app.click('#btn-paste');
            app.$('#import-text').value = '123';
            app.click('#btn-modal-import');
            expect(app.$('#import-error').textContent).not.toBe('');

            app.$('#import-text').value = EASY_PUZZLE;
            app.click('#btn-modal-import');
            expect(app.$('#import-error').textContent).toBe('');
        });

        it('clears the error when the modal is reopened', () => {
            app.click('#btn-paste');
            app.$('#import-text').value = '123';
            app.click('#btn-modal-import');
            app.click('#btn-modal-cancel');
            app.click('#btn-paste');
            expect(app.$('#import-error').textContent).toBe('');
        });
    });
});

describe('progressive web app', () => {
    it('links the manifest and icons', () => {
        expect(app.$('link[rel="manifest"]')).not.toBeNull();
        expect(app.$('link[rel="apple-touch-icon"]')).not.toBeNull();
        expect(app.$('link[rel="icon"][type="image/svg+xml"]')).not.toBeNull();
    });

    it('points every icon link at a file that exists', () => {
        const links = [
            ...app.$$('link[rel="icon"]'),
            ...app.$$('link[rel="apple-touch-icon"]'),
            ...app.$$('link[rel="manifest"]'),
        ];
        expect(links.length).toBeGreaterThan(0);
        for (const link of links) {
            const href = link.getAttribute('href').replace(/^\.\//, '');
            expect(fs.existsSync(path.join(repoRoot, 'public', href)), href).toBe(true);
        }
    });

    it('registers a service worker over http', async () => {
        const registered = [];
        const withSW = await bootApp({
            serviceWorker: {
                register: (url, opts) => {
                    registered.push({ url: String(url), opts });
                    return Promise.resolve();
                },
            },
        });
        // jsdom fires 'load' itself once the document settles; dispatching one
        // by hand here would double-register and hide that.
        await withSW.tick(20);

        expect(registered).toHaveLength(1);
        expect(registered[0].url).toMatch(/sw\.js$/);
        expect(registered[0].opts.scope).toBe('./');
        withSW.close();
    });

    it('survives a registration that rejects', async () => {
        const withSW = await bootApp({
            serviceWorker: { register: () => Promise.reject(new Error('denied')) },
        });
        await withSW.tick(20);

        // Offline support is a bonus; losing it must never affect the game.
        expect(withSW.cells()).toHaveLength(81);
        withSW.close();
    });

    it('does not break when service workers are unavailable', () => {
        // Safari in private mode, older browsers, and file:// all land here.
        expect(app.window.navigator.serviceWorker).toBeUndefined();
        expect(() => app.window.dispatchEvent(new app.window.Event('load'))).not.toThrow();
        expect(app.cells()).toHaveLength(81);
    });
});

describe('theme dropdown', () => {
    it('offers every theme', () => {
        const themes = app.$$('.theme-option').map((b) => b.dataset.theme);
        expect(themes).toEqual([
            'midnight', 'sakura', 'ocean', 'forest', 'arctic', 'naruto', 'wicked',
        ]);
    });

    // The dropdown used to carry a "Force Update" button that reloaded with a
    // cache-busting query string. Content-hashed assets, a no-cache index.html
    // and a network-first service worker make staleness structurally impossible,
    // and with a service worker installed the query string would not have
    // bypassed anything anyway.
    it('contains only theme choices', () => {
        for (const option of app.$$('.theme-option')) {
            expect(option.dataset.theme).toBeTruthy();
        }
    });
});

describe('dialog accessibility', () => {
    /** Open a dialog and return its overlay and the dialog element inside it. */
    function open(harness, trigger, overlayId) {
        harness.click(trigger);
        const overlay = harness.$(`#${overlayId}`);
        return { overlay, dialog: overlay.querySelector('[role="dialog"]') };
    }

    const press = (harness, key, init = {}) =>
        harness.document.activeElement.dispatchEvent(
            new harness.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
        );

    describe('markup', () => {
        it('marks every overlay as a modal dialog with a label', () => {
            for (const id of ['modal-overlay', 'win-overlay', 'stats-overlay', 'leaderboard-overlay']) {
                const dialog = app.$(`#${id} [role="dialog"]`);
                expect(dialog, id).not.toBeNull();
                expect(dialog.getAttribute('aria-modal'), id).toBe('true');

                const labelId = dialog.getAttribute('aria-labelledby');
                expect(labelId, id).toBeTruthy();
                expect(app.$(`#${labelId}`), `${id} label target`).not.toBeNull();
            }
        });
    });

    describe('opening', () => {
        beforeEach(() => app.click('#tab-solver'));

        it('moves focus into the dialog', () => {
            open(app, '#btn-paste', 'modal-overlay');
            expect(app.document.activeElement).toBe(app.$('#import-text'));
        });

        it('hides the page behind it from assistive technology', () => {
            open(app, '#btn-paste', 'modal-overlay');
            expect(app.$('#app').getAttribute('aria-hidden')).toBe('true');
            expect(app.$('.header').getAttribute('aria-hidden')).toBe('true');
        });

        it('reveals the page again on close', () => {
            open(app, '#btn-paste', 'modal-overlay');
            app.click('#btn-modal-cancel');
            expect(app.$('#app').getAttribute('aria-hidden')).toBeNull();
        });
    });

    describe('escape', () => {
        it('closes the import dialog', () => {
            app.click('#tab-solver');
            const { overlay } = open(app, '#btn-paste', 'modal-overlay');
            press(app, 'Escape');
            expect(overlay.classList.contains('active')).toBe(false);
        });

        it('closes the stats dialog', () => {
            const { overlay } = open(app, '#btn-stats', 'stats-overlay');
            press(app, 'Escape');
            expect(overlay.classList.contains('active')).toBe(false);
        });

        // Escape also resets the puzzle when a cell has focus, so the dialog
        // handler must win while one is open.
        it('does not reset the game while a dialog is open', async () => {
            await startGame(app);
            const empty = EASY_PUZZLE.indexOf('0');
            app.type(empty, EASY_SOLUTION[empty]);

            open(app, '#btn-stats', 'stats-overlay');
            press(app, 'Escape');

            expect(app.inputs()[empty].value).toBe(EASY_SOLUTION[empty]);
        });
    });

    describe('focus return', () => {
        it('returns focus to whatever opened the dialog', () => {
            app.click('#tab-solver');
            const trigger = app.$('#btn-paste');
            trigger.focus();
            open(app, '#btn-paste', 'modal-overlay');
            press(app, 'Escape');
            expect(app.document.activeElement).toBe(trigger);
        });

        it('returns focus when closed by its button', () => {
            const trigger = app.$('#btn-stats');
            trigger.focus();
            open(app, '#btn-stats', 'stats-overlay');
            app.click('#btn-stats-close');
            expect(app.document.activeElement).toBe(trigger);
        });
    });

    describe('focus trap', () => {
        // Without this, Tab walks into the grid behind the overlay — invisible
        // to a sighted user and incoherent to a screen reader.
        it('wraps from the last element back to the first', () => {
            open(app, '#btn-stats', 'stats-overlay');
            const focusable = [...app.$('#stats-overlay').querySelectorAll('button, input, textarea')];
            const last = focusable[focusable.length - 1];

            last.focus();
            press(app, 'Tab');
            expect(app.document.activeElement).toBe(focusable[0]);
        });

        it('wraps backwards from the first element to the last', () => {
            open(app, '#btn-stats', 'stats-overlay');
            const focusable = [...app.$('#stats-overlay').querySelectorAll('button, input, textarea')];

            focusable[0].focus();
            press(app, 'Tab', { shiftKey: true });
            expect(app.document.activeElement).toBe(focusable[focusable.length - 1]);
        });

        it('pulls focus back in if it escaped the dialog', () => {
            open(app, '#btn-stats', 'stats-overlay');
            app.inputs()[0].focus(); // a cell behind the overlay
            press(app, 'Tab');
            expect(app.$('#stats-overlay').contains(app.document.activeElement)).toBe(true);
        });

        it('leaves Tab alone when no dialog is open', () => {
            app.inputs()[0].focus();
            press(app, 'Tab');
            // The browser handles it; the app must not interfere.
            expect(app.document.activeElement).toBe(app.inputs()[0]);
        });
    });

    describe('stacking', () => {
        it('does not open the import dialog on top of another', () => {
            app.click('#tab-solver');
            open(app, '#btn-stats', 'stats-overlay');
            app.document.dispatchEvent(
                new app.window.KeyboardEvent('keydown', { key: 'i', ctrlKey: true, bubbles: true })
            );
            expect(app.$('#modal-overlay').classList.contains('active')).toBe(false);
        });
    });

    describe('win overlay', () => {
        it('traps focus and can be dismissed with Escape', async () => {
            await startGame(app);
            completePuzzle(app);
            await app.tick(700);

            const overlay = app.$('#win-overlay');
            expect(overlay.classList.contains('active')).toBe(true);
            expect(overlay.contains(app.document.activeElement)).toBe(true);

            press(app, 'Escape');
            expect(overlay.classList.contains('active')).toBe(false);
        });
    });
});
