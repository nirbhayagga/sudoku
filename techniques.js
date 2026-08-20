/**
 * Human solving techniques.
 *
 * These exist to *explain*, not to solve — solver.js already solves, faster and
 * completely. What these produce is the reasoning a person would use, so a hint
 * can say why a digit goes where it goes.
 *
 * Everything here works only from the visible board. Nothing consults the
 * solution, which is what keeps a hint a deduction rather than a giveaway.
 *
 * Two kinds of technique:
 *   - placements  ("this cell must be 7")
 *   - eliminations ("7 cannot be in these cells")
 * An elimination never fills anything in; it narrows candidates until a
 * placement appears, which is exactly how a person plays.
 */

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const rowOf = (idx) => Math.floor(idx / 9);
const colOf = (idx) => idx % 9;
const boxOf = (idx) => Math.floor(rowOf(idx) / 3) * 3 + Math.floor(colOf(idx) / 3);

const rowCells = (r) => Array.from({ length: 9 }, (_, c) => r * 9 + c);
const colCells = (c) => Array.from({ length: 9 }, (_, r) => r * 9 + c);
const boxCells = (b) => {
    const top = Math.floor(b / 3) * 3;
    const left = (b % 3) * 3;
    const cells = [];
    for (let r = top; r < top + 3; r++) {
        for (let c = left; c < left + 3; c++) cells.push(r * 9 + c);
    }
    return cells;
};

/** All 27 units, each labelled for use in an explanation. */
export const UNITS = [
    ...Array.from({ length: 9 }, (_, r) => ({ kind: 'row', index: r, cells: rowCells(r) })),
    ...Array.from({ length: 9 }, (_, c) => ({ kind: 'column', index: c, cells: colCells(c) })),
    ...Array.from({ length: 9 }, (_, b) => ({ kind: 'box', index: b, cells: boxCells(b) })),
];

/** Human-readable cell name, e.g. R4C7. */
export const cellName = (idx) => `R${rowOf(idx) + 1}C${colOf(idx) + 1}`;

/** The 20 cells sharing a row, column or box with this one. */
export function peersOf(idx) {
    const peers = new Set([...rowCells(rowOf(idx)), ...colCells(colOf(idx)), ...boxCells(boxOf(idx))]);
    peers.delete(idx);
    return [...peers];
}

/** Digits still legal in a cell, from the visible board alone. */
export function candidatesFor(board, idx) {
    const used = new Set();
    for (const peer of peersOf(idx)) used.add(board[peer]);

    const candidates = new Set();
    for (const digit of DIGITS) if (!used.has(digit)) candidates.add(digit);
    return candidates;
}

/**
 * Candidates for every empty cell. Filled cells hold null, so the index of an
 * entry is always its cell index.
 */
export function candidateGrid(board) {
    return Array.from({ length: 81 }, (_, i) =>
        (board[i] === '0' ? candidatesFor(board, i) : null));
}

// ── Placements ─────────────────────────────────────────────────────────

/** A cell with exactly one candidate left. */
export function findNakedSingle(grid) {
    for (let idx = 0; idx < 81; idx++) {
        const set = grid[idx];
        if (set && set.size === 1) {
            const [digit] = [...set];
            return {
                type: 'naked-single',
                idx,
                digit,
                reason: `only ${digit} fits in this cell`,
                nudge: `Every other digit already appears in ${cellName(idx)}'s row, column or box.`,
                evidence: peersOf(idx).filter((i) => !grid[i]),
            };
        }
    }
    return null;
}

/** A digit with only one possible home left in some unit. */
export function findHiddenSingle(grid) {
    for (const unit of UNITS) {
        for (const digit of DIGITS) {
            const homes = unit.cells.filter((i) => grid[i] && grid[i].has(digit));
            if (homes.length === 1) {
                const idx = homes[0];
                // A naked single is the simpler explanation for the same cell.
                if (grid[idx].size === 1) continue;
                return {
                    type: 'hidden-single',
                    idx,
                    digit,
                    reason: `the only place for ${digit} in this ${unit.kind}`,
                    nudge: `In the highlighted ${unit.kind}, ${digit} has only one cell left.`,
                    evidence: unit.cells.filter((i) => i !== idx),
                };
            }
        }
    }
    return null;
}

// ── Eliminations ───────────────────────────────────────────────────────

/**
 * Two cells in a unit holding the same two candidates. Between them they use
 * both digits, so neither can appear anywhere else in that unit.
 */
export function findNakedPair(grid) {
    for (const unit of UNITS) {
        const pairs = unit.cells.filter((i) => grid[i] && grid[i].size === 2);

        for (let a = 0; a < pairs.length; a++) {
            for (let b = a + 1; b < pairs.length; b++) {
                const first = [...grid[pairs[a]]].sort().join('');
                const second = [...grid[pairs[b]]].sort().join('');
                if (first !== second) continue;

                const digits = [...grid[pairs[a]]];
                const removals = [];
                for (const cell of unit.cells) {
                    if (cell === pairs[a] || cell === pairs[b] || !grid[cell]) continue;
                    for (const digit of digits) {
                        if (grid[cell].has(digit)) removals.push({ cell, digit });
                    }
                }
                if (removals.length === 0) continue;

                return {
                    type: 'naked-pair',
                    removals,
                    cells: [pairs[a], pairs[b]],
                    digits,
                    reason: `${cellName(pairs[a])} and ${cellName(pairs[b])} can only hold ${digits.join(' and ')}`,
                    nudge: `${cellName(pairs[a])} and ${cellName(pairs[b])} can only hold ${digits.join(' and ')}, `
                        + `so those digits leave the rest of this ${unit.kind}.`,
                    evidence: [pairs[a], pairs[b], ...removals.map((r) => r.cell)],
                };
            }
        }
    }
    return null;
}

/**
 * A digit confined to one row or column within a box. It must go somewhere in
 * that box, so it cannot appear in the rest of that row or column.
 */
export function findPointingPair(grid) {
    for (let box = 0; box < 9; box++) {
        const cells = boxCells(box);

        for (const digit of DIGITS) {
            const homes = cells.filter((i) => grid[i] && grid[i].has(digit));
            if (homes.length < 2 || homes.length > 3) continue;

            for (const [axis, of, lineCells] of [
                ['row', rowOf, rowCells],
                ['column', colOf, colCells],
            ]) {
                const line = of(homes[0]);
                if (!homes.every((i) => of(i) === line)) continue;

                const removals = [];
                for (const cell of lineCells(line)) {
                    if (boxOf(cell) === box || !grid[cell]) continue;
                    if (grid[cell].has(digit)) removals.push({ cell, digit });
                }
                if (removals.length === 0) continue;

                return {
                    type: 'pointing-pair',
                    removals,
                    cells: homes,
                    digits: [digit],
                    reason: `${digit} is confined to one ${axis} of this box`,
                    nudge: `Inside the highlighted box, ${digit} can only sit in one ${axis}. `
                        + `It must go there, so ${digit} leaves the rest of that ${axis}.`,
                    evidence: [...homes, ...removals.map((r) => r.cell)],
                };
            }
        }
    }
    return null;
}

/** Apply an elimination to the grid. */
export function applyRemovals(grid, removals) {
    for (const { cell, digit } of removals) {
        if (grid[cell]) grid[cell].delete(digit);
    }
    return grid;
}

// ── Orchestration ──────────────────────────────────────────────────────

/** Placements first, cheapest explanation first. */
const PLACEMENTS = [findNakedSingle, findHiddenSingle];
const ELIMINATIONS = [findNakedPair, findPointingPair];

/**
 * The next step a person could take: a placement, reached directly or after the
 * eliminations that make it visible.
 *
 * Returns null when nothing here can crack the position — the caller then falls
 * back to something duller, because a hint must always work.
 *
 * @param {string} board 81-character board
 * @param {number} [maxEliminations] guard against pathological chains
 */
export function nextStep(board, maxEliminations = 4) {
    const grid = candidateGrid(board);

    for (const find of PLACEMENTS) {
        const step = find(grid);
        if (step) return step;
    }

    // No placement is visible yet, so narrow the candidates and look again.
    // Each elimination is recorded so the explanation can show its working.
    const applied = [];
    for (let round = 0; round < maxEliminations; round++) {
        let progressed = false;

        for (const find of ELIMINATIONS) {
            const elimination = find(grid);
            if (!elimination) continue;

            applyRemovals(grid, elimination.removals);
            applied.push(elimination);
            progressed = true;

            for (const findPlacement of PLACEMENTS) {
                const step = findPlacement(grid);
                if (!step) continue;

                // Lead with the elimination that unlocked it — that is the part
                // the player could not see.
                return {
                    ...step,
                    type: `${elimination.type}+${step.type}`,
                    via: applied.map((e) => e.type),
                    reason: `${elimination.reason}, leaving ${step.reason}`,
                    nudge: `${elimination.nudge} That leaves ${cellName(step.idx)} with one option.`,
                    evidence: [...new Set([...elimination.evidence, ...step.evidence])],
                };
            }
            break; // re-run from the cheapest technique after any progress
        }

        if (!progressed) break;
    }

    return null;
}
