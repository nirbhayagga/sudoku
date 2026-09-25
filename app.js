import { createHintDiagram } from './hint-diagram.js';
/**
 * Sudoku — UI Controller
 * Solver Mode + Play Mode with pencil marks, undo/redo, digit highlighting,
 * conflict detection, localStorage save/resume, and stats tracking.
 */
import { SudokuSolver } from './solver.js';
import { SudokuGenerator } from './generator.js';
import { DIFFICULTY_LABELS, GAME_LABELS, BANK_SIZES, isDifficulty } from './difficulties.js';
import { dailyPuzzle, formatDay } from './daily.js';
import { puzzleId } from './puzzle-id.js';
import { parseShareLink, bankLink, puzzleLink, gameLink, parseGameLink, copyToClipboard } from './share.js';
import { candidatesFor, candidateGrid, peersOf, cellName, findNakedSingle, findHiddenSingle } from './techniques.js';
import { formatTime, escapeHtml, formatPuzzle, parsePuzzleText } from './format.js';
import { createDialogs } from './dialogs.js';
import { applyTheme, THEME_COLORS } from './theme.js';
import * as store from './storage.js';
import * as leaderboard from './leaderboard-client.js';
import { MAX_WORKSHEET_PUZZLES, planWorksheet, renderWorksheet } from './printing.js';
import { createAnalysisClient } from './analysis-client.js';
import { createGeneratorDialog } from './generator-dialog.js';
import { progressionPosition } from './progression.js';

/**
 * The puzzle bank is ~450 kB — over 90% of the app — and is not needed to draw
 * the grid, resume a saved game (the board lives in localStorage) or use solver
 * mode. It is fetched on first use and the promise cached, so the initial load
 * carries only the ~10 kB of everything else.
 */
let bankPromise = null;
function loadBank() {
    if (!bankPromise) bankPromise = import('./puzzle-bank.js').catch((error) => {
        bankPromise = null;
        throw error;
    });
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
    const pausePanel = document.getElementById('pause-panel');
    const btnPauseResume = document.getElementById('btn-pause-resume');
    const btnHandoff = document.getElementById('btn-handoff');
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
    const shareTitle = document.getElementById('share-title');
    const shareHint = document.getElementById('share-hint');
    const handoffConfirm = document.getElementById('btn-handoff-confirm');
    let pendingHandoff = null;

    const modalOverlay = document.getElementById('modal-overlay');
    const importText = document.getElementById('import-text');
    const importError = document.getElementById('import-error');
    const btnModalOk = document.getElementById('btn-modal-import');
    const btnModalNo = document.getElementById('btn-modal-cancel');

    const btnExport = document.getElementById('btn-export');
    const btnPauseExport = document.getElementById('btn-pause-export');
    const exportOverlay = document.getElementById('export-overlay');
    const exportSource = document.getElementById('export-source');
    const exportSourceLabel = document.getElementById('export-source-label');
    const exportFormat = document.getElementById('export-format');
    const exportText = document.getElementById('export-text');
    const exportHint = document.getElementById('export-hint');
    const btnExportCopy = document.getElementById('btn-export-copy');
    const btnExportClose = document.getElementById('btn-export-close');

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
    let currentProgression = false;
    let progressionItems = null;
    let selectedDifficulty = currentDifficulty;
    let gameRequest = 0;
    let gameLoading = false;
    let winTimeout = null;
    let completion = null;
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
    // Wrong digits placed this game. Counted at placement, against the solution,
    // and never shown until the win — it is a record, not a live check.
    let mistakes = 0;
    // Check has marked errors that are still on the board; the button then
    // offers to clear them until the next board change.
    let errorsMarked = false;
    // This game was handed to another device. Saving stops so the next launch
    // here does not offer a game that was finished elsewhere; the first move
    // made here afterwards is a decision to keep playing, and saving resumes.
    let handedOff = false;
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
        return mode === 'play' && (timerPaused || gameLoading);
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

        if (gameWon && !wrappers[idx].classList.contains('locked')) reopenCompletedGame();

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
            const prevValue = input.dataset.prevVal ?? input.dataset.lastValue ?? '';
            delete input.dataset.prevVal;
            delete input.dataset.prevNotes;
            const prevNotes = new Set(cellNotes[idx]);
            noteMistake(idx, val);

            // Clear notes on this cell
            clearCellNotes(idx);

            // Clear error styling
            wrappers[idx].classList.remove('user-error', 'correct-check');

            // Auto-clear conflicting notes in peers
            const peerNotes = clearPeerNotes(idx, val);
            pushUndo(idx, prevValue, val, prevNotes, new Set(), peerNotes);

            // Check conflicts
            highlightConflicts(idx);

            refreshAutoNotes();
            clearHintNudge();
            resetCheckButton();

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
        if (e.isComposing) return;
        // Leave browser/OS shortcuts intact, including modified digits and paste.
        if (e.ctrlKey || e.metaKey || e.altKey) {
            const key = e.key.toLowerCase();
            if (!e.altKey && mode === 'play' && (key === 'z' || key === 'y')) {
                e.preventDefault();
                if (key === 'y' || e.shiftKey) doRedo();
                else doUndo();
            }
            return;
        }
        const row = Math.floor(idx / 9);
        const col = idx % 9;
        const isLocked = mode === 'play' && wrappers[idx].classList.contains('locked');
        if (gameWon && !isLocked && (/^[0-9]$/.test(e.key) || ['Backspace', 'Delete'].includes(e.key))) reopenCompletedGame();

        // Arrow keys still navigate while paused; nothing may change the board.
        if (isPlayBlocked() && !e.key.startsWith('Arrow') && !['Tab', 'Escape', 'p', 'P'].includes(e.key)) {
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
                refreshAutoNotes();
                clearHintNudge();
                resetCheckButton();
                updateNumpadCompletion();
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
                refreshAutoNotes();
                clearHintNudge();
                resetCheckButton();
                updateNumpadCompletion();
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
                else onCheckPressed();
                break;

            case 'Escape':
                e.preventDefault();
                clearHintNudge();
                inputs[idx].blur();
                focusedIdx = -1;
                lastTouchedIdx = -1;
                for (const wrapper of wrappers) wrapper.classList.remove('focused');
                clearHighlights();
                clearDigitHighlight();
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

            case 'f': case 'F':
                if (mode === 'play') {
                    e.preventDefault();
                    fillNotesOnce();
                }
                break;

            case 'p': case 'P':
                if (mode === 'play') {
                    e.preventDefault();
                    setPaused(!timerPaused);
                }
                break;
        }
    }

    function onCellFocus(idx) {
        if (pendingHint && pendingHint.idx !== idx) clearHintNudge();
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
        if (pendingHint && pendingHint.idx !== idx) clearHintNudge();
        focusedIdx = idx;
        lastTouchedIdx = idx;
        for (const w of wrappers) w.classList.remove('focused');
        wrappers[idx].classList.add('focused');
        clearHighlights();
        clearDigitHighlight();
        highlightRelated(idx);
        updateDigitHighlight();
    }

    // Tapping the status text is the touch equivalent of blurring a grid input.
    // Keep button taps selected so the numpad and selected-cell hints still work.
    document.querySelector('.status-bar').addEventListener('click', event => {
        if (!isTouchDevice || event.target.closest('button')) return;
        focusedIdx = -1;
        lastTouchedIdx = -1;
        for (const wrapper of wrappers) wrapper.classList.remove('focused');
        clearHighlights();
        clearDigitHighlight();
    });

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
        setNotesMode(!notesMode);
    }

    function setNotesMode(on) {
        notesMode = on;
        btnNotesToggle.setAttribute('aria-pressed', String(notesMode));
        btnNotesToggle.classList.toggle('notes-active', notesMode);
        if (numpadEl) {
            const notesBtn = numpadEl.querySelector('#numpad-notes');
            if (notesBtn) {
                notesBtn.setAttribute('aria-pressed', String(notesMode));
                notesBtn.classList.toggle('notes-active', notesMode);
            }
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

    function notesSnapshot() {
        return { autoNotes, notesMode, notes: cellNotes.map(notes => [...notes]) };
    }

    function applyNotesSnapshot(snapshot) {
        autoNotes = snapshot.autoNotes;
        for (let i = 0; i < 81; i++) {
            cellNotes[i] = new Set(snapshot.notes[i]);
            renderNotes(i);
        }
        btnAutoNotes.setAttribute('aria-pressed', String(autoNotes));
        btnAutoNotes.classList.toggle('notes-active', autoNotes);
        setNotesMode(snapshot.notesMode);
    }

    function pushNotesUndo(before) {
        undoStack.push({ kind: 'notes', before, after: notesSnapshot() });
        redoStack.length = 0;
        if (undoStack.length > 200) undoStack.shift();
    }

    function fillNotesOnce() {
        if (isPlayBlocked() || !gameActive || gameWon) return;
        const before = notesSnapshot();
        const board = readGrid();
        applyNotesSnapshot({ autoNotes: false, notesMode, notes: candidateGrid(board).map(notes => notes ? [...notes] : []) });
        autoNotesUsed = true;
        pushNotesUndo(before);
        clearHintNudge();
        resetCheckButton();
        debounceSave();
        setStatus('Notes filled once — edit them by hand, or Undo to restore your notes');
    }

    function setAutoNotes(on, { record = true } = {}) {
        if (record && (isPlayBlocked() || !gameActive || gameWon)) return;
        const before = notesSnapshot();
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
            btnAutoNotes.setAttribute('aria-pressed', String(on));
            btnAutoNotes.classList.toggle('notes-active', on);
        }
        if (record) pushNotesUndo(before);
        debounceSave();
    }

    function renderNotes(idx) {
        for (let d = 0; d < 9; d++) {
            const digit = String(d + 1);
            notesEls[idx][d].classList.toggle('visible', cellNotes[idx].has(digit));
        }
        if (inputs[idx]) updateCellLabel(idx);
    }

    function clearCellNotes(idx) {
        cellNotes[idx].clear();
        renderNotes(idx);
    }

    function clearPeerNotes(idx, digit) {
        const changed = [];
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
                changed.push({ idx: i, before: [...cellNotes[i]], after: [...cellNotes[i]].filter(d => d !== digit) });
                cellNotes[i].delete(digit);
                renderNotes(i);
            }
        }
        return changed;
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
    function updateCellLabel(i) {
        inputs[i].dataset.lastValue = inputs[i].value;
        const kind = wrappers[i].classList.contains('given') ? 'given' : wrappers[i].classList.contains('hint') ? 'revealed hint' : 'entry';
        const value = inputs[i].value || 'empty';
        const notes = !inputs[i].value && cellNotes[i].size ? `, notes ${[...cellNotes[i]].sort().join(', ')}` : '';
        inputs[i].setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, Column ${i % 9 + 1}, ${kind}, ${value}${notes}`);
    }

    function updateCellLabels() {
        for (let i = 0; i < inputs.length; i++) updateCellLabel(i);
    }

    function updateNumpadCompletion() {
        updateCellLabels();
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

    function pushUndo(idx, prevVal, newVal, prevNotes, newNotes, peerNotes = [], hint = null) {
        undoStack.push({ idx, prevVal, newVal, prevNotes, newNotes, peerNotes, hint });
        redoStack.length = 0; // clear redo on new action
        if (undoStack.length > 200) undoStack.shift();
    }

    function restoreMovePeers(action, forward) {
        for (const change of action.peerNotes || []) {
            cellNotes[change.idx] = new Set(forward ? change.after : change.before);
            renderNotes(change.idx);
        }
        if (action.hint) {
            const hinted = forward || action.hint.wasHint;
            const locked = forward || action.hint.wasLocked;
            wrappers[action.idx].classList.toggle('hint', hinted);
            wrappers[action.idx].classList.toggle('locked', locked);
            inputs[action.idx].readOnly = isTouchDevice || locked;
        }
    }

    function doUndo() {
        if (isPlayBlocked()) return;
        if (undoStack.length === 0 || (!gameActive && !gameWon)) return;
        reopenCompletedGame();
        const action = undoStack.pop();
        redoStack.push(action);

        if (action.kind === 'notes') {
            applyNotesSnapshot(action.before);
            clearHintNudge();
            resetCheckButton();
            debounceSave();
            return;
        }

        inputs[action.idx].value = action.prevVal;
        cellNotes[action.idx] = new Set(action.prevNotes);
        renderNotes(action.idx);
        restoreMovePeers(action, false);
        wrappers[action.idx].classList.remove('user-error', 'correct-check');
        recheckAllConflicts();
        updateNumpadCompletion();
        refreshAutoNotes();
        clearHintNudge();
        resetCheckButton();

        // Move selection to the undone cell
        if (isTouchDevice) {
            selectCellTouch(action.idx);
        } else {
            inputs[action.idx].focus();
        }
        updateDigitHighlight();
        checkWin();
        debounceSave();
    }

    function doRedo() {
        if (isPlayBlocked()) return;
        if (redoStack.length === 0 || (!gameActive && !gameWon)) return;
        reopenCompletedGame();
        const action = redoStack.pop();
        undoStack.push(action);

        if (action.kind === 'notes') {
            applyNotesSnapshot(action.after);
            clearHintNudge();
            resetCheckButton();
            debounceSave();
            return;
        }

        inputs[action.idx].value = action.newVal;
        cellNotes[action.idx] = new Set(action.newNotes);
        renderNotes(action.idx);
        restoreMovePeers(action, true);
        wrappers[action.idx].classList.remove('user-error', 'correct-check');
        recheckAllConflicts();
        updateNumpadCompletion();
        refreshAutoNotes();
        clearHintNudge();
        resetCheckButton();

        // Move selection to the redone cell
        if (isTouchDevice) {
            selectCellTouch(action.idx);
        } else {
            inputs[action.idx].focus();
        }
        updateDigitHighlight();
        checkWin();
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
        if (!isTouchDevice) inputs[0].focus({ preventScroll: true });
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
        if (winSubmit) winSubmit.style.display = available && isDifficulty(currentDifficulty) ? 'flex' : 'none';
    }

    // ── Dialogs ────────────────────────────────────────────────────────
    // Overlays are siblings of these regions, never descendants, so nothing
    // focused ends up inside an aria-hidden subtree.
    const dialogs = createDialogs([
        document.querySelector('.header'),
        document.querySelector('.mode-toggle'),
        document.getElementById('board-rules-control'),
        document.getElementById('app'),
        document.querySelector('.shortcuts'),
    ].filter(Boolean), { onOpen: () => clearHintNudge() });

    // ── Import Modal ───────────────────────────────────────────────────
    const importAnalysis = createAnalysisClient();
    let assessedBoard = null;
    let importAssessment = null;
    let assessmentPromise = null;
    let assessmentTimeout;
    let importRevision = 0;
    function cancelImportAnalysis() {
        ++importRevision;
        clearTimeout(assessmentTimeout);
        importAnalysis.cancel();
        assessedBoard = null;
        importAssessment = null;
        assessmentPromise = null;
        document.getElementById('btn-modal-play').disabled = false;
    }
    function openModal() {
        cancelImportAnalysis();
        if (importError) importError.textContent = '';
        document.getElementById('import-assessment').textContent = '';
        importText.value = '';
        dialogs.open(modalOverlay, { initialFocus: importText, onClose: cancelImportAnalysis });
    }

    function closeModal() { dialogs.close(modalOverlay); }

    async function inspectImport(board) {
        if (board === assessedBoard && importAssessment) return importAssessment;
        if (board === assessedBoard && assessmentPromise) return assessmentPromise;
        cancelImportAnalysis();
        const revision = importRevision;
        assessedBoard = board;
        const status = document.getElementById('import-assessment');
        status.textContent = 'Checking uniqueness and explained techniques…';
        assessmentPromise = importAnalysis.request('assess', { puzzle: board, prepare: true }).then(result => {
            if (revision !== importRevision) return null;
            importAssessment = result;
            status.textContent = `${result.label}${result.solutions === 1 ? ' Observed technique coverage, not a bank difficulty tier.' : ''}`;
            return result;
        }).catch(error => {
            if (revision === importRevision && error.name !== 'AbortError') status.textContent = error.message;
            return null;
        }).finally(() => { if (revision === importRevision) assessmentPromise = null; });
        return assessmentPromise;
    }
    importText.addEventListener('input', () => {
        cancelImportAnalysis();
        document.getElementById('import-assessment').textContent = '';
        assessmentTimeout = setTimeout(() => {
            const board = parsePuzzleText(importText.value);
            if (board && modalOverlay.classList.contains('active')) void inspectImport(board);
        }, 250);
    });

    async function doImport(asPlay = false) {
        const raw = importText.value.trim();
        const board = parsePuzzleText(raw);
        if (!board) {
            const digits = raw.replace(/[^0-9.]/g, '');
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
        if (asPlay) {
            const pending = inspectImport(board);
            const revision = importRevision;
            document.getElementById('btn-modal-play').disabled = true;
            const assessment = await pending;
            if (revision !== importRevision || !modalOverlay.classList.contains('active') || parsePuzzleText(importText.value) !== board) return;
            document.getElementById('btn-modal-play').disabled = false;
            if (!assessment) return;
            if (!assessment.playable) {
                importError.textContent = assessment.label;
                return;
            }
            closeModal();
            startImportedPuzzle(board, assessment);
            return;
        }
        closeModal();
        switchMode('solver');
        writeGrid(board, true);
        solved = false;
        solveTimeEl.textContent = '';
        solveTimeEl.classList.remove('visible');
        setStatus('Puzzle imported');
    }

    async function startImportedPuzzle(board, assessment = null) {
        const request = ++gameRequest;
        if (!assessment) {
            try { assessment = await importAnalysis.request('assess', { puzzle: board, prepare: true }); }
            catch (error) { if (error.name !== 'AbortError') setStatus(error.message, 'error'); return false; }
        }
        if (request !== gameRequest || !assessment.playable) return false;
        const solution = assessment.solution;
        const state = store.validateGameState({ puzzle: board, userValues: board,
            solution, difficulty: 'imported' }, { recomputeSolution: false });
        if (!state) return false;
        switchMode('play');
        resumeGame(state);
        store.recordStart('imported');
        saveGame();
        setStatus(`Imported puzzle — ${assessment.clues} clues · ${assessment.label}`);
        return true;
    }

    // ── Quick Paste ────────────────────────────────────────────────────
    document.addEventListener('paste', (e) => {
        if (e.target === importText) return;
        if (mode === 'play') return;
        const text = (e.clipboardData || window.clipboardData).getData('text').trim();
        const board = parsePuzzleText(text);
        if (board) {
            e.preventDefault();
            writeGrid(board, true);
            solved = false;
            solveTimeEl.textContent = '';
            solveTimeEl.classList.remove('visible');
            setStatus('Puzzle pasted from clipboard');
        }
    });

    // ── Export Modal ───────────────────────────────────────────────────
    // Copies the board as text for other tools (a solver, a visualizer, a
    // forum post). In play mode the source picker chooses between the dealt
    // puzzle and the position as played; solver mode exports the grid as-is.
    let exportOverride = null;
    function exportBoard() {
        if (exportOverride) return exportOverride.puzzle;
        if (mode === 'play' && currentPuzzle && exportSource.value === 'original') {
            return currentPuzzle;
        }
        return readGrid();
    }

    function renderExport() {
        exportText.value = formatPuzzle(exportBoard(), exportFormat.value);
        exportHint.textContent = exportFormat.value === 'chat'
            ? 'Emoji alignment varies by app. Save PNG image keeps the grid aligned when messaging.'
            : exportFormat.value === 'grid' ? 'Use a monospace font to keep this grid aligned.'
                : 'Plain text for solvers and puzzle tools. Dots and zeros both mean empty cells.';
    }

    function openExportDialog(override = null) {
        exportOverride = override?.puzzle ? override : null;
        // The source choice only means something mid-game.
        const showSource = !exportOverride && mode === 'play' && !!currentPuzzle;
        exportSource.value = 'original';
        exportSource.style.display = showSource ? '' : 'none';
        exportSourceLabel.style.display = showSource ? '' : 'none';
        exportHint.textContent = '';
        document.getElementById('print-difficulty').value = selectedDifficulty;
        renderExport();
        updatePrintOptions();
        dialogs.open(exportOverlay, { initialFocus: exportFormat });
    }

    async function copyExport() {
        if (await copyToClipboard(exportText.value)) {
            exportHint.textContent = 'Copied to clipboard.';
        } else {
            exportHint.textContent = 'Clipboard unavailable — select the text and copy it yourself.';
            exportText.select();
        }
    }

    const generatorDialog = createGeneratorDialog({ dialogs, onPlay: startImportedPuzzle,
        onExport(puzzle, print) {
            document.getElementById('print-source').value = 'current';
            openExportDialog({ puzzle, title: 'Generated puzzle' });
            if (print) {
                exportOverlay.querySelector('.print-options').open = true;
                document.getElementById('print-layout').focus();
            }
        } });
    document.getElementById('btn-generate').addEventListener('click', () => generatorDialog.open());
    document.getElementById('btn-export-image').addEventListener('click', async () => {
        const board = exportBoard();
        const title = exportOverride?.title || (mode === 'play' && currentPuzzle ? puzzleIdentity() : 'Sudoku');
        try {
            const { downloadPuzzleImage } = await import('./puzzle-image.js');
            await downloadPuzzleImage(board, { title });
            exportHint.textContent = 'PNG image saved. Share the image to preserve the grid layout.';
        } catch (error) { exportHint.textContent = error.message || 'Image export failed.'; }
    });

    let printingWorksheet = false;
    function printOptions() {
        const fromBank = document.getElementById('print-source').value === 'bank';
        const difficulty = document.getElementById('print-difficulty').value;
        return {
            fromBank, difficulty,
            amount: fromBank ? Number(document.getElementById('print-count').value) : 1,
            unit: fromBank ? document.getElementById('print-unit').value : 'puzzles',
            perPage: Number(document.getElementById('print-layout').value),
            order: fromBank ? document.getElementById('print-order').value : 'random',
            start: Number(document.getElementById('print-start').value),
            bankSize: fromBank && isDifficulty(difficulty) ? BANK_SIZES[difficulty] : 1,
            answers: document.getElementById('print-answers').checked,
        };
    }

    function updatePrintOptions() {
        const options = printOptions();
        document.getElementById('print-bank-options').hidden = !options.fromBank;
        document.getElementById('print-start-row').hidden = options.order !== 'consecutive';
        document.getElementById('print-start').max = String(options.bankSize);
        const max = options.unit === 'pages' ? Math.floor(MAX_WORKSHEET_PUZZLES / options.perPage) : MAX_WORKSHEET_PUZZLES;
        document.getElementById('print-count').max = String(max);
        document.getElementById('print-count-label').textContent = `Number of ${options.unit === 'pages' ? 'puzzle pages' : 'puzzles'} (1–${max})`;
        const summary = document.getElementById('print-summary');
        const button = document.getElementById('btn-print');
        try {
            const plan = planWorksheet(options);
            const countLabel = (count, label) => `${count} ${label}${count === 1 ? '' : 's'}`;
            summary.textContent = `${countLabel(plan.count, 'puzzle')} · ${countLabel(plan.puzzlePages, 'puzzle page')}${plan.answerPages ? ` + ${countLabel(plan.answerPages, 'answer page')}` : ''} · ${countLabel(plan.totalPages, 'page')} total.`;
            button.disabled = printingWorksheet;
        } catch (error) {
            summary.textContent = error.message;
            button.disabled = true;
        }
    }

    async function printExport() {
        if (printingWorksheet) return;
        printingWorksheet = true;
        const button = document.getElementById('btn-print');
        button.disabled = true;
        try {
            let puzzles;
            const options = printOptions();
            const { difficulty, perPage, answers, order, start } = options;
            const { count } = planWorksheet(options);
            if (options.fromBank) {
                if (!isDifficulty(difficulty)) throw new Error('Choose a worksheet difficulty.');
                const { PUZZLES } = await loadBank();
                const pool = PUZZLES[difficulty].map((item, i) => ({ puzzle: item.puzzle, title: `${DIFFICULTY_LABELS[difficulty]} · Level ${i + 1}` }));
                planWorksheet({ ...options, bankSize: pool.length });
                if (order === 'random') {
                    for (let i = pool.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [pool[i], pool[j]] = [pool[j], pool[i]];
                    }
                    puzzles = pool.slice(0, count);
                } else {
                    puzzles = pool.slice(start - 1, start - 1 + count);
                }
            } else {
                puzzles = [{ puzzle: exportBoard(), title: exportOverride ? exportOverride.title : mode === 'play' && currentPuzzle ? `${puzzleIdentity()} · ${exportSource.value === 'original' ? 'Original puzzle' : 'Current position'}` : 'Custom puzzle' }];
            }
            if (answers) for (const item of puzzles) {
                if (SudokuSolver.countSolutions(item.puzzle, 2) !== 1) throw new Error('Answer pages need a uniquely solvable grid. Use the original puzzle or omit answers.');
                item.solution = SudokuSolver.solveSudoku(item.puzzle).solution;
            }
            renderWorksheet(document.getElementById('print-area'), puzzles, { perPage, answers });
            window.print();
            exportHint.textContent = 'Print dialog opened. You can print or save a PDF there.';
        } catch (error) {
            exportHint.textContent = error.message || 'Could not prepare the worksheet.';
        } finally { printingWorksheet = false; updatePrintOptions(); }
    }

    // ══════════════════════════════════════════════════════════════════
    //  PLAY MODE
    // ══════════════════════════════════════════════════════════════════

    function updateProgressionUi() {
        if (!progressionItems) return;
        const position = progressionPosition(progressionItems, store.getProgression()['9']);
        document.getElementById('progression-status').textContent = `${position.completed} of ${position.total} completed. ` +
            (position.next ? `Next: ${DIFFICULTY_LABELS[position.next.difficulty]} #${position.next.level}. Start when you are ready; other games do not advance this path.` : 'Path complete! You can replay any puzzle using its difficulty and level.');
        document.getElementById('btn-progression').disabled = !position.next;
        document.getElementById('btn-win-next').disabled = !position.next;
    }

    async function continueProgression() {
        if (currentProgression && gameActive && !completion) {
            if (timerPaused) setPaused(false);
            setStatus(`Continue: ${puzzleIdentity()}`);
            return;
        }
        const saved = store.loadSavedGame();
        if (saved?.progression && !saved.completion) { resumeGame(saved); return; }
        dialogs.close(winOverlay);
        return startGame(undefined, { progression: true });
    }

    function startGame(difficulty, { daily = null, random = false, progression = false } = {}) {
        let targetDifficulty = difficulty || selectedDifficulty;
        if (!isDifficulty(targetDifficulty) || mode !== 'play') return;
        let reqLevel = random ? NaN : (levelInput ? parseInt(levelInput.value, 10) : NaN);
        const request = ++gameRequest;
        gameLoading = true;
        setStatus('Loading puzzle...');

        // Awaiting the bank also yields to the event loop, so the status above
        // paints before the solver runs.
        return loadBank().then(({ PUZZLES, ALL_PUZZLES, DAILY_PUZZLES = PUZZLES }) => {
            if (request !== gameRequest || mode !== 'play') return;
            progressionItems = ALL_PUZZLES;
            updateProgressionUi();
            if (progression) {
                const { next } = progressionPosition(ALL_PUZZLES, store.getProgression()['9']);
                if (!next) { setStatus('Progression complete — every challenge finished!', 'success'); return; }
                targetDifficulty = next.difficulty;
                reqLevel = next.level;
                selectDifficulty(targetDifficulty);
            }
            let puzzle, solution;

            // ── PRIMARY: pick from pre-generated bank ────────────────────
            const bankList = PUZZLES[targetDifficulty];
            if (bankList && bankList.length > 0) {
                // Track played puzzles to avoid repeats
                let played = store.getPlayed(targetDifficulty);

                // If all puzzles played, reset the tracking
                if (played.length >= bankList.length) {
                    played = [];
                    store.clearPlayed(targetDifficulty);
                }

                // Check for user-specified level
                let pick;

                // Load specified level if valid
                if (daily) {
                    pick = DAILY_PUZZLES[targetDifficulty][reqLevel - 1];
                } else if (!isNaN(reqLevel) && reqLevel >= 1 && reqLevel <= bankList.length) {
                    pick = bankList[reqLevel - 1];
                } else {
                    // Pick a random unplayed puzzle
                    const unplayed = bankList.filter(p => !played.includes(p.id));
                    pick = unplayed[Math.floor(Math.random() * unplayed.length)];

                    store.markPlayed(targetDifficulty, pick.id);
                }

                puzzle = pick.puzzle;

                // Keep random mode blank; show the chosen board in the status.
                const actualIndex = bankList.findIndex(p => p.id === pick.id);
                currentLevel = actualIndex !== -1 ? actualIndex + 1 : null;
                if (levelInput) levelInput.value = Number.isNaN(reqLevel) ? '' : String(currentLevel);

                // Solve to get solution
                const solveResult = SudokuSolver.solveSudoku(puzzle);
                solution = solveResult.solution;
            }

            // ── FALLBACK: generator (Easy–Evil only, never Nightmare) ────
            // A generated puzzle has no bank level, so scores carry none.
            if (!puzzle && targetDifficulty !== 'nightmare') {
                currentLevel = null;
                try {
                    const result = SudokuGenerator.generate(targetDifficulty);
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

            currentDifficulty = targetDifficulty;
            currentProgression = progression;
            currentDaily = daily;
            document.querySelector('.resume-banner')?.remove();
            if (winTimeout) clearTimeout(winTimeout);
            hintsUsed = 0;
            mistakes = 0;
            handedOff = false;
            // Each game opts into auto-notes itself. Carrying the mode over from
            // the last game marked the new one as assisted before a single move,
            // which mostly caught players who forgot it was on.
            if (autoNotes) setAutoNotes(false, { record: false });
            autoNotesUsed = false;
            completion = null;
            gameWon = false;
            undoStack.length = 0;
            redoStack.length = 0;
            setNotesMode(false);

            clearHintNudge();

            resetCheckButton();
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
                ? `Daily puzzle — ${formatDay(currentDaily)} · ${label} #${currentLevel}`
                : `${currentProgression ? 'Progression · ' : ''}${label}${currentLevel ? ` #${currentLevel}` : ''} — ${clueCount} clues`);

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
            if (request === gameRequest) setStatus('Could not load puzzles — try again', 'error');
        }).finally(() => {
            if (request === gameRequest) gameLoading = false;
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
        const board = mode === 'play' && currentPuzzle ? currentPuzzle : readGrid();
        let link;

        if (mode === 'play' && currentLevel) {
            link = bankLink(window.location.href, currentDifficulty, currentLevel, puzzleId(currentPuzzle));
        } else if (board !== '0'.repeat(81)) {
            link = puzzleLink(window.location.href, board, { play: mode === 'play' && currentDifficulty === 'imported' });
        } else {
            setStatus('Nothing to share yet', 'error');
            return;
        }

        if (await copyToClipboard(link)) {
            setStatus('Link copied to clipboard', 'success');
            return;
        }

        // No clipboard on file:// or an insecure origin, so show the link.
        showLinkDialog(link, { title: 'Share this puzzle', hint: 'Copy the link below.' });
    }

    function showLinkDialog(link, { title, hint }) {
        pendingHandoff = null;
        handoffConfirm.style.display = 'none';
        if (!shareText || !shareOverlay) return;
        if (shareTitle) shareTitle.textContent = title;
        if (shareHint) shareHint.textContent = hint;
        shareText.value = link;
        dialogs.open(shareOverlay, { initialFocus: shareText });
        shareText.select();
    }

    /**
     * Pick up a game handed over from another device. The solution is derived
     * here rather than trusted from the link, and the link is then cleared from
     * the address bar so a reload continues the live game, not the snapshot.
     */
    function applyGameLink(state) {
        const { solution } = SudokuSolver.solveSudoku(state.puzzle);
        if (!solution) {
            setStatus('That link does not hold a valid puzzle', 'error');
            return;
        }
        resumeGame({ ...state, solution });
        saveGame();
        setStatus(`Continued from your other device — ${formatTime(timerSeconds)}`);
        window.history.replaceState(null, '', window.location.pathname);
    }

    /**
     * Act on a puzzle named in the URL. Applied after the initial switchMode so
     * a raw-board link can land in solver mode without being switched back.
     */
    async function applySharedPuzzle(shared) {
        if (!shared) return;

        if (shared.kind === 'outdated' || shared.kind === 'unavailable') {
            setStatus(shared.kind === 'outdated' ? 'The puzzle bank has changed. Choose a new level or import the original grid.' : 'That puzzle link is unavailable.', 'error');
            return;
        }
        if (shared.kind === 'identity') {
            const request = gameRequest;
            try {
                const { ALL_PUZZLES } = await loadBank();
                if (request !== gameRequest || mode !== 'play') return;
                const match = ALL_PUZZLES.find(p => p.id === shared.id);
                if (!match) { setStatus('That puzzle is not in this bank.', 'error'); return; }
                shared = { kind: 'bank', difficulty: match.difficulty, level: match.level };
            } catch { setStatus('Could not load puzzles — try again', 'error'); return; }
        }
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
        if (shared.play) {
            const before = gameRequest;
            if (await startImportedPuzzle(shared.puzzle)) {
                window.history.replaceState(null, '', window.location.pathname);
                return;
            }
            // A newer user action must not be replaced by this old link's fallback.
            if (gameRequest !== before + 1) return;
        }
        // Legacy raw-board links and ambiguous boards remain available in Solver.
        switchMode('solver');
        writeGrid(shared.puzzle, true);
        setStatus('Puzzle loaded from link');
    }

    function resetGame() {
        if (!currentPuzzle || gameLoading) return;
        if (completion) store.recordStart(currentDifficulty);
        completion = null;
        gameActive = true;
        if (winTimeout) clearTimeout(winTimeout);
        dialogs.close(winOverlay);
        gameWon = false;
        hintsUsed = 0;
        mistakes = 0;
        handedOff = false;
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
        resetCheckButton();
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
    function findHintCell(board) {
        const trustworthy = (idx, digit) => digit === currentSolution[idx];

        // A correct output digit alone cannot validate reasoning based on a
        // mistaken entry. Offer an explicit correction instead of a false proof.
        const wrong = [...board].findIndex((digit, idx) => digit !== '0' && !trustworthy(idx, digit));
        if (wrong !== -1) return {
            idx: wrong,
            digit: currentSolution[wrong],
            reason: 'verified answer correcting an earlier entry',
            answerBased: true,
            nudge: 'An earlier entry prevents reliable reasoning. The highlighted cell can be corrected from the verified answer.',
            evidence: [],
        };

        const visible = candidateGrid(board);
        const step = findNakedSingle(visible) || findHiddenSingle(visible);
        if (step && trustworthy(step.idx, step.digit)) return step;

        // Nothing the technique engine knows can crack this position, so fall
        // back to the most constrained cell. Duller, but always available.
        const grid = candidateGrid(board);
        let best = null;
        for (let idx = 0; idx < 81; idx++) {
            if (!grid[idx]) continue;
            if (!best || grid[idx].size < best.size) best = { idx, size: grid[idx].size, set: grid[idx] };
        }
        if (!best) return null;

        return {
            idx: best.idx,
            digit: currentSolution[best.idx],
            reason: 'verified answer; no supported deduction found',
            answerBased: true,
            nudge: `${cellName(best.idx)} is down to ${[...best.set].sort().join(', ')} — `
                + 'the most constrained cell on the board. No supported deduction was found; revealing uses the verified answer.',
            evidence: peersOf(best.idx).filter((i) => board[i] !== '0'),
        };
    }

    /**
     * A hint asked for but not yet revealed. The first press explains and
     * highlights; the second fills it in. Cleared by any board change, since
     * the deduction may no longer hold.
     */
    let pendingHint = null;
    let hintContinuation = null;
    let hintRevision = 0;
    let hintWorking = false;
    const hintAnalysis = createAnalysisClient();
    const hintDetails = document.getElementById('hint-details');
    const hintSteps = document.getElementById('hint-steps');

    function clearHintNudge() {
        ++hintRevision;
        hintAnalysis.cancel();
        hintContinuation = null;
        hintWorking = false;
        btnHint.removeAttribute('aria-busy');
        btnHint.textContent = 'Hint (free)';
        hintDetails.hidden = true;
        hintSteps.replaceChildren();
        if (!pendingHint) return;
        for (const i of pendingHint.evidence) wrappers[i].classList.remove('hint-evidence');
        wrappers[pendingHint.idx].classList.remove('hint-target');
        gridEl.classList.remove('hint-explaining');
        pendingHint = null;
        if (btnHint) {
            btnHint.textContent = 'Hint (free)';
            btnHint.title = 'Preview an explanation or answer offer for free (H)';
        }
    }

    /** Show the reasoning without filling anything in. Costs nothing. */
    function showHintNudge(candidate) {
        clearHintNudge();
        resetCheckButton();
        pendingHint = candidate;

        gridEl.classList.add('hint-explaining');
        wrappers[candidate.idx].classList.add('hint-target');
        for (const i of candidate.evidence) wrappers[i].classList.add('hint-evidence');

        if (btnHint) {
            btnHint.textContent = 'Reveal (+1 hint)';
            btnHint.title = 'Fill the highlighted cell; adds one hint to this game (H)';
        }
        if (candidate.trace?.length) {
            hintDetails.hidden = false;
            hintDetails.open = false;
            for (const step of candidate.trace) {
                const li = document.createElement('li');
                const description = document.createElement('p');
                description.textContent = step.nudge || step.reason;
                li.append(description);
                const map = document.createElement('details');
                const mapLabel = document.createElement('summary');
                mapLabel.textContent = 'Candidate map';
                map.append(mapLabel);
                map.addEventListener('toggle', () => {
                    if (map.open && !map.querySelector('figure')) map.append(createHintDiagram(step, document));
                });
                li.append(map);
                if (step.removals) {
                    const removals = document.createElement('p');
                    removals.textContent = 'Exclude: ' + step.removals.map(({ cell, digit }) => `${digit} from ${cellName(cell)}`).join('; ') + '.';
                    li.append(removals);
                }
                if (step.proof) {
                    const branches = step.proof.branches || [step.proof];
                    for (const [index, branch] of branches.entries()) {
                        const details = document.createElement('details');
                        const summary = document.createElement('summary');
                        summary.textContent = branches.length > 1 ? `Alternative ${index + 1}: ${branch.nodes.length} implications` : `${branch.nodes.length} chain implications`;
                        details.append(summary);
                        const links = document.createElement('ol');
                        const indices = new Map(branch.nodes.map((node, i) => [node.id, i + 1]));
                        for (const node of branch.nodes) {
                            const link = document.createElement('li');
                            const parents = node.parents || (node.parent === null ? [] : [node.parent]);
                            const prefix = node.cause === 'assumption' ? 'Assume: ' : parents.length ? `From ${parents.map(id => indices.get(id)).join(', ')}: ` : 'From the candidates: ';
                            link.textContent = `${prefix}${cellName(node.cell)} ${node.on ? 'is' : 'is not'} ${node.digit} (${node.cause.replaceAll('-', ' ')}).`;
                            links.append(link);
                        }
                        details.append(links);
                        li.append(details);
                    }
                }
                hintSteps.append(li);
            }
        }
        const kind = candidate.answerBased ? 'Answer preview' : 'Explained hint';
        setStatus(`${kind} — free. ${candidate.nudge} Press again to reveal (+1 hint).`);
    }

    async function giveHint() {
        if (isPlayBlocked()) return;
        if (!gameActive || !currentSolution || gameWon) return;
        if (hintWorking) { clearHintNudge(); setStatus('Hint search cancelled. No hint used.'); return; }

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
            const { idx, reason, continuation } = pendingHint;
            clearHintNudge();
            resetCheckButton();
            revealHint(idx, reason);
            if (continuation?.board === readGrid()) hintContinuation = continuation;
            return;
        }
        const continuation = hintContinuation;
        clearHintNudge();
        resetCheckButton();

        // lastTouchedIdx is the touch fallback — selection there is visual and
        // survives blur. On desktop a blurred cell means nothing is selected,
        // so honouring it would make the hint ignore its own deduction.
        const selected = focusedIdx >= 0
            ? focusedIdx
            : (isTouchDevice ? lastTouchedIdx : -1);

        const board = readGrid();
        let found = findHintCell(board);
        // Simple singles share the same detectors as the full engine. Larger
        // proofs run off the UI thread; an earlier wrong entry always wins.
        if ((!found || found.answerBased && !found.reason.includes('correcting')) || continuation) {
            const revision = hintRevision;
            hintWorking = true;
            btnHint.textContent = 'Cancel hint search';
            btnHint.setAttribute('aria-busy', 'true');
            setStatus('Looking for an explained hint… No hint used.');
            try {
                const path = await hintAnalysis.request('hint', { puzzle: board, continuation }, { timeoutMs: 12000 });
                if (revision !== hintRevision || readGrid() !== board || isPlayBlocked()) return;
                const step = path.trace.at(-1);
                const sound = path.trace.every(item => item.kind === 'placement' ? item.digit === currentSolution[item.idx]
                    : item.removals.every(({ cell, digit }) => digit !== currentSolution[cell]));
                if (path.status === 'placement' && step && sound) found = { ...step, trace: path.trace,
                    continuation: path.continuation, evidence: [...new Set(path.trace.flatMap(item => item.evidence))],
                    nudge: path.trace.length > 1 ? `${path.trace.length} deductions lead to ${cellName(step.idx)}. Open the explanation to follow the candidate exclusions.` : step.nudge };
            } catch (error) {
                if (revision !== hintRevision || error.name === 'AbortError') return;
                // A worker limit/failure still permits an explicitly labelled answer offer.
                if (found) found = { ...found, nudge: `The explanation search could not finish. ${found.nudge}` };
            }
            if (revision !== hintRevision || readGrid() !== board || isPlayBlocked()) return;
            hintWorking = false;
            btnHint.removeAttribute('aria-busy');
        }
        // A selected cell still gets a free preview before an answer is filled.
        // Use the explanation if it targets that cell; otherwise label the offer.
        if (selected >= 0 && fixable.includes(selected)) {
            showHintNudge(found?.idx === selected ? found : {
                idx: selected, evidence: [], answerBased: true,
                reason: 'verified answer for the selected cell',
                nudge: `${cellName(selected)}: this offers the verified answer for your selected cell, without a deduction explanation.`,
            });
            return;
        }

        if (found) {
            showHintNudge(found);
            return;
        }

        // Deduction is unreliable, which means something on the board is wrong;
        // fall back to any cell that still needs fixing.
        const idx = fixable[0];
        showHintNudge({ idx, evidence: [], answerBased: true, reason: 'verified answer',
            nudge: `${cellName(idx)}: no supported deduction was found. Revealing uses the verified answer.` });
    }

    /** Fill in a hinted cell. This is the step that counts against you. */
    function revealHint(hintIdx, reason) {
        const prevVal = inputs[hintIdx].value;
        const prevNotes = new Set(cellNotes[hintIdx]);

        inputs[hintIdx].value = currentSolution[hintIdx];
        clearCellNotes(hintIdx);
        const peerNotes = clearPeerNotes(hintIdx, currentSolution[hintIdx]);
        const hint = { wasHint: wrappers[hintIdx].classList.contains('hint'), wasLocked: wrappers[hintIdx].classList.contains('locked') };
        wrappers[hintIdx].classList.remove('user-error', 'correct-check', 'conflict');
        wrappers[hintIdx].classList.add('hint', 'hint-anim', 'locked');
        inputs[hintIdx].readOnly = true;
        hintsUsed++;

        pushUndo(hintIdx, prevVal, currentSolution[hintIdx], prevNotes, new Set(), peerNotes, hint);

        const because = reason ? ` — ${reason}` : '';
        setStatus(`Hint: ${cellName(hintIdx)}${because} (${hintsUsed} used)`);

        recheckAllConflicts();
        refreshAutoNotes();
        checkWin();
        debounceSave();
    }

    // ── Error Checking ─────────────────────────────────────────────────

    /** A placed digit that disagrees with the solution. Erasing is never one. */
    function noteMistake(idx, val) {
        if (val && currentSolution && val !== currentSolution[idx]) mistakes++;
    }

    /** Back to a plain Check; runs on every board change. */
    function resetCheckButton() {
        if (!errorsMarked) return;
        errorsMarked = false;
        btnCheck.textContent = 'Check';
    }

    /**
     * Check reveals which entries are wrong; pressing it again erases exactly
     * those, leaving every correct entry and note in place. It tells the
     * player nothing Check did not already show, so it is free — and each
     * cell is its own undo step, so nothing is lost.
     */
    function clearErrors() {
        if (isPlayBlocked()) return;
        if (!gameActive || gameWon) return;

        let cleared = 0;
        for (let i = 0; i < 81; i++) {
            if (!wrappers[i].classList.contains('user-error')) continue;
            pushUndo(i, inputs[i].value, '', new Set(cellNotes[i]), new Set(cellNotes[i]));
            inputs[i].value = '';
            clearConflictStyle(i);
            wrappers[i].classList.remove('user-error');
            cleared++;
        }
        for (let i = 0; i < 81; i++) wrappers[i].classList.remove('correct-check');

        recheckAllConflicts();
        updateNumpadCompletion();
        refreshAutoNotes();
        clearHintNudge();
        resetCheckButton();
        updateDigitHighlight();
        debounceSave();
        setStatus(`Cleared ${cleared} wrong ${cleared === 1 ? 'entry' : 'entries'}`, 'success');
    }

    function onCheckPressed() {
        if (errorsMarked) clearErrors();
        else checkErrors();
    }

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
            setStatus(`${errorCount} error${errorCount > 1 ? 's' : ''} found — press Check again to clear ${errorCount > 1 ? 'them' : 'it'}`, 'error');
            errorsMarked = true;
            btnCheck.textContent = 'Clear errors';
            gridEl.classList.add('shake');
            setTimeout(() => gridEl.classList.remove('shake'), 300);
        } else if (filledCount > 0) {
            setStatus('No errors — keep going!', 'success');
        } else {
            setStatus('Fill in some cells first');
        }
    }

    function puzzleIdentity() {
        if (currentDifficulty === 'imported') return 'Imported puzzle';
        const label = GAME_LABELS[currentDifficulty];
        return `${currentProgression ? 'Progression · ' : ''}${label}${currentLevel ? ` · Level ${currentLevel}` : ' · Generated puzzle'}${currentDaily ? ` · Daily ${currentDaily}` : ''}`;
    }

    function renderCompletion() {
        if (!completion) return;
        document.getElementById('btn-win-next').hidden = !currentProgression;
        updateProgressionUi();
        document.getElementById('win-puzzle').textContent = puzzleIdentity();
        const clues = [...currentPuzzle].filter(digit => digit !== '0').length;
        const hintText = completion.hints ? `${completion.hints} hint${completion.hints === 1 ? '' : 's'} used` : 'No hints used';
        const mistakeText = completion.mistakes ? `${completion.mistakes} mistake${completion.mistakes === 1 ? '' : 's'}` : 'no mistakes';
        winDetails.textContent = `Time: ${formatTime(completion.time)} — ${hintText} — ${mistakeText} — ${clues} clues — ${completion.autoNotes ? 'generated notes used' : 'no generated notes'}`;
        document.getElementById('win-review-hint').textContent = 'Review or undo freely. Your original completion time and statistics stay recorded.';
        if (btnWinSubmit) {
            if (winSubmit) winSubmit.style.display = leaderboard.isAvailable() && isDifficulty(currentDifficulty) ? 'flex' : 'none';
            btnWinSubmit.disabled = completion.submitted;
            btnWinSubmit.textContent = completion.submitted ? 'Score submitted' : 'Submit Score';
        }
    }

    function reopenCompletedGame() {
        if (!completion) return;
        if (winTimeout) clearTimeout(winTimeout);
        dialogs.close(winOverlay);
        if (!gameWon) return;
        gameWon = false;
        gameActive = true;
        for (const wrapper of wrappers) wrapper.classList.remove('win-anim');
        setStatus('Reviewing completed puzzle — original result kept');
        refreshLayout();
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

            const firstCompletion = !completion;
            if (firstCompletion) completion = { time: timerSeconds, hints: hintsUsed, mistakes, autoNotes: autoNotesUsed, submitted: false };
            if (currentProgression && firstCompletion) store.recordProgression('9', puzzleId(currentPuzzle));
            renderCompletion();
            refreshLayout();

            winTimeout = setTimeout(() => { if (gameWon && mode === 'play') dialogs.open(winOverlay); }, 600);
            setStatus('Puzzle complete!', 'success');

            // Update stats
            if (firstCompletion) store.recordWin(currentDifficulty, timerSeconds, hintsUsed, autoNotesUsed, new Date(), mistakes);
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

    /** Lay the pause panel over the grid's box; the card also holds controls. */
    function positionPausePanel() {
        if (!pausePanel || pausePanel.hidden) return;
        pausePanel.style.top = `${gridEl.offsetTop}px`;
        pausePanel.style.left = `${gridEl.offsetLeft}px`;
        pausePanel.style.width = `${gridEl.offsetWidth}px`;
        pausePanel.style.height = `${gridEl.offsetHeight}px`;
    }

    function setPaused(paused) {
        if (!gameActive || gameWon || paused === timerPaused) return;
        timerPaused = paused;
        gameTimerEl.classList.toggle('paused', paused);
        gridEl.classList.toggle('paused', paused);
        if (btnPause) btnPause.textContent = paused ? 'Resume' : 'Pause';
        if (pausePanel) {
            pausePanel.hidden = !paused;
            positionPausePanel();
        }
        if (paused) {
            // Time stops accruing; the interval keeps running but renders the
            // frozen total.
            suspendTimer();
            setStatus('Paused');
        } else {
            timerSegmentStart = completion ? 0 : Date.now();
            setStatus('');
        }
    }

    function togglePause() {
        setPaused(!timerPaused);
    }

    /**
     * Move this game to another device.
     *
     * The link carries the entire save state, so nothing needs an account or a
     * server. The game pauses here first — the clock should not run on while
     * the player walks to the other device — and stops saving, so the next
     * launch here does not offer a game that was finished somewhere else. The
     * board stays on screen: playing on regardless is allowed, and the first
     * move made here resumes saving.
     */
    async function handOffGame() {
        if (!gameActive || gameWon || gameLoading || completion) return;
        setPaused(true);
        saveGame();
        const snapshot = buildSaveState();
        const request = gameRequest;
        let link;
        try {
            link = gameLink(window.location.href, snapshot);
            if (!parseGameLink(new URL(link).search)) throw new Error('Invalid game link');
        } catch (e) {
            setStatus('Could not create a continuation link. Your game is still saved here.', 'error');
            return;
        }
        const finish = () => {
            if (request !== gameRequest || !timerPaused || readGrid() !== snapshot.userValues) return;
            handedOff = true;
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = null;
            store.deleteSavedGame();
            pendingHandoff = null;
            handoffConfirm.style.display = 'none';
            setStatus('Link ready — open it on the other device. Progress does not sync.', 'success');
        };
        if (await copyToClipboard(link)) {
            finish();
            return;
        }
        if (request !== gameRequest || !timerPaused) return;
        showLinkDialog(link, {
            title: 'Continue on another device',
            hint: 'Copy this snapshot link, then confirm below. Until then your game stays saved here. Progress does not sync.',
        });
        pendingHandoff = finish;
        handoffConfirm.style.display = '';
    }

    // ══════════════════════════════════════════════════════════════════
    //  localStorage SAVE / RESUME
    // ══════════════════════════════════════════════════════════════════

    function debounceSave() {
        // A move made here after a hand-off means the player kept this copy.
        handedOff = false;
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveGame, 2000);
    }

    /** Everything needed to pick this game up again, here or elsewhere. */
    function buildSaveState() {
        return {
            puzzle: currentPuzzle,
            solution: currentSolution,
            difficulty: currentDifficulty,
            userValues: readGrid(),
            notes: cellNotes.map(s => [...s]),
            timerSeconds: elapsedSeconds(),
            hintsUsed,
            mistakes,
            level: currentLevel,
            daily: currentDaily,
            progression: currentProgression,
            autoNotes,
            autoNotesUsed,
            completion,
            lockedCells: Array.from({ length: 81 }, (_, i) => wrappers[i].classList.contains('locked')),
            hintCells: Array.from({ length: 81 }, (_, i) => wrappers[i].classList.contains('hint')),
            timestamp: Date.now(),
        };
    }

    function saveGame() {
        if (!gameActive || !currentPuzzle || gameWon || handedOff) return;
        const state = buildSaveState();

        store.saveGameState(state);
    }

    function resumeGame(state) {
        const request = ++gameRequest;
        gameLoading = false;
        handedOff = false;
        clearHintNudge();
        resetCheckButton();
        if (winTimeout) clearTimeout(winTimeout);
        if (autoNotes) setAutoNotes(false, { record: false });
        completion = state.completion || null;
        currentPuzzle = state.puzzle;
        currentSolution = state.solution;
        currentDifficulty = state.difficulty;
        currentLevel = state.level ?? null;
        currentDaily = state.daily ?? null;
        currentProgression = state.progression === true;
        autoNotesUsed = state.autoNotesUsed || state.autoNotes || false;
        timerSeconds = state.timerSeconds || 0;
        hintsUsed = state.hintsUsed || 0;
        mistakes = state.mistakes || 0;
        gameWon = false;
        undoStack.length = 0;
        redoStack.length = 0;
        setNotesMode(false);

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
        if (completion) stopTimer();

        recheckAllConflicts();
        updateNumpadCompletion();

        if (state.autoNotes) {
            setAutoNotes(true, { record: false });
        }
        // setAutoNotes stamps the flag; the saved value is the truth.
        autoNotesUsed = state.autoNotesUsed || state.autoNotes || false;

        refreshLayout();

        setStatus(`Resumed: ${puzzleIdentity()} — ${formatTime(timerSeconds)}`);

        // Remove resume banner if it exists
        const banner = document.querySelector('.resume-banner');
        if (banner) banner.remove();

        // Insertions can move a level while the saved board stays identical.
        // Refresh its display level without making saved-board play depend on
        // a bank download. Score submissions also carry the authoritative ID.
        if (isDifficulty(state.difficulty)) {
            loadBank().then(({ PUZZLES, ALL_PUZZLES }) => {
                if (request !== gameRequest) return;
                progressionItems = ALL_PUZZLES;
                updateProgressionUi();
                const index = PUZZLES[state.difficulty].findIndex(p => p.puzzle === state.puzzle);
                currentLevel = index < 0 ? null : index + 1;
                if (levelInput) levelInput.value = currentLevel ? String(currentLevel) : '';
                setStatus(`Resumed: ${puzzleIdentity()} — ${formatTime(timerSeconds)}`);
                saveGame();
            }).catch(() => {
                if (request === gameRequest) {
                    currentLevel = null;
                    setStatus('Game resumed; bank level could not be loaded.');
                }
            });
        }
    }

    function showResumeBanner(state) {
        const existing = document.querySelector('.resume-banner');
        if (existing) existing.remove();

        const diff = escapeHtml(GAME_LABELS[state.difficulty] || 'Unknown');
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
        const diffs = Object.keys(GAME_LABELS);

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

        html += `<div class="table-scroll"><table class="stats-table">
      <thead><tr><th>Difficulty</th><th>Solved</th><th>Win rate</th><th>Best</th><th>Average</th><th>Hints</th><th>Mistakes</th><th>Auto</th></tr></thead>
      <tbody>`;

        for (const d of diffs) {
            const s = stats[d];
            if (!s || (!s.started && !s.won)) continue;
            const started = s.started || s.won;
            const avg = s.won ? Math.round(s.totalTime / s.won) : 0;
            const rate = started ? Math.round((s.won / started) * 100) : 0;
            html += `<tr>
        <td>${GAME_LABELS[d]}</td>
        <td>${s.won}</td>
        <td>${rate}%</td>
        <td>${s.won ? formatTime(s.bestTime) : '—'}</td>
        <td>${s.won ? formatTime(avg) : '—'}</td>
        <td>${s.totalHints}</td>
        <td>${s.totalMistakes || 0}</td>
        <td>${s.autoNotesGames || 0}</td>
      </tr>`;
        }

        html += '</tbody></table></div>';
        statsContent.innerHTML = html;
    }

    function openStats() {
        document.getElementById('backup-status').textContent = '';
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
        clearHintNudge();
        gameRequest++;
        gameLoading = false;
        if (winTimeout) clearTimeout(winTimeout);

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
        currentProgression = false;
        currentSolution = null;
        completion = null;
        setNotesMode(false);

        tabSolver.classList.toggle('active', mode === 'solver');
        tabPlay.classList.toggle('active', mode === 'play');
        tabPlay.setAttribute('aria-pressed', String(mode === 'play'));
        tabSolver.setAttribute('aria-pressed', String(mode === 'solver'));
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
            subtitleEl.textContent = '';
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
        if (!isDifficulty(diff)) return;
        selectedDifficulty = diff;
        if (!currentPuzzle) currentDifficulty = diff;
        diffSelector.querySelectorAll('.diff-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.diff === diff);
            btn.setAttribute('aria-pressed', String(btn.dataset.diff === diff));
        });

        if (levelInput && levelMaxDisplay) {
            const max = BANK_SIZES[diff] || 500;
            levelInput.max = max;
            levelInput.title = `Enter 1–${max}, or leave blank for a random level`;
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
        if (document.body.classList.contains('small-board-active')) return;
        const formField = e.target.closest?.('input:not(.cell-input), textarea, select, [contenteditable="true"]');
        if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && !e.isComposing && e.key.toLowerCase() === 'i' && !formField && !dialogs.isOpen()) {
            e.preventDefault();
            openModal();
        }
    });

    const shortcuts = document.querySelector('.shortcuts');
    shortcuts.open = store.getShortcutsOpen(!isTouchDevice);
    let shortcutsWereOpen = shortcuts.open;
    const renderShortcutSummary = () => { shortcuts.querySelector('summary').textContent = `${shortcuts.open ? 'Hide' : 'Show'} keyboard shortcuts`; };
    renderShortcutSummary();
    shortcuts.addEventListener('toggle', () => {
        if (shortcuts.open === shortcutsWereOpen) return;
        renderShortcutSummary();
        store.setShortcutsOpen(shortcuts.open);
        shortcutsWereOpen = shortcuts.open;
        scheduleFit();
    });

    // ══════════════════════════════════════════════════════════════════
    //  EVENT LISTENERS
    // ══════════════════════════════════════════════════════════════════

    let smallApp = null, sizeRequest = 0;
    const boardSize = document.getElementById('board-size');
    const boardRule = document.getElementById('board-rule');
    async function changeBoardSize(size, linkedPuzzle = null, rule = boardRule.value) {
        const request = ++sizeRequest;
        if (size !== '9') rule = 'classic';
        boardRule.value = rule;
        document.getElementById('board-rules-control').hidden = size !== '9';
        if (size === '9' && rule === 'classic') {
            smallApp?.deactivate();
            document.body.classList.remove('small-board-active');
            document.getElementById('small-app').hidden = true;
            scheduleFit(); return;
        }
        if (gameActive) { setPaused(true); saveGame(); }
        clearHintNudge();
        try {
            const { createSmallApp } = await import('./small-app.js');
            if (request !== sizeRequest) return;
            smallApp ||= createSmallApp(document.getElementById('small-app'));
            document.body.classList.add('small-board-active');
            document.getElementById('small-app').hidden = false;
            document.getElementById('board-rules-control').hidden = size !== '9';
            smallApp.activate(size, linkedPuzzle, rule);
        } catch (error) {
            boardSize.value = '9'; boardRule.value = 'classic';
            smallApp?.deactivate(); document.body.classList.remove('small-board-active');
            document.getElementById('small-app').hidden = true;
            document.getElementById('board-rules-control').hidden = false;
            setStatus(`Board could not load: ${error.message}`);
        }
    }
    boardSize.addEventListener('change', () => changeBoardSize(boardSize.value));
    boardRule.addEventListener('change', () => changeBoardSize(boardSize.value));
    const sizeParams = new URLSearchParams(location.search);
    const linkedSize = sizeParams.get('size');
    const linkedRule = sizeParams.get('rule') || 'classic';
    const linkedBoard = sizeParams.get('p');
    const sizedLinkRequested = sizeParams.has('size') || sizeParams.has('rule');
    const validSizedLink = (['4', '6'].includes(linkedSize) && linkedRule === 'classic'
        || linkedSize === '9' && ['diagonal', 'hyper'].includes(linkedRule))
        && sizeParams.get('box') === (linkedSize === '4' ? '2x2' : linkedSize === '6' ? '2x3' : '3x3')
        && linkedBoard?.length === Number(linkedSize) ** 2
        && [...linkedBoard].every(d => ('0' + '123456789'.slice(0, Number(linkedSize))).includes(d))
        && [...sizeParams.keys()].every(key => sizeParams.getAll(key).length === 1);

    tabSolver.addEventListener('click', () => switchMode('solver'));
    tabPlay.addEventListener('click', () => switchMode('play'));

    btnSolve.addEventListener('click', solve);
    btnExample.addEventListener('click', loadSolverExample);
    btnPaste.addEventListener('click', openModal);
    btnClear.addEventListener('click', clearGrid);

    if (btnExport) btnExport.addEventListener('click', openExportDialog);
    document.getElementById('btn-print').addEventListener('click', printExport);
    document.querySelector('.print-options').addEventListener('input', updatePrintOptions);
    document.querySelector('.print-options').addEventListener('change', updatePrintOptions);
    if (btnPauseExport) btnPauseExport.addEventListener('click', openExportDialog);
    document.getElementById('btn-win-export').addEventListener('click', openExportDialog);
    document.getElementById('btn-win-share').addEventListener('click', async () => {
        dialogs.close(winOverlay);
        await shareCurrentPuzzle();
    });
    document.getElementById('btn-win-review').addEventListener('click', reopenCompletedGame);
    document.getElementById('btn-results').addEventListener('click', () => {
        renderCompletion();
        dialogs.open(winOverlay);
    });
    document.getElementById('btn-fill-notes').addEventListener('click', fillNotesOnce);
    document.getElementById('btn-fill-notes').addEventListener('mousedown', event => event.preventDefault());
    if (exportFormat) exportFormat.addEventListener('change', renderExport);
    if (exportSource) exportSource.addEventListener('change', renderExport);
    if (btnExportCopy) btnExportCopy.addEventListener('click', copyExport);
    if (btnExportClose) btnExportClose.addEventListener('click', () => dialogs.close(exportOverlay));
    if (exportOverlay) {
        exportOverlay.addEventListener('click', (e) => {
            if (e.target === exportOverlay) dialogs.close(exportOverlay);
        });
    }

    btnNewGame.addEventListener('click', () => startGame());
    document.getElementById('btn-random').addEventListener('click', () => startGame(undefined, { random: true }));
    handoffConfirm.addEventListener('click', () => {
        pendingHandoff?.();
        dialogs.close(shareOverlay);
    });
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
    btnCheck.addEventListener('click', onCheckPressed);
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
    if (btnPauseResume) btnPauseResume.addEventListener('click', () => setPaused(false));
    if (btnHandoff) btnHandoff.addEventListener('click', handOffGame);
    if (btnPause) {
        btnPause.addEventListener('click', () => {
            togglePause();
        });
        btnPause.addEventListener('mousedown', (e) => e.preventDefault());
    }
    // Timer click also toggles pause
    gameTimerEl.addEventListener('click', () => {
        if (btnPause) {
            togglePause();
        }
    });
    gameTimerEl.style.cursor = 'pointer';

    // Prevent ALL play buttons from stealing cell focus
    [btnHint, btnCheck, btnUndo, btnRedo, btnReset].forEach(btn => {
        if (btn) btn.addEventListener('mousedown', (e) => e.preventDefault());
    });

    const backupStatus = document.getElementById('backup-status');
    const backupFile = document.getElementById('backup-file');
    document.getElementById('btn-backup').addEventListener('click', () => {
        if (gameActive && !handedOff && !store.saveGameState(buildSaveState())) {
            backupStatus.textContent = 'Could not save your current game. Free some storage and try again.';
            return;
        }
        let json;
        try { json = store.exportBackup(); } catch (e) {
            backupStatus.textContent = e.message;
            return;
        }
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sudoku-backup-${store.dayKey()}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        backupStatus.textContent = 'Backup downloaded. Keep it somewhere safe.';
    });
    document.getElementById('btn-restore').addEventListener('click', () => backupFile.click());
    backupFile.addEventListener('change', async () => {
        const file = backupFile.files?.[0];
        backupFile.value = '';
        if (!file) return;
        if (file.size > 1024 * 1024) {
            backupStatus.textContent = 'That file is too large for a Sudoku backup.';
            return;
        }
        if (!window.confirm('Replace your saved game, statistics and settings with this backup?')) return;
        try {
            const result = store.restoreBackup(await file.text());
            if (!result.success) {
                backupStatus.textContent = result.error || 'Could not restore that backup.';
                return;
            }
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = null;
            gameActive = false;
            stopTimer();
            window.location.reload();
        } catch (e) {
            backupStatus.textContent = 'Could not read that backup file.';
        }
    });

    btnStats.addEventListener('click', openStats);
    btnStatsClose.addEventListener('click', closeStats);
    btnStatsReset.addEventListener('click', resetStats);

    btnWinNew.addEventListener('click', () => {
        dialogs.close(winOverlay);
        startGame(undefined, { random: true });
    });
    document.getElementById('btn-progression').addEventListener('click', continueProgression);
    let practiceLoaded = false;
    document.getElementById('btn-practice').addEventListener('click', async () => {
        if (gameActive) { setPaused(true); saveGame(); }
        const request = gameRequest;
        const boardRequest = sizeRequest;
        try {
            const { createPracticeApp } = await import('./practice-app.js');
            if (request !== gameRequest || boardRequest !== sizeRequest) return;
            if (!practiceLoaded) { createPracticeApp(document.getElementById('practice-content')); practiceLoaded = true; }
            dialogs.open(document.getElementById('practice-overlay'));
        } catch { setStatus('Could not load practice. Try again.', 'error'); }
    });
    document.getElementById('btn-practice-close').addEventListener('click', () => dialogs.close(document.getElementById('practice-overlay')));
    document.getElementById('btn-win-next').addEventListener('click', continueProgression);
    document.getElementById('progression-controls').addEventListener('toggle', async event => {
        refreshLayout();
        if (!event.target.open) return;
        try { progressionItems = (await loadBank()).ALL_PUZZLES; updateProgressionUi(); }
        catch { document.getElementById('progression-status').textContent = 'Could not load progression. Try again.'; }
    });

    diffSelector.addEventListener('click', (e) => {
        if (e.target.classList.contains('diff-btn')) {
            selectDifficulty(e.target.dataset.diff);
        }
    });

    btnModalOk.addEventListener('click', () => doImport());
    document.getElementById('btn-modal-play').addEventListener('click', () => doImport(true));
    document.getElementById('btn-import-play').addEventListener('click', openModal);
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
        const idx = isTouchDevice ? lastTouchedIdx : (focusedIdx >= 0 ? focusedIdx : lastTouchedIdx);
        if (idx < 0) return;
        const isLocked = wrappers[idx].classList.contains('locked');
        if (isLocked) return;
        reopenCompletedGame();

        if (digit === '0') {
            // Erase
            if (mode === 'play' && gameActive) {
                if (cellNotes[idx].size > 0 && !autoNotes) {
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
            refreshAutoNotes();
            clearHintNudge();
            resetCheckButton();
            updateNumpadCompletion();
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
            const peerNotes = clearPeerNotes(idx, digit);
            wrappers[idx].classList.remove('user-error', 'correct-check');
            pushUndo(idx, prevVal, digit, prevNotes, new Set(), peerNotes);
            noteMistake(idx, digit);
            highlightConflicts(idx);
            refreshAutoNotes();
            clearHintNudge();
            resetCheckButton();
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
        themeToggle.setAttribute('aria-expanded', String(themeDropdown.classList.contains('open')));
    });

    themeDropdown.addEventListener('click', (e) => {
        const opt = e.target.closest('.theme-option');
        if (!opt) return;
        e.stopPropagation();
        applyTheme(opt.dataset.theme, { dropdown: themeDropdown });
        themeToggle.setAttribute('aria-expanded', 'false');
        themeDropdown.classList.remove('open');
    });

    // Close dropdown when clicking elsewhere
    document.addEventListener('click', () => {
        themeToggle.setAttribute('aria-expanded', 'false');
        themeDropdown.classList.remove('open');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && themeDropdown.classList.contains('open')) {
            themeDropdown.classList.remove('open');
            themeToggle.setAttribute('aria-expanded', 'false');
            themeToggle.focus();
        }
    });
    window.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => {
        if (!Object.hasOwn(THEME_COLORS, store.getTheme(null))) {
            applyTheme('system', { dropdown: themeDropdown, persist: false });
        }
    });

    // Restore saved theme
    // Restore the saved theme. Persisting is skipped here: reading it back and
    // writing it straight out again would be pointless work on every load.
    // No saved theme resolves to the system scheme inside applyTheme.
    applyTheme(store.getTheme(null), { dropdown: themeDropdown, persist: false });

    // ══════════════════════════════════════════════════════════════════
    //  LEADERBOARD (graceful degradation)
    // ══════════════════════════════════════════════════════════════════

    function renderLeaderboard(entries) {
        if (!lbContent) return;
        if (!entries || entries.length === 0) {
            lbContent.innerHTML = '<p class="lb-empty">No scores yet. Be the first!</p>';
            return;
        }
        let html = `<div class="table-scroll"><table class="lb-table">
            <thead><tr><th>#</th><th>Name</th><th>Time</th><th>Hints</th><th>Mistakes</th><th>Auto</th><th>Date</th></tr></thead>
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
                <td>${e.mistakes == null ? '—' : escapeHtml(String(Number(e.mistakes) || 0))}</td>
                <td>${e.autoNotes ? '✓' : ''}</td>
                <td>${escapeHtml(date)}</td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        lbContent.innerHTML = html;
    }

    let leaderboardRequest = 0;
    async function openLeaderboard(diff) {
        if (!lbOverlay) return;
        const currentLbDiff = diff || (isDifficulty(currentDifficulty) ? currentDifficulty : selectedDifficulty);
        const request = ++leaderboardRequest;
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
        if (request === leaderboardRequest) renderLeaderboard(entries);
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
            const resultSnapshot = completion;
            if (!resultSnapshot || resultSnapshot.submitted || !isDifficulty(currentDifficulty)) return;
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
                time: resultSnapshot.time,
                hints: resultSnapshot.hints,
                mistakes: resultSnapshot.mistakes,
                level: currentLevel,
                puzzleId: currentLevel ? puzzleId(currentPuzzle) : null,
                autoNotes: resultSnapshot.autoNotes,
            });

            if (completion !== resultSnapshot) return;
            if (result?.success) {
                resultSnapshot.submitted = true;
                saveGame();
                btnWinSubmit.textContent = result.rank ? `Rank #${result.rank}!` : 'Submitted — outside top 100';
                // Save name for next time
                store.setPlayerName(name);
            } else {
                btnWinSubmit.textContent = 'Error';
            }
            setTimeout(() => {
                if (completion === resultSnapshot) renderCompletion();
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
        document.getElementById('board-rules-control').hidden = folded;
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
        if (document.body.classList.contains('small-board-active')) return;
        document.getElementById('btn-results').style.display = completion ? '' : 'none';
        if (btnHandoff) btnHandoff.style.display = completion ? 'none' : '';
        const playing = mode === 'play' && gameActive && !gameWon && !setupOpen;

        if (!playing) {
            setSetupFolded(false);
            fitBoardSettled();
            return;
        }

        setSetupFolded(false);
        const open = fitBoardSettled();
        const viewport = window.visualViewport?.height || window.innerHeight;
        const openOverflow = document.body.scrollHeight - viewport;
        if (open.atMax && openOverflow <= 1) return;

        setSetupFolded(true);
        const folded = fitBoardSettled();
        const reducesOverflow = openOverflow > 1 && document.body.scrollHeight - viewport < openOverflow;

        // Only stay folded if it actually bought something. Hiding the
        // difficulty buttons to gain a pixel is a straight loss.
        if (folded.size - open.size < MEANINGFUL_GAIN && !reducesOverflow) {
            setSetupFolded(false);
            fitBoardSettled();
        }
        positionPausePanel();
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
    diffSelector.querySelectorAll('.diff-btn').forEach(btn => btn.setAttribute('aria-pressed', String(btn.classList.contains('active'))));
    updateDailyButton();

    // Parsed before the first switchMode so the resume offer can be suppressed,
    // applied after so a raw-board link can stay in solver mode.
    const gameState = parseGameLink(window.location.search);
    const sharedPuzzle = gameState ? null : parseShareLink(window.location.search);
    sharedPuzzleLoaded = gameState !== null || sharedPuzzle !== null || sizedLinkRequested;

    switchMode('play');
    if (gameState) applyGameLink(gameState);
    else applySharedPuzzle(sharedPuzzle);
    if (sizedLinkRequested) {
        if (validSizedLink) { boardSize.value = linkedSize; changeBoardSize(linkedSize, linkedBoard, linkedRule); }
        else setStatus('This puzzle link has invalid or unsupported board rules.', 'error');
    }
    revealLeaderboardUi();

    // Once the real layout exists, size the board to whatever room is left.
    refreshLayout();
    document.getElementById('app').setAttribute('aria-busy', 'false');
    document.getElementById('loading-status').remove();
    document.body.classList.remove('is-loading');

    // ── Offline support ────────────────────────────────────────────────
    // Registered only over http(s): service workers are unavailable on file://,
    // and the dev server intentionally ships none, so failure here is normal and
    // must never affect gameplay.
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
        let hadController = Boolean(navigator.serviceWorker.controller);
        const updateButton = document.getElementById('btn-update');
        navigator.serviceWorker.addEventListener?.('controllerchange', () => {
            if (hadController) updateButton.style.display = '';
            hadController = true;
        });
        updateButton.addEventListener('click', () => {
            if (gameActive && !handedOff && !store.saveGameState(buildSaveState())) {
                setStatus('Cannot save progress. Free storage before updating.', 'error');
                return;
            }
            window.location.reload();
        });
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register(new URL('sw.js', window.location.href), { scope: './' })
                .catch(() => { /* offline support unavailable; the app still works */ });
        });

        // Look for a new build when the app returns to the foreground.
        //
        // The browser checks for an updated worker on navigation, which is
        // fine in a tab and close to useless in an installed app: there is no
        // address bar and no reload button, and iOS resumes a home-screen app
        // from the app switcher without navigating at all. Left to itself it
        // can sit on the build it was installed with for days.
        //
        // It also pays for the worker's own caution. A document whose assets
        // the active worker does not hold is refused until that build's worker
        // has installed, so picking the new build up quietly in the background
        // is exactly what makes the next launch current rather than one behind.
        //
        // Throttled because visibilitychange fires on every tab switch; the
        // request is a conditional GET of a file that is served no-cache.
        const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
        let lastUpdateCheck = Date.now();

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            if (Date.now() - lastUpdateCheck < UPDATE_CHECK_INTERVAL_MS) return;
            lastUpdateCheck = Date.now();

            const pending = navigator.serviceWorker.getRegistration?.();
            if (pending) {
                pending
                    .then((registration) => registration?.update())
                    .catch(() => { /* nothing to do; checked again next time */ });
            }
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
