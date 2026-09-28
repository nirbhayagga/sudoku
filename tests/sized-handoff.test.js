import { it, expect } from 'vitest';
import { sizedGameLink, parseSizedGameLink } from '../sized-handoff.js';
import { newSmallGame, smallDigit } from '../small-state.js';
import { SMALL_BANK } from '../small-bank.js';
import { VARIANT_BANK } from '../variant-bank.js';
import { SMALL_GEOMETRIES, VARIANT_GEOMETRIES } from '../geometry.js';

it('round-trips moves, notes, time, assistance and rules without undo history', () => {
    for (const [g, puzzle] of [[SMALL_GEOMETRIES[6], SMALL_BANK[6][0].puzzle], [VARIANT_GEOMETRIES.hyper, VARIANT_BANK.hyper[0].puzzle]]) {
        const game = newSmallGame(puzzle, g), cell = puzzle.indexOf('0');
        smallDigit(game, g, cell, '1', true); game.elapsedMs = 42000; game.hints = 2;
        const link = new URL(sizedGameLink('https://example.com/sudoku/?old=1', game, g));
        expect(link.searchParams.has('old')).toBe(false);
        expect(parseSizedGameLink(link.search, g, puzzle)).toEqual({ ...game, undo: [], redo: [] });
        expect(parseSizedGameLink(link.search, SMALL_GEOMETRIES[4], puzzle)).toBeNull();
        expect(parseSizedGameLink(link.search + '&resume=x', g, puzzle)).toBeNull();
    }
});
it('rejects malformed and oversized snapshots', () => {
    expect(parseSizedGameLink('?resume=garbage', SMALL_GEOMETRIES[4], SMALL_BANK[4][0].puzzle)).toBeNull();
    expect(parseSizedGameLink('?resume=' + 'a'.repeat(12001), SMALL_GEOMETRIES[4], SMALL_BANK[4][0].puzzle)).toBeNull();
});
