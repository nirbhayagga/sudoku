import { UNITS, peersOf, cellName } from './techniques.js';

const peers = Array.from({ length: 81 }, (_, i) => new Set(peersOf(i)));
const box = cell => Math.floor(cell / 27) * 3 + Math.floor(cell % 9 / 3);

/** These rules REQUIRE independently established unique solvability. Discovery
 * only reads candidates. The caller binds and verifies the uniqueness premise.
 */
export function findUniqueRectangle(grid) {
    for (let r = 0; r < 8; r++) for (let s = r + 1; s < 9; s++) {
        for (let c = 0; c < 8; c++) for (let d = c + 1; d < 9; d++) {
            const cells = [r * 9 + c, r * 9 + d, s * 9 + c, s * 9 + d];
            if (cells.some(i => !grid[i]) || new Set(cells.map(box)).size !== 2) continue;
            const common = [...grid[cells[0]]].filter(v => cells.every(i => grid[i].has(v))).sort();
            for (let a = 0; a < common.length; a++) for (let b = a + 1; b < common.length; b++) {
                const digits = [common[a], common[b]];
                const roofs = cells.filter(i => grid[i].size > 2);
                let type, removals = [], unit;
                if (roofs.length === 1) {
                    type = 'unique-rectangle-1';
                    removals = digits.map(digit => ({ cell: roofs[0], digit }));
                } else if (roofs.length === 2) {
                    const extras = roofs.map(i => [...grid[i]].filter(v => !digits.includes(v)));
                    if (extras.every(e => e.length === 1) && extras[0][0] === extras[1][0]) {
                        type = 'unique-rectangle-2';
                        const digit = extras[0][0];
                        removals = [...peers[roofs[0]]].filter(i => !cells.includes(i) && peers[roofs[1]].has(i) && grid[i]?.has(digit)).map(cell => ({ cell, digit }));
                    }
                    if (!removals.length) for (const house of UNITS) {
                        if (!roofs.every(i => house.cells.includes(i))) continue;
                        for (const digit of digits) {
                            const homes = house.cells.filter(i => grid[i]?.has(digit));
                            if (homes.length !== 2 || !homes.every(i => roofs.includes(i))) continue;
                            type = 'unique-rectangle-4'; unit = { kind: house.kind, index: house.index };
                            removals = roofs.map(cell => ({ cell, digit: digits.find(v => v !== digit) }));
                            break;
                        }
                        if (removals.length) break;
                    }
                }
                if (!removals.length) continue;
                const reason = `${cells.map(cellName).join(', ')} form a two-box rectangle on ${digits.join(' and ')}`;
                const detail = type.endsWith('-1') ? 'The fourth corner must use an extra digit.'
                    : type.endsWith('-2') ? 'At least one extra corner must use the shared extra digit; cells seeing both cannot use it.'
                        : `A rectangle digit has only the two extra corners available in ${unit.kind} ${unit.index + 1}; exclude the other rectangle digit there.`;
                return { type, cells, digits, removals, unit, evidence: [...new Set([...cells, ...removals.map(v => v.cell)])],
                    reason, nudge: `${reason}. This puzzle has been verified to have one solution: allowing a swappable pair of solutions is impossible. ${detail}` };
            }
        }
    }
    return null;
}

export function findBugPlusOne(grid) {
    const open = grid.flatMap((set, i) => set ? [i] : []);
    const extra = open.filter(i => grid[i].size !== 2);
    if (extra.length !== 1 || grid[extra[0]].size !== 3) return null;
    const idx = extra[0];
    for (const digit of [...grid[idx]].sort()) {
        const valid = UNITS.every(unit => [...'123456789'].every(d => {
            const count = unit.cells.filter(i => grid[i]?.has(d)).length;
            return count === (unit.cells.includes(idx) && d === digit ? 3 : count ? 2 : 0);
        }));
        if (valid) return { type: 'bug-plus-one', idx, digit, cells: open, evidence: open,
            reason: 'one extra candidate prevents a bivalue universal grave',
            nudge: `Every empty cell except ${cellName(idx)} has two candidates. ${digit} is the extra candidate occurring three times in each of its houses. The verified unique puzzle requires ${cellName(idx)} to be ${digit}.` };
    }
    return null;
}
