import { UNITS, cellName, peersOf } from './techniques.js';

const DIGITS = [...'123456789'];
const PEERS = Array.from({ length: 81 }, (_, i) => new Set(peersOf(i)));
const SIZE_NAMES = { 2: 'pair', 3: 'triple', 4: 'quad' };

/** Small deterministic combinations; never permute equivalent patterns. */
function* combinations(items, size, start = 0, chosen = []) {
    if (!size) { yield chosen; return; }
    for (let i = start; i <= items.length - size; i++) {
        yield* combinations(items, size - 1, i + 1, [...chosen, items[i]]);
    }
}

/** N cells whose union contains N digits reserve those digits in the house. */
export function findNakedSubset(grid, size) {
    if (![2, 3, 4].includes(size)) return null;
    for (const unit of UNITS) {
        const eligible = unit.cells.filter(i => grid[i]?.size >= 2 && grid[i].size <= size);
        for (const cells of combinations(eligible, size)) {
            const digits = [...new Set(cells.flatMap(i => [...grid[i]]))].sort();
            if (digits.length !== size) continue;
            const removals = unit.cells.filter(i => grid[i] && !cells.includes(i))
                .flatMap(cell => digits.filter(digit => grid[cell].has(digit)).map(digit => ({ cell, digit })));
            if (!removals.length) continue;
            const reason = `${cells.map(cellName).join(', ')} reserve ${digits.join(', ')} in ${unit.kind} ${unit.index + 1}`;
            return { type: `naked-${SIZE_NAMES[size]}`, cells, digits, removals,
                unit: { kind: unit.kind, index: unit.index }, reason,
                nudge: `${reason}. Those digits cannot go in the other cells of that ${unit.kind}.`,
                evidence: [...new Set([...cells, ...removals.map(r => r.cell)])] };
        }
    }
    return null;
}

/** N digits with homes in exactly N cells reserve those cells in the house. */
export function findHiddenSubset(grid, size) {
    if (![2, 3, 4].includes(size)) return null;
    for (const unit of UNITS) {
        const homes = new Map(DIGITS.map(digit => [digit, unit.cells.filter(i => grid[i]?.has(digit))]));
        const eligible = DIGITS.filter(digit => homes.get(digit).length >= 2 && homes.get(digit).length <= size);
        for (const digits of combinations(eligible, size)) {
            const cells = [...new Set(digits.flatMap(digit => homes.get(digit)))].sort((a, b) => a - b);
            if (cells.length !== size) continue;
            const removals = cells.flatMap(cell => [...grid[cell]].sort().filter(digit => !digits.includes(digit)).map(digit => ({ cell, digit })));
            if (!removals.length) continue;
            const reason = `${digits.join(', ')} have only ${cells.map(cellName).join(', ')} available in ${unit.kind} ${unit.index + 1}`;
            return { type: `hidden-${SIZE_NAMES[size]}`, cells, digits, removals,
                unit: { kind: unit.kind, index: unit.index }, reason,
                nudge: `${reason}. These cells must hold those digits, excluding their other candidates.`,
                evidence: [...unit.cells] };
        }
    }
    return null;
}

/** Basic fish: N base houses reserve a digit in N covering houses. */
export function findFish(grid, size) {
    if (![2, 3, 4].includes(size)) return null;
    for (const orientation of ['row', 'column']) {
        const units = orientation === 'row' ? UNITS.slice(0, 9) : UNITS.slice(9, 18);
        const crosses = orientation === 'row' ? UNITS.slice(9, 18) : UNITS.slice(0, 9);
        const crossOf = orientation === 'row' ? i => i % 9 : i => Math.floor(i / 9);
        for (const digit of DIGITS) {
            const bases = units.map(unit => ({ unit, homes: unit.cells.filter(i => grid[i]?.has(digit)) }))
                .filter(base => base.homes.length >= 2 && base.homes.length <= size);
            for (const pattern of combinations(bases, size)) {
                const cover = [...new Set(pattern.flatMap(base => base.homes.map(crossOf)))].sort((a, b) => a - b);
                if (cover.length !== size) continue;
                const cells = pattern.flatMap(base => base.homes);
                const removals = cover.flatMap(cross => crosses[cross].cells)
                    .filter(cell => !cells.includes(cell) && grid[cell]?.has(digit))
                    .map(cell => ({ cell, digit }));
                if (!removals.length) continue;
                const type = { 2: 'x-wing', 3: 'swordfish', 4: 'jellyfish' }[size];
                const baseNames = pattern.map(base => base.unit.index + 1).join(', ');
                const crossName = orientation === 'row' ? 'columns' : 'rows';
                const reason = `${digit} in ${orientation}s ${baseNames} is restricted to ${crossName} ${cover.map(i => i + 1).join(', ')}`;
                return { type, cells, digits: [digit], removals, orientation,
                    bases: pattern.map(base => base.unit.index), covers: cover, reason,
                    nudge: `${reason}. Each base ${orientation} needs that digit, reserving those ${size} ${crossName} and excluding it elsewhere in them.`,
                    evidence: [...new Set([...cells, ...removals.map(r => r.cell)])] };
            }
        }
    }
    return null;
}

/** Pivot XYZ, wings XZ and YZ. A target must see the pivot AND both wings. */
export function findXYZWing(grid) {
    for (let pivot = 0; pivot < 81; pivot++) {
        if (grid[pivot]?.size !== 3) continue;
        const digits = [...grid[pivot]].sort();
        const wings = [...PEERS[pivot]].filter(i => grid[i]?.size === 2 && [...grid[i]].every(d => grid[pivot].has(d)));
        for (const [first, second] of combinations(wings, 2)) {
            const common = [...grid[first]].filter(d => grid[second].has(d));
            if (common.length !== 1) continue;
            const z = common[0];
            const x = [...grid[first]].find(d => d !== z);
            const y = [...grid[second]].find(d => d !== z);
            const cells = [pivot, first, second];
            const removals = [...PEERS[pivot]].filter(cell => !cells.includes(cell)
                && PEERS[first].has(cell) && PEERS[second].has(cell) && grid[cell]?.has(z))
                .map(cell => ({ cell, digit: z }));
            if (!removals.length) continue;
            const reason = `one of ${cells.map(cellName).join(', ')} must be ${z}`;
            return { type: 'xyz-wing', cells, digits, removals, reason,
                nudge: `${cellName(pivot)} is ${x}, ${y} or ${z}. If ${x}, ${cellName(first)} becomes ${z}; if ${y}, ${cellName(second)} becomes ${z}. A cell seeing all three cannot be ${z}.`,
                evidence: [...cells, ...removals.map(r => r.cell)] };
        }
    }
    return null;
}

export const findHiddenTriple = grid => findHiddenSubset(grid, 3);
export const findNakedQuad = grid => findNakedSubset(grid, 4);
export const findHiddenQuad = grid => findHiddenSubset(grid, 4);
export const findSwordfish = grid => findFish(grid, 3);
export const findJellyfish = grid => findFish(grid, 4);
