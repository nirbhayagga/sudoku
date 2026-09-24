import { describe, it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PUZZLES } from '../puzzle-bank.js';

describe('enhanced assessment CLI', () => {
    it('reproduces arbitrary-puzzle reports, transformations and provenance without overwriting', () => {
        const dir=mkdtempSync(join(tmpdir(),'sudoku-v4-'));
        try {
            const input=join(dir,'puzzles.txt');writeFileSync(input,PUZZLES.expert[444].puzzle+'\n');
            for(const name of ['one','two']) execFileSync(process.execPath,['scripts/assess-v4.js',`--file=${input}`,'--transforms',`--out=${join(dir,name+'.json')}`],{stdio:'pipe'});
            const a=readFileSync(join(dir,'one.json'),'utf8');expect(a).toBe(readFileSync(join(dir,'two.json'),'utf8'));
            const report=JSON.parse(a);expect(report.records[0].human.family).toBe('uniqueness');expect(report.records[0].transformations).toHaveLength(3);
            expect(report.provenance.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
            expect(spawnSync(process.execPath,['scripts/assess-v4.js',`--file=${input}`,`--out=${join(dir,'one.json')}`]).status).not.toBe(0);
        } finally {rmSync(dir,{recursive:true,force:true});}
    });
    it('rejects malformed flags',()=>{
        expect(spawnSync(process.execPath,['scripts/assess-v4.js','--all=false']).status).not.toBe(0);
        expect(spawnSync(process.execPath,['scripts/assess-v4.js','--puzzle']).status).not.toBe(0);
    });
});
