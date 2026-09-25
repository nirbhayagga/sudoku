import { PRACTICE_BANK } from './practice-bank.js';
import { prepareExercise, acceptsPracticeMove } from './practice.js';
import { createHintDiagram } from './hint-diagram.js';
import { cellName } from './techniques.js';

export function createPracticeApp(root) {
    root.innerHTML = `<label>Technique <select id="practice-technique"></select></label>
      <p id="practice-task"></p><div class="practice-grid" id="practice-grid" role="group" aria-label="Technique practice board"></div>
      <p id="practice-selection"></p><div class="practice-pad" id="practice-pad" role="group" aria-label="Choose a candidate"></div>
      <p id="practice-status" role="status"></p><div class="modal-actions"><button class="btn" id="practice-explain">Show explanation</button><button class="btn" id="practice-next">Next exercise</button></div>
      <details id="practice-proof" hidden><summary>Candidate explanation</summary><div></div></details>
      <p>Candidate marks come from the puzzle and its preceding verified deductions. This lesson does not affect your game, statistics or progression.</p>`;
    const $ = id => root.querySelector(`#practice-${id}`), label = type => type.replaceAll('-', ' ');
    let position = 0, prepared, exercise, selected, completed = false;
    for (const type of Object.keys(PRACTICE_BANK.groups)) {
        const option = document.createElement('option'); option.value = type; option.textContent = label(type); $('technique').append(option);
    }
    function showExplanation() {
        const box = $('proof').querySelector('div'); box.replaceChildren();
        const p = document.createElement('p'); p.textContent = prepared.step.nudge || prepared.step.reason;
        box.append(p, createHintDiagram(prepared.step, document)); $('proof').hidden = false; $('proof').open = true;
    }
    function chooseCell(cell) {
        selected = cell;
        for (const button of $('grid').children) {
            button.classList.toggle('practice-selected', Number(button.dataset.cell) === cell);
            button.setAttribute('aria-pressed', String(Number(button.dataset.cell) === cell));
        }
        $('selection').textContent = `${cellName(cell)} — ${prepared.step.kind === 'placement' ? 'which digit must go here?' : 'which candidate can be excluded?'} Choose a digit below.`;
        for (const b of $('pad').children) b.disabled = completed || !prepared.state.candidates[cell]?.has(b.dataset.digit);
    }
    function load() {
        const items = PRACTICE_BANK.groups[$('technique').value];
        exercise = items[position % items.length]; prepared = prepareExercise(exercise); completed = false;
        const { state, step } = prepared;
        $('task').textContent = `Exercise ${position % items.length + 1} of ${items.length}: use ${label(step.type)} to ${step.kind === 'placement' ? 'place a digit' : 'exclude a candidate'}. Outlined cells support this pattern.`;
        $('status').textContent = ''; $('proof').hidden = true; $('proof').open = false; $('proof').querySelector('div').replaceChildren(); $('grid').replaceChildren();
        for (let cell = 0; cell < 81; cell++) {
            const b = document.createElement('button'); b.className = 'practice-cell'; b.dataset.cell = cell;
            b.classList.toggle('practice-evidence', step.evidence.includes(cell));
            const value = state.board[cell], candidates = [...(state.candidates[cell] || [])].sort();
            b.setAttribute('aria-label', `${cellName(cell)}, ${value === '0' ? `candidates ${candidates.join(', ')}` : value}`);
            if (value !== '0') b.textContent = value;
            else {
                const marks = document.createElement('span'); marks.className = 'practice-notes';
                for (const digit of '123456789') { const mark = document.createElement('span'); mark.textContent = candidates.includes(digit) ? digit : ''; marks.append(mark); }
                b.append(marks);
            }
            b.disabled = value !== '0'; b.onclick = () => chooseCell(cell); $('grid').append(b);
        }
        chooseCell(step.idx ?? step.removals[0].cell);
    }
    for (const digit of '123456789') {
        const b = document.createElement('button'); b.className = 'btn'; b.dataset.digit = digit; b.textContent = digit;
        b.onclick = () => {
            if (completed) return;
            if (acceptsPracticeMove(prepared.step, selected, digit)) {
                completed = true; $('status').textContent = 'Correct — this deduction follows from the highlighted pattern.'; chooseCell(selected); showExplanation();
            } else $('status').textContent = 'That is not a conclusion of the highlighted pattern. Try another candidate or open the explanation.';
        };
        $('pad').append(b);
    }
    $('explain').onclick = showExplanation;
    $('next').onclick = () => { position++; load(); };
    $('technique').onchange = () => { position = 0; load(); };
    load();
}
