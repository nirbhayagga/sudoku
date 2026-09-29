import { renderResultSummary } from './result-view.js';
import { loadSavedGame, loadSmallData } from './storage.js';

/** Activity navigation owns dialogs, not game state or solving rules. */
export function createNavigation({ dialogs, classic, other, pause, resume, current }) {
    const $ = id => document.getElementById(id);
    function overlay(id, title, body) {
        const node = document.createElement('div'); node.id = id; node.className = 'modal-overlay';
        node.innerHTML = `<section class="modal activity-modal" role="dialog" aria-modal="true" aria-labelledby="${id}-title"><div class="modal-header"><h2 id="${id}-title">${title}</h2><button class="btn" data-close>Close</button></div><div class="modal-body">${body}</div></section>`;
        document.body.append(node);
        node.querySelector('[data-close]').onclick = () => dialogs.close(node);
        node.addEventListener('click', e => { if (e.target === node) dialogs.close(node); });
        return node;
    }
    const chooser = overlay('new-game-overlay', 'New game', `<p>Your current game is saved when you switch activities.</p>
      <label class="activity-field">Puzzle <select id="game-kind"><option value="classic">Classic · 9×9</option><option value="diagonal">Diagonal · 9×9</option><option value="hyper">Hyper · 9×9</option><option value="6">Quick puzzle · 6×6</option></select></label>
      <div id="classic-choices"></div><div id="other-choices" hidden><p id="other-rules"></p><label class="activity-field">Puzzle number <input id="other-level" type="number" required min="1" value="1"></label>
      <div class="modal-actions"><button class="btn btn-primary" id="other-start">Start puzzle</button><button class="btn" id="other-random">Random</button><button class="btn" id="other-path">Continue progression</button></div></div>
      <details id="resume-choices"><summary>Resume a saved game</summary><div id="resume-list" class="activity-list"></div></details>`);
    $('classic-choices').append($('setup-controls'));
    const learning = overlay('learn-overlay', 'Learn Sudoku', `<p>Start small, learn a pattern, then try it without guidance.</p><div class="activity-list"><button class="btn" id="learn-intro">Introduction · 4×4</button><p>Digits 1–4, with each digit once per row, column and 2×2 box. A short starting point.</p><button class="btn" id="learn-techniques">Technique lessons & practice</button><p>Worked examples, guided practice and independent challenges.</p></div>`);
    const tools = overlay('tools-overlay', 'Tools', `<p id="tools-context"></p><div class="activity-list" id="tools-list"></div>`);
    const puzzleTools = overlay('puzzle-tools-overlay', 'Puzzle tools', `<p id="puzzle-tools-context"></p><div class="activity-list" id="classic-puzzle-tools"></div><div id="other-puzzle-tools" hidden></div>`);
    const practiceButton = $('btn-practice');
    $('learn-techniques').replaceWith(practiceButton); practiceButton.textContent = 'Technique lessons & practice';
    const results = overlay('other-result-overlay', 'Puzzle complete', `<p id="other-result-identity"></p><p id="other-result-details"></p><p>Review or undo freely. Your original completion time and statistics stay recorded.</p><div class="modal-actions"><button class="btn" id="other-result-review">Review puzzle</button><button class="btn" id="other-result-share">Share puzzle</button><button class="btn" id="other-result-tools">Export &amp; print</button><button class="btn btn-primary" id="other-result-new">New game</button></div>`);
    $('other-result-review').onclick = () => dialogs.close(results);
    $('other-result-share').onclick = () => { dialogs.close(results); return other.share(); };
    $('other-result-tools').onclick = openPuzzleTools;
    $('other-result-new').onclick = openNewGame;
    function showResult(result) {
        renderResultSummary({ ...result, identityElement: $('other-result-identity'), detailsElement: $('other-result-details') });
        dialogs.open(results);
    }
    const nav = document.querySelector('.mode-navigation');
    $('mode-indicator').hidden = true;
    const play = $('tab-play'); play.classList.add('btn');
    play.title = 'Return to your Classic game or choose a puzzle';
    nav.replaceChildren(play);
    function button(label, action, parent, id) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label;
        if (id) b.id = id;
        b.onclick = action; parent.append(b); return b;
    }
    // Keep controller-owned buttons and listeners; only their location changes.
    const solver = $('tab-solver');
    // tab-solver was detached together with the old mode-toggle.
    const solverButton = solver || classic.solver;
    $('tools-list').append(solverButton); solverButton.classList.add('btn'); solverButton.textContent = 'Classic 9×9 solver';
    solverButton.addEventListener('click', () => dialogs.close(tools));
    button('Learn', () => { pause(); dialogs.open(learning); }, nav, 'nav-learn');
    button('Tools', () => { pause(); $('tools-context').textContent = current(); dialogs.open(tools); }, nav, 'nav-tools');
    const newButton = button('New game', () => openNewGame(), nav, 'nav-new-game'); newButton.classList.add('btn-primary');
    button('Import puzzle', () => { dialogs.close(tools); classic.import(); }, $('tools-list'));
    button('Generate puzzle', () => { dialogs.close(tools); classic.generate(); }, $('tools-list'));
    button('Export, share & print', openPuzzleTools, $('tools-list'));
    button('Statistics & complete backup', () => { dialogs.close(tools); classic.stats(); }, $('tools-list'));
    for (const [label, action] of [['Export & print', classic.export], ['Continue on another device', classic.handoff]]) {
        button(label, () => { dialogs.close(puzzleTools); action(); }, $('classic-puzzle-tools'));
    }
    for (const [id, text] of [['btn-share', 'Share puzzle'], ['btn-reset', 'Reset this puzzle']]) {
        const control = $(id); control.textContent = text; $('classic-puzzle-tools').append(control);
        control.addEventListener('click', () => dialogs.close(puzzleTools), { capture: true });
    }
    function updateChoices() {
        const kind = $('game-kind').value;
        $('classic-choices').hidden = kind !== 'classic'; $('other-choices').hidden = kind === 'classic';
        $('other-level').max = kind === '6' ? 120 : 24;
        $('other-level').value = '1';
        $('other-rules').textContent = kind === '6' ? 'A shorter puzzle with digits 1–6 and 2×3 boxes.' : kind === 'diagonal' ? 'Classic rules plus both marked diagonals.' : 'Classic rules plus four shaded 3×3 regions.';
    }
    function openNewGame() {
        pause();
        const list = $('resume-list'); list.replaceChildren();
        const saved = loadSavedGame();
        if (saved) button(`Classic 9×9 · ${saved.difficulty}${saved.level ? ' · Level ' + saved.level : ''}`, () => { dialogs.close(chooser); resume('classic'); }, list);
        for (const [track, label] of [['6', 'Quick 6×6'], ['9-diagonal', 'Diagonal 9×9'], ['9-hyper', 'Hyper 9×9'], ['4', 'Introduction 4×4']]) {
            const game = loadSmallData(track);
            if (game) button(`${label}${Number.isInteger(game.level) ? ' · Puzzle ' + game.level : ''}`, () => { dialogs.close(chooser); resume(track); }, list);
        }
        if (!list.children.length) list.textContent = 'No saved games yet.';
        dialogs.open(chooser);
    }
    function openPuzzleTools() {
        pause(); $('puzzle-tools-context').textContent = current();
        const activeOther = document.body.classList.contains('small-board-active');
        $('classic-puzzle-tools').hidden = activeOther; $('other-puzzle-tools').hidden = !activeOther;
        if (activeOther) other.tools($('other-puzzle-tools'));
        dialogs.open(puzzleTools);
    }
    $('game-kind').onchange = updateChoices;
    for (const [id, mode] of [['other-start', 'numbered'], ['other-random', 'random'], ['other-path', 'progression']]) {
        $(id).onclick = async () => {
            const level = Number($('other-level').value), max = Number($('other-level').max);
            if (mode === 'numbered' && (!Number.isInteger(level) || level < 1 || level > max)) { $('other-level').reportValidity(); return; }
            dialogs.close(chooser); await other.start($('game-kind').value, mode, level);
        };
    }
    $('classic-choices').addEventListener('click', e => {
        if (e.target.closest('#btn-new-game,#btn-random,#btn-daily,#btn-progression,#btn-import-play')) { dialogs.close(chooser); classic.activate(); }
    }, true);
    $('learn-intro').onclick = () => { dialogs.close(learning); resume('4'); };
    practiceButton.onclick = () => { dialogs.close(learning); };
    // The controller already attached its lazy lesson loader.
    updateChoices();
    return { openNewGame, openPuzzleTools, showResult, toolsOverlay: puzzleTools };
}
