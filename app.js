/**
 * Sudoku — UI Controller
 * Solver Mode + Play Mode with pencil marks, undo/redo, digit highlighting,
 * conflict detection, localStorage save/resume, and stats tracking.
 */
(() => {
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
    const btnPause = document.getElementById('btn-pause');
    const diffSelector = document.getElementById('difficulty-selector');
    const levelInput = document.getElementById('level-input');
    const levelMaxDisplay = document.getElementById('level-max');
    const btnStats = document.getElementById('btn-stats');

    const modalOverlay = document.getElementById('modal-overlay');
    const importText = document.getElementById('import-text');
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
    const btnUpdateApp = document.getElementById('btn-update-app');

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
    let hintsUsed = 0;
    let notesMode = false;
    let focusedIdx = -1;
    let lastTouchedIdx = -1; // Persists through blur — used by numpad on mobile

    // Undo/redo
    const undoStack = [];
    const redoStack = [];

    // Save debounce
    let saveTimeout = null;
    let timerPaused = false;

    // Mobile detection
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // Numpad elements
    const numpadEl = document.getElementById('numpad');
    const numpadNotesBtn = document.getElementById('numpad-notes');

    const SOLVER_ALL_PUZZLES = ALL_PUZZLES.slice();

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
                    if (cellNotes[idx].size > 0) {
                        pushUndo(idx, inputs[idx].value, '', new Set(cellNotes[idx]), new Set());
                        clearCellNotes(idx);
                    } else if (inputs[idx].value) {
                        pushUndo(idx, inputs[idx].value, '', new Set(cellNotes[idx]), new Set());
                        inputs[idx].value = '';
                        clearConflictStyle(idx);
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
    }

    function toggleNote(idx, digit) {
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
        if (undoStack.length === 0 || !gameActive) return;
        const action = undoStack.pop();
        redoStack.push(action);

        inputs[action.idx].value = action.prevVal;
        cellNotes[action.idx] = new Set(action.prevNotes);
        renderNotes(action.idx);
        wrappers[action.idx].classList.remove('user-error', 'correct-check');
        recheckAllConflicts();
        updateNumpadCompletion();

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
        if (redoStack.length === 0 || !gameActive) return;
        const action = redoStack.pop();
        undoStack.push(action);

        inputs[action.idx].value = action.newVal;
        cellNotes[action.idx] = new Set(action.newNotes);
        renderNotes(action.idx);
        wrappers[action.idx].classList.remove('user-error', 'correct-check');
        recheckAllConflicts();
        updateNumpadCompletion();

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
            inputs[i].readOnly = false;
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
            inputs[i].readOnly = false;
            clearCellNotes(i);
        }
        solved = false;
        solveTimeEl.textContent = '';
        solveTimeEl.classList.remove('visible');
        setStatus('Click a cell and type a digit');
        inputs[0].focus();
    }

    function loadSolverExample() {
        const p = SOLVER_ALL_PUZZLES[solverExampleIdx];
        const diff = DIFFICULTY_LABELS[p.difficulty] || p.difficulty;
        writeGrid(p.puzzle, true);
        solved = false;
        solveTimeEl.textContent = '';
        solveTimeEl.classList.remove('visible');
        setStatus(`Loaded: ${diff} (${p.id})`);
        solverExampleIdx = (solverExampleIdx + 1) % SOLVER_ALL_PUZZLES.length;
    }

    // ── Import Modal ───────────────────────────────────────────────────
    function openModal() {
        importText.value = '';
        modalOverlay.classList.add('active');
        setTimeout(() => importText.focus(), 100);
    }

    function closeModal() { modalOverlay.classList.remove('active'); }

    function doImport() {
        const raw = importText.value.trim();
        const digits = raw.replace(/[^0-9.]/g, '');
        if (digits.length !== 81) {
            importText.style.borderColor = 'var(--danger)';
            setTimeout(() => importText.style.borderColor = '', 1500);
            return;
        }
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

    function startGame(difficulty) {
        currentDifficulty = difficulty || currentDifficulty;
        hintsUsed = 0;
        gameWon = false;
        undoStack.length = 0;
        redoStack.length = 0;
        notesMode = false;
        btnNotesToggle.textContent = 'Notes: OFF';
        btnNotesToggle.classList.remove('notes-active');

        setStatus('Loading puzzle...');

        // Use setTimeout to let the UI update
        setTimeout(() => {
            let puzzle, solution;

            // ── PRIMARY: pick from pre-generated bank ────────────────────
            const bankList = PUZZLES[currentDifficulty];
            if (bankList && bankList.length > 0) {
                // Track played puzzles to avoid repeats
                const playedKey = `played_${currentDifficulty}`;
                let played = [];
                try { played = JSON.parse(localStorage.getItem(playedKey) || '[]'); } catch (e) { }

                // If all puzzles played, reset the tracking
                if (played.length >= bankList.length) {
                    played = [];
                    localStorage.setItem(playedKey, '[]');
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

                    // Mark as played
                    played.push(pick.id);
                    try { localStorage.setItem(playedKey, JSON.stringify(played)); } catch (e) { }
                }

                puzzle = pick.puzzle;

                // Update level input to show the randomly chosen level
                if (levelInput) {
                    const actualIndex = bankList.findIndex(p => p.id === pick.id);
                    if (actualIndex !== -1) {
                        levelInput.value = actualIndex + 1;
                    }
                }

                // Solve to get solution
                const solveResult = SudokuSolver.solveSudoku(puzzle);
                solution = solveResult.solution;
            }

            // ── FALLBACK: generator (Easy–Evil only, never Nightmare) ────
            if (!puzzle && currentDifficulty !== 'nightmare') {
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
            setStatus(`${label} — ${clueCount} clues`);

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

            deleteSavedGame();
            debounceSave();
            updateNumpadCompletion();
        }, 16);
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
        setStatus('Puzzle reset');
        debounceSave();
        updateNumpadCompletion();
    }

    // ── Hints ──────────────────────────────────────────────────────────
    function giveHint() {
        if (!gameActive || !currentSolution || gameWon) return;

        const emptyCells = [];
        for (let i = 0; i < 81; i++) {
            if (!wrappers[i].classList.contains('locked') && inputs[i].value !== currentSolution[i]) {
                emptyCells.push(i);
            }
        }

        if (emptyCells.length === 0) {
            setStatus('No more hints needed!', 'success');
            return;
        }

        const hintIdx = emptyCells[Math.floor(Math.random() * emptyCells.length)];
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
        setStatus(`Hint revealed (${hintsUsed} hint${hintsUsed > 1 ? 's' : ''} used)`);

        recheckAllConflicts();
        checkWin();
        debounceSave();
    }

    // ── Error Checking ─────────────────────────────────────────────────
    function checkErrors() {
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

            const timeStr = formatTime(timerSeconds);
            const hintStr = hintsUsed > 0 ? `${hintsUsed} hint${hintsUsed > 1 ? 's' : ''} used` : 'No hints used';
            winDetails.textContent = `Time: ${timeStr} — ${hintStr}`;

            setTimeout(() => winOverlay.classList.add('active'), 600);
            setStatus('Puzzle complete!', 'success');

            // Update stats
            updateStats(currentDifficulty, timerSeconds, hintsUsed);
            deleteSavedGame();
        }
    }

    // ── Timer ──────────────────────────────────────────────────────────
    function startTimer() {
        stopTimer();
        timerSeconds = 0;
        timerPaused = false;
        gameTimerEl.textContent = '0:00';
        gameTimerEl.classList.remove('paused');
        timerInterval = setInterval(() => {
            if (!timerPaused) {
                timerSeconds++;
                gameTimerEl.textContent = formatTime(timerSeconds);
            }
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    }

    function togglePause() {
        if (!gameActive || gameWon) return;
        timerPaused = !timerPaused;
        gameTimerEl.classList.toggle('paused', timerPaused);
        if (timerPaused) {
            setStatus('Paused');
            // Optionally hide the grid to prevent cheating
            gridEl.classList.add('paused');
        } else {
            setStatus('');
            gridEl.classList.remove('paused');
        }
    }

    function formatTime(s) {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ══════════════════════════════════════════════════════════════════
    //  localStorage SAVE / RESUME
    // ══════════════════════════════════════════════════════════════════

    const SAVE_KEY = 'sudoku_saved_game';
    const STATS_KEY = 'sudoku_stats';

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
            timerSeconds,
            hintsUsed,
            lockedCells: Array.from({ length: 81 }, (_, i) => wrappers[i].classList.contains('locked')),
            hintCells: Array.from({ length: 81 }, (_, i) => wrappers[i].classList.contains('hint')),
            timestamp: Date.now(),
        };

        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        } catch (e) { /* quota exceeded, ignore */ }
    }

    function loadSavedGame() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) { return null; }
    }

    function deleteSavedGame() {
        localStorage.removeItem(SAVE_KEY);
    }

    function resumeGame(state) {
        currentPuzzle = state.puzzle;
        currentSolution = state.solution;
        currentDifficulty = state.difficulty;
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
            inputs[i].readOnly = false;
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
        gameTimerEl.textContent = formatTime(timerSeconds);

        // Resume timer
        timerInterval = setInterval(() => {
            timerSeconds++;
            gameTimerEl.textContent = formatTime(timerSeconds);
        }, 1000);

        recheckAllConflicts();
        updateNumpadCompletion();

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
        card.appendChild(banner);

        document.getElementById('btn-resume-yes').addEventListener('click', () => {
            resumeGame(state);
        });
        document.getElementById('btn-resume-no').addEventListener('click', () => {
            banner.remove();
            deleteSavedGame();
        });
    }

    // ══════════════════════════════════════════════════════════════════
    //  STATS
    // ══════════════════════════════════════════════════════════════════

    function getStats() {
        try {
            const raw = localStorage.getItem(STATS_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }

    function saveStats(stats) {
        try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) { }
    }

    function updateStats(difficulty, timeSeconds, hints) {
        const stats = getStats();
        if (!stats[difficulty]) {
            stats[difficulty] = { played: 0, won: 0, bestTime: null, totalTime: 0, totalHints: 0 };
        }
        const s = stats[difficulty];
        s.played++;
        s.won++;
        s.totalTime += timeSeconds;
        s.totalHints += hints;
        if (s.bestTime === null || timeSeconds < s.bestTime) {
            s.bestTime = timeSeconds;
        }
        saveStats(stats);
    }

    function renderStats() {
        const stats = getStats();
        const diffs = ['easy', 'medium', 'hard', 'expert', 'evil', 'nightmare'];

        let hasData = false;
        for (const d of diffs) {
            if (stats[d] && stats[d].played > 0) { hasData = true; break; }
        }

        if (!hasData) {
            statsContent.innerHTML = '<p style="text-align:center;color:var(--text-muted);">No games played yet.</p>';
            return;
        }

        let html = `<table class="stats-table">
      <thead><tr><th>Difficulty</th><th>Played</th><th>Best Time</th><th>Avg Time</th><th>Hints</th></tr></thead>
      <tbody>`;

        for (const d of diffs) {
            const s = stats[d];
            if (!s || s.played === 0) continue;
            const avg = Math.round(s.totalTime / s.won);
            html += `<tr>
        <td>${DIFFICULTY_LABELS[d]}</td>
        <td>${s.played}</td>
        <td>${formatTime(s.bestTime)}</td>
        <td>${formatTime(avg)}</td>
        <td>${s.totalHints}</td>
      </tr>`;
        }

        html += '</tbody></table>';
        statsContent.innerHTML = html;
    }

    function openStats() {
        renderStats();
        statsOverlay.classList.add('active');
    }

    function closeStats() { statsOverlay.classList.remove('active'); }

    function resetStats() {
        localStorage.removeItem(STATS_KEY);
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
        if (btnLeaderboard && leaderboardAvailable) {
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

            // Check for saved game
            const saved = loadSavedGame();
            if (saved) showResumeBanner(saved);
        }
    }

    function selectDifficulty(diff) {
        currentDifficulty = diff;
        diffSelector.querySelectorAll('.diff-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.diff === diff);
        });

        if (levelInput && levelMaxDisplay) {
            const max = diff === 'nightmare' ? 3000 : 500;
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
            if (mode === 'solver') openModal();
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
        winOverlay.classList.remove('active');
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
    winOverlay.addEventListener('click', (e) => { if (e.target === winOverlay) winOverlay.classList.remove('active'); });

    // ══════════════════════════════════════════════════════════════════
    //  NUMPAD (mobile/tablet)
    // ══════════════════════════════════════════════════════════════════

    function handleNumpadInput(digit) {
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

    const THEME_COLORS = {
        midnight: '#0a0a0f',
        sakura: '#f5e1d8',
        ocean: '#0b1628',
        forest: '#091209',
        arctic: '#dce4ef',
        naruto: '#0f0800',
        wicked: '#050d08'
    };

    function applyTheme(theme) {
        if (theme && theme !== 'midnight') {
            document.documentElement.setAttribute('data-theme', theme);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        // Update meta theme-color for mobile browsers
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.midnight);

        // Update active state in dropdown
        themeDropdown.querySelectorAll('.theme-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.theme === theme);
        });

        try { localStorage.setItem('sudoku-theme', theme); } catch (e) { }
    }

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

    // Force Update / Refresh
    if (btnUpdateApp) {
        btnUpdateApp.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Reload the app to get the latest version?')) {
                // Add timestamp to query string to bypass cache
                const url = new URL(window.location.href);
                url.searchParams.set('v', Date.now());
                window.location.href = url.toString();
            }
        });
    }

    // Restore saved theme
    const savedTheme = localStorage.getItem('sudoku-theme') || 'midnight';
    applyTheme(savedTheme);

    // ══════════════════════════════════════════════════════════════════
    //  LEADERBOARD (graceful degradation)
    // ══════════════════════════════════════════════════════════════════

    // Detect API base: in Docker, nginx proxies /api/. For local dev, use localhost:3001.
    const API_BASE = (() => {
        if (window.location.protocol === 'file:') return 'http://localhost:3001';
        return '';
    })();

    let leaderboardAvailable = false;
    let currentLbDiff = 'easy';

    async function checkLeaderboardHealth() {
        try {
            const resp = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
            if (resp.ok) {
                leaderboardAvailable = true;
                if (btnLeaderboard) btnLeaderboard.style.display = 'inline-flex';
                if (winSubmit) winSubmit.style.display = 'flex';
            }
        } catch (e) {
            leaderboardAvailable = false;
            if (btnLeaderboard) btnLeaderboard.style.display = 'none';
            if (winSubmit) winSubmit.style.display = 'none';
        }
    }

    async function fetchLeaderboard(difficulty) {
        if (!leaderboardAvailable) return [];
        try {
            const resp = await fetch(`${API_BASE}/api/leaderboard/${difficulty}`);
            if (resp.ok) return await resp.json();
        } catch (e) { /* silently fail */ }
        return [];
    }

    async function submitScore(name, difficulty, time, hints, level) {
        if (!leaderboardAvailable) return null;
        try {
            const resp = await fetch(`${API_BASE}/api/leaderboard`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, difficulty, time, hints, level })
            });
            if (resp.ok) return await resp.json();
        } catch (e) { /* silently fail */ }
        return null;
    }

    function renderLeaderboard(entries) {
        if (!lbContent) return;
        if (!entries || entries.length === 0) {
            lbContent.innerHTML = '<p class="lb-empty">No scores yet. Be the first!</p>';
            return;
        }
        let html = `<table class="lb-table">
            <thead><tr><th>#</th><th>Name</th><th>Time</th><th>Hints</th><th>Date</th></tr></thead>
            <tbody>`;
        entries.forEach((e, i) => {
            const date = new Date(e.date).toLocaleDateString();
            html += `<tr>
                <td>${i + 1}</td>
                <td>${e.name}</td>
                <td>${formatTime(e.time)}</td>
                <td>${e.hints || 0}</td>
                <td>${date}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        lbContent.innerHTML = html;
    }

    async function openLeaderboard(diff) {
        if (!lbOverlay) return;
        currentLbDiff = diff || currentDifficulty;
        lbContent.innerHTML = '<p class="lb-empty">Loading...</p>';
        lbOverlay.classList.add('active');
        if (lbTabs) {
            lbTabs.querySelectorAll('.lb-tab').forEach(t =>
                t.classList.toggle('active', t.dataset.diff === currentLbDiff)
            );
        }
        const entries = await fetchLeaderboard(currentLbDiff);
        renderLeaderboard(entries);
    }

    function closeLeaderboard() {
        if (lbOverlay) lbOverlay.classList.remove('active');
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

            const levelVal = levelInput ? parseInt(levelInput.value, 10) : null;
            const result = await submitScore(name, currentDifficulty, timerSeconds, hintsUsed, levelVal);

            if (result && result.rank) {
                btnWinSubmit.textContent = `Rank #${result.rank}!`;
                // Save name for next time
                try { localStorage.setItem('sudoku-player-name', name); } catch (e) { }
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
        const savedName = localStorage.getItem('sudoku-player-name');
        if (savedName) winNameInput.value = savedName;
        winNameInput.addEventListener('input', () => {
            winNameInput.style.borderColor = '';
        });
    }

    // ══════════════════════════════════════════════════════════════════
    //  INIT
    // ══════════════════════════════════════════════════════════════════

    buildGrid();
    switchMode('play');
    checkLeaderboardHealth();
})();
