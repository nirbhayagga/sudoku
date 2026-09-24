#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { parseSeRatings, compareSe, renderSeComparison } from './lib/se-comparison.js';

try {
    const options = {};
    for (const arg of process.argv.slice(2)) {
        const match = arg.match(/^--(assessment|ratings|jar|out|report)=(.+)$/);
        if (!match || options[match[1]]) throw new Error('Use --assessment=report.json --ratings=ratings.txt --jar=Sudoku9Explainer.jar --out=comparison.json [--report=comparison.md].');
        options[match[1]] = match[2];
    }
    if (!['assessment', 'ratings', 'jar', 'out'].every(key => options[key])) throw new Error('Missing required comparison input/output.');
    const outputs = [options.out, options.report].filter(Boolean).map(p => resolve(p));
    if (new Set(outputs).size !== outputs.length || outputs.some(p => existsSync(p))) throw new Error('Choose different, new output paths; previous reports are preserved.');
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    const reportBytes = readFileSync(options.assessment);
    const ratings = parseSeRatings(readFileSync(options.ratings, 'utf8'));
    const result = compareSe(JSON.parse(reportBytes), ratings);
    result.provenance = { jarSha256: hash(readFileSync(options.jar)), reportSha256: hash(reportBytes),
        ratingsSha256: hash(JSON.stringify([...ratings].sort(([a], [b]) => a.localeCompare(b)))) };
    const write = (path, data) => { mkdirSync(dirname(resolve(path)), { recursive: true }); writeFileSync(path, data, { flag: 'wx' }); };
    write(options.out, JSON.stringify(result, null, 2) + '\n');
    if (options.report) write(options.report, renderSeComparison(result));
    console.log(`${result.rated}/${result.total} SE ratings joined; ${result.failed} failed/sentinel results.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
