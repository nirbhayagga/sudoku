import { validBoard } from './geometry.js';
/** Only automorphisms preserving BOTH extra-house layouts are allowed. Classic
 * within-band row/column permutations generally destroy variant constraints.
 */
export function canonicalVariant(puzzle, g) {
    if (g.size !== 9 || !['diagonal', 'hyper'].includes(g.rule) || !validBoard(puzzle, g)) throw new Error('Invalid variant board');
    const variants = [];
    for (const flip of [false, true]) for (let rotation = 0; rotation < 4; rotation++) {
        const values = Array(81);
        for (let i = 0; i < 81; i++) {
            let r = Math.floor(i / 9), c = i % 9;
            if (flip) c = 8 - c;
            for (let j = 0; j < rotation; j++) [r, c] = [c, 8 - r];
            values[r * 9 + c] = puzzle[i];
        }
        const labels = new Map();
        variants.push(values.map(d => { if (d === '0') return d; if (!labels.has(d)) labels.set(d, String(labels.size + 1)); return labels.get(d); }).join(''));
    }
    return variants.sort()[0];
}
