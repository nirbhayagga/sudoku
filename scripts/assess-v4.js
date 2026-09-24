#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PUZZLES } from '../puzzle-bank.js';
import { assessPuzzleEnhanced } from '../enhanced-assessment.js';
import { ENHANCED_VERSION, ENHANCED_FAMILIES, ENHANCED_PROFILES } from '../enhanced-reasoning.js';
import { parsePuzzleText } from '../format.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = v => createHash('sha256').update(v).digest('hex');
export function transforms(puzzle) {
    const map = fn => Array.from({ length: 81 }, (_, i) => puzzle[fn(i)]).join('');
    return [puzzle.replace(/[1-9]/g, d => String(10 - Number(d))),
        map(i => i % 9 * 9 + Math.floor(i / 9)),
        map(i => (Math.floor(i / 9) < 2 ? 1 - Math.floor(i / 9) : Math.floor(i / 9)) * 9 + i % 9)];
}
const distribution = xs => {
    if (!xs.length) return null;
    const a = [...xs].sort((x, y) => x - y);
    return [a[0], a[Math.floor(a.length / 2)], a[Math.ceil(a.length * .9) - 1], a.at(-1)].join(' / ');
};
try {
    const options = {};
    const allowed = new Set(['--all', '--sample', '--puzzle', '--file', '--out', '--report', '--transforms', '--trace', '--help']);
    for (const arg of process.argv.slice(2)) {
        const index = arg.indexOf('='), key = index < 0 ? arg : arg.slice(0, index);
        if (!allowed.has(key) || key in options) throw new Error('Unknown or duplicate option');
        const flag = ['--all', '--transforms', '--trace', '--help'].includes(key);
        if ((index < 0) !== flag || (index >= 0 && !arg.slice(index + 1))) throw new Error('Missing value or unexpected flag value');
        options[key] = index < 0 ? true : arg.slice(index + 1);
    }
    if (options['--help']) {
        console.log('assess-v4.js --all|--sample=N|--puzzle=GRID|--file=LINES [--transforms] [--trace] [--out=NEW.json] [--report=NEW.md]\nFiles contain one 81-cell puzzle per nonempty line. Duplicate boards rejected. No outputs are overwritten.');
        process.exit(0);
    }
    if (['--all', '--sample', '--puzzle', '--file'].filter(k => options[k] !== undefined).length !== 1) throw new Error('Choose one input selection');
    const sample = Number(options['--sample']);
    if (options['--sample'] && (!Number.isSafeInteger(sample) || sample < 1)) throw new Error('Invalid sample');
    const paths = ['--out', '--report'].filter(k => options[k]).map(k => resolve(options[k]));
    if (new Set(paths).size !== paths.length || paths.some(existsSync)) throw new Error('Use distinct new output paths');
    let selected;
    if (options['--file'] || options['--puzzle']) {
        const raw = options['--file'] ? readFileSync(options['--file'], 'utf8') : options['--puzzle'];
        const lines = options['--file'] ? raw.split(/\r?\n/).filter(s => s.trim()) : [raw];
        selected = lines.map((line, i) => {
            const puzzle = parsePuzzleText(line);
            if (!puzzle) throw new Error(`Malformed input on line ${i + 1}`);
            return { difficulty: 'external', level: i + 1, puzzle };
        });
    } else selected = Object.entries(PUZZLES).flatMap(([difficulty, puzzles]) => {
        const n = options['--all'] ? puzzles.length : Math.min(sample, puzzles.length);
        return Array.from({ length: n }, (_, i) => {
            const level = n === 1 ? 1 : 1 + Math.floor(i * (puzzles.length - 1) / (n - 1));
            return { difficulty, level, puzzle: puzzles[level - 1].puzzle };
        });
    });
    if (!selected.length || new Set(selected.map(r => r.puzzle)).size !== selected.length) throw new Error('Empty input or duplicate puzzles');
    if (options['--trace'] && selected.length !== 1) throw new Error('Traces require one puzzle');
    const sources = ['enhanced-assessment.js', 'enhanced-reasoning.js', 'named-techniques.js', 'extended-reasoning.js', 'dynamic-chains.js', 'reasoning.js', 'advanced-techniques.js', 'chains.js', 'techniques.js', 'solver.js', 'format.js', 'scripts/assess-v4.js'];
    const sourceHashes = Object.fromEntries(sources.map(p => [p, hash(readFileSync(resolve(root, p)))]));
    const records = selected.map((r, i) => {
        const human = assessPuzzleEnhanced(r.puzzle, { trace: Boolean(options['--trace']) });
        const variants = options['--transforms'] ? transforms(r.puzzle).map(p => {
            const a = assessPuzzleEnhanced(p);
            return { sha256: hash(p), status: a.status, family: a.family, opening: a.opening, workload: a.workload };
        }) : [];
        if ((i + 1) % 100 === 0 || i + 1 === selected.length) console.error(`${i + 1}/${selected.length} assessed`);
        return { ...r, id: `classic9-${hash(r.puzzle)}`, human, ...(variants.length ? { transformations: variants } : {}) };
    });
    const report = { schemaVersion: 1, policy: { version: ENHANCED_VERSION, families: ENHANCED_FAMILIES, profile: 'maintenance', limits: ENHANCED_PROFILES.maintenance,
        meaning: 'Best observed bounded path; families are not exact SE grades or universal human difficulty.', transformations: options['--transforms'] ? ['digit reversal', 'transpose', 'first two rows swapped'] : [] },
        provenance: { inputSha256: hash(JSON.stringify(selected)), sourceHashes, sourceSha256: hash(JSON.stringify(sourceHashes)) }, records };
    const solved = records.filter(r => r.human.status === 'solved');
    const lines = ['# Human assessment v4', '', '**Review report only: no bank reorder or tier changes.**', '',
        `Explained ${solved.length}/${records.length}; other statuses retain no difficulty rank.`, '',
        'Profiles share rules; maintenance compares forward/reverse technique order within the first successful family cap. The selected path minimizes family, deepest proof, largest proof, elimination steps, then total steps. This is a declared selection policy, not a numerical SE grade.', '',
        'Opening records the first deduction, first placement, preceding exclusions and highest family encountered before that placement. Proof complexity counts branches, nodes and maximum parent depth. Unique rectangles (types 1, 2, 4) and BUG+1 require a separately verified unique puzzle. Every selected move is audited against the complete solver.', '',
        '| Family | Count | Exclusion steps min / median / p90 / max | Largest proof nodes |', '|---|---:|---|---|',
        ...ENHANCED_FAMILIES.map(f => { const a = solved.filter(r => r.human.family === f); return `| ${f} | ${a.length} | ${distribution(a.map(r => r.human.workload.eliminationSteps)) || '—'} | ${distribution(a.map(r => r.human.workload.largestProof)) || '—'} |`; }), '',
        `Transformation checks: ${records.reduce((n, r) => n + (r.transformations?.length || 0), 0)}. Changed observed family: ${records.filter(r => r.transformations?.some(t => t.family !== r.human.family)).length} boards. Differences are reported, not silently normalized away.`, '',
        '## Review examples', '', 'These sample the minimum, median and maximum workload of each family. No solutions are printed.', ''];
    for (const family of ENHANCED_FAMILIES) {
        const a = solved.filter(r => r.human.family === family).sort((a, b) => a.human.workload.eliminationSteps - b.human.workload.eliminationSteps || a.id.localeCompare(b.id));
        for (const i of [...new Set([0, Math.floor(a.length / 2), a.length - 1])]) if (a[i]) {
            const r = a[i]; lines.push(`- ${r.difficulty} ${r.level}: ${family}; ${r.human.workload.eliminationSteps} exclusions; proof ${r.human.workload.largestProof} nodes. Board: \`${r.puzzle}\``);
        }
    }
    lines.push('', `Input SHA-256: \`${report.provenance.inputSha256}\``, '', `Source SHA-256: \`${report.provenance.sourceSha256}\``, '', 'Earlier v1–v3 reports and executables remain available. New or imported puzzle collections use the identical --file or --puzzle path. Review technique disagreements and boundaries before applying a bank migration.', '');
    const write = (p, data) => { mkdirSync(dirname(resolve(p)), { recursive: true }); writeFileSync(p, data, { flag: 'wx' }); };
    if (options['--out']) write(options['--out'], JSON.stringify(report, null, 2) + '\n');
    else console.log(JSON.stringify(report, null, 2));
    if (options['--report']) write(options['--report'], lines.join('\n'));
} catch (error) { console.error(error.message); process.exitCode = 1; }
