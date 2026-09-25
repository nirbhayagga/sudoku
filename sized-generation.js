import { solveSized, assessSized } from './sized-solver.js';
export function seededRandom(seed) {
    let state = seed >>> 0;
    return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const shuffle = (a, random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** Deterministic digging; every accepted removal preserves uniqueness.
 * The optional explained-path constraint can retain non-minimal clue sets. */
export function generateSized(g, seed, { requireExplained = false } = {}) {
    const random = seededRandom(seed);
    const full = solveSized('0'.repeat(g.count), g, { limit: 1, random });
    if (full.status !== 'solved') throw new Error('Generation work limit');
    const board = [...full.solutions[0]];
    for (const cell of shuffle(Array.from({ length: g.count }, (_, i) => i), random)) {
        const old = board[cell]; board[cell] = '0';
        const result = solveSized(board.join(''), g);
        if (result.status !== 'solved' || result.count !== 1 || requireExplained && assessSized(board.join(''), g).status !== 'solved') board[cell] = old;
    }
    const puzzle = board.join('');
    return { puzzle, assessment: assessSized(puzzle, g), seed };
}
function permutations(items) {
    if (items.length < 2) return [items];
    return items.flatMap((v, i) => permutations(items.filter((_, j) => j !== i)).map(p => [v, ...p]));
}
const ordersCache = new Map();
function houseOrders(size, groupSize) {
    const key = `${size}:${groupSize}`;
    if (ordersCache.has(key)) return ordersCache.get(key);
    const groups = Array.from({ length: size / groupSize }, (_, i) => Array.from({ length: groupSize }, (_, j) => i * groupSize + j));
    const result = [];
    for (const order of permutations(groups)) {
        let parts = [[]];
        for (const group of order) parts = parts.flatMap(p => permutations(group).map(g => [...p, ...g]));
        result.push(...parts);
    }
    ordersCache.set(key, result); return result;
}
/** Exact orbit representative under digit renaming, band/stack and within-house
 * permutations, plus transpose for square boxes. Rectangular transpose changes
 * geometry, so 6x6 is normalized within its chosen 2x3 orientation only.
 */
export function canonicalSized(puzzle, g) {
    const rows = houseOrders(g.size, g.boxRows), cols = houseOrders(g.size, g.boxCols);
    let best = null;
    for (const transposed of g.boxRows === g.boxCols ? [false, true] : [false]) for (const r of rows) for (const c of cols) {
        let value = '', next = 1; const labels = new Map();
        for (let i = 0; i < g.count; i++) {
            const row = r[Math.floor(i / g.size)], col = c[i % g.size];
            const d = puzzle[transposed ? col * g.size + row : row * g.size + col];
            if (d === '0') value += '0';
            else { if (!labels.has(d)) labels.set(d, g.digits[next++ - 1]); value += labels.get(d); }
            if (best && value > best.slice(0, value.length)) break;
        }
        if (value.length === g.count && (best === null || value < best)) best = value;
    }
    return best;
}
