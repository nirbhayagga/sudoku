import { describe, it, expect } from 'vitest';
import { geometry, SMALL_GEOMETRIES, formatSizedPuzzle, parseSizedPuzzle } from '../geometry.js';
import { solveSized, assessSized, sizedCandidates } from '../sized-solver.js';
import { SMALL_BANK, SMALL_BANK_REPORT } from '../small-bank.js';
import { canonicalSized, generateSized } from '../sized-generation.js';
import { newSmallGame, validateSmallGame, editSmallGame, smallDigit, smallUndo, smallHint } from '../small-state.js';
import { sizedLink, parseSizedLink, sizedSheet } from '../sized-export.js';
import { PUZZLES } from '../puzzle-bank.js';
import { SudokuSolver } from '../solver.js';

describe('classic board geometry and complete solver', () => {
    it.each([[4,2,2], [6,2,3], [6,3,2], [9,3,3], [16,4,4]])('builds %sx%s/%s complete houses with correct peers', (size, r, c) => {
        const g = geometry(size, r, c);
        expect(g.units).toHaveLength(size * 3);
        expect(g.houses.every(h => h.length === 3)).toBe(true);
        expect(g.units.every(u => u.cells.length === size && new Set(u.cells).size === size)).toBe(true);
        const solution = Array.from({ length: size * size }, (_, i) => g.digits[(Math.floor(i / size) * c + Math.floor(Math.floor(i / size) / r) + i % size) % size]).join('');
        const answer = solveSized('0' + solution.slice(1), g);
        expect(answer.count).toBe(1); expect(answer.solutions[0]).toBe(solution);
    });
    it('cross-checks the generic solver against the optimized 9x9 engine', () => {
        for (const p of [PUZZLES.easy[0], PUZZLES.expert[147], PUZZLES.nightmare.at(-1)]) {
            expect(solveSized(p.puzzle, geometry()).solutions).toEqual([SudokuSolver.solveSudoku(p.puzzle).solution]);
        }
    });
    it('reports work exhaustion distinctly and rejects malformed/conflicting boards', () => {
        const g = SMALL_GEOMETRIES[6];
        expect(solveSized('0'.repeat(36), g, { maxNodes: 1 }).status).toBe('budget-exhausted');
        expect(solveSized('11' + '0'.repeat(34), g).status).toBe('invalid');
        expect(parseSizedPuzzle('7' + '0'.repeat(35), g)).toBeNull();
    });
});

describe('curated small banks', () => {
    it.each([4,6])('verifies every %s board, reasoning path, minimality and equivalent-puzzle filtering', size => {
        const g = SMALL_GEOMETRIES[size], bank = SMALL_BANK[size], canon = new Set();
        const errors = [];
        for (const entry of bank) {
            const solved = solveSized(entry.puzzle, g);
            if (solved.count !== 1 || solved.status !== 'solved') errors.push(entry.id);
            const rating = assessSized(entry.puzzle, g);
            if (rating.status !== 'solved' || rating.family !== entry.rating.family) errors.push(`${entry.id}:rating`);
            for (let i = 0; i < g.count; i++) if (entry.puzzle[i] !== '0') {
                const removed = entry.puzzle.slice(0,i) + '0' + entry.puzzle.slice(i+1);
                if (solveSized(removed,g).count === 1) errors.push(`${entry.id}:not-minimal`);
            }
            canon.add(canonicalSized(entry.puzzle,g));
        }
        expect(errors).toEqual([]); expect(canon.size).toBe(bank.length);
        expect(new Set(bank.map(p => p.id)).size).toBe(bank.length);
    });
    it('exhaustively enumerates the 288 solved 4x4 grids and reproduces seeded 6x6 puzzles', () => {
        expect(solveSized('0'.repeat(16), SMALL_GEOMETRIES[4], { limit: 1000 }).count).toBe(SMALL_BANK_REPORT[4].solvedGrids);
        const entry = SMALL_BANK[6][0];
        expect(generateSized(SMALL_GEOMETRIES[6],entry.seed).puzzle).toBe(entry.puzzle);
    });
});

describe('small game state and formats', () => {
    it.each([4,6])('round-trips %s formats, geometry links and print sheets', size => {
        const g = SMALL_GEOMETRIES[size], board = SMALL_BANK[size][0].puzzle;
        for (const style of ['line','zeros','rows','grid']) expect(parseSizedPuzzle(formatSizedPuzzle(board,g,style),g)).toBe(board);
        const url = new URL(sizedLink('https://example.test/game?old=1',board,g));
        expect(parseSizedLink(url.search,SMALL_GEOMETRIES)).toEqual({g,puzzle:board});
        expect(sizedSheet([board,board],g,1).match(/class="sheet"/g)).toHaveLength(2);
        expect(() => sizedSheet(['<script>'],g)).toThrow();
    });
    it('restores peer notes and automatic-note changes through undo/redo', () => {
        const g = SMALL_GEOMETRIES[6], s = newSmallGame(SMALL_BANK[6][0].puzzle,g);
        editSmallGame(s,g,x=>{x.notes=[...sizedCandidates(x.board,g)];});
        const initial = [...s.notes], cell=s.board.indexOf('0'), digit=solveSized(s.puzzle,g).solutions[0][cell];
        smallDigit(s,g,cell,digit); expect(smallUndo(s)).toBe(true); expect(s.notes).toEqual(initial);
        expect(smallUndo(s,true)).toBe(true); expect(s.board[cell]).toBe(digit);
        editSmallGame(s,g,x=>{x.auto=true;}); smallUndo(s); expect(s.auto).toBe(false);
        expect(validateSmallGame(s)).toEqual(s);
        expect(validateSmallGame({...s,puzzle:'0'.repeat(36)})).toBeNull();
        expect(validateSmallGame({...s,notes:[-1]})).toBeNull();
    });
    it('keeps hints correct on wrong entries and preserves undo after completion', () => {
        const g=SMALL_GEOMETRIES[4], s=newSmallGame(SMALL_BANK[4][0].puzzle,g);
        const cell=s.board.indexOf('0'), answer=solveSized(s.puzzle,g).solutions[0];
        smallDigit(s,g,cell,answer[cell] === '1' ? '2' : '1');
        expect(smallHint(s,g)).toMatchObject({idx:cell,digit:answer[cell],answerBased:true});
        smallUndo(s);
        for(let i=0;i<g.count;i++) if(s.puzzle[i]==='0') smallDigit(s,g,i,answer[i]);
        expect(s.board).toBe(answer); smallUndo(s); expect(s.board).not.toBe(answer);
    });
});
