import { acceptsPracticeMove } from './practice.js';
import { REASONING_RULES } from './reasoning.js';
import { UNITS, cellName } from './techniques.js';

export const TECHNIQUE_LESSONS = Object.freeze({
    'naked-single': 'A cell with just one candidate must contain that digit. Check its row, column and box.',
    'hidden-single': 'A digit with only one possible home in a row, column or box must go there, even when the cell has other candidates.',
    'pointing-pair': 'If all homes for a digit in a box share a row or column, remove it from the rest of that line.',
    'claiming-pair': 'If all homes for a digit in a row or column lie in one box, remove it from the rest of that box.',
    'claiming-triple': 'Three homes for a digit can also be confined to one box. The same claiming rule applies.',
    'naked-pair': 'Two cells in one house containing only the same two candidates reserve those digits. Remove them from the other cells in the house.',
    'hidden-pair': 'If two digits have only the same two homes in a house, those cells reserve the digits. Remove other candidates from those two cells.',
    'naked-triple': 'Three cells in a house whose combined candidates are exactly three digits reserve those digits.',
    'hidden-triple': 'Three digits confined to three cells in a house reserve those cells; other candidates leave those cells.',
    'naked-quad': 'Four cells in a house whose combined candidates are exactly four digits reserve those digits.',
    'hidden-quad': 'Four digits confined to four cells in a house reserve those cells; other candidates leave those cells.',
    'x-wing': 'When a digit has the same two column homes in two rows, remove it from the other cells in those columns. Rows and columns can be exchanged.',
    'swordfish': 'Three rows restricting a digit to the same three columns reserve its positions there. Rows and columns can be exchanged.',
    'jellyfish': 'Four rows restricting a digit to the same four columns reserve its positions there. Rows and columns can be exchanged.',
    'xy-wing': 'A two-candidate pivot sees two wings. Either pivot value forces the shared wing digit in a wing; remove that digit from cells seeing both wings.',
    'xyz-wing': 'A three-candidate pivot and two two-candidate wings force their common digit somewhere in the pattern. A removal cell must see all three.',
});
export const patternCells = step => [...new Set(step.cells?.length ? step.cells : [step.idx])].filter(Number.isInteger);
export const patternDigits = (state, step) => [...new Set(step.digits?.length ? step.digits : step.digit ? [step.digit] : patternCells(step).flatMap(i => [...state.candidates[i] || []]))].sort();

/** Failed-premise feedback refers only to the visible reconstructed candidates. */
export function checkPracticePattern(state, step, cells, digits) {
    const wantedCells = patternCells(step), wantedDigits = patternDigits(state, step);
    if (!cells.length || !digits.length) return { correct: false, message: 'Select the pattern cells and its digit or digits first.' };
    if (step.type.startsWith('naked-') && step.type !== 'naked-single') {
        if (!UNITS.some(u => cells.every(c => u.cells.includes(c)))) return { correct: false, message: 'These cells do not share one row, column or box. A naked subset must lie in one house.' };
        const union = new Set(cells.flatMap(c => [...state.candidates[c] || []]));
        if (union.size !== cells.length) return { correct: false, message: `${cells.length} selected cells have ${union.size} distinct candidates (${[...union].sort().join(', ')}). A naked subset needs the same number of cells and candidates.` };
    }
    if (cells.some(c => state.board[c] !== '0')) return { correct: false, message: 'A filled cell is not a candidate home. Select empty cells forming the pattern.' };
    if (digits.some(d => !cells.some(c => state.candidates[c]?.has(d)))) return { correct: false, message: 'One of those digits is not a candidate in any selected cell.' };
    const correct = cells.length === wantedCells.length && wantedCells.every(c => cells.includes(c)) && digits.length === wantedDigits.length && wantedDigits.every(d => digits.includes(d));
    return { correct, message: correct ? 'Pattern identified. Now choose one consequence.' : 'That selection is not the pattern used in this worked example. Inspect the candidate homes, or reveal the next guidance stage.' };
}

export function practiceFeedback(state, step, cell, digit) {
    if (!Number.isInteger(cell)) return { correct: false, message: 'Select a cell, then a digit.' };
    if (state.board[cell] !== '0') return { correct: false, message: `${cellName(cell)} is already filled. Choose an empty cell.` };
    if (!state.candidates[cell]?.has(digit)) return { correct: false, message: `${digit} is not a remaining candidate in ${cellName(cell)}.` };
    if (acceptsPracticeMove(step, cell, digit)) return { correct: true, message: 'Correct. The deduction has been applied; compare before and after on the same board.' };
    // Only acknowledge deductions the bounded, solution-independent detectors
    // actually found. Compatible with an answer is not a logical justification.
    for (const rule of REASONING_RULES.filter(r => r.family < 4)) {
        const found = rule.find(state.candidates);
        if (found && acceptsPracticeMove({ ...found, kind: found.removals ? 'elimination' : 'placement' }, cell, digit)) {
            return { correct: false, alternative: true, message: `A verified ${found.type.replaceAll('-', ' ')} also supports this move. This exercise asks for a consequence of the chosen ${step.type.replaceAll('-', ' ')} pattern.` };
        }
    }
    return { correct: false, message: step.kind === 'placement' ? 'This pattern does not establish that placement. Check all candidate homes in its house.' : 'That candidate is not excluded by this pattern. Check which cells the pattern constrains; a matching digit alone is insufficient.' };
}
