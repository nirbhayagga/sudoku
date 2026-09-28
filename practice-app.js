import { PRACTICE_BANK } from './practice-bank.js';
import { prepareExercise, practiceIdentity } from './practice.js';
import { applyDeduction } from './reasoning.js';
import { createBoardCell, renderBoardCell, arrowCell } from './board-view.js';
import { TECHNIQUE_LESSONS, patternCells, checkPracticePattern, practiceFeedback } from './practice-coach.js';
import { practiceHistory, recordPractice } from './learning-history.js';
import { cellName } from './techniques.js';

export function createPracticeApp(root, { transfer = () => {} } = {}) {
    root.innerHTML = `<div class="lesson-options"><label class="practice-technique">Technique <select id="practice-technique"></select></label>
      <label class="activity-field">Activity <select id="practice-mode"><option value="learn">Learn · worked example</option><option value="guided">Guided practice</option><option value="challenge">Challenge · find it yourself</option></select></label></div>
      <p id="practice-rule"></p><p id="practice-history"></p>
      <div class="practice-workspace"><div class="practice-puzzle"><p id="practice-task"></p><div class="practice-grid" id="practice-grid" role="group" aria-label="Technique learning board"></div>
      <p class="practice-legend">Outline: evidence · ring: selection · shaded: consequence</p></div>
      <div class="practice-response"><p id="practice-selection" aria-live="polite"></p><div class="practice-pad" id="practice-pad" role="group" aria-label="Choose a candidate"></div>
      <button class="btn" id="practice-pattern">Check pattern</button><p id="practice-status" role="status"></p>
      <div class="modal-actions"><button class="btn" id="practice-back">Previous step</button><button class="btn" id="practice-forward">Next step</button><button class="btn" id="practice-explain">Show region</button><button class="btn" id="practice-before" hidden>Show before</button></div>
      <p id="practice-proof" hidden></p></div></div>
      <div class="modal-actions"><button class="btn" id="practice-next">Next exercise</button><button class="btn" id="practice-review">Review assisted exercises</button><button class="btn" id="practice-transfer">Play the full source puzzle</button></div>
      <details class="practice-about"><summary>About these lessons</summary><p>Four verified examples per technique. “Practised” records attempts, not mastery. Candidate marks include preceding verified deductions. An independent result means a correct challenge without guidance or incorrect attempts. Arrow keys select cells; digits answer. In the guided pattern stage, Space selects a cell and digits toggle the pattern digits. The full source puzzle starts from its original givens, before the earlier deductions that lead to this example.</p></details>`;
    const $ = id => root.querySelector(`#practice-${id}`), label = type => type.replaceAll('-', ' ');
    let position = 0, prepared, exercise, selected = null, completed = false, page = 0, guidance = 0, patternDone = false, before = false, incorrect = 0, after;
    const chosenCells = new Set(), chosenDigits = new Set(), views = [];
    const mode = () => $('mode').value;
    const identifying = () => mode() === 'guided' && !patternDone;
    for (const type of Object.keys(PRACTICE_BANK.groups)) {
        const option = document.createElement('option'); option.value = type; option.textContent = label(type); $('technique').append(option);
    }
    for (let cell = 0; cell < 81; cell++) {
        const view = createBoardCell({ index: cell }); view.cell.classList.add('practice-cell');
        view.cell.onclick = () => chooseCell(cell, true);
        view.cell.onfocus = () => { if (selected !== cell) chooseCell(cell); }; views.push(view); $('grid').append(view.cell);
    }
    function chooseCell(cell, toggle = false) {
        selected = cell;
        if (toggle && identifying()) { if (chosenCells.has(cell)) chosenCells.delete(cell); else chosenCells.add(cell); }
        render();
    }
    function render() {
        const { state, step } = prepared;
        const updated = mode() === 'learn' ? page === 2 : completed && !before;
        const board = updated ? after : state;
        const evidence = mode() === 'learn' || guidance >= 2;
        const consequence = mode() === 'learn' && page >= 1 || guidance >= 3 || completed;
        for (let cell = 0; cell < 81; cell++) {
            const view = views[cell], value = board.board[cell];
            renderBoardCell(view, { value, candidates: [...board.candidates[cell] || []], given: exercise.puzzle[cell] !== '0', selected: selected === cell,
                label: `${cellName(cell)}, ${value === '0' ? 'candidates ' + [...board.candidates[cell] || []].sort().join(', ') : value}${chosenCells.has(cell) ? ', chosen for pattern' : ''}` });
            view.cell.classList.toggle('practice-evidence', evidence && step.evidence.includes(cell));
            view.cell.classList.toggle('practice-pattern-cell', chosenCells.has(cell));
            view.cell.classList.toggle('practice-consequence', consequence && (step.idx === cell || step.removals?.some(r => r.cell === cell)));
            view.cell.classList.toggle('practice-region', guidance === 1 && Math.floor(cell / 27) === Math.floor(patternCells(step)[0] / 27));
        }
        // One roving tab stop, without preselecting an answer in challenges.
        if (selected === null) views[0].cell.tabIndex = 0;
        const verb = step.kind === 'placement' ? 'place a digit' : 'exclude a candidate';
        $('task').textContent = mode() === 'learn' ? ['1 of 3 · Observe the evidence.', '2 of 3 · Follow the consequence.', '3 of 3 · Inspect the updated candidates.'][page]
            : identifying() ? `Identify the ${label(step.type)}: select its cells and digit(s), then Check pattern.` : `Find a ${label(step.type)} and ${verb}.`;
        $('selection').textContent = identifying() ? `${chosenCells.size} pattern cells · digits ${[...chosenDigits].sort().join(', ') || 'not selected'}`
            : selected === null ? 'Select a cell to inspect its candidates.' : `${cellName(selected)} · ${board.board[selected] === '0' ? [...board.candidates[selected]].sort().join(', ') : board.board[selected]}`;
        for (const b of $('pad').children) {
            b.disabled = mode() === 'learn' || completed || (!identifying() && selected === null);
            b.setAttribute('aria-pressed', String(identifying() && chosenDigits.has(b.dataset.digit)));
        }
        $('rule').hidden = mode() !== 'learn';
        $('pad').hidden = mode() === 'learn' || completed;
        $('selection').hidden = mode() === 'learn';
        root.querySelector('.practice-response').classList.toggle('practice-finished', completed || mode() === 'learn');
        $('pattern').hidden = !identifying(); $('back').hidden = $('forward').hidden = mode() !== 'learn';
        $('back').disabled = page === 0; $('forward').disabled = page === 2;
        $('explain').hidden = mode() === 'learn' || completed; $('explain').disabled = guidance === 3;
        $('explain').textContent = ['Show region', 'Show evidence', 'Show a consequence', 'Guidance shown'][guidance];
        $('before').hidden = !completed; $('before').textContent = before ? 'Show after' : 'Show before';
        $('proof').hidden = !(mode() === 'learn' && page >= 1 || guidance >= 2 || completed);
        $('proof').textContent = step.nudge || step.reason;
        const items = PRACTICE_BANK.groups[$('technique').value], history = practiceHistory();
        const own = history[prepared.id];
        $('history').textContent = `Exercise ${position % items.length + 1} of ${items.length} · ${items.filter(e => history[prepareId(e)]).length} practised.` + (own ? ` This exercise: ${own.independent} independent, ${own.assisted} assisted completed attempts.` : ' No completed attempts yet.');
    }
    const prepareId = e => practiceIdentity(e.puzzle, e.index);
    function load() {
        const items = PRACTICE_BANK.groups[$('technique').value]; exercise = items[position % items.length]; prepared = prepareExercise(exercise);
        after = { board: [...prepared.state.board], candidates: prepared.state.candidates.map(s => s ? new Set(s) : null) };
        applyDeduction(after, prepared.step);
        selected = null; completed = false; page = 0; guidance = 0; patternDone = false; before = false; incorrect = 0; chosenCells.clear(); chosenDigits.clear();
        $('rule').textContent = TECHNIQUE_LESSONS[exercise.type]; $('status').textContent = ''; render();
    }
    function answer(digit) {
        if (mode() === 'learn' || completed) return;
        if (identifying()) { if (chosenDigits.has(digit)) chosenDigits.delete(digit); else chosenDigits.add(digit); render(); return; }
        const result = practiceFeedback(prepared.state, prepared.step, selected, digit);
        $('status').textContent = result.message;
        if (result.correct) {
            completed = true;
            if (!recordPractice(prepared.id, { mode: mode(), assisted: mode() !== 'challenge' || guidance > 0 || incorrect > 0, incorrect })) $('status').textContent += ' Practice history could not be saved.';
        } else if (selected !== null && !result.alternative) incorrect++;
        render();
    }
    for (const digit of '123456789') {
        const b = document.createElement('button'); b.className = 'btn btn-toggle'; b.dataset.digit = digit; b.textContent = digit; b.onclick = () => answer(digit); $('pad').append(b);
    }
    $('pattern').onclick = () => {
        const result = checkPracticePattern(prepared.state, prepared.step, [...chosenCells], [...chosenDigits]);
        $('status').textContent = result.message;
        if (result.correct) { patternDone = true; selected = null; } else incorrect++;
        render();
    };
    $('explain').onclick = () => { guidance = Math.min(3, guidance + 1); render(); };
    $('back').onclick = () => { page--; render(); }; $('forward').onclick = () => { page++; render(); };
    $('before').onclick = () => { before = !before; render(); };
    $('next').onclick = () => { position++; load(); };
    $('technique').onchange = () => { position = 0; load(); }; $('mode').onchange = load;
    $('transfer').onclick = () => transfer(exercise.puzzle);
    $('review').onclick = () => {
        const history = practiceHistory();
        for (const [type, items] of Object.entries(PRACTICE_BANK.groups)) {
            const index = items.findIndex(e => { const h = history[prepareId(e)]; return h && (h.assisted || h.incorrect); });
            if (index >= 0) { $('technique').value = type; $('mode').value = 'challenge'; position = index; load(); $('status').textContent = 'Review: try this previously assisted exercise without guidance.'; return; }
        }
        $('status').textContent = 'No assisted exercises to review yet.';
    };
    $('grid').addEventListener('keydown', e => {
        if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
        const cell = selected ?? Number(e.target.closest('[data-cell]')?.dataset.cell || 0), next = arrowCell(e.key, cell, 9);
        if (next !== null) { e.preventDefault(); chooseCell(next); views[next].cell.focus({ preventScroll: true }); }
        else if (/^[1-9]$/.test(e.key)) { e.preventDefault(); answer(e.key); }
    });
    load();
}
