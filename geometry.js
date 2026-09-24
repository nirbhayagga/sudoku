/** Complete-house classic Sudoku geometry. No variant constraints are implied. */
const cache = new Map();
export function geometry(size = 9, boxRows = 3, boxCols = 3) {
    if (![4, 6, 9, 16].includes(size) || !Number.isInteger(boxRows) || !Number.isInteger(boxCols)
        || boxRows < 2 || boxCols < 2 || boxRows * boxCols !== size) throw new Error('Unsupported board geometry');
    const key = `${size}:${boxRows}x${boxCols}`;
    if (cache.has(key)) return cache.get(key);
    const count = size * size, digits = '123456789ABCDEFG'.slice(0, size);
    const units = [];
    for (let r = 0; r < size; r++) units.push({ kind: 'row', index: r, cells: Array.from({ length: size }, (_, c) => r * size + c) });
    for (let c = 0; c < size; c++) units.push({ kind: 'column', index: c, cells: Array.from({ length: size }, (_, r) => r * size + c) });
    for (let r = 0; r < size; r += boxRows) for (let c = 0; c < size; c += boxCols) {
        units.push({ kind: 'box', index: units.length - 2 * size,
            cells: Array.from({ length: size }, (_, i) => (r + Math.floor(i / boxCols)) * size + c + i % boxCols) });
    }
    const houses = Array.from({ length: count }, (_, cell) => units.filter(u => u.cells.includes(cell)));
    const peers = houses.map((h, cell) => [...new Set(h.flatMap(u => u.cells))].filter(i => i !== cell).sort((a, b) => a - b));
    for (const unit of units) { Object.freeze(unit.cells); Object.freeze(unit); }
    houses.forEach(Object.freeze); peers.forEach(Object.freeze);
    const result = Object.freeze({ key, size, boxRows, boxCols, count, digits, all: (1 << size) - 1,
        units: Object.freeze(units), houses: Object.freeze(houses), peers: Object.freeze(peers) });
    cache.set(key, result); return result;
}
export const SMALL_GEOMETRIES = Object.freeze({ '4': geometry(4, 2, 2), '6': geometry(6, 2, 3) });
export const cellLabel = (g, cell) => `r${Math.floor(cell / g.size) + 1}c${cell % g.size + 1}`;
export function validBoard(board, g) {
    return typeof board === 'string' && board.length === g.count && [...board].every(d => d === '0' || g.digits.includes(d));
}
export function parseSizedPuzzle(text, g) {
    if (typeof text !== 'string' || text.length > 10000) return null;
    // Accept only familiar grid separators; reject hidden letters/extra digits.
    const board = text.trim().toUpperCase().replace(/\./g, '0').replace(/[\s|+─│┌┐└┘├┤┬┴┼-]/g, '');
    return validBoard(board, g) ? board : null;
}
export function formatSizedPuzzle(board, g, format = 'rows') {
    if (!validBoard(board, g)) throw new Error('Invalid board');
    if (format === 'line') return board.replaceAll('0', '.');
    if (format === 'zeros') return board;
    const rows = Array.from({ length: g.size }, (_, r) => board.slice(r * g.size, (r + 1) * g.size).replaceAll('0', '.'));
    if (format === 'rows') return rows.join('\n');
    if (format !== 'grid') throw new Error('Invalid format');
    return rows.map((row, r) => (r && r % g.boxRows === 0 ? '-'.repeat(g.size * 2 + g.size / g.boxCols - 2) + '\n' : '')
        + [...row].map((d, c) => (c && c % g.boxCols === 0 ? '| ' : '') + d).join(' ')).join('\n');
}
