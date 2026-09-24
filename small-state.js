import { SMALL_GEOMETRIES, validBoard } from './geometry.js';
import { sizedCandidates, solveSized, nextSizedStep, applySizedStep } from './sized-solver.js';
const snapshot = s => ({ board: s.board, notes: [...s.notes], auto: s.auto });
export function newSmallGame(puzzle, g, { id = 'imported', level = null } = {}) {
    const solved = solveSized(puzzle, g);
    if (solved.status !== 'solved' || solved.count !== 1 || !puzzle.includes('0')) throw new Error('Choose an incomplete puzzle with exactly one solution.');
    return { version: 1, size: g.size, geometry: g.key, puzzle, board: puzzle, id, level,
        notes: Array(g.count).fill(0), auto: false, hints: 0, elapsedMs: 0, recorded: false, undo: [], redo: [] };
}
export function validateSmallGame(s) {
    const g = SMALL_GEOMETRIES[s?.size];
    const validSnapshot = v => v && validBoard(v.board, g) && [...s.puzzle].every((d, i) => d === '0' || v.board[i] === d)
        && typeof v.auto === 'boolean' && Array.isArray(v.notes) && v.notes.length === g.count && v.notes.every(n => Number.isInteger(n) && n >= 0 && n <= g.all);
    if (!g || s.version !== 1 || s.geometry !== g.key || !validBoard(s.puzzle, g)
        || !validSnapshot(s) || typeof s.id !== 'string' || s.id.length > 100
        || !(s.level === null || Number.isInteger(s.level) && s.level >= 1 && s.level <= 10000)
        || !Number.isSafeInteger(s.elapsedMs) || s.elapsedMs < 0 || s.elapsedMs > 31536000000
        || !Number.isSafeInteger(s.hints) || s.hints < 0 || s.hints > 100000 || typeof s.recorded !== 'boolean'
        || ![s.undo, s.redo].every(stack => Array.isArray(stack) && stack.length <= 200 && stack.every(validSnapshot))) return null;
    const solved = solveSized(s.puzzle, g);
    return solved.status === 'solved' && solved.count === 1 ? structuredClone(s) : null;
}
export function editSmallGame(s, g, mutate) {
    const before = snapshot(s); mutate(s);
    if (s.auto) s.notes = [...sizedCandidates(s.board, g)];
    if (JSON.stringify(before) === JSON.stringify(snapshot(s))) return false;
    s.undo.push(before); if (s.undo.length > 200) s.undo.shift(); s.redo = [];
    return true;
}
export function smallDigit(s, g, cell, digit, notes = false) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= g.count || s.puzzle[cell] !== '0' || typeof digit !== 'string' || digit.length !== 1 || !('0' + g.digits).includes(digit)) return false;
    return editSmallGame(s, g, state => {
        if (notes && digit !== '0' && !state.auto && state.board[cell] === '0') state.notes[cell] ^= 1 << g.digits.indexOf(digit);
        else if (!notes || digit === '0') {
            state.board = [...state.board].map((d, i) => i === cell ? digit : d).join('');
            state.notes[cell] = 0;
            if (digit !== '0') for (const p of g.peers[cell]) state.notes[p] &= ~(1 << g.digits.indexOf(digit));
        }
    });
}
export function smallUndo(s, redo = false) {
    const from = redo ? s.redo : s.undo, to = redo ? s.undo : s.redo;
    if (!from.length) return false;
    to.push(snapshot(s)); Object.assign(s, from.pop()); return true;
}
export function smallHint(s, g) {
    const solved = solveSized(s.puzzle, g);
    const answer = solved.solutions[0];
    for (let i = 0; i < g.count; i++) if (s.board[i] !== '0' && s.board[i] !== answer[i]) return { idx: i, digit: answer[i], answerBased: true, trace: [], nudge: 'This entry differs from the verified solution. Reveal offers its correction.' };
    const state = { board: [...s.board], candidates: sizedCandidates(s.board, g) }, trace = [];
    for (let i = 0; i < g.count * g.size; i++) {
        const step = nextSizedStep(state.board, state.candidates, g);
        if (!step) break;
        if (step.removals ? step.removals.some(r => answer[r.cell] === r.digit) : answer[step.idx] !== step.digit) throw new Error('Invalid hint');
        trace.push(step); applySizedStep(state, step, g);
        if (!step.removals) return { ...step, trace, answerBased: false };
    }
    const idx = s.board.indexOf('0');
    return idx < 0 ? null : { idx, digit: answer[idx], answerBased: true, trace,
        nudge: 'No supported deduction leads to a placement here. Reveal will supply a verified number.' };
}
