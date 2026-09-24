import { UNITS, peersOf, cellName } from './techniques.js';

const PEERS = Array.from({ length: 81 }, (_, i) => peersOf(i));
const atom = (cell, digit) => cell * 9 + Number(digit) - 1;
const literal = (cell, digit, on) => atom(cell, digit) * 2 + Number(on);
const describe = id => ({ cell: Math.floor(id / 18), digit: String(Math.floor(id / 2) % 9 + 1), on: Boolean(id % 2) });

// Each cell and each unfilled house/digit is an exactly-one constraint. Unlike
// static links, these can acquire a last remaining alternative inside a branch.
function constraints(grid) {
    const groups = [];
    for (let cell = 0; cell < 81; cell++) if (grid[cell]) {
        groups.push({ cause: 'remaining-cell', members: [...grid[cell]].sort().map(d => atom(cell, d)) });
    }
    for (const unit of UNITS) for (const digit of '123456789') {
        const members = unit.cells.filter(c => grid[c]?.has(digit)).map(c => atom(c, digit));
        if (members.length) groups.push({ cause: 'remaining-house', unit: { kind: unit.kind, index: unit.index }, members });
    }
    const memberships = Array.from({ length: 729 }, () => []);
    groups.forEach(group => group.members.forEach(a => memberships[a].push(group)));
    return { groups, memberships };
}

function pruneProof(branch, ends) {
    const needed = new Set([branch.root]);
    const visit = id => {
        if (needed.has(id)) return;
        needed.add(id);
        branch.nodes.get(id).parents.forEach(visit);
    };
    ends.forEach(visit);
    return { assumption: describe(branch.root), nodes: [...branch.nodes.values()].filter(node => needed.has(node.id)),
        ...(branch.contradiction ? { contradiction: branch.contradiction } : {}) };
}

/** Dynamic single-assumption propagation and exhaustive on/off convergence.
 * No solved board, uniqueness premise, nested guessing or recursive search.
 * Work limits count primitive visits, independently of machine speed.
 */
export function findDynamicChain(grid, { maxWork = 2000000, convergence = true, budget = {} } = {}) {
    if (!Number.isSafeInteger(maxWork) || maxWork < 1) throw new Error('Invalid dynamic work limit');
    const { groups, memberships } = constraints(grid);
    let work = 0;
    const spend = () => {
        if (work >= maxWork) { budget.exhausted = true; return false; }
        work++; budget.work = work; return true;
    };
    const propagate = root => {
        const nodes = new Map();
        const queue = [];
        let contradiction = null;
        const add = (id, cause, parents, unit) => {
            if (!spend()) return;
            if (nodes.has(id)) return;
            nodes.set(id, { id, ...describe(id), cause, parents, ...(unit ? { unit } : {}) });
            queue.push(id);
            if (nodes.has(id ^ 1)) contradiction = [id ^ 1, id];
        };
        const scan = group => {
            const left = [], parents = [];
            for (const a of group.members) {
                if (!spend()) return;
                if (nodes.has(a * 2)) parents.push(a * 2);
                else left.push(a);
            }
            // All false: derive the last member from the other exclusions. Its
            // opposite already exists, giving an explicit contradictory pair.
            if (left.length <= 1) {
                const target = left[0] ?? group.members.at(-1);
                add(target * 2 + 1, group.cause, parents.filter(id => id !== target * 2), group.unit);
            }
        };
        add(root, 'assumption', []);
        for (const group of groups) {
            if (contradiction || budget.exhausted) break;
            if (group.members.length === 1) scan(group);
        }
        for (let cursor = 0; cursor < queue.length && !contradiction && !budget.exhausted; cursor++) {
            const id = queue[cursor];
            const node = nodes.get(id);
            if (node.on) {
                for (const d of grid[node.cell]) {
                    if (d !== node.digit) add(literal(node.cell, d, false), 'cell-exclusion', [id]);
                    if (contradiction || budget.exhausted) break;
                }
                for (const peer of PEERS[node.cell]) {
                    if (contradiction || budget.exhausted) break;
                    if (grid[peer]?.has(node.digit)) add(literal(peer, node.digit, false), 'peer-exclusion', [id]);
                }
            } else for (const group of memberships[Math.floor(id / 2)]) {
                if (contradiction || budget.exhausted) break;
                scan(group);
            }
        }
        return { root, nodes, contradiction };
    };
    const result = (target, proof) => {
        const { cell, digit, on } = describe(target);
        const nodes = proof.branches.flatMap(branch => branch.nodes);
        const evidence = [...new Set(nodes.map(node => node.cell))].sort((a, b) => a - b);
        const conclusion = `${cellName(cell)} ${on ? 'must be' : 'cannot be'} ${digit}`;
        const assumption = describe(proof.branches[0].nodes[0].id);
        return { type: proof.kind === 'contradiction' ? 'dynamic-forcing-chain' : 'forcing-convergence',
            ...(on ? { idx: cell, digit } : { removals: [{ cell, digit }] }), cells: evidence,
            digits: [...new Set(nodes.map(node => node.digit))].sort(), evidence, proof: { ...proof, target, work },
            reason: proof.kind === 'contradiction' ? 'dynamic implications contradict the assumption' : 'both alternatives prove the same consequence',
            nudge: proof.kind === 'contradiction'
                ? `Following the assumption ${cellName(assumption.cell)} ${assumption.on ? 'is' : 'is not'} ${assumption.digit} leads to a contradiction. Therefore ${conclusion}.`
                : `Whether ${cellName(assumption.cell)} is ${assumption.digit} or is not ${assumption.digit}, the deductions agree: ${conclusion}.` };
    };
    for (let cell = 0; cell < 81; cell++) if (grid[cell]) for (const digit of [...grid[cell]].sort()) {
        const branches = [];
        for (const on of [true, false]) {
            const root = literal(cell, digit, on);
            const branch = propagate(root);
            if (budget.exhausted) return null;
            if (branch.contradiction) return result(root ^ 1, { kind: 'contradiction', branches: [pruneProof(branch, branch.contradiction)] });
            branches.push(branch);
        }
        if (convergence) {
            const common = [...branches[0].nodes.keys()].filter(id => branches[1].nodes.has(id)).sort((a, b) => a - b);
            // Do not return a deduction already present as a singleton premise.
            for (const target of common) {
                const item = describe(target);
                if (item.on && grid[item.cell].size === 1) continue;
                return result(target, { kind: 'convergence', branches: branches.map(branch => pruneProof(branch, [target])) });
            }
        }
    }
    return null;
}

/** Check each hyperedge using the original candidates and all its parents.
 * This does not call the discovery algorithm or trust its declared outcome.
 */
export function verifyDynamicProof(grid, proof) {
    if (!proof || !['contradiction', 'convergence'].includes(proof.kind)
        || !Array.isArray(proof.branches) || proof.branches.length !== (proof.kind === 'contradiction' ? 1 : 2)
        || !Number.isInteger(proof.target) || proof.target < 0 || proof.target >= 1458) return false;
    const roots = [];
    for (const branch of proof.branches) {
        if (!branch.assumption || !Array.isArray(branch.nodes) || !branch.nodes.length) return false;
        const root = literal(branch.assumption.cell, branch.assumption.digit, branch.assumption.on);
        const seen = new Map();
        let assumptions = 0;
        for (const node of branch.nodes) {
            if (!Number.isInteger(node.cell) || node.cell < 0 || node.cell > 80 || !/^[1-9]$/.test(node.digit)
                || typeof node.on !== 'boolean' || node.id !== literal(node.cell, node.digit, node.on)
                || !grid[node.cell]?.has(node.digit) || seen.has(node.id) || !Array.isArray(node.parents)
                || new Set(node.parents).size !== node.parents.length || node.parents.some(id => !seen.has(id))) return false;
            const parents = node.parents.map(id => seen.get(id));
            let valid = false;
            if (node.cause === 'assumption') { assumptions++; valid = node.id === root && !parents.length; }
            if (node.cause === 'cell-exclusion') valid = parents.length === 1 && parents[0].on && !node.on
                && parents[0].cell === node.cell && parents[0].digit !== node.digit;
            if (node.cause === 'peer-exclusion') valid = parents.length === 1 && parents[0].on && !node.on
                && parents[0].digit === node.digit && PEERS[node.cell].includes(parents[0].cell);
            if (node.cause === 'remaining-cell' || node.cause === 'remaining-house') {
                let required;
                if (node.cause === 'remaining-cell') required = [...grid[node.cell]].filter(d => d !== node.digit).map(d => literal(node.cell, d, false));
                else {
                    const unit = UNITS.find(u => u.kind === node.unit?.kind && u.index === node.unit?.index);
                    if (!unit?.cells.includes(node.cell)) return false;
                    required = unit.cells.filter(c => c !== node.cell && grid[c]?.has(node.digit)).map(c => literal(c, node.digit, false));
                }
                valid = node.on && required.length === parents.length && required.every(id => node.parents.includes(id));
            }
            if (!valid) return false;
            seen.set(node.id, node);
        }
        if (assumptions !== 1) return false;
        roots.push(root);
        if (proof.kind === 'contradiction') {
            if (!Array.isArray(branch.contradiction) || branch.contradiction.length !== 2
                || (branch.contradiction[0] ^ 1) !== branch.contradiction[1]
                || !branch.contradiction.every(id => seen.has(id)) || proof.target !== (root ^ 1)) return false;
        } else if (branch.contradiction || !seen.has(proof.target)) return false;
    }
    return proof.kind === 'contradiction' || (roots[0] ^ 1) === roots[1];
}
