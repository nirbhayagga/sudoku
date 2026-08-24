/**
 * Sudoku — UI Controller
 * Solver Mode + Play Mode with pencil marks, undo/redo, digit highlighting,
 * conflict detection, localStorage save/resume, and stats tracking.
 */
import { SudokuSolver } from './solver.js';
import { SudokuGenerator } from './generator.js';
import { DIFFICULTY_LABELS, BANK_SIZES } from './difficulties.js';
import { dailyPuzzle, formatDay } from './daily.js';
import { parseShareLink, bankLink, puzzleLink, copyToClipboard } from './share.js';
import { candidatesFor, candidateGrid, peersOf, cellName, nextStep } from './techniques.js';
import { formatTime, escapeHtml } from './format.js';
import { createDialogs } from './dialogs.js';
import { applyTheme, DEFAULT_THEME } from './theme.js';
import * as store from './storage.js';
import * as leaderboard from './leaderboard-client.js';

/**
 * The puzzle bank is ~450 kB — over 90% of the app — and is not needed to draw
 * the grid, resume a saved game (the board lives in localStorage) or use solver
 * mode. It is fetched on first use and the promise cached, so the initial load
 * carries only the ~10 kB of everything else.
 */
let bankPromise = null;
function loadBank() {
    if (!bankPromise) bankPromise = import('./puzzle-bank.js');
    return bankPromise;
}

(() => {
    // Rubber-band scrolling is suppressed in CSS with `overscroll-behavior`,
    // not JavaScript.
    //
    // This used to preventDefault() on touchmove unless the nearest `body` or
    // `.card` ancestor was itself scrollable. On a short screen that matched
    // `.card`, which is not a scroll container, so every touch drag was
    // cancelled — the page could not be scrolled at all and anything below the
    // fold was unreachable. Cancelling touchmove is far too blunt for this.

    // ── Elements ───────────────────────────────────────────────────────
    const gridEl = document.getElementById('grid');
    const statusEl = document.getElementById('status');
    const solveTimeEl = document.getElementById('solve-time');
    const gameTimerEl = document.getElementById('game-timer');
    const subtitleEl = document.getElementById('subtitle');

    const tabSolver = document.getElementById('tab-solver');
    const tabPlay = document.getElementById('tab-play');
    const modeIndicator = document.getElementById('mode-indicator');

    const solverControls = document.getElementById('solver-controls');
    const btnSolve = document.getElementById('btn-solve');
    const btnExample = document.getElementById('btn-example');
    const btnPaste = document.getElementById('btn-paste');
    const btnClear = document.getElementById('btn-clear');

    const playControls = document.getElementById('play-controls');
    const btnNewGame = document.getElementById('btn-new-game');
    const btnHint = document.getElementById('btn-hint');
    const btnCheck = document.getElementById('btn-check');
    const btnReset = document.getElementById('btn-reset');
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const btnNotesToggle = document.getElementById('btn-notes-toggle');
    const btnAutoNotes = document.getElementById('btn-auto-notes');
    const btnPause = document.getElementById('btn-pause');
    const diffSelector = document.getElementById('difficulty-selector');
    const levelInput = document.getElementById('level-input');
    const levelMaxDisplay = document.getElementById('level-max');
    const btnStats = document.getElementById('btn-stats');
    const btnDaily = document.getElementById('btn-daily');
    const setupControls = document.getElementById('setup-controls');
    const btnSetupToggle = document.getElementById('btn-setup-toggle');
    const btnShare = document.getElementById('btn-share');
    const shareOverlay = document.getElementById('share-overlay');
    const shareText = document.getElementById('share-text');
    const btnShareClose = document.getElementById('btn-share-close');

    const modalOverlay = document.getElementById('modal-overlay');
    const importText = document.getElementById('import-text');
    const importError = document.getElementById('import-error');
    const btnModalOk = document.getElementById('btn-modal-import');
    const btnModalNo = document.getElementById('btn-modal-cancel');

    const winOverlay = document.getElementById('win-overlay');
    const winDetails = document.getElementById('win-details');
    const btnWinNew = document.getElementById('btn-win-new');
    const winSubmit = document.getElementById('win-submit');
    const winNameInput = document.getElementById('win-name');
    const btnWinSubmit = document.getElementById('btn-win-submit');

    const statsOverlay = document.getElementById('stats-overlay');
    const statsContent = document.getElementById('stats-content');
    const btnStatsClose = document.getElementById('btn-stats-close');
    const btnStatsReset = document.getElementById('btn-stats-reset');

    // Leaderboard
    const lbOverlay = document.getElementById('leaderboard-overlay');
    const lbContent = document.getElementById('leaderboard-content');
    const lbTabs = document.getElementById('leaderboard-tabs');
    const btnLbClose = document.getElementById('btn-lb-close');
    const btnLeaderboard = document.getElementById('btn-leaderboard');

    // Theme picker & Update
    const themeToggle = document.getElementById('theme-toggle');
    const themeDropdown = document.getElementById('theme-dropdown');

    // ── Cell Data Structures ───────────────────────────────────────────
    // Each cell is a wrapper div containing an input and a notes grid
    const wrappers = [];    // 81 wrapper divs
    const inputs = [];      // 81 input elements
    const notesEls = [];    // 81 arrays of 9 note-digit spans
    const cellNotes = [];   // 81 Sets of active note digits (1-9)

    for (let i = 0; i < 81; i++) cellNotes.push(new Set());

    // ── State ──────────────────────────────────────────────────────────
    let mode = 'solver'; // switchMode('play') called at init
    let solved = false;
    let solverExampleIdx = 0;

    // Play mode
    let currentDifficulty = 'easy';
    let currentPuzzle = null;
    let currentSolution = null;
    let gameActive = false;
    let gameWon = false;
    let timerInterval = null;
    let timerSeconds = 0;
    // Timer state is kept as wall-clock anchors rather than a tick count:
    // timerBaseSeconds is everything accumulated before the current running
    // segment, timerSegmentStart is when that segment began (0 = not running).
    let timerBaseSeconds = 0;
    let timerSegmentStart = 0;
    let hintsUsed = 0;
    let notesMode = false;
    // Auto-notes fills every empty cell with the digits its row, column and box
    // still allow, and keeps them current as the board changes. It reveals no
    // answers — it is derived purely from what is on the board, never from
    // currentSolution — but it does remove the scanning work, so a game that
    // used it is recorded as such alongside hints.
    let autoNotes = false;
    let autoNotesUsed = false;
    let focusedIdx = -1;
    let lastTouchedIdx = -1; // Persists through blur — used by numpad on mobile

    // Undo/redo
    const undoStack = [];
    const redoStack = [];

    // Save debounce
    let saveTimeout = null;
    let timerPaused = false;

    // Level actually being played. Captured when the game starts because
    // #level-input stays editable afterwards — reading it at submit time
    // attributed scores to whatever number happened to be in the box.
    let currentLevel = null;
    // The day whose puzzle is being played, or null for a normal game.
    let currentDaily = null;
    // Set during init when the URL names a puzzle; suppresses the resume offer.
    let sharedPuzzleLoaded = false;
    // Whether the setup panel is showing. It folds away during a game so the
    // board can use the height, and the toggle brings it back.
    let setupOpen = true;

    /**
     * While paused the timer is frozen and the grid is blurred, so accepting
     * input would let a player solve at leisure and submit a near-zero time.
     */
    function isPlayBlocked() {
        return mode === 'play' && timerPaused;
    }

    /**
     * Touch-ONLY device: no mouse, coarse pointer.
     *
     * This must agree with the `(hover: none) and (pointer: coarse)` media
     * query in style.css that reveals the numpad, and for a long time it did
     * not. The old test was `('ontouchstart' in window) ||
     * navigator.maxTouchPoints > 0`, which is equally true of a laptop with a
     * touchscreen — and there the two disagreed in the worst possible
     * direction. JS took the touch branch (inputs readOnly, inputMode none,
     * click never focuses a cell) while CSS, seeing a mouse, kept the numpad
     * hidden. That leaves no way to enter a digit at all: the keyboard is
     * refused and the on-screen replacement is invisible.
     *
     * Capability ("can this device receive a touch?") is the wrong question.
     * The right one is "is touch the only thing this person has?", which is
     * what the media query asks. The old check survives only as a fallback for
     * environments without matchMedia — which is how jsdom drives either
     * branch in tests.
     */
    const TOUCH_ONLY_QUERY = '(hover: none) and (pointer: coarse)';
    const isTouchDevice = window.matchMedia
        ? window.matchMedia(TOUCH_ONLY_QUERY).matches
        : ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // Numpad elements
    const numpadEl = document.getElementById('numpad');

    let solverExamples = null;

    // ══════════════════════════════════════════════════════════════════
    //  GRID BUILDING
    // ══════════════════════════════════════════════════════════════════

    function buildGrid() {
        for (let i = 0; i < 81; i++) {
            const row = Math.floor(i / 9);
            const col = i % 9;

            // Wrapper div
            const wrapper = document.createElement('div');
            wrapper.className = 'cell-wrapper';
            wrapper.dataset.row = row;
            wrapper.dataset.col = col;
            wrapper.dataset.idx = i;

            // Input
            const input = document.createElement('input');
            input.type = 'text';
            input.maxLength = 1;
            input.className = 'cell-input';
            input.setAttribute('aria-label', `Row ${row + 1}, Column ${col + 1}`);

            // On touch devices, suppress virtual keyboard — use on-screen numpad
            if (isTouchDevice) {
                input.readOnly = true;
                input.inputMode = 'none';
            } else {
                input.inputMode = 'numeric';
            }

            // Notes grid (3x3 mini-grid for pencil marks)
            const notesGrid = document.createElement('div');
            notesGrid.className = 'notes-grid';
            const noteSpans = [];
            for (let d = 1; d <= 9; d++) {
                const span = document.createElement('span');
                span.className = 'note-digit';
                span.textContent = d;
                span.dataset.digit = d;
                notesGrid.appendChild(span);
                noteSpans.push(span);
            }

            wrapper.appendChild(notesGrid);
            wrapper.appendChild(input);
            gridEl.appendChild(wrapper);

            wrappers.push(wrapper);
            inputs.push(input);
            notesEls.push(noteSpans);

            // Events
            input.addEventListener('input', (e) => onCellInput(e, i));
            input.addEventListener('keydown', (e) => onCellKeydown(e, i));
            input.addEventListener('focus', () => onCellFocus(i));
            input.addEventListener('blur', () => onCellBlur(i));
            // On desktop, clicking wrapper focuses the input.
            // On touch, we handle selection separately — never call focus()
            // to avoid iOS Safari scrolling the page.
            if (!isTouchDevice) {
                wrapper.addEventListener('click', () => inputs[i].focus());
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  CELL INPUT HANDLING
    // ══════════════════════════════════════════════════════════════════

    function onCellInput(e, idx) {
        const input = inputs[idx];
        const val = input.value;

        if (isPlayBlocked()) {
            input.value = currentPuzzle && currentPuzzle[idx] !== '0' ? currentPuzzle[idx] : '';
            return;
        }

        if (!/^[1-9]$/.test(val)) {
            input.value = '';
            return;
        }

        // Locked cells
        if (mode === 'play' && wrappers[idx].classList.contains('locked')) {
            input.value = currentPuzzle ? (currentPuzzle[idx] !== '0' ? currentPuzzle[idx] : '') : '';
            return;
        }

        if (mode === 'solver') {
            if (solved) clearSolution();
            wrappers[idx].classList.remove('error');
            setStatus('');
        } else if (mode === 'play' && gameActive) {
            // Notes mode: toggle note instead of placing digit
            if (notesMode) {
                input.value = '';
                toggleNote(idx, val);
                return;
            }

            // Record for undo
            const prevValue = '';  // input just changed, prev was empty or we handle in keydown
            pushUndo(idx, prevValue, val, new Set(cellNotes[idx]), new Set());

            // Clear notes on this cell
            clearCellNotes(idx);

            // Clear error styling
            wrappers[idx].classList.remove('user-error', 'correct-check');

            // Auto-clear conflicting notes in peers
            clearPeerNotes(idx, val);

            // Check conflicts
            highlightConflicts(idx);

            refreshAutoNotes();
            clearHintNudge();

            // Check for win
            checkWin();

            // Auto-save
            debounceSave();
        }

        // Digit highlighting + numpad completion
        updateDigitHighlight();
        updateNumpadCompletion();

        // Auto-advance
        advanceToNextEmpty(idx);
    }

    function onCellKeydown(e, idx) {
        const row = Math.floor(idx / 9);
        const col = idx % 9;
        const isLocked = mode === 'play' && wrappers[idx].classList.contains('locked');

        // Arrow keys still navigate while paused; nothing may change the board.
        if (isPlayBlocked() && !e.key.startsWith('Arrow') && e.key !== 'Tab') {
            e.preventDefault();
            return;
        }

        // Prevent editing locked cells
        if (isLocked && (/^[0-9]$/.test(e.key) || e.key === 'Backspace' || e.key === 'Delete')) {
            e.preventDefault();
            return;
        }

        switch (e.key) {
            case 'ArrowUp': e.preventDefault(); if (row > 0) inputs[idx - 9].focus(); break;
            case 'ArrowDown': e.preventDefault(); if (row < 8) inputs[idx + 9].focus(); break;
            case 'ArrowLeft': e.preventDefault(); if (col > 0) inputs[idx - 1].focus(); break;
            case 'ArrowRight': e.preventDefault(); if (col < 8) inputs[idx + 1].focus(); break;
            case 'Tab': break;

            case 'Backspace':
            case 'Delete':
                e.preventDefault();
                if (mode === 'play' && gameActive) {
                    // While auto-notes is on the marks are computed, not the
                    // player's, so Delete only ever clears the value; clearing
                    // them would just have them reappear on the next recompute.
                    if (cellNotes[idx].size > 0 && !autoNotes) {
                        pushUndo(idx, inputs[idx].value, '', new Set(cellNotes[idx]), new Set());
                        clearCellNotes(idx);
                    } else if (inputs[idx].value) {
                        pushUndo(idx, inputs[idx].value, '', new Set(cellNotes[idx]), new Set());
                        inputs[idx].value = '';
                        clearConflictStyle(idx);
                        // Erasing frees the digit for its peers again.
                        refreshAutoNotes();
                    }
                    debounceSave();
                } else if (mode === 'solver') {
                    inputs[idx].value = '';
                    wrappers[idx].classList.remove('given', 'solved', 'error', 'solve-anim');
                    if (solved) clearSolution();
                }
                updateDigitHighlight();
                break;

            case '0':
                e.preventDefault();
                if (mode === 'play' && gameActive && !isLocked) {
                    if (inputs[idx].value) {
                        pushUndo(idx, inputs[idx].value, '', new Set(cellNotes[idx]), new Set());
                        inputs[idx].value = '';
                        clearConflictStyle(idx);
                    }
                    debounceSave();
                } else if (mode === 'solver') {
                    inputs[idx].value = '';
                    wrappers[idx].classList.remove('given', 'solved', 'error');
                    if (solved) clearSolution();
                }
                updateDigitHighlight();
                break;

            case '1': case '2': case '3': case '4': case '5':
            case '6': case '7': case '8': case '9':
                if (mode === 'play' && gameActive && notesMode && !isLocked) {
                    e.preventDefault();
                    toggleNote(idx, e.key);
                } else if (mode === 'play' && gameActive && !isLocked) {
                    // Record undo before the input event changes the value
                    const prevVal = inputs[idx].value;
                    const prevNotes = new Set(cellNotes[idx]);
                    // We'll let the input event handle the actual placement
                    // Set up a one-time listener to record undo after value changes
                    inputs[idx].dataset.prevVal = prevVal;
                    inputs[idx].dataset.prevNotes = JSON.stringify([...prevNotes]);
                }
                break;

            case 'Enter':
                e.preventDefault();
                if (mode === 'solver') solve();
                else checkErrors();
                break;

            case 'Escape':
                e.preventDefault();
                if (mode === 'solver') clearGrid();
                else resetGame();
                break;

            case 'n': case 'N':
                if (mode === 'play' && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    toggleNotesMode();
                }
                break;

            case 'a': case 'A':
                if (mode === 'play' && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    setAutoNotes(!autoNotes);
                }
                break;

            case 'h': case 'H':
                if (mode === 'play' && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    giveHint();
                }
                break;

            case 'z':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (e.shiftKey) doRedo();
                    else doUndo();
                }
                break;

            case 'y':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    doRedo();
                }
                break;
        }
    }

    function onCellFocus(idx) {
        focusedIdx = idx;
        lastTouchedIdx = idx;
        // Remove previous focus
        for (const w of wrappers) w.classList.remove('focused');
        wrappers[idx].classList.add('focused');

        clearHighlights();
        clearDigitHighlight();
        highlightRelated(idx);
        updateDigitHighlight();
    }

    function onCellBlur(idx) {
        // On touch devices, blur is irrelevant — selection is visual only
        if (isTouchDevice) return;
        wrappers[idx].classList.remove('focused');
        clearHighlights();
        clearDigitHighlight();
        focusedIdx = -1;
    }

    // Touch-only: visually select a cell without calling input.focus()
    function selectCellTouch(idx) {
        lastTouchedIdx = idx;
        for (const w of wrappers) w.classList.remove('focused');
        wrappers[idx].classList.add('focused');
        clearHighlights();
        clearDigitHighlight();
        highlightRelated(idx);
        updateDigitHighlight();
    }

    function advanceToNextEmpty(fromIdx) {
        for (let i = 1; i <= 81; i++) {
            const next = (fromIdx + i) % 81;
            if (!inputs[next].value && !wrappers[next].classList.contains('locked')) {
                if (isTouchDevice) {
                    selectCellTouch(next);
                } else {
                    // Use rAF to avoid focus race with the current input event
                    requestAnimationFrame(() => inputs[next].focus());
                }
                return;
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  PENCIL MARKS / NOTES
    // ══════════════════════════════════════════════════════════════════

    function toggleNotesMode() {
        notesMode = !notesMode;
        btnNotesToggle.textContent = `Notes: ${notesMode ? 'ON' : 'OFF'}`;
        btnNotesToggle.classList.toggle('notes-active', notesMode);
        btnNotesToggle.setAttribute('aria-pressed', String(notesMode));
        if (numpadEl) {
            const notesBtn = numpadEl.querySelector('#numpad-notes');
            if (notesBtn) notesBtn.setAttribute('aria-pressed', String(notesMode));
        }
    }

    function toggleNote(idx, digit) {
        if (autoNotes) {
            setStatus('Turn auto-notes off to edit notes by hand');
            return;
        }
        const prevNotes = new Set(cellNotes[idx]);
        if (inputs[idx].value) return; // don't add notes to filled cells

        if (cellNotes[idx].has(digit)) {
            cellNotes[idx].delete(digit);
        } else {
            cellNotes[idx].add(digit);
        }

        pushUndo(idx, '', '', prevNotes, new Set(cellNotes[idx]));
        renderNotes(idx);
        debounceSave();
    }

    /** Recompute every empty cell's notes. No-op unless auto-notes is on. */
    function refreshAutoNotes() {
        if (!autoNotes || mode !== 'play') return;

        const board = readGrid();
        for (let i = 0; i < 81; i++) {
            if (board[i] !== '0') {
                if (cellNotes[i].size) {
                    cellNotes[i].clear();
                    renderNotes(i);
                }
                continue;
            }
            cellNotes[i] = candidatesFor(board, i);
            renderNotes(i);
        }
    }

    function setAutoNotes(on) {
        autoNotes = on;
        if (on) {
            autoNotesUsed = true;
            // Manual notes would be overwritten on the next recompute, so the
            // two modes are mutually exclusive.
            if (notesMode) toggleNotesMode();
            refreshAutoNotes();
            setStatus('Auto-notes on — candidates update as you play');
        } else {
            setStatus('Auto-notes off — notes are yours to edit again');
        }

        if (btnAutoNotes) {
            btnAutoNotes.textContent = `Auto: ${on ? 'ON' : 'OFF'}`;
            btnAutoNotes.classList.toggle('notes-active', on);
            btnAutoNotes.setAttribute('aria-pressed', String(on));
        }
        debounceSave();
    }

    function renderNotes(idx) {
        for (let d = 0; d < 9; d++) {
            const digit = String(d + 1);
            notesEls[idx][d].classList.toggle('visible', cellNotes[idx].has(digit));
        }
    }

    function clearCellNotes(idx) {
        cellNotes[idx].clear();
        renderNotes(idx);
    }

    function clearPeerNotes(idx, digit) {
        const row = Math.floor(idx / 9);
        const col = idx % 9;
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;

        for (let i = 0; i < 81; i++) {
            if (i === idx) continue;
            const r = Math.floor(i / 9);
            const c = i % 9;
            const isPeer = (r === row) || (c === col) ||
                (r >= boxRow && r < boxRow + 3 && c >= boxCol && c < boxCol + 3);
            if (isPeer && cellNotes[i].has(digit)) {
                cellNotes[i].delete(digit);
                renderNotes(i);
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  HIGHLIGHTING
    // ══════════════════════════════════════════════════════════════════

    function highlightRelated(idx) {
        const row = Math.floor(idx / 9);
        const col = idx % 9;
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;

        for (let i = 0; i < 81; i++) {
            const r = Math.floor(i / 9);
            const c = i % 9;
            const isPeer = (r === row) || (c === col) ||
                (r >= boxRow && r < boxRow + 3 && c >= boxCol && c < boxCol + 3);
            if (isPeer && i !== idx) {
                wrappers[i].classList.add('peer-highlight');
            }
        }
    }

    function clearHighlights() {
        for (const w of wrappers) w.classList.remove('peer-highlight');
    }

    function updateDigitHighlight() {
        clearDigitHighlight();
        // Use lastTouchedIdx as fallback for touch devices where focusedIdx is -1
        const idx = focusedIdx >= 0 ? focusedIdx : lastTouchedIdx;
        if (idx < 0) return;
        const digit = inputs[idx].value;
        if (!digit) return;

        for (let i = 0; i < 81; i++) {
            if (i !== idx && inputs[i].value === digit) {
                wrappers[i].classList.add('digit-highlight');
            }
        }
    }

    function clearDigitHighlight() {
        for (const w of wrappers) w.classList.remove('digit-highlight');
    }

    // ── Numpad Completion Tracking ─────────────────────────────────────
    function updateNumpadCompletion() {
        if (!numpadEl) return;
        const counts = {};
        for (let d = 1; d <= 9; d++) counts[d] = 0;
        for (let i = 0; i < 81; i++) {
            const v = inputs[i].value;
            if (v && counts[v] !== undefined) counts[v]++;
        }
        numpadEl.querySelectorAll('.numpad-btn[data-digit]').forEach(btn => {
            const d = btn.dataset.digit;
            if (d === '0') return; // skip erase
            btn.classList.toggle('completed', counts[d] >= 9);
        });
    }

    // ══════════════════════════════════════════════════════════════════
    //  CONFLICT DETECTION
    // ══════════════════════════════════════════════════════════════════

    function highlightConflicts(idx) {
        const digit = inputs[idx].value;
        if (!digit) return;

        clearConflictStyle(idx);

        const row = Math.floor(idx / 9);
        const col = idx % 9;
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        let hasConflict = false;

        for (let i = 0; i < 81; i++) {
            if (i === idx) continue;
            const r = Math.floor(i / 9);
            const c = i % 9;
            const isPeer = (r === row) || (c === col) ||
                (r >= boxRow && r < boxRow + 3 && c >= boxCol && c < boxCol + 3);
            if (isPeer && inputs[i].value === digit) {
                wrappers[i].classList.add('conflict', 'conflict-flash');
                hasConflict = true;
            }
        }

        if (hasConflict) {
            wrappers[idx].classList.add('conflict', 'conflict-flash');
        }
    }

    function clearConflictStyle(idx) {
        wrappers[idx].classList.remove('conflict', 'conflict-flash');
        // Also clear conflict on peers that might have been marked
        for (const w of wrappers) {
            w.classList.remove('conflict', 'conflict-flash');
        }
        // Re-check all conflicts for current board state
        recheckAllConflicts();
    }

    function recheckAllConflicts() {
        for (const w of wrappers) w.classList.remove('conflict');
        for (let i = 0; i < 81; i++) {
            const digit = inputs[i].value;
            if (!digit) continue;
            const row = Math.floor(i / 9);
            const col = i % 9;
            const boxRow = Math.floor(row / 3) * 3;
            const boxCol = Math.floor(col / 3) * 3;

            for (let j = i + 1; j < 81; j++) {
                if (inputs[j].value !== digit) continue;
                const r = Math.floor(j / 9);
                const c = j % 9;
                const isPeer = (r === row) || (c === col) ||
                    (r >= boxRow && r < boxRow + 3 && c >= boxCol && c < boxCol + 3);
                if (isPeer) {
                    wrappers[i].classList.add('conflict');
                    wrappers[j].classList.add('conflict');
                }
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  UNDO / REDO
    // ══════════════════════════════════════════════════════════════════

    function pushUndo(idx, prevVal, newVal, prevNotes, newNotes) {
        undoStack.push({ idx, prevVal, newVal, prevNotes, newNotes });
        redoStack.length = 0; // clear redo on new action
        if (undoStack.length > 200) undoStack.shift();
    }

    function doUndo() {
        if (isPlayBlocked()) return;
        if (undoStack.length === 0 || !gameActive) return;
        const action = undoStack.pop();
        redoStack.push(action);

        inputs[action.idx].value = action.prevVal;
        cellNotes[action.idx] = new Set(action.prevNotes);
        renderNotes(action.idx);
        wrappers[action.idx].classList.remove('user-error', 'correct-check');
        recheckAllConflicts();
        updateNumpadCompletion();
        refreshAutoNotes();
        clearHintNudge();

        // Move selection to the undone cell
        if (isTouchDevice) {
            selectCellTouch(action.idx);
        } else {
            inputs[action.idx].focus();
        }
        updateDigitHighlight();
        debounceSave();
    }

    function doRedo() {
        if (isPlayBlocked()) return;
        if (redoStack.length === 0 || !gameActive) return;
        const action = redoStack.pop();
        undoStack.push(action);

        inputs[action.idx].value = action.newVal;
        cellNotes[action.idx] = new Set(action.newNotes);
        renderNotes(action.idx);
        wrappers[action.idx].classList.remove('user-error', 'correct-check');
        recheckAllConflicts();
        updateNumpadCompletion();
        refreshAutoNotes();
        clearHintNudge();

        // Move selection to the redone cell
        if (isTouchDevice) {
            selectCellTouch(action.idx);
        } else {
            inputs[action.idx].focus();
        }
        updateDigitHighlight();
        debounceSave();
    }

    // ══════════════════════════════════════════════════════════════════
    //  READ / WRITE GRID
    // ══════════════════════════════════════════════════════════════════

    function readGrid() {
        return inputs.map(c => c.value || '0').join('');
    }

    function writeGrid(str, markAsGiven = false) {
        for (let i = 0; i < 81; i++) {
            const ch = str[i];
            inputs[i].value = (ch === '0' || ch === '.') ? '' : ch;
            wrappers[i].classList.remove('given', 'solved', 'error', 'solve-anim', 'hint',
                'hint-anim', 'locked', 'user-error', 'correct-check', 'win-anim',
                'conflict', 'conflict-flash', 'digit-highlight', 'focused');
            // Cells stay readOnly on touch devices whatever else changes: that
            // is the only thing stopping iOS opening a keyboard over the board.
            inputs[i].readOnly = isTouchDevice;
            clearCellNotes(i);

            if (markAsGiven && inputs[i].value) {
                wrappers[i].classList.add('given');
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  SOLVER MODE
    // ══════════════════════════════════════════════════════════════════

    function solve() {
        const board = readGrid();
        const filledCount = board.replace(/0/g, '').length;

        if (filledCount < 1) {
            setStatus('Enter some digits first', 'error');
            gridEl.classList.add('shake');
            setTimeout(() => gridEl.classList.remove('shake'), 300);
            return;
        }

        const { solution, timeMs } = SudokuSolver.solveSudoku(board);

        if (!solution) {
            setStatus('No solution exists — check your input', 'error');
            gridEl.classList.add('shake');
            setTimeout(() => gridEl.classList.remove('shake'), 300);
            return;
        }

        for (let i = 0; i < 81; i++) {
            if (board[i] !== '0') {
                wrappers[i].classList.add('given');
            } else {
                inputs[i].value = solution[i];
                wrappers[i].classList.add('solved', 'solve-anim');
                wrappers[i].style.animationDelay = `${(i % 9) * 15 + Math.floor(i / 9) * 15}ms`;
            }
        }

        solved = true;
        const formattedTime = timeMs < 1 ? `${(timeMs * 1000).toFixed(0)} μs` : `${timeMs.toFixed(2)} ms`;
        solveTimeEl.textContent = formattedTime;
        solveTimeEl.classList.add('visible');
        setStatus('Solved!', 'success');
    }

    function clearSolution() {
        solved = false;
        solveTimeEl.textContent = '';
        solveTimeEl.classList.remove('visible');
        for (let i = 0; i < 81; i++) {
            if (wrappers[i].classList.contains('solved')) {
                inputs[i].value = '';
                wrappers[i].classList.remove('solved', 'solve-anim');
                wrappers[i].style.animationDelay = '';
            }
        }
    }

    function clearGrid() {
        for (let i = 0; i < 81; i++) {
            inputs[i].value = '';
            wrappers[i].classList.remove('given', 'solved', 'error', 'solve-anim', 'hint',
                'hint-anim', 'locked', 'user-error', 'correct-check', 'win-anim',
                'conflict', 'conflict-flash', 'digit-highlight', 'focused');
            wrappers[i].style.animationDelay = '';
            inputs[i].readOnly = isTouchDevice; // never editable directly on touch
            clearCellNotes(i);
        }
        solved = false;
        solveTimeEl.textContent = '';
        solveTimeEl.classList.remove('visible');
        setStatus('Click a cell and type a digit');
        inputs[0].focus();
    }

    async function loadSolverExample() {
        if (!solverExamples) {
            setStatus('Loading puzzles...');
            try {
                const { ALL_PUZZLES } = await loadBank();
                solverExamples = ALL_PUZZLES.slice();
            } catch (e) {
                setStatus('Could not load puzzles', 'error');
                return;
            }
        }

        const p = solverExamples[solverExampleIdx];
        const diff = DIFFICULTY_LABELS[p.difficulty] || p.difficulty;
        writeGrid(p.puzzle, true);
        solved = false;
        solveTimeEl.textContent = '';
        solveTimeEl.classList.remove('visible');
        setStatus(`Loaded: ${diff} (${p.id})`);
        solverExampleIdx = (solverExampleIdx + 1) % solverExamples.length;
    }

    /**
     * Probe the leaderboard and show its UI only if something answered. The
     * backend is optional, so absence is a normal state, not an error.
     */
    async function revealLeaderboardUi() {
        const available = await leaderboard.checkHealth();
        if (btnLeaderboard) btnLeaderboard.style.display = available ? 'inline-flex' : 'none';
        if (winSubmit) winSubmit.style.display = available ? 'flex' : 'none';
    }

    // ── Dialogs ────────────────────────────────────────────────────────
    // Overlays are siblings of these regions, never descendants, so nothing
    // focused ends up inside an aria-hidden subtree.
    const dialogs = createDialogs([
        document.querySelector('.header'),
        document.querySelector('.mode-toggle'),
        document.getElementById('app'),
        document.querySelector('.shortcuts'),
    ].filter(Boolean));

    // ── Import Modal ───────────────────────────────────────────────────
    function openModal() {
        if (importError) importError.textContent = '';
        importText.value = '';
        dialogs.open(modalOverlay, { initialFocus: importText });
    }

    function closeModal() { dialogs.close(modalOverlay); }

    function doImport() {
        const raw = importText.value.trim();
        const digits = raw.replace(/[^0-9.]/g, '');
        if (digits.length !== 81) {
            importText.style.borderColor = 'var(--danger)';
            setTimeout(() => importText.style.borderColor = '', 1500);
            // Say what is wrong. The border flash alone conveyed nothing to a
            // screen reader, and nothing at all to anyone who missed it.
            if (importError) {
                importError.textContent = digits.length === 0
                    ? 'Enter a puzzle: 81 digits, using 0 or . for empty cells.'
                    : `Need 81 digits, found ${digits.length}.`;
            }
            return;
        }
        if (importError) importError.textContent = '';
        writeGrid(digits.replace(/\./g, '0'), true);
        solved = false;
        solveTimeEl.textContent = '';
        solveTimeEl.classList.remove('visible');
        setStatus('Puzzle imported');
        closeModal();
    }

    // ── Quick Paste ────────────────────────────────────────────────────
    document.addEventListener('paste', (e) => {
        if (e.target === importText) return;
        if (mode === 'play') return;
        const text = (e.clipboardData || window.clipboardData).getData('text').trim();
        const digits = text.replace(/[^0-9.]/g, '');
        if (digits.length === 81) {
            e.preventDefault();
            writeGrid(digits.replace(/\./g, '0'), true);
            solved = false;
            solveTimeEl.textContent = '';
            solveTimeEl.classList.remove('visible');
            setStatus('Puzzle pasted from clipboard');
        }
    });

    // ══════════════════════════════════════════════════════════════════
    //  PLAY MODE
    // ══════════════════════════════════════════════════════════════════

    function startGame(difficulty, { daily = null } = {}) {
        currentDaily = daily;
        currentDifficulty = difficulty || currentDifficulty;
        hintsUsed = 0;
        autoNotesUsed = autoNotes; // carrying the mode over counts as using it
        gameWon = false;
        undoStack.length = 0;
        redoStack.length = 0;
        notesMode = false;
        btnNotesToggle.textContent = 'Notes: OFF';
        btnNotesToggle.classList.remove('notes-active');

        clearHintNudge();
        setStatus('Loading puzzle...');

        // Awaiting the bank also yields to the event loop, so the status above
        // paints before the solver runs.
        loadBank().then(({ PUZZLES }) => {
            let puzzle, solution;

            // ── PRIMARY: pick from pre-generated bank ────────────────────
            const bankList = PUZZLES[currentDifficulty];
            if (bankList && bankList.length > 0) {
                // Track played puzzles to avoid repeats
                let played = store.getPlayed(currentDifficulty);

                // If all puzzles played, reset the tracking
                if (played.length >= bankList.length) {
                    played = [];
                    store.clearPlayed(currentDifficulty);
                }

                // Check for user-specified level
                const reqLevel = levelInput ? parseInt(levelInput.value, 10) : NaN;
                let pick;

                // Load specified level if valid
                if (!isNaN(reqLevel) && reqLevel >= 1 && reqLevel <= bankList.length) {
                    pick = bankList[reqLevel - 1];
                } else {
                    // Pick a random unplayed puzzle
                    const unplayed = bankList.filter(p => !played.includes(p.id));
                    pick = unplayed[Math.floor(Math.random() * unplayed.length)];

                    store.markPlayed(currentDifficulty, pick.id);
                }

                puzzle = pick.puzzle;

                // Update level input to show the randomly chosen level
                const actualIndex = bankList.findIndex(p => p.id === pick.id);
                currentLevel = actualIndex !== -1 ? actualIndex + 1 : null;
                if (levelInput && currentLevel !== null) {
                    levelInput.value = currentLevel;
                }

                // Solve to get solution
                const solveResult = SudokuSolver.solveSudoku(puzzle);
                solution = solveResult.solution;
            }

            // ── FALLBACK: generator (Easy–Evil only, never Nightmare) ────
            // A generated puzzle has no bank level, so scores carry none.
            if (!puzzle && currentDifficulty !== 'nightmare') {
                currentLevel = null;
                try {
                    const result = SudokuGenerator.generate(currentDifficulty);
                    if (result && result.puzzle && result.solution) {
                        puzzle = result.puzzle;
                        solution = result.solution;
                    }
                } catch (e) { /* generator failed */ }
            }

            if (!solution) {
                setStatus('Error loading puzzle', 'error');
                return;
            }

            currentPuzzle = puzzle;
            currentSolution = solution;

            writeGrid(currentPuzzle, true);

            for (let i = 0; i < 81; i++) {
                if (currentPuzzle[i] !== '0') {
                    wrappers[i].classList.add('locked');
                    inputs[i].readOnly = true;
                }
            }

            gameActive = true;
            startTimer();

            const label = DIFFICULTY_LABELS[currentDifficulty];
            const clueCount = currentPuzzle.replace(/0/g, '').length;
            // Set here rather than by the caller: the bank loads asynchronously,
            // so anything set before this point is overwritten.
            setStatus(currentDaily
                ? `Daily puzzle — ${formatDay(currentDaily)} · ${label}`
                : `${label} — ${clueCount} clues`);

            // Select first empty cell
            for (let i = 0; i < 81; i++) {
                if (!inputs[i].value) {
                    if (isTouchDevice) {
                        selectCellTouch(i);
                    } else {
                        inputs[i].focus();
                    }
                    break;
                }
            }

            store.recordStart(currentDifficulty);
            setupOpen = false;
            refreshLayout();
            refreshAutoNotes();
            store.deleteSavedGame();
            debounceSave();
            updateNumpadCompletion();
        }).catch(() => {
            setStatus('Could not load puzzles', 'error');
        });
    }

    /**
     * Start today's puzzle. The board is derived from the date, so every player
     * gets the same one and the per-level leaderboard compares like with like.
     */
    function startDaily(day) {
        const today = day || store.dayKey();
        const { difficulty, level } = dailyPuzzle(today);

        selectDifficulty(difficulty);
        if (levelInput) levelInput.value = String(level);
        startGame(difficulty, { daily: today });
    }

    /** Tick the Daily button once today's puzzle has been solved. */
    function updateDailyButton() {
        if (!btnDaily) return;
        const done = store.isDailyDone(store.dayKey());
        btnDaily.classList.toggle('done', done);
        btnDaily.title = done
            ? "Today's puzzle — already solved, play it again"
            : "Today's puzzle — everyone gets the same one";
    }

    /**
     * Copy a link to whatever is on screen. Prefers a bank link, which is short
     * and carries the level the leaderboard compares; falls back to encoding
     * the board itself for a hand-entered puzzle.
     */
    async function shareCurrentPuzzle() {
        const board = readGrid();
        let link;

        if (mode === 'play' && currentLevel) {
            link = bankLink(window.location.href, currentDifficulty, currentLevel);
        } else if (board !== '0'.repeat(81)) {
            link = puzzleLink(window.location.href, board);
        } else {
            setStatus('Nothing to share yet', 'error');
            return;
        }

        if (await copyToClipboard(link)) {
            setStatus('Link copied to clipboard', 'success');
            return;
        }

        // No clipboard on file:// or an insecure origin, so show the link.
        if (shareText && shareOverlay) {
            shareText.value = link;
            dialogs.open(shareOverlay, { initialFocus: shareText });
            shareText.select();
        }
    }

    /**
     * Act on a puzzle named in the URL. Applied after the initial switchMode so
     * a raw-board link can land in solver mode without being switched back.
     */
    function applySharedPuzzle(shared) {
        if (!shared) return;

        if (shared.kind === 'daily') {
            startDaily(shared.dayKey);
            return;
        }
        if (shared.kind === 'bank') {
            selectDifficulty(shared.difficulty);
            if (levelInput) levelInput.value = shared.level ? String(shared.level) : '';
            startGame(shared.difficulty);
            return;
        }
        // A raw board goes to the solver, which is what it is for.
        switchMode('solver');
        writeGrid(shared.puzzle, true);
        setStatus('Puzzle loaded from link');
    }

    function resetGame() {
        if (!currentPuzzle) return;
        gameWon = false;
        hintsUsed = 0;
        undoStack.length = 0;
        redoStack.length = 0;

        for (let i = 0; i < 81; i++) {
            wrappers[i].classList.remove('user-error', 'correct-check', 'hint', 'hint-anim',
                'win-anim', 'solved', 'conflict', 'conflict-flash');
            if (currentPuzzle[i] === '0') {
                inputs[i].value = '';
                wrappers[i].classList.remove('given', 'locked');
                inputs[i].readOnly = isTouchDevice; // keep readOnly on touch
                clearCellNotes(i);
            }
        }

        startTimer();
        clearHintNudge();
        setStatus('Puzzle reset');
        refreshAutoNotes();
        debounceSave();
        updateNumpadCompletion();
    }

    // ── Hints ──────────────────────────────────────────────────────────

    /**
     * The most useful cell to reveal: one the player could actually have worked
     * out from what is on the board right now.
     *
     * Preference order is naked single (one candidate left), then hidden single
     * (a digit with only one home in some unit), then whichever cell has fewest
     * candidates. Every deduction is checked against the solution before it is
     * used — a wrong entry elsewhere makes candidate arithmetic unsound, and a
     * hint must never be wrong.
     *
     * @returns {{idx: number, reason: string}|null}
     */
    /**
     * The most useful cell to reveal: one the player could actually work out
     * from the board right now, with the reasoning to show for it.
     *
     * Delegates to techniques.js, then checks the answer against the solution.
     * Candidate arithmetic is meaningless once a wrong digit is on the board,
     * and a hint that is wrong is worse than no hint at all.
     */
    function findHintCell(board) {
        const trustworthy = (idx, digit) => digit === currentSolution[idx];

        const step = nextStep(board);
        if (step && trustworthy(step.idx, step.digit)) return step;

        // Nothing the technique engine knows can crack this position, so fall
        // back to the most constrained cell. Duller, but always available.
        const grid = candidateGrid(board);
        let best = null;
        for (let idx = 0; idx < 81; idx++) {
            if (!grid[idx] || !trustworthy(idx, currentSolution[idx])) continue;
            if (!best || grid[idx].size < best.size) best = { idx, size: grid[idx].size, set: grid[idx] };
        }
        if (!best) return null;

        return {
            idx: best.idx,
            digit: currentSolution[best.idx],
            reason: `narrowed to ${best.size} candidates`,
            nudge: `${cellName(best.idx)} is down to ${[...best.set].sort().join(', ')} — `
                + 'the most constrained cell on the board.',
            evidence: peersOf(best.idx).filter((i) => board[i] !== '0'),
        };
    }

    /**
     * A hint asked for but not yet revealed. The first press explains and
     * highlights; the second fills it in. Cleared by any board change, since
     * the deduction may no longer hold.
     */
    let pendingHint = null;

    function clearHintNudge() {
        if (!pendingHint) return;
        for (const i of pendingHint.evidence) wrappers[i].classList.remove('hint-evidence');
        wrappers[pendingHint.idx].classList.remove('hint-target');
        gridEl.classList.remove('hint-explaining');
        pendingHint = null;
        if (btnHint) btnHint.textContent = 'Hint';
    }

    /** Show the reasoning without filling anything in. Costs nothing. */
    function showHintNudge(candidate) {
        clearHintNudge();
        pendingHint = candidate;

        gridEl.classList.add('hint-explaining');
        wrappers[candidate.idx].classList.add('hint-target');
        for (const i of candidate.evidence) wrappers[i].classList.add('hint-evidence');

        if (btnHint) btnHint.textContent = 'Reveal';
        setStatus(`${candidate.nudge} Press again to reveal.`);
    }

    function giveHint() {
        if (isPlayBlocked()) return;
        if (!gameActive || !currentSolution || gameWon) return;

        const fixable = [];
        for (let i = 0; i < 81; i++) {
            if (!wrappers[i].classList.contains('locked') && inputs[i].value !== currentSolution[i]) {
                fixable.push(i);
            }
        }

        if (fixable.length === 0) {
            setStatus('No more hints needed!', 'success');
            return;
        }

        // Second press on a standing nudge reveals it.
        if (pendingHint && fixable.includes(pendingHint.idx)) {
            const { idx, reason } = pendingHint;
            clearHintNudge();
            revealHint(idx, reason);
            return;
        }
        clearHintNudge();

        // lastTouchedIdx is the touch fallback — selection there is visual and
        // survives blur. On desktop a blurred cell means nothing is selected,
        // so honouring it would make the hint ignore its own deduction.
        const selected = focusedIdx >= 0
            ? focusedIdx
            : (isTouchDevice ? lastTouchedIdx : -1);

        // Pointing at a specific cell asks for the answer there, not a lesson.
        if (selected >= 0 && fixable.includes(selected)) {
            revealHint(selected, '');
            return;
        }

        const found = findHintCell(readGrid());
        if (found) {
            showHintNudge(found);
            return;
        }

        // Deduction is unreliable, which means something on the board is wrong;
        // fall back to any cell that still needs fixing.
        revealHint(fixable[Math.floor(Math.random() * fixable.length)], '');
    }

    /** Fill in a hinted cell. This is the step that counts against you. */
    function revealHint(hintIdx, reason) {
        const prevVal = inputs[hintIdx].value;
        const prevNotes = new Set(cellNotes[hintIdx]);

        inputs[hintIdx].value = currentSolution[hintIdx];
        clearCellNotes(hintIdx);
        clearPeerNotes(hintIdx, currentSolution[hintIdx]);
        wrappers[hintIdx].classList.remove('user-error', 'correct-check', 'conflict');
        wrappers[hintIdx].classList.add('hint', 'hint-anim', 'locked');
        inputs[hintIdx].readOnly = true;
        hintsUsed++;

        pushUndo(hintIdx, prevVal, currentSolution[hintIdx], prevNotes, new Set());

        const because = reason ? ` — ${reason}` : '';
        setStatus(`Hint: ${cellName(hintIdx)}${because} (${hintsUsed} used)`);

        recheckAllConflicts();
        refreshAutoNotes();
        checkWin();
        debounceSave();
    }

    // ── Error Checking ─────────────────────────────────────────────────
    function checkErrors() {
        if (isPlayBlocked()) return;
        if (!gameActive || !currentSolution || gameWon) return;

        let errorCount = 0;
        let filledCount = 0;

        for (let i = 0; i < 81; i++) {
            if (wrappers[i].classList.contains('locked')) continue;
            wrappers[i].classList.remove('user-error', 'correct-check');

            if (inputs[i].value) {
                filledCount++;
                if (inputs[i].value !== currentSolution[i]) {
                    wrappers[i].classList.add('user-error');
                    errorCount++;
                } else {
                    wrappers[i].classList.add('correct-check');
                }
            }
        }

        if (errorCount > 0) {
            setStatus(`${errorCount} error${errorCount > 1 ? 's' : ''} found`, 'error');
            gridEl.classList.add('shake');
            setTimeout(() => gridEl.classList.remove('shake'), 300);
        } else if (filledCount > 0) {
            setStatus('No errors — keep going!', 'success');
        } else {
            setStatus('Fill in some cells first');
        }
    }

    // ── Win Detection ──────────────────────────────────────────────────
    function checkWin() {
        if (!gameActive || !currentSolution || gameWon) return;

        const current = readGrid();
        if (current === currentSolution) {
            gameWon = true;
            gameActive = false;
            stopTimer();

            for (let i = 0; i < 81; i++) {
                wrappers[i].classList.add('win-anim');
                wrappers[i].style.animationDelay = `${(i % 9) * 20 + Math.floor(i / 9) * 20}ms`;
            }

            // The game is over; offering setup again is what the player wants.
            setupOpen = true;
            refreshLayout();

            const timeStr = formatTime(timerSeconds);
            const hintStr = hintsUsed > 0 ? `${hintsUsed} hint${hintsUsed > 1 ? 's' : ''} used` : 'No hints used';
            const assistStr = autoNotesUsed ? ' — auto-notes used' : '';
            winDetails.textContent = `Time: ${timeStr} — ${hintStr}${assistStr}`;

            setTimeout(() => dialogs.open(winOverlay), 600);
            setStatus('Puzzle complete!', 'success');

            // Update stats
            store.recordWin(currentDifficulty, timerSeconds, hintsUsed, autoNotesUsed);
            if (currentDaily) {
                store.markDailyDone(currentDaily);
                updateDailyButton();
            }
            store.deleteSavedGame();
        }
    }

    // ── Timer ──────────────────────────────────────────────────────────
    // Elapsed time is derived from the clock, not counted in ticks. Browsers
    // throttle timers in background tabs and mobile browsers do so aggressively,
    // so a counter incremented once per interval silently undercounts — which
    // made recorded times inconsistent between devices and sessions.

    /** Seconds played so far, from the clock. */
    function elapsedSeconds() {
        if (!timerSegmentStart) return timerBaseSeconds;
        return timerBaseSeconds + Math.floor((Date.now() - timerSegmentStart) / 1000);
    }

    function renderTimer() {
        timerSeconds = elapsedSeconds();
        gameTimerEl.textContent = formatTime(timerSeconds);
    }

    /** Freeze the running segment into the accumulated total. */
    function suspendTimer() {
        timerBaseSeconds = elapsedSeconds();
        timerSegmentStart = 0;
        timerSeconds = timerBaseSeconds;
    }

    /** Start (or continue) timing from a given number of seconds. */
    function runTimer(fromSeconds) {
        stopTimer();
        timerBaseSeconds = fromSeconds;
        timerSegmentStart = Date.now();
        timerPaused = false;
        gameTimerEl.classList.remove('paused');
        gridEl.classList.remove('paused');
        renderTimer();
        // Twice a second, so a tab returning from the background corrects its
        // display promptly instead of showing a stale value for up to a second.
        timerInterval = setInterval(renderTimer, 500);
    }

    function startTimer() {
        runTimer(0);
    }

    function stopTimer() {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        suspendTimer();
    }

    function togglePause() {
        if (!gameActive || gameWon) return;
        timerPaused = !timerPaused;
        gameTimerEl.classList.toggle('paused', timerPaused);
        if (timerPaused) {
            // Time stops accruing; the interval keeps running but renders the
            // frozen total.
            suspendTimer();
            setStatus('Paused');
            // Optionally hide the grid to prevent cheating
            gridEl.classList.add('paused');
        } else {
            timerSegmentStart = Date.now();
            setStatus('');
            gridEl.classList.remove('paused');
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  localStorage SAVE / RESUME
    // ══════════════════════════════════════════════════════════════════

    function debounceSave() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveGame, 2000);
    }

    function saveGame() {
        if (!gameActive || !currentPuzzle || gameWon) return;

        const state = {
            puzzle: currentPuzzle,
            solution: currentSolution,
            difficulty: currentDifficulty,
            userValues: readGrid(),
            notes: cellNotes.map(s => [...s]),
            timerSeconds: elapsedSeconds(),
            hintsUsed,
            level: currentLevel,
            daily: currentDaily,
            autoNotes,
            autoNotesUsed,
            lockedCells: Array.from({ length: 81 }, (_, i) => wrappers[i].classList.contains('locked')),
            hintCells: Array.from({ length: 81 }, (_, i) => wrappers[i].classList.contains('hint')),
            timestamp: Date.now(),
        };

        store.saveGameState(state);
    }

    function resumeGame(state) {
        currentPuzzle = state.puzzle;
        currentSolution = state.solution;
        currentDifficulty = state.difficulty;
        currentLevel = state.level ?? null;
        currentDaily = state.daily ?? null;
        autoNotesUsed = state.autoNotesUsed || false;
        timerSeconds = state.timerSeconds || 0;
        hintsUsed = state.hintsUsed || 0;
        gameWon = false;
        undoStack.length = 0;
        redoStack.length = 0;

        // Select difficulty button
        selectDifficulty(currentDifficulty);

        // Write user values
        for (let i = 0; i < 81; i++) {
            const ch = state.userValues[i];
            inputs[i].value = (ch === '0') ? '' : ch;
            wrappers[i].classList.remove('given', 'solved', 'error', 'hint', 'locked',
                'user-error', 'correct-check', 'conflict');
            inputs[i].readOnly = isTouchDevice; // keep readOnly on touch to suppress virtual keyboard
            clearCellNotes(i);

            if (state.lockedCells[i]) {
                wrappers[i].classList.add('locked');
                inputs[i].readOnly = true;
                if (state.hintCells && state.hintCells[i]) {
                    wrappers[i].classList.add('hint');
                } else if (currentPuzzle[i] !== '0') {
                    wrappers[i].classList.add('given');
                }
            }

            // Restore notes
            if (state.notes[i]) {
                for (const d of state.notes[i]) cellNotes[i].add(d);
                renderNotes(i);
            }
        }

        gameActive = true;
        setupOpen = false;
        runTimer(state.timerSeconds || 0);

        recheckAllConflicts();
        updateNumpadCompletion();

        if (state.autoNotes) {
            setAutoNotes(true);
        }
        // setAutoNotes stamps the flag; the saved value is the truth.
        autoNotesUsed = state.autoNotesUsed || false;

        refreshLayout();

        const label = DIFFICULTY_LABELS[currentDifficulty];
        setStatus(`Resumed: ${label} — ${formatTime(timerSeconds)}`);

        // Remove resume banner if it exists
        const banner = document.querySelector('.resume-banner');
        if (banner) banner.remove();
    }

    function showResumeBanner(state) {
        const existing = document.querySelector('.resume-banner');
        if (existing) existing.remove();

        const diff = DIFFICULTY_LABELS[state.difficulty] || state.difficulty;
        const time = formatTime(state.timerSeconds || 0);

        const banner = document.createElement('div');
        banner.className = 'resume-banner';
        banner.innerHTML = `
      <span>Resume ${diff} game? (${time})</span>
      <div class="resume-actions">
        <button class="btn btn-primary" id="btn-resume-yes">Resume</button>
        <button class="btn" id="btn-resume-no">Dismiss</button>
      </div>
    `;

        const card = document.getElementById('app');
        const numpad = document.getElementById('numpad');
        if (numpad) {
            card.insertBefore(banner, numpad);
        } else {
            card.appendChild(banner);
        }

        document.getElementById('btn-resume-yes').addEventListener('click', () => {
            resumeGame(state);
        });
        document.getElementById('btn-resume-no').addEventListener('click', () => {
            banner.remove();
            store.deleteSavedGame();
        });
    }

    // ══════════════════════════════════════════════════════════════════
    //  STATS
    // ══════════════════════════════════════════════════════════════════

    function renderStats() {
        const stats = store.getStats();
        const summary = store.getSummary();
        const diffs = ['easy', 'medium', 'hard', 'expert', 'evil', 'nightmare'];

        if (summary.started === 0) {
            statsContent.innerHTML =
                '<p style="text-align:center;color:var(--text-muted);">No games played yet.</p>';
            return;
        }

        const pct = Math.round(summary.winRate * 100);
        let html = `<div class="stats-summary">
      <div class="stat-tile"><span class="stat-value">${summary.won}</span><span class="stat-label">Solved</span></div>
      <div class="stat-tile"><span class="stat-value">${pct}%</span><span class="stat-label">Win rate</span></div>
      <div class="stat-tile"><span class="stat-value">${summary.streak.current}</span><span class="stat-label">Day streak</span></div>
      <div class="stat-tile"><span class="stat-value">${summary.streak.best}</span><span class="stat-label">Best streak</span></div>
      <div class="stat-tile"><span class="stat-value">${formatTime(summary.totalTime)}</span><span class="stat-label">Time played</span></div>
    </div>`;

        html += `<table class="stats-table">
      <thead><tr><th>Difficulty</th><th>Solved</th><th>Win rate</th><th>Best</th><th>Average</th><th>Hints</th><th>Auto</th></tr></thead>
      <tbody>`;

        for (const d of diffs) {
            const s = stats[d];
            if (!s || (!s.started && !s.won)) continue;
            const started = s.started || s.won;
            const avg = s.won ? Math.round(s.totalTime / s.won) : 0;
            const rate = started ? Math.round((s.won / started) * 100) : 0;
            html += `<tr>
        <td>${DIFFICULTY_LABELS[d]}</td>
        <td>${s.won}</td>
        <td>${rate}%</td>
        <td>${s.won ? formatTime(s.bestTime) : '—'}</td>
        <td>${s.won ? formatTime(avg) : '—'}</td>
        <td>${s.totalHints}</td>
        <td>${s.autoNotesGames || 0}</td>
      </tr>`;
        }

        html += '</tbody></table>';
        statsContent.innerHTML = html;
    }

    function openStats() {
        renderStats();
        dialogs.open(statsOverlay);
    }

    function closeStats() { dialogs.close(statsOverlay); }

    function resetStats() {
        store.resetStats();
        renderStats();
    }

    // ══════════════════════════════════════════════════════════════════
    //  MODE SWITCHING
    // ══════════════════════════════════════════════════════════════════

    function switchMode(newMode) {
        if (newMode === mode) return;

        // Capture grid state before clearing (for Play → Solver puzzle retention)
        let gridSnapshot = null;
        if (mode === 'play' && newMode === 'solver') {
            gridSnapshot = readGrid();
            if (gameActive) saveGame();
        } else if (mode === 'play' && gameActive) {
            saveGame();
        }

        mode = newMode;
        stopTimer();
        clearGrid();
        gameActive = false;
        gameWon = false;
        currentPuzzle = null;
        currentSolution = null;
        notesMode = false;
        btnNotesToggle.textContent = 'Notes: OFF';
        btnNotesToggle.classList.remove('notes-active');

        tabSolver.classList.toggle('active', mode === 'solver');
        tabPlay.classList.toggle('active', mode === 'play');
        modeIndicator.classList.toggle('solver', mode === 'solver');

        solverControls.style.display = mode === 'solver' ? 'flex' : 'none';
        playControls.style.display = mode === 'play' ? 'flex' : 'none';
        btnStats.style.display = mode === 'play' ? 'inline-flex' : 'none';
        if (btnLeaderboard && leaderboard.isAvailable()) {
            btnLeaderboard.style.display = mode === 'play' ? 'inline-flex' : 'none';
        }

        if (mode === 'solver') {
            subtitleEl.textContent = 'Constraint propagation & backtracking — solves in <1 ms';
            gameTimerEl.textContent = '';

            // Restore the Play puzzle into Solver so user can solve it
            if (gridSnapshot && gridSnapshot.replace(/0/g, '').length > 0) {
                writeGrid(gridSnapshot, true);
                setStatus('Puzzle loaded from Play mode — click Solve');
            } else {
                setStatus('Click a cell and type a digit');
            }
        } else {
            subtitleEl.textContent = 'Select a difficulty and start playing';
            solveTimeEl.textContent = '';
            solveTimeEl.classList.remove('visible');
            setStatus('Click "New Game" to start');

            // A shared link is an explicit request for a specific puzzle, so
            // it wins over offering to resume.
            if (!sharedPuzzleLoaded) {
                const saved = store.loadSavedGame();
                if (saved) showResumeBanner(saved);
            }
        }

        refreshLayout();
    }

    function selectDifficulty(diff) {
        currentDifficulty = diff;
        diffSelector.querySelectorAll('.diff-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.diff === diff);
        });

        if (levelInput && levelMaxDisplay) {
            const max = BANK_SIZES[diff] || 500;
            levelInput.max = max;
            levelMaxDisplay.textContent = '/ ' + max;
            // Clear current selection on diff change unless empty
            levelInput.value = '';
        }
    }

    // ══════════════════════════════════════════════════════════════════
    //  STATUS + GLOBAL SHORTCUTS
    // ══════════════════════════════════════════════════════════════════

    function setStatus(msg, type = '') {
        statusEl.textContent = msg;
        statusEl.className = 'status-msg' + (type ? ` ${type}` : '');
    }

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            // Never stack a second dialog on top of an open one.
            if (mode === 'solver' && !dialogs.isOpen()) openModal();
        }
    });

    // ══════════════════════════════════════════════════════════════════
    //  EVENT LISTENERS
    // ══════════════════════════════════════════════════════════════════

    tabSolver.addEventListener('click', () => switchMode('solver'));
    tabPlay.addEventListener('click', () => switchMode('play'));

    btnSolve.addEventListener('click', solve);
    btnExample.addEventListener('click', loadSolverExample);
    btnPaste.addEventListener('click', openModal);
    btnClear.addEventListener('click', clearGrid);

    btnNewGame.addEventListener('click', () => startGame());
    if (btnShare) {
        btnShare.addEventListener('click', shareCurrentPuzzle);
        btnShare.addEventListener('mousedown', (e) => e.preventDefault());
    }
    if (btnShareClose) btnShareClose.addEventListener('click', () => dialogs.close(shareOverlay));
    if (shareOverlay) {
        shareOverlay.addEventListener('click', (e) => {
            if (e.target === shareOverlay) dialogs.close(shareOverlay);
        });
    }
    if (btnSetupToggle) {
        btnSetupToggle.addEventListener('click', () => {
            setupOpen = true;
            refreshLayout();
        });
        btnSetupToggle.addEventListener('mousedown', (e) => e.preventDefault());
    }
    if (btnDaily) {
        btnDaily.addEventListener('click', () => startDaily());
        btnDaily.addEventListener('mousedown', (e) => e.preventDefault());
    }
    btnHint.addEventListener('click', giveHint);
    btnCheck.addEventListener('click', checkErrors);
    btnReset.addEventListener('click', resetGame);
    btnUndo.addEventListener('click', doUndo);
    btnRedo.addEventListener('click', doRedo);
    btnNotesToggle.addEventListener('click', () => {
        toggleNotesMode();
        // Re-focus the previously selected cell to keep keyboard input working
        if (!isTouchDevice && focusedIdx >= 0) {
            requestAnimationFrame(() => inputs[focusedIdx].focus());
        }
    });
    // Prevent mousedown from stealing focus from active cell
    btnNotesToggle.addEventListener('mousedown', (e) => e.preventDefault());
    if (btnAutoNotes) {
        btnAutoNotes.addEventListener('click', () => {
            setAutoNotes(!autoNotes);
            if (!isTouchDevice && focusedIdx >= 0) {
                requestAnimationFrame(() => inputs[focusedIdx].focus());
            }
        });
        btnAutoNotes.addEventListener('mousedown', (e) => e.preventDefault());
    }
    if (btnPause) {
        btnPause.addEventListener('click', () => {
            togglePause();
            btnPause.textContent = timerPaused ? 'Resume' : 'Pause';
        });
        btnPause.addEventListener('mousedown', (e) => e.preventDefault());
    }
    // Timer click also toggles pause
    gameTimerEl.addEventListener('click', () => {
        if (btnPause) {
            togglePause();
            btnPause.textContent = timerPaused ? 'Resume' : 'Pause';
        }
    });
    gameTimerEl.style.cursor = 'pointer';

    // Prevent ALL play buttons from stealing cell focus
    [btnHint, btnCheck, btnUndo, btnRedo, btnReset].forEach(btn => {
        if (btn) btn.addEventListener('mousedown', (e) => e.preventDefault());
    });

    btnStats.addEventListener('click', openStats);
    btnStatsClose.addEventListener('click', closeStats);
    btnStatsReset.addEventListener('click', resetStats);

    btnWinNew.addEventListener('click', () => {
        dialogs.close(winOverlay);
        startGame();
    });

    diffSelector.addEventListener('click', (e) => {
        if (e.target.classList.contains('diff-btn')) {
            selectDifficulty(e.target.dataset.diff);
        }
    });

    btnModalOk.addEventListener('click', doImport);
    btnModalNo.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
    statsOverlay.addEventListener('click', (e) => { if (e.target === statsOverlay) closeStats(); });
    winOverlay.addEventListener('click', (e) => { if (e.target === winOverlay) dialogs.close(winOverlay); });

    // ══════════════════════════════════════════════════════════════════
    //  NUMPAD (mobile/tablet)
    // ══════════════════════════════════════════════════════════════════

    function handleNumpadInput(digit) {
        if (isPlayBlocked()) return;
        // Use lastTouchedIdx as fallback — focusedIdx is -1 after blur on mobile
        const idx = focusedIdx >= 0 ? focusedIdx : lastTouchedIdx;
        if (idx < 0) return;
        const isLocked = wrappers[idx].classList.contains('locked');
        if (isLocked) return;

        if (digit === '0') {
            // Erase
            if (mode === 'play' && gameActive) {
                if (cellNotes[idx].size > 0) {
                    pushUndo(idx, inputs[idx].value, '', new Set(cellNotes[idx]), new Set());
                    clearCellNotes(idx);
                    updateNumpadCompletion();
                } else if (inputs[idx].value) {
                    pushUndo(idx, inputs[idx].value, '', new Set(cellNotes[idx]), new Set());
                    inputs[idx].value = '';
                    clearConflictStyle(idx);
                    updateNumpadCompletion();
                    // Erasing frees the digit up again for its peers.
                    refreshAutoNotes();
                }
                debounceSave();
            } else if (mode === 'solver') {
                inputs[idx].value = '';
                wrappers[idx].classList.remove('given', 'solved', 'error', 'solve-anim');
                if (solved) clearSolution();
            }
            updateDigitHighlight();
            return;
        }

        if (mode === 'play' && gameActive && notesMode) {
            toggleNote(idx, digit);
            return;
        }

        // Place digit
        if (mode === 'play' && gameActive) {
            const prevVal = inputs[idx].value;
            const prevNotes = new Set(cellNotes[idx]);
            inputs[idx].value = digit;
            clearCellNotes(idx);
            clearPeerNotes(idx, digit);
            wrappers[idx].classList.remove('user-error', 'correct-check');
            pushUndo(idx, prevVal, digit, prevNotes, new Set());
            highlightConflicts(idx);
            refreshAutoNotes();
            clearHintNudge();
            checkWin();
            debounceSave();
            updateNumpadCompletion();
        } else if (mode === 'solver') {
            if (solved) clearSolution();
            inputs[idx].value = digit;
            wrappers[idx].classList.remove('error');
            setStatus('');
        }

        updateDigitHighlight();
        advanceToNextEmpty(idx);
    }

    // ── NUMPAD (touch devices) ─────────────────────────────────────
    if (numpadEl) {
        numpadEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.numpad-btn');
            if (!btn) return;
            e.preventDefault();

            if (btn.id === 'numpad-notes') {
                toggleNotesMode();
                btn.classList.toggle('notes-active', notesMode);
                return;
            }

            const digit = btn.dataset.digit;
            if (digit !== undefined) {
                handleNumpadInput(digit);
            }
        });
    }

    // Touch cell selection — NO input.focus(), purely visual
    if (isTouchDevice) {
        gridEl.addEventListener('click', (e) => {
            const wrapper = e.target.closest('.cell-wrapper');
            if (!wrapper) return;
            const idx = parseInt(wrapper.dataset.idx, 10);
            if (!isNaN(idx)) {
                selectCellTouch(idx);
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════
    //  THEME SELECTOR
    // ══════════════════════════════════════════════════════════════════

    themeToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        themeDropdown.classList.toggle('open');
    });

    themeDropdown.addEventListener('click', (e) => {
        const opt = e.target.closest('.theme-option');
        if (!opt) return;
        e.stopPropagation();
        applyTheme(opt.dataset.theme);
        themeDropdown.classList.remove('open');
    });

    // Close dropdown when clicking elsewhere
    document.addEventListener('click', () => {
        themeDropdown.classList.remove('open');
    });

    // Restore saved theme
    // Restore the saved theme. Persisting is skipped here: reading it back and
    // writing it straight out again would be pointless work on every load.
    applyTheme(store.getTheme(DEFAULT_THEME), { dropdown: themeDropdown, persist: false });

    // ══════════════════════════════════════════════════════════════════
    //  LEADERBOARD (graceful degradation)
    // ══════════════════════════════════════════════════════════════════

    function renderLeaderboard(entries) {
        if (!lbContent) return;
        if (!entries || entries.length === 0) {
            lbContent.innerHTML = '<p class="lb-empty">No scores yet. Be the first!</p>';
            return;
        }
        let html = `<table class="lb-table">
            <thead><tr><th>#</th><th>Name</th><th>Time</th><th>Hints</th><th>Auto</th><th>Date</th></tr></thead>
            <tbody>`;
        entries.forEach((e, i) => {
            const date = new Date(e.date).toLocaleDateString();
            // Everything is escaped, including the numeric fields: the API is
            // the only thing validating them and this is built with innerHTML,
            // so defence in depth costs nothing here.
            html += `<tr>
                <td>${i + 1}</td>
                <td>${escapeHtml(e.name)}</td>
                <td>${escapeHtml(formatTime(Number(e.time) || 0))}</td>
                <td>${escapeHtml(String(Number(e.hints) || 0))}</td>
                <td>${e.autoNotes ? '✓' : ''}</td>
                <td>${escapeHtml(date)}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        lbContent.innerHTML = html;
    }

    async function openLeaderboard(diff) {
        if (!lbOverlay) return;
        currentLbDiff = diff || currentDifficulty;
        lbContent.innerHTML = '<p class="lb-empty">Loading...</p>';
        // Only opened once; re-opening on a tab switch would steal focus back
        // to the first tab on every click.
        if (!lbOverlay.classList.contains('active')) dialogs.open(lbOverlay);
        if (lbTabs) {
            lbTabs.querySelectorAll('.lb-tab').forEach(t =>
                t.classList.toggle('active', t.dataset.diff === currentLbDiff)
            );
        }
        const entries = await leaderboard.fetchLeaderboard(currentLbDiff);
        renderLeaderboard(entries);
    }

    function closeLeaderboard() {
        if (lbOverlay) dialogs.close(lbOverlay);
    }

    // Leaderboard button
    if (btnLeaderboard) {
        btnLeaderboard.addEventListener('click', () => openLeaderboard());
    }

    // Leaderboard close
    if (btnLbClose) {
        btnLbClose.addEventListener('click', closeLeaderboard);
    }
    if (lbOverlay) {
        lbOverlay.addEventListener('click', (e) => {
            if (e.target === lbOverlay) closeLeaderboard();
        });
    }

    // Leaderboard tabs
    if (lbTabs) {
        lbTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.lb-tab');
            if (tab) openLeaderboard(tab.dataset.diff);
        });
    }

    // Win submit
    if (btnWinSubmit) {
        btnWinSubmit.addEventListener('click', async () => {
            const name = winNameInput ? winNameInput.value.trim() : '';
            if (!name) {
                winNameInput.style.borderColor = 'var(--text-error)';
                winNameInput.focus();
                return;
            }
            btnWinSubmit.disabled = true;
            btnWinSubmit.textContent = 'Submitting...';

            const result = await leaderboard.submitScore({
                name,
                difficulty: currentDifficulty,
                time: timerSeconds,
                hints: hintsUsed,
                level: currentLevel,
                autoNotes: autoNotesUsed,
            });

            if (result && result.rank) {
                btnWinSubmit.textContent = `Rank #${result.rank}!`;
                // Save name for next time
                store.setPlayerName(name);
            } else {
                btnWinSubmit.textContent = 'Error';
            }
            setTimeout(() => {
                btnWinSubmit.disabled = false;
                btnWinSubmit.textContent = 'Submit Score';
            }, 3000);
        });
    }

    // Restore saved player name
    if (winNameInput) {
        const savedName = store.getPlayerName();
        if (savedName) winNameInput.value = savedName;
        winNameInput.addEventListener('input', () => {
            winNameInput.style.borderColor = '';
        });
    }

    // ── Save on the way out ────────────────────────────────────────────
    // saveGame() is debounced by 2s, so up to two seconds of play was lost
    // whenever a tab was closed or a phone backgrounded the app — which iOS
    // does aggressively, and it may never resume the page afterwards.
    function flushSave() {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
        }
        saveGame();
    }

    // visibilitychange is the reliable one on mobile; pagehide covers desktop
    // navigation. 'beforeunload' is deliberately not used — it is unreliable on
    // iOS and can block bfcache.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushSave();
    });
    window.addEventListener('pagehide', flushSave);

    /**
     * Show setup between games, fold it away during one.
     *
     * Difficulty, level and New Game are decided once and then take up room for
     * the rest of the puzzle. Folding them recovers ~120px, which on a phone is
     * the difference between a 26px cell and a 37px one.
     */
    function setSetupFolded(folded) {
        if (!setupControls || !btnSetupToggle) return;
        setupControls.style.display = folded ? 'none' : '';
        btnSetupToggle.style.display = folded ? '' : 'none';
        btnSetupToggle.setAttribute('aria-expanded', String(!folded));
    }

    /**
     * Fold setup away, size the board, and unfold again if folding bought
     * nothing.
     *
     * Folding only helps when height is what limits the board. On a desktop
     * there is room to spare, so hiding the difficulty buttons mid-game would
     * be a loss for no gain — the board is already at its maximum size.
     */
    function refreshLayout() {
        const playing = mode === 'play' && gameActive && !gameWon && !setupOpen;

        if (!playing) {
            setSetupFolded(false);
            fitBoardSettled();
            return;
        }

        setSetupFolded(false);
        const open = fitBoardSettled();
        if (open.atMax) return; // already as large as the stylesheet allows

        setSetupFolded(true);
        const folded = fitBoardSettled();

        // Only stay folded if it actually bought something. Hiding the
        // difficulty buttons to gain a pixel is a straight loss.
        if (folded.size - open.size < MEANINGFUL_GAIN) {
            setSetupFolded(false);
            fitBoardSettled();
        }
    }

    // ── Fitting the board to the screen ────────────────────────────────
    //
    // The board used to be sized by media queries that subtracted a guessed
    // constant for everything else on screen (`calc((100dvh - 11rem) / 9)`).
    // The guess is wrong on any device whose chrome is not exactly that tall,
    // and being wrong by a little means the bottom controls fall off.
    //
    // So measure instead: whatever height the rest of the page occupies, give
    // the remainder to the grid. This adapts to any device, to rotation, and to
    // iOS collapsing its toolbars mid-scroll.

    /** Below this a cell is too small to tap, so the page scrolls instead. */
    const MIN_CELL = 26;

    /** Breathing room so the last row never sits flush against the edge. */
    const FIT_MARGIN = 8;

    /** Folding setup away has to earn its keep, in pixels per cell. */
    const MEANINGFUL_GAIN = 4;

    /**
     * @returns {{size: number, atMax: boolean}} atMax true means the board is
     *   as large as the stylesheet allows — or that nothing could be measured,
     *   in which case rearranging the layout cannot help either.
     */
    function fitBoard() {
        const unmeasurable = { size: 0, atMax: true };
        if (!wrappers.length) return unmeasurable;

        // Clear the previous fit so the stylesheet's maximum applies, then read
        // it off a real cell. Custom properties are not resolved until they are
        // used, so several breakpoints hand back a literal `calc(...)` string —
        // measuring the element is the only way to get a number.
        document.documentElement.style.removeProperty('--cell-size');
        // Zero means no layout engine — jsdom, or a hidden document. Nothing
        // to fit, and nothing to gain by folding controls away.
        const maxCell = wrappers[0].getBoundingClientRect().width;
        if (!maxCell) return unmeasurable;

        // Everything except the grid: header, tabs, controls, status, numpad,
        // padding, margins. Derived rather than listed, so adding UI cannot
        // silently break the calculation.
        const gridHeight = gridEl.offsetHeight;
        const chrome = document.body.scrollHeight - gridHeight;

        const viewport = window.visualViewport?.height || window.innerHeight;
        const available = viewport - chrome - FIT_MARGIN;

        // 8 one-pixel gaps plus the 2px border either side.
        const forCells = available - 8 - 4;
        const fitted = Math.floor(forCells / 9);

        const size = Math.max(MIN_CELL, Math.min(maxCell, fitted));
        document.documentElement.style.setProperty('--cell-size', `${size}px`);
        return { size, atMax: fitted >= maxCell };
    }

    /**
     * Fit twice.
     *
     * The card's max-width is derived from the cell size, so a larger board
     * widens the card, which lets the buttons wrap into fewer rows, which frees
     * height — the measurement feeds back into itself. One pass lands close; a
     * second settles it.
     */
    function fitBoardSettled() {
        fitBoard();
        return fitBoard();
    }

    /** Coalesce bursts of resize events into one measurement per frame. */
    let fitPending = false;
    function scheduleFit() {
        if (fitPending) return;
        fitPending = true;
        requestAnimationFrame(() => {
            fitPending = false;
            refreshLayout();
        });
    }

    window.addEventListener('resize', scheduleFit);
    window.addEventListener('orientationchange', scheduleFit);
    // iOS reports toolbar collapse here rather than through window resize.
    window.visualViewport?.addEventListener('resize', scheduleFit);

    // ══════════════════════════════════════════════════════════════════
    //  INIT
    // ══════════════════════════════════════════════════════════════════

    buildGrid();
    updateDailyButton();

    // Parsed before the first switchMode so the resume offer can be suppressed,
    // applied after so a raw-board link can stay in solver mode.
    const sharedPuzzle = parseShareLink(window.location.search);
    sharedPuzzleLoaded = sharedPuzzle !== null;

    switchMode('play');
    applySharedPuzzle(sharedPuzzle);
    revealLeaderboardUi();

    // Once the real layout exists, size the board to whatever room is left.
    refreshLayout();

    // ── Offline support ────────────────────────────────────────────────
    // Registered only over http(s): service workers are unavailable on file://,
    // and the dev server intentionally ships none, so failure here is normal and
    // must never affect gameplay.
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register(new URL('sw.js', window.location.href), { scope: './' })
                .catch(() => { /* offline support unavailable; the app still works */ });
        });

        // Ask the browser not to evict us when storage runs short. This covers
        // the precached bank *and* localStorage — the saved game, stats and
        // streak.
        //
        // Only for an installed app, and that restraint is the point. Firefox
        // turns persist() into a visible permission prompt, and asking someone
        // who just opened the page to "allow persistent storage" before they
        // have played a single puzzle reads as a dark pattern — it is exactly
        // the kind of prompt that makes people leave. Installing the app is
        // already the user saying they want it kept, so that is when to ask.
        // Chrome, which decides silently, counts being installed towards
        // granting it anyway; Safari does not implement it at all and exempts
        // home-screen apps from its seven-day eviction cap instead.
        //
        // persisted() is checked first so an already-granted app never
        // re-prompts. Advisory throughout: nothing depends on the answer.
        if (window.matchMedia?.('(display-mode: standalone)')?.matches) {
            const state = navigator.storage?.persisted?.();
            if (state) {
                state
                    .then((already) => { if (!already) navigator.storage.persist(); })
                    .catch(() => { /* advisory; the app is unaffected */ });
            }
        }
    }
})();
