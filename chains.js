import { UNITS, peersOf, cellName } from './techniques.js';

const PEERS = Array.from({ length: 81 }, (_, i) => peersOf(i));
const literal = (cell, digit, on) => (cell * 9 + Number(digit) - 1) * 2 + (on ? 1 : 0);
const describe = id => ({ cell: Math.floor(id / 18), digit: String(Math.floor(id / 2) % 9 + 1), on: Boolean(id % 2) });

/** Static implications: exclusions and the remaining alternative of a conjugate pair. */
function implicationGraph(grid) {
    const edges = Array.from({ length: 1458 }, () => []);
    const add = (from, to, cause, cells, unit) => edges[from].push({ to, cause, cells, ...(unit ? { unit } : {}) });
    for (let cell = 0; cell < 81; cell++) {
        if (!grid[cell]) continue;
        const digits = [...grid[cell]].sort();
        for (const digit of digits) {
            const on = literal(cell, digit, true);
            for (const other of digits) if (other !== digit) add(on, literal(cell, other, false), 'cell-exclusion', [cell]);
            for (const peer of PEERS[cell]) if (grid[peer]?.has(digit)) add(on, literal(peer, digit, false), 'peer-exclusion', [cell, peer]);
            if (digits.length === 2) add(literal(cell, digit, false), literal(cell, digits.find(d => d !== digit), true), 'bivalue-cell', [cell]);
        }
    }
    for (const unit of UNITS) {
        for (const digit of '123456789') {
            const homes = unit.cells.filter(cell => grid[cell]?.has(digit));
            if (homes.length !== 2) continue;
            const house = { kind: unit.kind, index: unit.index };
            add(literal(homes[0], digit, false), literal(homes[1], digit, true), 'conjugate-house', homes, house);
            add(literal(homes[1], digit, false), literal(homes[0], digit, true), 'conjugate-house', homes, house);
        }
    }
    return edges;
}

/** Bounded forcing chains. No branching search, answer lookup or candidate guessing is applied. */
export function findForcingChain(grid, { maxEdges = 150000, maxDepth = 16, budget = {} } = {}) {
    if (!Number.isSafeInteger(maxEdges) || maxEdges < 1 || !Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 1458) throw new Error('Invalid chain budget');
    const graph = implicationGraph(grid);
    let explored = 0;
    const branch = root => {
        const parent = new Int16Array(1458).fill(-2);
        const via = new Array(1458);
        const depth = new Uint16Array(1458);
        const queue = [root]; parent[root] = -1;
        for (let cursor = 0; cursor < queue.length; cursor++) {
            const from = queue[cursor];
            if (depth[from] >= maxDepth) continue;
            for (const edge of graph[from]) {
                if (++explored > maxEdges) { budget.exhausted = true; return null; }
                const to = edge.to;
                if (parent[to] !== -2) continue;
                parent[to] = from; via[to] = edge; depth[to] = depth[from] + 1;
                if (parent[to ^ 1] !== -2) {
                    const needed = new Set();
                    for (const end of [to, to ^ 1]) {
                        let at = end;
                        while (at !== -1 && !needed.has(at)) { needed.add(at); at = parent[at]; }
                    }
                    const ids = [...needed].sort((a, b) => depth[a] - depth[b] || a - b);
                    const nodes = ids.map(id => ({ id, ...describe(id), parent: parent[id] < 0 ? null : parent[id],
                        ...(via[id] ? { cause: via[id].cause, cells: via[id].cells, ...(via[id].unit ? { unit: via[id].unit } : {}) } : { cause: 'assumption' }) }));
                    return { assumption: describe(root), nodes, contradiction: [to, to ^ 1], exploredEdges: explored, maxDepth };
                }
                queue.push(to);
            }
        }
        return null;
    };
    for (let cell = 0; cell < 81; cell++) {
        if (!grid[cell]) continue;
        for (const digit of [...grid[cell]].sort()) {
            for (const on of [true, false]) {
                const proof = branch(literal(cell, digit, on));
                if (proof) {
                    const conflict = describe(proof.contradiction[0]);
                    const premise = `${cellName(cell)} ${on ? 'is' : 'is not'} ${digit}`;
                    const consequence = `${cellName(conflict.cell)} would both contain and exclude ${conflict.digit}`;
                    const evidence = [...new Set(proof.nodes.flatMap(node => node.cells || [node.cell]))];
                    return { type: 'forcing-chain', ...(on ? { removals: [{ cell, digit }] } : { idx: cell, digit }),
                        cells: evidence, digits: [...new Set(proof.nodes.map(node => node.digit))], proof,
                        reason: `assuming ${premise} leads to a contradiction`,
                        nudge: `If ${premise}, ${consequence}. Therefore ${cellName(cell)} ${on ? 'cannot be' : 'must be'} ${digit}.`, evidence };
                }
                if (explored >= maxEdges) { budget.exhausted = true; return null; }
            }
        }
    }
    return null;
}

/** Independent local checks for each edge of a stored static chain proof. */
export function verifyChainProof(grid, proof) {
    if (!proof?.nodes?.length || !Array.isArray(proof.contradiction) || proof.contradiction.length !== 2) return false;
    const seen = new Map();
    let assumptions = 0;
    for (const node of proof.nodes) {
        if (node.id !== literal(node.cell, node.digit, node.on) || !grid[node.cell]?.has(node.digit) || seen.has(node.id)) return false;
        if (node.parent === null) {
            assumptions++;
            if (node.cause !== 'assumption' || node.id !== literal(proof.assumption.cell, proof.assumption.digit, proof.assumption.on)) return false;
        } else {
            const parent = seen.get(node.parent);
            if (!parent) return false;
            let valid = false;
            if (node.cause === 'cell-exclusion') valid = parent.on && !node.on && parent.cell === node.cell && parent.digit !== node.digit;
            if (node.cause === 'peer-exclusion') valid = parent.on && !node.on && parent.digit === node.digit && PEERS[parent.cell].includes(node.cell);
            if (node.cause === 'bivalue-cell') valid = !parent.on && node.on && parent.cell === node.cell && parent.digit !== node.digit && grid[node.cell].size === 2;
            if (node.cause === 'conjugate-house') {
                const unit = UNITS.find(unit => unit.kind === node.unit?.kind && unit.index === node.unit?.index);
                const homes = unit?.cells.filter(cell => grid[cell]?.has(node.digit));
                valid = !parent.on && node.on && parent.digit === node.digit && parent.cell !== node.cell
                    && homes?.length === 2 && homes.includes(parent.cell) && homes.includes(node.cell);
            }
            if (!valid) return false;
        }
        seen.set(node.id, node);
    }
    return assumptions === 1 && (proof.contradiction[0] ^ 1) === proof.contradiction[1]
        && proof.contradiction.every(id => seen.has(id));
}
