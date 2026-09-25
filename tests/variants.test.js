import { describe, expect, it } from 'vitest';
import { geometry, VARIANT_GEOMETRIES, SMALL_GEOMETRIES, formatSizedPuzzle, parseSizedPuzzle } from '../geometry.js';
import { VARIANT_BANK } from '../variant-bank.js';
import { consistent, solveSized, assessSized, sizedCandidates } from '../sized-solver.js';
import { generateSized } from '../sized-generation.js';
import { canonicalVariant } from '../variant-tools.js';
import { newSmallGame, validateSmallGame, smallHint } from '../small-state.js';
import { sizedLink, parseSizedLink, sizedSheet } from '../sized-export.js';
import { parseShareLink } from '../share.js';

describe('explicit variant rules', () => {
    it('enforces diagonal and Hyper houses beyond classic row/column/box rules', () => {
        for (const [rule, cells] of [['diagonal', [0,40]], ['hyper', [10,30]]]) {
            const board = Array(81).fill('0'); cells.forEach(c => board[c] = '1');
            expect(consistent(board.join(''), geometry())).toBe(true);
            expect(consistent(board.join(''), VARIANT_GEOMETRIES[rule])).toBe(false);
        }
        const g = VARIANT_GEOMETRIES.diagonal, board = '1' + '0'.repeat(80);
        expect(sizedCandidates(board,g)[40] & 1).toBe(0);
        expect(sizedCandidates(board,geometry())[40] & 1).toBe(1);
        expect(() => geometry(6,2,3,'diagonal')).toThrow();
    });
    it.each(['diagonal', 'hyper'])('audits every %s puzzle and explanation, deduplicates only allowed transformations', rule => {
        const g = VARIANT_GEOMETRIES[rule], canon = new Set();
        for (const item of VARIANT_BANK[rule]) {
            const solved = solveSized(item.puzzle, g);
            expect(solved.status).toBe('solved'); expect(solved.count).toBe(1);
            const answer = solved.solutions[0];
            // Independent explicit checks of the additional rules.
            const extra = rule === 'diagonal' ? [Array.from({length:9},(_,i)=>i*10), Array.from({length:9},(_,i)=>8+i*8)]
                : [1,5].flatMap(r=>[1,5].map(c=>Array.from({length:9},(_,i)=>(r+Math.floor(i/3))*9+c+i%3)));
            expect(extra.every(cells=>new Set(cells.map(i=>answer[i])).size===9)).toBe(true);
            expect(assessSized(item.puzzle,g).status).toBe('solved');
            canon.add(canonicalVariant(item.puzzle,g));
        }
        expect(canon.size).toBe(24);
        const item = VARIANT_BANK[rule][0];
        expect(generateSized(g,item.seed,{requireExplained:true}).puzzle).toBe(item.puzzle);
    }, 60000);
    it.each(['diagonal', 'hyper'])('keeps %s rules through text, links, saved games, hints and worksheets', rule => {
        const g = VARIANT_GEOMETRIES[rule], item = VARIANT_BANK[rule][0];
        for (const style of ['line','zeros','rows','grid']) {
            const text = formatSizedPuzzle(item.puzzle,g,style);
            expect(parseSizedPuzzle(text,g)).toBe(item.puzzle);
            expect(parseSizedPuzzle(' \n' + text.replaceAll('\n', '\r\n') + '\n ',g)).toBe(item.puzzle);
            expect(parseSizedPuzzle(text,geometry())).toBeNull();
        }
        const url = new URL(sizedLink('https://example.test/?old=1',item.puzzle,g));
        expect(parseSizedLink(url.search,SMALL_GEOMETRIES)).toEqual({g,puzzle:item.puzzle});
        expect(parseShareLink(url.search)).toBeNull();
        expect(parseSizedLink(url.search + '&rule=classic',SMALL_GEOMETRIES)).toBeNull();
        const state = newSmallGame(item.puzzle,g,{id:item.id,level:1});
        expect(validateSmallGame(state)).toEqual(state);
        expect(validateSmallGame({...state,geometry:'9:3x3:unknown'})).toBeNull();
        const hint = smallHint(state,g), answer=solveSized(item.puzzle,g).solutions[0];
        expect(hint.digit).toBe(answer[hint.idx]); expect(hint.answerBased).toBe(false);
        const sheet=sizedSheet([item.puzzle],g,1);
        expect(sheet).toContain(rule === 'diagonal' ? 'Diagonal' : 'Hyper');
        expect(sheet).toContain('#dedede');
    });
});
