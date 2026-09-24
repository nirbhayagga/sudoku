import { validBoard, cellLabel } from './geometry.js';
export const bits = mask => { const out = []; for (let d = 0; mask; d++, mask >>>= 1) if (mask & 1) out.push(d); return out; };
export function sizedCandidates(board, g) {
    if (!validBoard(board, g)) throw new Error('Invalid board');
    return Uint32Array.from([...board], (v, cell) => {
        if (v !== '0') return 0;
        let mask = g.all;
        for (const p of g.peers[cell]) if (board[p] !== '0') mask &= ~(1 << g.digits.indexOf(board[p]));
        return mask;
    });
}
export function consistent(board, g) {
    return validBoard(board, g) && g.units.every(u => {
        const filled = u.cells.map(i => board[i]).filter(d => d !== '0');
        return new Set(filled).size === filled.length;
    });
}
/** MRV complete solver. Explicit work-limit results are never called unsolvable. */
export function solveSized(board, g, { limit = 2, maxNodes = 1000000, random = null } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000 || !Number.isSafeInteger(maxNodes) || maxNodes < 1) throw new Error('Invalid search budget');
    if (!consistent(board, g)) return { status: 'invalid', count: 0, solutions: [], nodes: 0 };
    const solutions = []; let nodes = 0, exhausted = false;
    const visit = input => {
        if (solutions.length >= limit || exhausted) return;
        if (++nodes > maxNodes) { exhausted = true; return; }
        const values = [...input], candidates = sizedCandidates(input, g);
        while (true) {
            if (values.some((d, i) => d === '0' && candidates[i] === 0)) return;
            let idx = -1, digit = -1;
            for (let i = 0; i < g.count; i++) if (values[i] === '0' && (candidates[i] & (candidates[i] - 1)) === 0) { idx = i; digit = bits(candidates[i])[0]; break; }
            if (idx < 0) for (const u of g.units) {
                for (let d = 0; d < g.size; d++) {
                    if (u.cells.some(i => values[i] === g.digits[d])) continue;
                    const homes = u.cells.filter(i => candidates[i] & (1 << d));
                    if (!homes.length) return;
                    if (homes.length === 1) { idx = homes[0]; digit = d; break; }
                }
                if (idx >= 0) break;
            }
            if (idx < 0) break;
            values[idx] = g.digits[digit]; candidates[idx] = 0;
            for (const p of g.peers[idx]) candidates[p] &= ~(1 << digit);
        }
        if (!values.includes('0')) { solutions.push(values.join('')); return; }
        let selected = -1;
        for (let i = 0; i < g.count; i++) if (values[i] === '0' && (selected < 0 || bits(candidates[i]).length < bits(candidates[selected]).length)) selected = i;
        const choices = bits(candidates[selected]);
        if (random) for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
        for (const d of choices) { values[selected] = g.digits[d]; visit(values.join('')); if (solutions.length >= limit || exhausted) break; }
    };
    visit(board);
    return { status: exhausted ? 'budget-exhausted' : solutions.length ? 'solved' : 'no-solution', count: solutions.length, solutions, nodes: Math.min(nodes, maxNodes) };
}
function* combinations(a, n, start = 0, out = []) {
    if (!n) { yield out; return; }
    for (let i = start; i <= a.length - n; i++) yield* combinations(a, n - 1, i + 1, [...out, a[i]]);
}
export function nextSizedStep(board, candidates, g) {
    for (let i = 0; i < g.count; i++) if (board[i] === '0' && bits(candidates[i]).length === 1) {
        const digit = g.digits[bits(candidates[i])[0]];
        return { type: 'naked-single', family: 0, idx: i, digit, evidence: [i], nudge: `${cellLabel(g, i)} has only ${digit} remaining.` };
    }
    for (const u of g.units) for (let d = 0; d < g.size; d++) {
        const homes = u.cells.filter(i => candidates[i] & (1 << d));
        if (homes.length === 1) return { type: 'hidden-single', family: 0, idx: homes[0], digit: g.digits[d], evidence: u.cells,
            nudge: `${g.digits[d]} has only ${cellLabel(g, homes[0])} available in ${u.kind} ${u.index + 1}.` };
    }
    for (const u of g.units) for (let d = 0; d < g.size; d++) {
        const homes = u.cells.filter(i => candidates[i] & (1 << d));
        if (homes.length > 1) for (const other of g.units) {
            if (other === u || !homes.every(i => other.cells.includes(i))) continue;
            const removals = other.cells.filter(i => !u.cells.includes(i) && (candidates[i] & (1 << d))).map(cell => ({ cell, digit: g.digits[d] }));
            if (removals.length) return { type: 'locked-candidates', family: 1, removals, evidence: homes,
                nudge: `${g.digits[d]} in ${u.kind} ${u.index + 1} is confined to ${other.kind} ${other.index + 1}; exclude it elsewhere in that house.` };
        }
    }
    for (const u of g.units) for (const n of [2, 3]) {
        const open = u.cells.filter(i => bits(candidates[i]).length >= 2 && bits(candidates[i]).length <= n);
        for (const cells of combinations(open, n)) {
            const mask = cells.reduce((m, i) => m | candidates[i], 0);
            if (bits(mask).length !== n) continue;
            const removals = u.cells.filter(i => !cells.includes(i)).flatMap(cell => bits(candidates[cell] & mask).map(d => ({ cell, digit: g.digits[d] })));
            if (removals.length) return { type: n === 2 ? 'naked-pair' : 'naked-triple', family: 2, removals, evidence: cells,
                nudge: `${cells.map(i => cellLabel(g, i)).join(', ')} reserve ${bits(mask).map(d => g.digits[d]).join(', ')} in ${u.kind} ${u.index + 1}.` };
        }
    }
    return null;
}
export function applySizedStep(state, step, g) {
    if (step.removals) for (const r of step.removals) state.candidates[r.cell] &= ~(1 << g.digits.indexOf(r.digit));
    else {
        state.board[step.idx] = step.digit; state.candidates[step.idx] = 0;
        for (const p of g.peers[step.idx]) state.candidates[p] &= ~(1 << g.digits.indexOf(step.digit));
    }
}
export function assessSized(puzzle, g, { trace = false } = {}) {
    const solved = solveSized(puzzle, g);
    if (solved.status === 'budget-exhausted' || solved.count !== 1) return { status: solved.status === 'budget-exhausted' ? solved.status : solved.count > 1 ? 'multiple-solutions' : 'no-solution', family: null };
    const state = { board: [...puzzle], candidates: sizedCandidates(puzzle, g) }, steps = [];
    let family = 0, eliminations = 0, hiddenSingles = 0;
    while (state.board.includes('0')) {
        const step = nextSizedStep(state.board, state.candidates, g);
        if (!step) return { status: 'unresolved', family: null, remaining: state.board.filter(v => v === '0').length, eliminations, hiddenSingles, ...(trace ? { trace: steps } : {}) };
        if (step.removals ? step.removals.some(r => solved.solutions[0][r.cell] === r.digit) : solved.solutions[0][step.idx] !== step.digit) throw new Error('Unsound sized deduction');
        family = Math.max(family, step.family);
        if (step.removals) eliminations++; if (step.type === 'hidden-single') hiddenSingles++;
        applySizedStep(state, step, g); steps.push(step);
    }
    return { status: 'solved', family, eliminations, hiddenSingles, steps: steps.length, ...(trace ? { trace: steps } : {}) };
}
