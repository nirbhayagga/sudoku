import { sizedGameLink, parseSizedGameLink } from './sized-handoff.js';
import { deleteSmallData } from './storage.js';
import { createBoardCell, renderBoardCell, arrowCell } from './board-view.js';
import { arrangePlayerControls } from './player-controls.js';
import { AUX_KEYS, readAuxiliary, writeAuxiliary } from './storage.js';
import { validateModeResults } from './complete-backup.js';
import { SMALL_GEOMETRIES, VARIANT_GEOMETRIES, RULE_LABELS, RULE_DESCRIPTIONS, cellLabel, parseSizedPuzzle } from './geometry.js';
import { SMALL_BANK } from './small-bank.js';
import { VARIANT_BANK } from './variant-bank.js';
import { newSmallGame, validateSmallGame, recordSmallCompletion, editSmallGame, smallDigit, smallUndo, smallHint } from './small-state.js';
import { bits, sizedCandidates, solveSized } from './sized-solver.js';
import { createAnalysisClient } from './analysis-client.js';
import { sizedLink, sizedPng, sizedSheet, SIZED_PRINT_CSS, formatSizedPuzzle } from './sized-export.js';
import { loadSmallData, saveSmallData, smallProgress, recordSmallWin, getProgression, recordProgression, restoreSmallBackup } from './storage.js';
import { progressionPosition } from './progression.js';
import { copyToClipboard } from './share.js';
import { formatTime } from './format.js';
import { planWorksheet } from './printing.js';
import { fitToViewport } from './layout.js';

export function createSmallApp(root, { openNewGame, openTools, showResult, showShareLink, openStats } = {}) {
    root.innerHTML = `<div class="small-heading"><h2 id="small-title"></h2><span id="small-clock"></span></div>
      <div class="small-game-summary"><p id="small-identity"></p>
      <button class="btn" id="small-setup-toggle" aria-expanded="false" aria-controls="small-setup-options">Game setup…</button></div>
      <div id="small-pause-actions" class="modal-actions" hidden><button class="btn" id="small-pause-share">Share puzzle</button></div>
      <div id="small-setup-options" hidden>
        <p id="small-rules"></p><p id="small-progress"></p>
        <div class="small-setup"><label>Challenge <input id="small-level" type="number" min="1" value="1"></label>
        <button class="btn btn-primary" id="small-start">Start</button><button class="btn" id="small-next">Next challenge</button></div>
        <details class="progression-controls"><summary>Progression</summary><p id="small-path-status"></p><button class="btn" id="small-path">Continue progression</button></details>
      </div>
      <div class="small-play-layout"><div class="small-grid" id="small-grid" role="group" aria-label="Sudoku board"></div>
      <div class="small-play-controls">
      <div class="small-pad" id="small-pad" aria-label="Digits"></div>
      <div class="small-actions"><div class="btn-group" role="group" aria-label="History"><button class="btn" id="small-undo">Undo</button><button class="btn" id="small-redo">Redo</button></div>
      <div class="btn-group" role="group" aria-label="Notes"><button class="btn btn-toggle" id="small-notes" aria-pressed="false">Notes</button><button class="btn btn-toggle" id="small-auto" aria-pressed="false">Auto-notes</button>
      <button class="btn" id="small-fill">Fill notes</button></div><div class="btn-group" role="group" aria-label="Game"><button class="btn" id="small-hint" title="Preview an explanation or answer offer (H)">Hint</button><button class="btn" id="small-pause">Pause</button></div></div>
      <p id="small-status" role="status" aria-live="polite"></p><details id="small-proof" hidden><summary>Explanation details</summary><ol></ol></details>
      </div></div>
      <details id="small-tools"><summary>Import, export and print</summary>
      <div class="small-tool-choices" role="group" aria-label="Puzzle tools">
        <button class="btn btn-toggle" data-tool="text" aria-pressed="true">Puzzle text</button>
        <button class="btn btn-toggle" data-tool="print" aria-pressed="false">Print</button>
        <button class="btn btn-toggle" data-tool="backup" aria-pressed="false">Backup</button>
      </div><div id="small-tool-text">
      <label for="small-text">Puzzle text (one line, rows or boxed grid)</label><textarea id="small-text" rows="6" spellcheck="false"></textarea>
      <div class="small-actions"><button class="btn" id="small-import">Play imported puzzle</button><button class="btn" id="small-generate">Generate</button></div>
      <label>Export source <select id="small-source"><option value="puzzle">Original puzzle</option><option value="board">Current position</option></select></label>
      <label>Text format <select id="small-format"><option value="rows">Rows</option><option value="line">Line (dots)</option><option value="zeros">Line (zeros)</option><option value="grid">Boxed grid</option></select></label>
      <div class="small-actions"><button class="btn" id="small-export">Export text</button><button class="btn" id="small-copy">Copy text</button><button class="btn" id="small-png">Download PNG</button><button class="btn" id="small-share">Share puzzle</button></div>
      </div><fieldset id="small-tool-print" hidden><legend>Printable worksheet</legend><label>Selection <select id="small-print-source"><option value="current">Current puzzle</option><option value="consecutive">Consecutive challenges</option><option value="random">Random challenges</option></select></label>
      <div id="small-print-batch" hidden><label>Choose total by <select id="small-print-unit"><option value="puzzles">Number of puzzles</option><option value="pages">Number of puzzle pages</option></select></label>
      <label>Amount <input id="small-print-count" type="number" min="1" max="24" value="4"></label></div>
      <label>Per page <select id="small-per-page"><option>1</option><option>2</option><option selected>4</option><option>6</option></select></label>
      <label><input id="small-answers" type="checkbox"> Include separate answers</label><p id="small-print-summary" role="status"></p><button class="btn" id="small-print">Print / Save PDF</button></fieldset>
      <div id="small-tool-backup" hidden><p id="small-backup-scope">Includes every saved game, statistics, settings, progression and practice history. Use Statistics & complete backup to restore a complete backup. Older single-game files can still be restored here.</p><button class="btn" id="small-backup" aria-describedby="small-backup-scope">Download complete backup</button><label>Restore older game backup <input id="small-restore" type="file" accept="application/json,.json" aria-describedby="small-backup-scope"></label>
      </div></details><details><summary>Board shortcuts</summary><p>Digits enter a value; arrows select a cell; Delete erases. N toggles notes, A auto-notes, F fills notes, H previews/reveals, P or Space pauses. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z redoes. Undo also works after completion.</p></details>`;
    const $ = id => document.getElementById(`small-${id}`);
    const cellViews = [];
    let errors = new Set(), handedOff = false, handoffOffer = null;
    const check = document.createElement('button'); check.id = 'small-check'; check.className = 'btn'; check.textContent = 'Check';
    check.onclick = () => {
        if (paused) return;
        settle(); clearHint();
        if (errors.size) {
            handedOff = false;
            editSmallGame(state, g, s => { const board = [...s.board]; for (const i of errors) board[i] = '0'; s.board = board.join(''); });
            errors.clear(); check.textContent = 'Check'; render(); message('Errors cleared. Undo restores the entries and notes.');
        } else {
            errors = new Set([...state.board].flatMap((d, i) => d !== '0' && d !== answer[i] && state.puzzle[i] === '0' ? [i] : []));
            check.textContent = errors.size ? 'Clear errors' : 'Check'; render(); message(errors.size ? `${errors.size} incorrect entries marked.` : 'No incorrect entries.');
        }
    };
    root.querySelector('.small-game-summary').append($('next'));
    const resultButton = document.createElement('button'); resultButton.id = 'small-result'; resultButton.className = 'btn'; resultButton.textContent = 'Result'; resultButton.hidden = true;
    resultButton.onclick = () => { if (state.completion) showResult?.({ identity: `${$('title').textContent} · ${$('identity').textContent}`,
        time: Math.floor(state.completion.elapsedMs / 1000), hints: state.completion.hints,
        generatedNotesUsed: state.completion.generatedNotesUsed, clues: [...state.puzzle].filter(d => d !== '0').length }); };
    const toolContent = $('tools');
    const toolStatus = document.createElement('p'); toolStatus.id = 'small-tool-status'; toolStatus.setAttribute('role', 'status'); toolContent.append(toolStatus);
    const handoff = document.createElement('button'); handoff.id = 'small-handoff'; handoff.className = 'btn'; handoff.textContent = 'Continue on another device';
    const confirmHandoff = document.createElement('button'); confirmHandoff.id = 'small-handoff-confirm'; confirmHandoff.className = 'btn'; confirmHandoff.textContent = 'I copied the resume link'; confirmHandoff.hidden = true;
    function finishHandoff(offer = handoffOffer) {
        if (!offer || offer !== handoffOffer || state !== offer.state || track !== offer.track || JSON.stringify(state) !== offer.snapshot || $('text').value !== offer.link) {
            message('The game or link changed. Create a new resume link before removing this saved copy.'); return;
        }
        if (!deleteSmallData(track)) { message('The link is ready, but this device could not remove its saved copy.'); return; }
        handedOff = true; handoffOffer = null; confirmHandoff.hidden = true;
        message('Resume link ready. This device will not offer this game again unless you make another move here.');
    }
    handoff.onclick = async () => {
        settle(); paused = true; clearHint(); render();
        try {
            const link = sizedGameLink(location.href, state, g); $('text').value = link;
            const offer = handoffOffer = { state, track, snapshot: JSON.stringify(state), link };
            const copied = await copyToClipboard(link);
            if (offer !== handoffOffer) return;
            if (copied) finishHandoff(offer);
            else { confirmHandoff.hidden = false; message('Copy the resume link from Puzzle text, then confirm below.'); }
        } catch (e) { message(e.message); }
    };
    confirmHandoff.onclick = () => finishHandoff(); toolContent.append(handoff, confirmHandoff);
    const reset = document.createElement('button'); reset.className = 'btn btn-danger'; reset.textContent = 'Reset this puzzle';
    reset.onclick = () => { if (window.confirm('Reset entries and notes for this puzzle? Your first completion result stays recorded.')) { settle(); clearHint(); handedOff = false; errors.clear(); check.textContent = 'Check'; editSmallGame(state, g, s => { s.board = s.puzzle; s.notes.fill(0); s.auto = false; }); render(); message('Entries reset. Undo restores them; your first result is kept.'); } };
    toolContent.append(reset);
    if (openStats) { const stats = document.createElement('button'); stats.className = 'btn'; stats.textContent = 'Statistics & complete backup'; stats.onclick = openStats; toolContent.append(stats); }
    arrangePlayerControls({ root, actions: root.querySelector('.small-actions'), timer: $('clock'), hint: $('hint'), check,
        undo: $('undo'), redo: $('redo'), notes: $('notes'), fill: $('fill'), auto: $('auto'), pause: $('pause'),
        tools: () => openTools?.(), result: resultButton });
    $('setup-toggle').textContent = 'New game'; $('setup-toggle').hidden = true;
    // Current-player tools live in the shared dialog; legacy restore remains available.
    toolContent.hidden = true;

    function showSetup(open) {
        $('setup-options').hidden = !open;
        $('setup-toggle').setAttribute('aria-expanded', String(open));
        $('setup-toggle').textContent = open ? 'Close setup' : 'New game';
        scheduleLayout();
    }
    $('setup-toggle').onclick = () => openNewGame ? openNewGame() : showSetup($('setup-options').hidden);
    for (const button of $('tools').querySelectorAll('[data-tool]')) {
        button.onclick = () => {
            for (const choice of $('tools').querySelectorAll('[data-tool]')) {
                const chosen = choice === button;
                choice.setAttribute('aria-pressed', String(chosen));
                $(`tool-${choice.dataset.tool}`).hidden = !chosen;
            }
            scheduleLayout();
        };
    }
    let layoutPending = false;
    function scheduleLayout() {
        if (layoutPending) return;
        layoutPending = true;
        requestAnimationFrame(() => { layoutPending = false; refreshLayout(); });
    }
    function refreshLayout() {
        if (!active || document.body.classList.contains('dialog-open')) return;
        // Expanded tools are intentionally scrollable; don't shrink the board
        // just because a worksheet or backup form is open.
        if ($('tools').open || !$('setup-options').hidden || !$('proof').hidden) return;
        fitToViewport({
            reset: () => $('grid').style.removeProperty('width'),
            maximum: () => $('grid').getBoundingClientRect().width,
            setSize: width => { $('grid').style.width = `${width}px`; },
            minimum: g.size * (g.size === 9 ? 32 : 44) + 4,
        });
    }
    root.addEventListener('toggle', scheduleLayout, true);
    let g, bank, track, state, selected = 0, notes = false, paused = false, active = false, anchor = Date.now(), pending = null, answer;
    const analysis = createAnalysisClient();
    let workSerial = 0, working = false;
    function cancelWork() {
        workSerial++; working = false; analysis.cancel();
        $('generate').textContent = 'Generate'; $('import').disabled = false;
    }
    const message = text => { $('status').textContent = text; toolStatus.textContent = text; scheduleLayout(); };
    const isWon = () => state?.board === answer;
    const settle = () => { if (state && active && !paused && !state.recorded && !isWon()) state.elapsedMs += Math.max(0, Date.now() - anchor); anchor = Date.now(); };
    const save = () => { if (state && !handedOff) saveSmallData(track, state); };
    const clearHint = () => { pending = null; $('hint').textContent = 'Hint'; $('hint').title = 'Preview an explanation or answer offer (H)'; $('proof').hidden = true; $('proof').querySelector('ol').replaceChildren(); };
    const updateClock = () => {
        const result = state.completion || state;
        $('clock').textContent = `${state.recorded ? 'Result · ' : ''}${formatTime(Math.floor(result.elapsedMs / 1000))} · ${result.hints} hints`;
    };
    function render() {
        $('title').textContent = g.size === 4 ? 'Introduction · 4 × 4' : g.size === 6 ? 'Quick puzzle · 6 × 6' : `9 × 9 · ${RULE_LABELS[g.rule]}`;
        $('rules').textContent = RULE_DESCRIPTIONS[g.rule];
        $('grid').dataset.rule = g.rule;
        $('identity').textContent = state.level ? `Challenge ${state.level} of ${bank.length}` : `Imported / generated puzzle`;
        if (isWon() && !state.recorded) {
            showSetup(false);
            recordSmallWin(state.id);
            if (state.progression) recordProgression(track, state.id);
            recordSmallCompletion(state);
            const results = validateModeResults(readAuxiliary(AUX_KEYS.results)) || {};
            if (/^(?:[46]|9-(?:diagonal|hyper))-[a-f0-9]{16}$/.test(state.id) && !results[state.id]) {
                results[state.id] = state.completion; writeAuxiliary(AUX_KEYS.results, results);
            }
        }
        const path = progressionPosition(bank, getProgression()[track]);
        $('path-status').textContent = `${path.completed} of ${path.total} progression challenges completed. ` + (path.next ? `Next: challenge ${path.nextIndex + 1}. Only games started in progression count.` : 'Path complete! Replay any challenge by number.');
        $('path').disabled = !path.next;
        if (state.progression) $('identity').textContent = 'Progression · ' + $('identity').textContent;
        $('progress').textContent = `${smallProgress().filter(id => bank.some(p => p.id === id)).length} of ${bank.length} challenges completed`;
        $('grid').style.setProperty('--small-size', g.size);
        $('grid').classList.toggle('small-paused', paused);
        $('grid').setAttribute('aria-label', paused ? 'Paused Sudoku board' : `${g.size} by ${g.size} Sudoku board`);
        for (let i = 0; i < g.count; i++) {
            const view = cellViews[i], given = state.puzzle[i] !== '0';
            renderBoardCell(view, { value: state.board[i], candidates: bits(state.notes[i]).map(d => g.digits[d]),
                given, selected: i === selected, hidden: paused,
                label: paused ? `${cellLabel(g, i)}, paused` : `${cellLabel(g, i)}, ${state.board[i] === '0' ? 'candidates ' + bits(state.notes[i]).map(d => g.digits[d]).join(', ') : state.board[i]}${given ? ', given' : ''}` });
            view.cell.classList.toggle('small-given', given);
            view.cell.classList.toggle('small-selected', i === selected);
            view.cell.classList.toggle('variant-region', g.houses[i].some(u => ['diagonal', 'hyper region'].includes(u.kind)));
            view.cell.classList.toggle('board-peer', i !== selected && g.peers[selected].includes(i));
            view.cell.classList.toggle('board-same-digit', i !== selected && state.board[selected] !== '0' && state.board[selected] === state.board[i]);
            view.cell.classList.toggle('board-error', errors.has(i));
            view.cell.classList.toggle('practice-evidence', !paused && !!pending?.trace.some(s => s.evidence?.includes(i) || s.cells?.includes(i)));
        }
        $('notes').setAttribute('aria-pressed', String(notes)); $('auto').setAttribute('aria-pressed', String(state.auto));
        $('pause').textContent = paused ? 'Resume' : 'Pause';
        $('pause-actions').hidden = !paused;
        resultButton.hidden = !state.completion;
        $('next').hidden = g.size !== 4 && !state.completion;
        $('next').textContent = g.size === 4 ? 'Next example' : state.progression ? 'Continue progression' : 'Next puzzle';
        $('next').disabled = state.progression ? !isWon() || !path.next : state.level === bank.length;
        $('undo').disabled = paused || !state.undo.length; $('redo').disabled = paused || !state.redo.length;
        updateClock();
        updatePrintPlan();
        if (state.completion) {
            const result = state.completion;
            const assistance = result.generatedNotesUsed === null ? 'Note assistance was not recorded by this older save.'
                : result.generatedNotesUsed ? 'Generated notes used.' : 'No generated notes used.';
            message(`${isWon() ? 'Completed' : 'Reviewing completed'} ${g.size}×${g.size}${g.rule === 'classic' ? '' : ' ' + RULE_LABELS[g.rule]}${state.level ? ` challenge ${state.level}` : ' puzzle'} in ${formatTime(Math.floor(result.elapsedMs / 1000))}, ${result.hints} hints. ${assistance} Your first result is kept; review time is not counted. Share, export, undo, or choose your next challenge.`);
        }
        save();
    }
    function build() {
        $('grid').replaceChildren(); $('pad').replaceChildren();
        $('pad').style.setProperty('--small-size', g.size);
        $('pad').dataset.size = g.size;
        cellViews.length = 0;
        for (let i = 0; i < g.count; i++) {
            const view = createBoardCell({ ...g, index: i }); view.cell.classList.add('small-cell');
            view.cell.addEventListener('click', () => { selected = i; render(); });
            cellViews.push(view); $('grid').append(view.cell);
        }
        for (const digit of g.digits + '0') {
            const b = document.createElement('button'); b.className = 'btn'; b.textContent = digit === '0' ? 'Erase' : digit;
            b.dataset.digit = digit; b.addEventListener('click', () => enter(digit)); $('pad').append(b);
        }
        if (g.rule !== 'classic') {
            const ns = 'http://www.w3.org/2000/svg', overlay = document.createElementNS(ns, 'svg');
            overlay.setAttribute('viewBox', '0 0 900 900'); overlay.setAttribute('aria-hidden', 'true'); overlay.classList.add('variant-outline');
            const shapes = g.rule === 'diagonal' ? [{ x1: 0, y1: 0, x2: 900, y2: 900 }, { x1: 900, y1: 0, x2: 0, y2: 900 }]
                : [1,5].flatMap(r => [1,5].map(c => ({ x: c * 100 + 3, y: r * 100 + 3, width: 294, height: 294 })));
            for (const attrs of shapes) { const shape = document.createElementNS(ns, g.rule === 'diagonal' ? 'line' : 'rect'); for (const [k,v] of Object.entries(attrs)) shape.setAttribute(k,v); overlay.append(shape); }
            $('grid').append(overlay);
        }
        $('level').max = bank.length; $('level').value = state.level || 1;
    }
    function load(next, verifiedAnswer = null, { savePrevious = true } = {}) {
        cancelWork();
        const solution = verifiedAnswer || solveSized(next.puzzle, g, { limit: 1, maxNodes: 20000 }).solutions[0];
        if (!solution) throw new Error('Puzzle validation reached its work limit.');
        settle(); if (savePrevious) save(); state = next; answer = solution; handedOff = false; handoffOffer = null; confirmHandoff.hidden = true; errors.clear(); check.textContent = 'Check';
        const index = bank.findIndex(p => p.puzzle === state.puzzle);
        state.level = index < 0 ? null : index + 1;
        state.id = index < 0 ? 'imported' : bank[index].id;
        state.progression = index >= 0 && state.progression === true;
        selected = Math.max(0, state.board.indexOf('0')); notes = false; paused = false; anchor = Date.now(); clearHint(); build(); render();
    }
    function start(level, progression = false) {
        const item = bank[level - 1];
        if (!item) { message(`Choose a challenge from 1 to ${bank.length}.`); return; }
        showSetup(false);
        load(newSmallGame(item.puzzle, g, { id: item.id, level, progression })); message('Select a cell and enter a digit.');
    }
    function enter(digit) {
        if (!active || paused) return;
        settle(); clearHint(); errors.clear(); $('check').textContent = 'Check';
        if (smallDigit(state, g, selected, digit, notes)) { handedOff = false; render(); }
    }
    function action(fn) {
        if (!active || paused) return;
        settle(); clearHint(); errors.clear(); $('check').textContent = 'Check';
        const before = JSON.stringify([state.board, state.notes, state.auto]); fn();
        if (before !== JSON.stringify([state.board, state.notes, state.auto])) handedOff = false;
        render();
    }
    $('undo').onclick = () => action(() => smallUndo(state)); $('redo').onclick = () => action(() => smallUndo(state, true));
    $('notes').onclick = () => action(() => { notes = !notes; });
    $('auto').onclick = () => action(() => editSmallGame(state, g, s => { s.auto = !s.auto; }));
    $('fill').onclick = () => action(() => editSmallGame(state, g, s => { s.notes = [...sizedCandidates(s.board, g)]; }, { generatedNotes: true }));
    $('pause').onclick = () => { settle(); paused = !paused; clearHint(); render(); message(paused ? 'Paused. Resume to continue.' : 'Resumed.'); };
    $('hint').onclick = () => {
        if (paused || isWon()) return;
        settle();
        if (pending) { const hint = pending; clearHint(); handedOff = false; errors.clear(); check.textContent = 'Check'; smallDigit(state, g, hint.idx, hint.digit); state.hints++; selected = hint.idx; render(); return; }
        pending = smallHint(state, g); if (!pending) return;
        selected = pending.idx; render();
        $('hint').textContent = 'Reveal number'; $('hint').title = 'Fill the highlighted cell; adds one hint to this game (H)';
        message(`${pending.answerBased ? 'Answer offer' : 'Explained hint'}. ${pending.nudge} Revealing adds 1 to your hint count.`);
        $('proof').hidden = !pending.trace.length;
        for (const step of pending.trace) { const li = document.createElement('li'); li.textContent = step.nudge; $('proof').querySelector('ol').append(li); }
    };
    $('start').onclick = () => start(Number($('level').value));
    function continuePath() {
        if (state.progression && !isWon()) { if (paused) $('pause').click(); message('Continue your current progression challenge.'); return; }
        const path = progressionPosition(bank, getProgression()[track]);
        if (path.next) start(path.nextIndex + 1, true);
    }
    $('path').onclick = continuePath;
    $('next').onclick = () => { if (state.progression) continuePath(); else if (state.level !== bank.length) start((state.level || 0) + 1); };
    async function runAnalysis(kind) {
        if (working) { cancelWork(); message('Search cancelled.'); return; }
        const puzzle = kind === 'sized-import' ? parseSizedPuzzle($('text').value, g) : null;
        if (kind === 'sized-import' && !puzzle) { message(`Enter exactly ${g.count} cells using digits 1–${g.size}, with the selected rules.`); return; }
        const serial = ++workSerial, seed = crypto.getRandomValues(new Uint32Array(1))[0];
        working = true; $('generate').textContent = 'Cancel search'; $('import').disabled = true;
        message(kind === 'sized-import' ? 'Checking puzzle and rules…' : 'Generating an explained puzzle…');
        try {
            const result = await analysis.request(kind, { puzzle, seed, size: g.size, rule: g.rule });
            if (serial !== workSerial || !active) return;
            load(result.state, result.answer);
            message(kind === 'sized-import' ? `Imported puzzle. ${result.assessment.status === 'solved' ? ['Singles', 'Locked candidates', 'Subsets'][result.assessment.family] : 'Beyond supported deductions; verified-answer hints remain available'}.` : `Generated on this device. Seed ${seed}.`);
        } catch (error) { if (serial === workSerial && error.name !== 'AbortError') message(error.message); }
        finally { if (serial === workSerial) cancelWork(); }
    }
    $('import').onclick = () => runAnalysis('sized-import');
    $('generate').onclick = () => runAnalysis('sized-generate');
    $('text').addEventListener('input', () => { if (working) { cancelWork(); message('Search cancelled because the input changed.'); } });
    const source = () => state[$('source').value === 'board' ? 'board' : 'puzzle'];
    $('export').onclick = () => { $('text').value = formatSizedPuzzle(source(), g, $('format').value); message('Puzzle exported below.'); };
    $('copy').onclick = async () => { message(await copyToClipboard($('text').value) ? 'Copied.' : 'Select and copy the text below.'); };
    async function sharePuzzle() {
        const link = sizedLink(location.href, state.puzzle, g);
        $('text').value = link;
        if (await copyToClipboard(link)) message('Puzzle link copied.');
        else {
            message('Copy the puzzle link below.');
            if (showShareLink) showShareLink(link);
            else { openTools?.(); toolContent.hidden = false; toolContent.open = true; toolContent.querySelector('[data-tool="text"]').click(); }
        }
    }
    $('share').onclick = sharePuzzle;
    $('pause-share').onclick = sharePuzzle;
    function download(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
    $('png').onclick = async () => { try { download(await sizedPng(source(), g, document), `sudoku-${g.size}x${g.size}.png`); } catch (e) { message(e.message); } };
    $('backup').onclick = async () => { try { settle(); if (!saveSmallData(track, state)) throw new Error('Could not save the current game.'); const { exportCompleteBackup } = await import('./complete-backup.js'); download(new Blob([exportCompleteBackup()], { type: 'application/json' }), 'sudoku-backup.json'); } catch (e) { message(e.message); } };
    $('restore').onchange = async () => {
        try { const file = $('restore').files[0]; if (!file) return; if (file.size > 1000000) throw new Error('Backup is too large.');
            const parsed = JSON.parse(await file.text()), next = validateSmallGame(parsed);
            if (!next || next.geometry !== g.key) throw new Error('Choose a valid backup for this board size and rules.');
            delete next.progressionCompleted;
            if (!restoreSmallBackup(track, next, parsed.progressionCompleted)) throw new Error('Backup has invalid progression or storage is unavailable.');
            load(next, null, { savePrevious: false }); message('Game restored.');
        } catch (e) { message(e.message); } finally { $('restore').value = ''; }
    };
    function printPlan() {
        const current = $('print-source').value === 'current';
        return planWorksheet({ amount: current ? 1 : Number($('print-count').value),
            unit: current ? 'puzzles' : $('print-unit').value, perPage: Number($('per-page').value),
            order: $('print-source').value === 'consecutive' ? 'consecutive' : 'random',
            start: Number($('level').value), bankSize: current ? 1 : bank.length,
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
                const pool = [...bank];
                if (selection === 'random') for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
                const startAt = selection === 'consecutive' ? Number($('level').value) - 1 : 0;
                if (startAt < 0 || !Number.isInteger(startAt) || startAt + count > pool.length) throw new Error('The selected range exceeds this bank.');
                puzzles = pool.slice(startAt, startAt + count).map(p => p.puzzle);
            }
            let html = sizedSheet(puzzles, g, perPage);
            if ($('answers').checked) {
                const solutions = puzzles.map(p => { const s = solveSized(p, g, { maxNodes: 20000 }); if (s.count !== 1 || s.status !== 'solved') throw new Error('The position must have one verified solution within the print work limit.'); return s.solutions[0]; });
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
            const next = arrowCell(e.key, selected, g.size);
            if (next !== null) { selected = next; render(); cellViews[selected].cell.focus({ preventScroll: true }); }
        } else if ({ n: 'notes', a: 'auto', f: 'fill', h: 'hint', p: 'pause', ' ': 'pause' }[key]) $({ n: 'notes', a: 'auto', f: 'fill', h: 'hint', p: 'pause', ' ': 'pause' }[key]).click();
        else handled = false;
        if (handled) { e.preventDefault(); e.stopPropagation(); }
    });
    setInterval(() => { if (!active) return; settle(); updateClock(); }, 1000);
    const flush = () => { settle(); save(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    return {
        refreshLayout,
        share: sharePuzzle,
        flush() { settle(); if (state && !handedOff && !saveSmallData(track, state)) throw new Error('Could not save the current board.'); },
        discard() { active = false; state = null; cancelWork(); },
        identity() { return `${g.size}×${g.size} ${RULE_LABELS[g.rule]} · ${$('identity').textContent}`; },
        openTools(host) { toolContent.hidden = false; toolContent.open = true; host.append(toolContent); },
        startSelection(selection, level) {
            if (selection === 'progression') continuePath();
            else start(selection === 'random' ? Math.floor(Math.random() * bank.length) + 1 : level);
        },
        pause() { if (active && !paused) $('pause').click(); },
        activate(size, puzzle = null, rule = 'classic') {
            settle(); save(); state = null; g = rule === 'classic' ? SMALL_GEOMETRIES[size] : VARIANT_GEOMETRIES[rule];
            bank = rule === 'classic' ? SMALL_BANK[size] : VARIANT_BANK[rule];
            track = rule === 'classic' ? String(size) : `9-${rule}`; active = true;
            showSetup(false); $('tools').open = false;
            try {
                if (puzzle && new URLSearchParams(location.search).has('resume')) {
                    const incoming = parseSizedGameLink(location.search, g, puzzle);
                    if (!incoming) throw new Error('This resume link is invalid. Your existing game has been kept.');
                    load(incoming); history.replaceState(null, '', location.pathname + location.hash);
                    message('Game continued from another device.');
                }
                else if (puzzle) load(newSmallGame(puzzle, g));
                else { const saved = validateSmallGame(loadSmallData(track)); if (saved?.geometry === g.key) load(saved); else start(1); }
            } catch (e) { const saved = validateSmallGame(loadSmallData(track)); if (saved?.geometry === g.key) load(saved); else start(1); message(e.message); }
            scheduleLayout();
        },
        deactivate() { cancelWork(); settle(); save(); active = false; },
    };
}
