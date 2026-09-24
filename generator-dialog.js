import { createAnalysisClient } from './analysis-client.js';

/** Preview creation never changes the current board. Playing is an explicit action. */
export function createGeneratorDialog({ dialogs, onPlay, onExport }) {
    const $ = id => document.getElementById(id);
    const overlay = $('generator-overlay');
    const form = $('generator-form');
    const status = $('generator-status');
    const client = createAnalysisClient();
    let revision = 0;
    let busy = false;
    let result = null;
    function setBusy(value) {
        busy = value;
        $('btn-generator-start').disabled = value;
        $('btn-generator-cancel').hidden = !value;
        form.setAttribute('aria-busy', String(value));
    }
    function cancel() {
        ++revision;
        client.cancel();
        if (busy) status.textContent = 'Search cancelled. No puzzle replaced.';
        setBusy(false);
    }
    function clueFields() {
        const mode = $('generator-clue-mode').value;
        $('generator-clue-fields').hidden = mode === 'auto';
        $('generator-min').disabled = mode === 'auto';
        $('generator-max-field').hidden = mode !== 'range';
        $('generator-max').disabled = mode !== 'range';
        $('generator-min-label').textContent = mode === 'range' ? 'Minimum clues' : 'Clues';
    }
    form.addEventListener('input', () => { cancel(); clueFields(); });
    form.addEventListener('change', clueFields);
    form.addEventListener('submit', async event => {
        event.preventDefault();
        cancel();
        const request = revision;
        const seed = $('generator-seed').value.trim() || Array.from(crypto.getRandomValues(new Uint32Array(2)), n => n.toString(36)).join('-');
        const options = { family: $('generator-family').value, symmetry: $('generator-symmetry').value,
            maxAttempts: Number($('generator-attempts').value), seed };
        const clueMode = $('generator-clue-mode').value;
        if (clueMode !== 'auto') {
            options.minClues = Number($('generator-min').value);
            options.maxClues = clueMode === 'exact' ? options.minClues : Number($('generator-max').value);
        }
        result = null;
        $('generator-result').hidden = true;
        setBusy(true);
        status.textContent = 'Generating and checking uniqueness…';
        try {
            const generated = await client.request('generate', options, { timeoutMs: 60000, onProgress(progress) {
                status.textContent = `Attempt ${progress.attempts} of ${progress.maxAttempts} · closest puzzle has ${progress.closestClues} clues.`;
            } });
            if (request !== revision) return;
            result = generated;
            const preview = $('generator-preview');
            preview.replaceChildren();
            for (const digit of result.puzzle) {
                const cell = document.createElement('span');
                cell.textContent = digit === '0' ? '' : digit;
                cell.setAttribute('aria-hidden', 'true');
                preview.append(cell);
            }
            preview.setAttribute('aria-label', `Generated Sudoku with ${result.clues} clues. Play, export or print below.`);
            status.textContent = result.targetMet ? 'Target met. This puzzle has exactly one solution.'
                : 'Target not met within the search budget. The closest unique puzzle is shown below.';
            const o = result.options;
            $('generator-summary').textContent = `${result.clues} clues · ${result.assessment.label}`;
            $('generator-settings').textContent = `Seed: ${o.seed}. Requested ${o.family}, ${o.minClues}–${o.maxClues} clues, ${o.symmetry === 'none' ? 'no symmetry' : '180° symmetry'}, ${o.maxAttempts} attempts. Engine ${result.version} / ${result.ratingVersion}.`;
            $('generator-result').hidden = false;
        } catch (error) {
            if (request === revision && error.name !== 'AbortError') status.textContent = error.message;
        } finally { if (request === revision) setBusy(false); }
    });
    $('btn-generator-close').addEventListener('click', () => dialogs.close(overlay));
    $('btn-generator-cancel').addEventListener('click', cancel);
    overlay.addEventListener('click', event => { if (event.target === overlay) dialogs.close(overlay); });
    $('btn-generator-play').addEventListener('click', () => {
        if (!result) return;
        const chosen = result;
        dialogs.close(overlay);
        void onPlay(chosen.puzzle, chosen.assessment);
    });
    for (const [id, print] of [['btn-generator-export', false], ['btn-generator-print', true]]) {
        $(id).addEventListener('click', () => { if (result) onExport(result.puzzle, print); });
    }
    clueFields();
    return { open() { dialogs.open(overlay, { initialFocus: $('generator-family'), onClose: cancel }); } };
}
