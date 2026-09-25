import { geometry } from '../../geometry.js';
import { canonicalSized } from '../../sized-generation.js';

const g = geometry(9, 3, 3);
/** Necessary orbit invariants only. A matching bucket still needs exact checking. */
export function orbitBucket(puzzle) {
    const counts = units => units.map(u => u.cells.filter(i => puzzle[i] !== '0').length).sort((a, b) => a - b).join(',');
    const axes = [counts(g.units.slice(0, 9)), counts(g.units.slice(9, 18))].sort();
    const digits = [...'123456789'].map(d => [...puzzle].filter(v => v === d).length).sort((a, b) => a - b);
    return `${axes.join('|')}|${counts(g.units.slice(18))}|${digits.join(',')}`;
}

/** Full classic orbit check, with cheap invariant buckets to avoid needless work. */
export function equivalenceIndex(puzzles) {
    const buckets = new Map(), canonical = new Map();
    const key = p => { if (!canonical.has(p)) canonical.set(p, canonicalSized(p, g)); return canonical.get(p); };
    const add = puzzle => {
        const fingerprint = orbitBucket(puzzle);
        if (!buckets.has(fingerprint)) buckets.set(fingerprint, []);
        buckets.get(fingerprint).push(puzzle);
    };
    for (const p of puzzles) add(p);
    return { add, has(puzzle) {
        const matches = buckets.get(orbitBucket(puzzle)) || [];
        return matches.some(p => p === puzzle || key(p) === key(puzzle));
    } };
}

export function classicTransforms(puzzle) {
    const map = fn => Array.from({ length: 81 }, (_, i) => puzzle[fn(i)]).join('');
    return [puzzle.replace(/[1-9]/g, d => String(10 - Number(d))),
        map(i => i % 9 * 9 + Math.floor(i / 9)),
        map(i => (Math.floor(i / 9) < 2 ? 1 - Math.floor(i / 9) : Math.floor(i / 9)) * 9 + i % 9)];
}
