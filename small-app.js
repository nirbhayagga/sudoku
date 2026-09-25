import { SMALL_GEOMETRIES, cellLabel, parseSizedPuzzle } from './geometry.js';
import { SMALL_BANK } from './small-bank.js';
import { newSmallGame, validateSmallGame, editSmallGame, smallDigit, smallUndo, smallHint } from './small-state.js';
import { bits, sizedCandidates, solveSized, assessSized } from './sized-solver.js';
import { generateSized } from './sized-generation.js';
import { sizedLink, sizedPng, sizedSheet, SIZED_PRINT_CSS, formatSizedPuzzle } from './sized-export.js';
import { loadSmallData, saveSmallData, smallProgress, recordSmallWin } from './storage.js';
import { copyToClipboard } from './share.js';
import { formatTime } from './format.js';
import { planWorksheet } from './printing.js';

export function createSmallApp(root) {
    root.innerHTML = `<div class="small-heading"><h2 id="small-title"></h2><span id="small-clock"></span></div>
      <p id="small-identity"></p><p id="small-progress"></p>
      <div class="small-grid" id="small-grid" role="group" aria-label="Sudoku board"></div>
      <div class="small-pad" id="small-pad" aria-label="Digits"></div>
      <div class="small-actions"><div class="btn-group" role="group" aria-label="History"><button class="btn" id="small-undo">Undo</button><button class="btn" id="small-redo">Redo</button></div>
      <div class="btn-group" role="group" aria-label="Notes"><button class="btn btn-toggle" id="small-notes" aria-pressed="false">Notes</button><button class="btn btn-toggle" id="small-auto" aria-pressed="false">Auto-notes</button>
      <button class="btn" id="small-fill">Fill notes</button></div><div class="btn-group" role="group" aria-label="Game"><button class="btn" id="small-hint">Hint (free)</button><button class="btn" id="small-pause">Pause</button></div></div>
      <p id="small-status" role="status" aria-live="polite"></p><details id="small-proof" hidden><summary>Explanation details</summary><ol></ol></details>
      <div class="small-setup"><label>Challenge <input id="small-level" type="number" min="1" value="1"></label>
      <button class="btn btn-primary" id="small-start">Start</button><button class="btn" id="small-next">Next challenge</button></div>
      <details id="small-tools"><summary>Import, export and more</summary>
      <label for="small-text">Puzzle text (one line, rows or boxed grid)</label><textarea id="small-text" rows="6" spellcheck="false"></textarea>
      <div class="small-actions"><button class="btn" id="small-import">Play imported puzzle</button><button class="btn" id="small-generate">Generate</button></div>
      <label>Export source <select id="small-source"><option value="puzzle">Original puzzle</option><option value="board">Current position</option></select></label>
      <label>Text format <select id="small-format"><option value="rows">Rows</option><option value="line">Line (dots)</option><option value="zeros">Line (zeros)</option><option value="grid">Boxed grid</option></select></label>
      <div class="small-actions"><button class="btn" id="small-export">Export text</button><button class="btn" id="small-copy">Copy text</button><button class="btn" id="small-png">Download PNG</button><button class="btn" id="small-share">Share puzzle</button></div>
      <fieldset><legend>Printable worksheet</legend><label>Selection <select id="small-print-source"><option value="current">Current puzzle</option><option value="consecutive">Consecutive challenges</option><option value="random">Random challenges</option></select></label>
      <div id="small-print-batch" hidden><label>Choose total by <select id="small-print-unit"><option value="puzzles">Number of puzzles</option><option value="pages">Number of puzzle pages</option></select></label>
      <label>Amount <input id="small-print-count" type="number" min="1" max="24" value="4"></label></div>
      <label>Per page <select id="small-per-page"><option>1</option><option>2</option><option selected>4</option><option>6</option></select></label>
      <label><input id="small-answers" type="checkbox"> Include separate answers</label><p id="small-print-summary" role="status"></p><button class="btn" id="small-print">Print / Save PDF</button></fieldset>
      <button class="btn" id="small-backup">Download game backup</button><label>Restore game backup <input id="small-restore" type="file" accept="application/json,.json"></label>
      </details><details><summary>Small-board shortcuts</summary><p>Digits enter a value; arrows select a cell; Delete erases. N toggles notes, A auto-notes, H previews/reveals, Space pauses. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z redoes. Undo also works after completion.</p></details>`;
    const $ = id => root.querySelector(`#small-${id}`);
    let g, state, selected = 0, notes = false, paused = false, active = false, anchor = Date.now(), pending = null, answer;
    const message = text => { $('status').textContent = text; };
    const isWon = () => state?.board === answer;
    const settle = () => { if (state && active && !paused && !isWon()) state.elapsedMs += Math.max(0, Date.now() - anchor); anchor = Date.now(); };
    const save = () => { if (state) saveSmallData(g.size, state); };
    const clearHint = () => { pending = null; $('hint').textContent = 'Hint (free)'; $('proof').hidden = true; $('proof').querySelector('ol').replaceChildren(); };
    function render() {
        $('title').textContent = `${g.size} × ${g.size} Sudoku`;
        $('identity').textContent = state.level ? `Challenge ${state.level} of ${SMALL_BANK[g.size].length} · ${g.boxRows} × ${g.boxCols} boxes` : `Imported / generated puzzle · ${g.boxRows} × ${g.boxCols} boxes`;
        if (isWon() && !state.recorded) { recordSmallWin(state.id); state.recorded = true; }
        $('progress').textContent = `${smallProgress().filter(id => SMALL_BANK[g.size].some(p => p.id === id)).length} of ${SMALL_BANK[g.size].length} challenges completed`;
        $('grid').style.setProperty('--small-size', g.size);
        $('grid').classList.toggle('small-paused', paused);
        $('grid').setAttribute('aria-label', paused ? 'Paused Sudoku board' : `${g.size} by ${g.size} Sudoku board`);
        const cells = [...$('grid').children];
        for (let i = 0; i < g.count; i++) {
            const button = cells[i], given = state.puzzle[i] !== '0';
            button.className = 'small-cell' + (given ? ' small-given' : '') + (i === selected ? ' small-selected' : '');
            button.setAttribute('aria-label', paused ? `${cellLabel(g, i)}, paused` : `${cellLabel(g, i)}, ${state.board[i] === '0' ? 'empty' : state.board[i]}${given ? ', given' : ''}`);
            button.setAttribute('aria-pressed', String(i === selected)); button.tabIndex = i === selected ? 0 : -1;
            button.replaceChildren();
            if (!paused && state.board[i] !== '0') button.textContent = state.board[i];
            else if (!paused && state.notes[i]) {
                const span = document.createElement('span'); span.className = 'small-pencil';
                span.textContent = bits(state.notes[i]).map(d => g.digits[d]).join(' '); button.append(span);
            }
        }
        $('notes').setAttribute('aria-pressed', String(notes)); $('auto').setAttribute('aria-pressed', String(state.auto));
        $('pause').textContent = paused ? 'Resume' : 'Pause';
        $('next').disabled = state.level === SMALL_BANK[g.size].length;
        $('undo').disabled = paused || !state.undo.length; $('redo').disabled = paused || !state.redo.length;
        $('clock').textContent = `${formatTime(Math.floor(state.elapsedMs / 1000))} · ${state.hints} hints`;
        updatePrintPlan();
        if (isWon()) {
            if (!state.recorded) { recordSmallWin(state.id); state.recorded = true; }
            message(`Completed ${g.size}×${g.size}${state.level ? ` challenge ${state.level}` : ' puzzle'} in ${formatTime(Math.floor(state.elapsedMs / 1000))}, ${state.hints} hints. Share, export, undo, or choose your next challenge.`);
        }
        save();
    }
    function build() {
        $('grid').replaceChildren(); $('pad').replaceChildren();
        $('pad').style.setProperty('--small-size', g.size);
        $('pad').dataset.size = g.size;
        for (let i = 0; i < g.count; i++) {
            const b = document.createElement('button'); b.type = 'button'; b.dataset.cell = i;
            if ((i % g.size + 1) % g.boxCols === 0 && i % g.size !== g.size - 1) b.style.borderRightWidth = '3px';
            if ((Math.floor(i / g.size) + 1) % g.boxRows === 0 && Math.floor(i / g.size) !== g.size - 1) b.style.borderBottomWidth = '3px';
            b.addEventListener('click', () => { selected = i; render(); }); $('grid').append(b);
        }
        for (const digit of g.digits + '0') {
            const b = document.createElement('button'); b.className = 'btn'; b.textContent = digit === '0' ? 'Erase' : digit;
            b.dataset.digit = digit; b.addEventListener('click', () => enter(digit)); $('pad').append(b);
        }
        $('level').max = SMALL_BANK[g.size].length; $('level').value = state.level || 1;
    }
    function load(next) {
        settle(); save(); state = next; answer = solveSized(state.puzzle, g).solutions[0];
        const index = SMALL_BANK[g.size].findIndex(p => p.puzzle === state.puzzle);
        state.level = index < 0 ? null : index + 1;
        state.id = index < 0 ? 'imported' : SMALL_BANK[g.size][index].id;
        selected = Math.max(0, state.board.indexOf('0')); notes = false; paused = false; anchor = Date.now(); clearHint(); build(); render();
    }
    function start(level) {
        const item = SMALL_BANK[g.size][level - 1];
        if (!item) { message(`Choose a challenge from 1 to ${SMALL_BANK[g.size].length}.`); return; }
        load(newSmallGame(item.puzzle, g, { id: item.id, level })); message('Challenge ready. Select a cell and enter a digit.');
    }
    function enter(digit) {
        if (!active || paused) return;
        settle(); clearHint(); if (smallDigit(state, g, selected, digit, notes)) render();
    }
    function action(fn) { if (!active || paused) return; settle(); clearHint(); fn(); render(); }
    $('undo').onclick = () => action(() => smallUndo(state)); $('redo').onclick = () => action(() => smallUndo(state, true));
    $('notes').onclick = () => action(() => { notes = !notes; });
    $('auto').onclick = () => action(() => editSmallGame(state, g, s => { s.auto = !s.auto; }));
    $('fill').onclick = () => action(() => editSmallGame(state, g, s => { s.notes = [...sizedCandidates(s.board, g)]; }));
    $('pause').onclick = () => { settle(); paused = !paused; clearHint(); render(); message(paused ? 'Paused. Resume to continue.' : 'Resumed.'); };
    $('hint').onclick = () => {
        if (paused || isWon()) return;
        settle();
        if (pending) { const hint = pending; clearHint(); smallDigit(state, g, hint.idx, hint.digit); state.hints++; selected = hint.idx; render(); return; }
        pending = smallHint(state, g); if (!pending) return;
        $('hint').textContent = 'Reveal (+1 hint)'; message(`${pending.answerBased ? 'Answer offer' : 'Explained hint'} — free. ${pending.nudge}`);
        $('proof').hidden = !pending.trace.length;
        for (const step of pending.trace) { const li = document.createElement('li'); li.textContent = step.nudge; $('proof').querySelector('ol').append(li); }
    };
    $('start').onclick = () => start(Number($('level').value));
    $('next').onclick = () => { if (state.level !== SMALL_BANK[g.size].length) start((state.level || 0) + 1); };
    $('import').onclick = () => {
        try { const p = parseSizedPuzzle($('text').value, g); if (!p) throw new Error(`Enter exactly ${g.count} cells using digits 1–${g.size}.`);
            const next = newSmallGame(p, g); const rating = assessSized(p, g); load(next);
            message(`Imported puzzle. ${rating.status === 'solved' ? ['Singles', 'Locked candidates', 'Subsets'][rating.family] : 'Beyond the small-board explanation rules'}.`);
        } catch (error) { message(error.message); }
    };
    $('generate').onclick = () => {
        const seed = crypto.getRandomValues(new Uint32Array(1))[0], result = generateSized(g, seed);
        load(newSmallGame(result.puzzle, g)); message(`Generated on this device. Seed ${seed}.`);
    };
    const source = () => state[$('source').value === 'board' ? 'board' : 'puzzle'];
    $('export').onclick = () => { $('text').value = formatSizedPuzzle(source(), g, $('format').value); message('Puzzle exported below.'); };
    $('copy').onclick = async () => { message(await copyToClipboard($('text').value) ? 'Copied.' : 'Select and copy the text below.'); };
    $('share').onclick = async () => { const link = sizedLink(location.href, state.puzzle, g); $('text').value = link; message(await copyToClipboard(link) ? 'Puzzle link copied.' : 'Copy the puzzle link below.'); };
    function download(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
    $('png').onclick = async () => { try { download(await sizedPng(source(), g, document), `sudoku-${g.size}x${g.size}.png`); } catch (e) { message(e.message); } };
    $('backup').onclick = () => { settle(); save(); download(new Blob([JSON.stringify(state)], { type: 'application/json' }), `sudoku-${g.size}x${g.size}-save.json`); };
    $('restore').onchange = async () => {
        try { const file = $('restore').files[0]; if (!file) return; if (file.size > 1000000) throw new Error('Backup is too large.');
            const next = validateSmallGame(JSON.parse(await file.text())); if (!next || next.size !== g.size) throw new Error('Choose a valid backup for this board size.'); load(next); message('Game restored.');
        } catch (e) { message(e.message); } finally { $('restore').value = ''; }
    };
    function printPlan() {
        const current = $('print-source').value === 'current';
        return planWorksheet({ amount: current ? 1 : Number($('print-count').value),
            unit: current ? 'puzzles' : $('print-unit').value, perPage: Number($('per-page').value),
            order: $('print-source').value === 'consecutive' ? 'consecutive' : 'random',
            start: Number($('level').value), bankSize: current ? 1 : SMALL_BANK[g.size].length,
            answers: $('answers').checked });
    }
    function updatePrintPlan() {
        $('print-batch').hidden = $('print-source').value === 'current';
        $('print-count').max = $('print-unit').value === 'pages' ? Math.floor(24 / Number($('per-page').value)) : 24;
        try {
            const plan = printPlan();
            $('print-summary').textContent = `${plan.count} puzzles · ${plan.puzzlePages} puzzle pages${plan.answerPages ? ` + ${plan.answerPages} answer pages` : ''} · ${plan.totalPages} pages total.`;
            $('print').disabled = false;
        } catch (e) { $('print-summary').textContent = e.message; $('print').disabled = true; }
    }
    for (const id of ['print-source', 'print-unit', 'print-count', 'per-page', 'answers', 'level']) $(id).addEventListener('input', updatePrintPlan);
    $('print').onclick = () => {
        try {
            const { count } = printPlan(), perPage = Number($('per-page').value), selection = $('print-source').value;
            let puzzles = [source()];
            if (selection !== 'current') {
                const bank = [...SMALL_BANK[g.size]];
                if (selection === 'random') for (let i = bank.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bank[i], bank[j]] = [bank[j], bank[i]]; }
                const startAt = selection === 'consecutive' ? Number($('level').value) - 1 : 0;
                if (startAt < 0 || !Number.isInteger(startAt) || startAt + count > bank.length) throw new Error('The selected range exceeds this bank.');
                puzzles = bank.slice(startAt, startAt + count).map(p => p.puzzle);
            }
            let html = sizedSheet(puzzles, g, perPage);
            if ($('answers').checked) {
                const solutions = puzzles.map(p => { const s = solveSized(p, g); if (s.count !== 1 || s.status !== 'solved') throw new Error('The position must have one solution to print answers.'); return s.solutions[0]; });
                html += sizedSheet(solutions, g, perPage, true);
            }
            root.querySelector('iframe')?.remove();
            const frame = document.createElement('iframe'); frame.title = 'Printable Sudoku worksheet'; frame.className = 'small-print-frame';
            frame.srcdoc = `<!doctype html><html><head><title>Sudoku worksheet</title><style>${SIZED_PRINT_CSS}</style></head><body>${html}</body></html>`;
            frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); }; root.append(frame);
        } catch (e) { message(e.message); }
    };
    root.addEventListener('keydown', e => {
        if (!active || e.target.closest('textarea,input,select') || e.altKey || e.isComposing) return;
        const key = e.key.toLowerCase(); let handled = true;
        if (key === ' ' && !e.target.closest('.small-cell')) return;
        if ((e.ctrlKey || e.metaKey) && key === 'z') action(() => smallUndo(state, e.shiftKey));
        else if (e.ctrlKey || e.metaKey) return;
        else if (g.digits.includes(key) && key.length === 1) enter(key);
        else if (['delete', 'backspace', '0'].includes(key)) enter('0');
        else if (key.startsWith('arrow')) {
            const delta = { arrowleft: -1, arrowright: 1, arrowup: -g.size, arrowdown: g.size }[key];
            if (delta) { selected = (selected + delta + g.count) % g.count; render(); $('grid').children[selected].focus({ preventScroll: true }); }
        } else if ({ n: 'notes', a: 'auto', h: 'hint', ' ': 'pause' }[key]) $({ n: 'notes', a: 'auto', h: 'hint', ' ': 'pause' }[key]).click();
        else handled = false;
        if (handled) { e.preventDefault(); e.stopPropagation(); }
    });
    setInterval(() => { if (!active) return; settle(); $('clock').textContent = `${formatTime(Math.floor(state.elapsedMs / 1000))} · ${state.hints} hints`; }, 1000);
    const flush = () => { settle(); save(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    return {
        activate(size, puzzle = null) {
            settle(); save(); state = null; g = SMALL_GEOMETRIES[size]; active = true;
            try {
                if (puzzle) load(newSmallGame(puzzle, g));
                else { const saved = validateSmallGame(loadSmallData(g.size)); if (saved) load(saved); else start(1); }
            } catch (e) { start(1); message(e.message); }
        },
        deactivate() { settle(); save(); active = false; },
    };
}
