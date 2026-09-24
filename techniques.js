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
                    unit: { kind: unit.kind, index: unit.index },
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

/**
 * Claiming pair/triple: all two or three homes of a digit in a row/column
 * fall in one box. That line must use the digit inside the box, excluding it
 * from the other rows/columns of the box (the converse of pointing).
 */
export function findClaimingPair(grid) {
    for (const unit of UNITS.slice(0, 18)) {
        for (const digit of DIGITS) {
            const homes = unit.cells.filter(i => grid[i]?.has(digit));
            if (homes.length < 2 || homes.length > 3) continue;
            const box = boxOf(homes[0]);
            if (!homes.every(i => boxOf(i) === box)) continue;
            const removals = boxCells(box)
                .filter(cell => !unit.cells.includes(cell) && grid[cell]?.has(digit))
                .map(cell => ({ cell, digit }));
            if (!removals.length) continue;
            const line = `${unit.kind} ${unit.index + 1}`;
            return {
                type: homes.length === 2 ? 'claiming-pair' : 'claiming-triple',
                cells: homes,
                digits: [digit],
                removals,
                reason: `${digit} in ${line} is confined to box ${box + 1}`,
                nudge: `In ${line}, ${digit} can only go in ${homes.map(cellName).join(' or ')}. `
                    + `Those cells are all in box ${box + 1}, so ${digit} leaves the other cells of that box.`,
                evidence: [...new Set([...unit.cells, ...removals.map(r => r.cell)])],
            };
        }
    }
    return null;
}

/** Two digits with exactly the same two homes in a unit reserve those cells. */
export function findHiddenPair(grid) {
    for (const unit of UNITS) {
        const homes = DIGITS.map(digit => unit.cells.filter(i => grid[i]?.has(digit)));
        for (let a = 0; a < DIGITS.length; a++) {
            if (homes[a].length !== 2) continue;
            for (let b = a + 1; b < DIGITS.length; b++) {
                if (homes[b].length !== 2 || !homes[a].every((cell, i) => cell === homes[b][i])) continue;
                const cells = homes[a];
                const digits = [DIGITS[a], DIGITS[b]];
                const removals = cells.flatMap(cell => [...grid[cell]]
                    .filter(digit => !digits.includes(digit)).map(digit => ({ cell, digit })));
                if (!removals.length) continue;
                const line = `${unit.kind} ${unit.index + 1}`;
                return {
                    type: 'hidden-pair', cells, digits, removals,
                    reason: `${digits.join(' and ')} in ${line} have only ${cells.map(cellName).join(' and ')} available`,
                    nudge: `In ${line}, only ${cells.map(cellName).join(' and ')} can hold ${digits.join(' and ')}. `
                        + 'Those two digits must occupy those two cells, so all other candidates leave them.',
                    evidence: [...unit.cells],
                };
            }
        }
    }
    return null;
}

/**
 * Three cells in a unit whose candidates, taken together, are exactly three
 * digits. Between them they consume all three, so none can appear elsewhere in
 * that unit. The cells need not each hold all three — {1,2} {2,3} {1,3} counts.
 */
export function findNakedTriple(grid) {
    for (const unit of UNITS) {
        const cells = unit.cells.filter((i) => grid[i] && grid[i].size >= 2 && grid[i].size <= 3);

        for (let a = 0; a < cells.length; a++) {
            for (let b = a + 1; b < cells.length; b++) {
                for (let c = b + 1; c < cells.length; c++) {
                    const trio = [cells[a], cells[b], cells[c]];
                    const union = new Set([...grid[trio[0]], ...grid[trio[1]], ...grid[trio[2]]]);
                    if (union.size !== 3) continue;

                    const digits = [...union].sort();
                    const removals = [];
                    for (const cell of unit.cells) {
                        if (trio.includes(cell) || !grid[cell]) continue;
                        for (const digit of digits) {
                            if (grid[cell].has(digit)) removals.push({ cell, digit });
                        }
                    }
                    if (removals.length === 0) continue;

                    return {
                        type: 'naked-triple',
                        removals,
                        cells: trio,
                        digits,
                        reason: `${trio.map(cellName).join(', ')} share just ${digits.join(', ')}`,
                        nudge: `${trio.map(cellName).join(', ')} between them use only `
                            + `${digits.join(', ')}, so those digits leave the rest of this ${unit.kind}.`,
                        evidence: [...trio, ...removals.map((r) => r.cell)],
                    };
                }
            }
        }
    }
    return null;
}

/**
 * X-Wing. When a digit has exactly two possible cells in each of two rows, and
 * both rows use the same pair of columns, the digit must occupy opposite
 * corners of that rectangle either way — so it cannot appear anywhere else in
 * those two columns. The same holds with rows and columns swapped.
 *
 * This is the usual wall for players solving by eye; it is the first technique
 * needing two units considered together.
 */
export function findXWing(grid) {
    for (const [orientation, lineCells, crossOf, crossCells] of [
        ['row', rowCells, colOf, colCells],
        ['column', colCells, rowOf, rowCells],
    ]) {
        for (const digit of DIGITS) {
            // Lines where this digit has exactly two homes.
            const candidates = [];
            for (let line = 0; line < 9; line++) {
                const homes = lineCells(line).filter((i) => grid[i] && grid[i].has(digit));
                if (homes.length === 2) candidates.push({ line, homes, crosses: homes.map(crossOf) });
            }

            for (let a = 0; a < candidates.length; a++) {
                for (let b = a + 1; b < candidates.length; b++) {
                    const [first, second] = [candidates[a], candidates[b]];
                    if (first.crosses[0] !== second.crosses[0] || first.crosses[1] !== second.crosses[1]) {
                        continue;
                    }

                    const corners = [...first.homes, ...second.homes];
                    const removals = [];
                    for (const cross of first.crosses) {
                        for (const cell of crossCells(cross)) {
                            if (corners.includes(cell) || !grid[cell]) continue;
                            if (grid[cell].has(digit)) removals.push({ cell, digit });
                        }
                    }
                    if (removals.length === 0) continue;

                    const other = orientation === 'row' ? 'columns' : 'rows';
                    return {
                        type: 'x-wing',
                        removals,
                        cells: corners,
                        digits: [digit],
                        reason: `${digit} forms an X-Wing across two ${orientation}s`,
                        nudge: `In two ${orientation}s, ${digit} can only sit in the same two ${other}. `
                            + `It must take opposite corners of that rectangle, so ${digit} leaves `
                            + `the rest of those ${other}.`,
                        evidence: [...corners, ...removals.map((r) => r.cell)],
                    };
                }
            }
        }
    }
    return null;
}

// Fixed geometry, shared by XY-Wing checks without changing visible candidates.
const PEER_SETS = Array.from({ length: 81 }, (_, idx) => new Set(peersOf(idx)));

/**
 * XY-Wing: a pivot {X,Y} sees wings {X,Z} and {Y,Z}. Whichever pivot value
 * is chosen, one wing must be Z. Only cells seeing BOTH wings lose Z;
 * seeing the pivot alone is not sufficient. No guess is placed on the board.
 */
export function findXYWing(grid) {
    const bivalue = Array.from({ length: 81 }, (_, i) => i).filter(i => grid[i]?.size === 2);
    for (const pivot of bivalue) {
        const [x, y] = [...grid[pivot]].sort();
        const wings = bivalue.filter(i => PEER_SETS[pivot].has(i));
        for (const first of wings) {
            if (!grid[first].has(x) || grid[first].has(y)) continue;
            const z = [...grid[first]].find(digit => digit !== x);
            for (const second of wings) {
                if (first === second || !grid[second].has(y) || !grid[second].has(z)) continue;
                const cells = [pivot, first, second];
                const removals = [...PEER_SETS[first]]
                    .filter(cell => !cells.includes(cell) && PEER_SETS[second].has(cell) && grid[cell]?.has(z))
                    .map(cell => ({ cell, digit: z }));
                if (!removals.length) continue;
                return {
                    type: 'xy-wing', cells, digits: [x, y, z], removals,
                    reason: `${cellName(pivot)} forces one of ${cellName(first)} and ${cellName(second)} to be ${z}`,
                    nudge: `${cellName(pivot)} has only ${x} or ${y}. If it is ${x}, ${cellName(first)} must be ${z}; `
                        + `if it is ${y}, ${cellName(second)} must be ${z}. Either way, a cell seeing both wings cannot be ${z}.`,
                    evidence: [...cells, ...removals.map(r => r.cell)],
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
// Cheapest to explain first, so a hint never reaches for X-Wing when a pair
// would do.
const ELIMINATIONS = [
    findNakedPair, findPointingPair, findClaimingPair, findHiddenPair,
    findNakedTriple, findXWing, findXYWing,
];

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
    // Preserve an established short deduction path. New eliminations can
    // consume the chain budget before that path becomes visible; try them when
    // the original set stalls instead of losing an explanation we already had.
    return stepWithTechniques(board, maxEliminations, [findNakedPair, findPointingPair, findNakedTriple, findXWing])
        || stepWithTechniques(board, maxEliminations, ELIMINATIONS);
}

function stepWithTechniques(board, maxEliminations, eliminations) {
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

        for (const find of eliminations) {
            const elimination = find(grid);
            if (!elimination) continue;

            applyRemovals(grid, elimination.removals);
            applied.push(elimination);
            progressed = true;

            for (const findPlacement of PLACEMENTS) {
                const step = findPlacement(grid);
                if (!step) continue;

                // Keep the complete derivation: an earlier elimination may be
                // essential even when the last one immediately unlocks a digit.
                const conclusion = step.type === 'naked-single'
                    ? `${cellName(step.idx)} then has only ${step.digit} left.`
                    : `${cellName(step.idx)} is then the only place for ${step.digit} in ${step.unit.kind} ${step.unit.index + 1}.`;
                return {
                    ...step,
                    type: `${elimination.type}+${step.type}`,
                    via: applied.map(e => e.type),
                    eliminations: applied,
                    reason: `${applied.map(e => e.reason).join('; then ')}. ${conclusion}`,
                    nudge: `${applied.map((e, i) => `${i + 1}. ${e.nudge}`).join(' ')} ${conclusion}`,
                    evidence: [...new Set([...applied.flatMap(e => e.evidence), ...step.evidence])],
                };
            }
            break; // re-run from the cheapest technique after any progress
        }

        if (!progressed) break;
    }

    return null;
}
