/**
 * Legacy search-node candidate collector. Dry runs only; use the human
 * assessment and reclassification pipeline to publish a bank revision.
 *
 *   node scripts/generate-bank.js --difficulty evil --count 500 --pool 4000
 *   node scripts/generate-bank.js --difficulty nightmare --reorder --out=candidates.json
 *   node scripts/generate-bank.js --difficulty evil --import FILE --count 500
 *
 * Search effort is a diagnostic, not a human difficulty label. --import takes
 * a separate filename argument. Every retained candidate is uniquely solvable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SudokuSolver } from '../solver.js';
import { SudokuGenerator } from '../generator.js';
import { puzzleId } from '../puzzle-id.js';
import { PUZZLES } from '../puzzle-bank.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function parseArgs(argv) {
    const args = {
        difficulty: 'evil', count: 500, pool: 4000,
        write: false, reorder: false, import: null, out: null, maxAttempts: null,
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--write') args.write = true;
        else if (arg === '--reorder') args.reorder = true;
        else if (['--import', '--difficulty', '--count', '--pool', '--out', '--max-attempts'].includes(arg)) {
            const value = argv[++i];
            if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
            const key = arg === '--max-attempts' ? 'maxAttempts' : arg.slice(2);
            args[key] = ['count', 'pool', 'maxAttempts'].includes(key) ? Number(value) : value;
        } else throw new Error(`Unknown option: ${arg}`);
    }
    if (!Object.hasOwn(PUZZLES, args.difficulty)) throw new Error('Unknown difficulty');
    for (const key of ['count', 'pool']) {
        if (!Number.isSafeInteger(args[key]) || args[key] < 1 || args[key] > 100000) throw new Error(`Invalid ${key}`);
    }
    if (args.import && args.reorder) throw new Error('Choose import or reorder, not both');
    if (args.write && args.out) throw new Error('--out is only for a dry run');
    if (!args.import && !args.reorder && args.pool < args.count) throw new Error('Pool must contain at least count puzzles');
    if (args.write && !args.reorder && args.count !== PUZZLES[args.difficulty].length) {
        throw new Error('Changing tier size requires a separate BANK_SIZES migration');
    }
    args.maxAttempts ??= args.pool * 50;
    if (!Number.isSafeInteger(args.maxAttempts) || args.maxAttempts < 1 || args.maxAttempts > 5000000) throw new Error('Invalid max-attempts');
    return args;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.write) throw new Error('Use human assessment and reclassify-bank.js to publish; this search-node tool only produces candidates.');
    // Fail before expensive generation when a dry-run destination already exists.
    const output = args.out || (!args.reorder ? `${args.difficulty}-${args.import ? 'imported' : 'regenerated'}.json` : null);
    if (!args.write && output && fs.existsSync(path.resolve(output))) throw new Error('EEXIST: output already exists');

    const existing = PUZZLES[args.difficulty];
    if (!existing) {
        console.error(`Unknown difficulty: ${args.difficulty}`);
        process.exit(1);
    }

    if (args.reorder) {
        reorderTier(args, SudokuSolver, existing);
        return;
    }

    if (args.import) {
        importTier(args, SudokuSolver);
        return;
    }

    console.log(`Regenerating "${args.difficulty}": keeping the hardest ${args.count} of a ${args.pool}-puzzle pool\n`);

    const seen = new Set();
    const candidates = [];
    const started = Date.now();

    let attempts = 0;
    while (candidates.length < args.pool && attempts++ < args.maxAttempts) {
        const result = SudokuGenerator.generate(args.difficulty, { maxAttempts: 1 });
        if (!result || seen.has(result.puzzle)) continue;
        seen.add(result.puzzle);

        candidates.push({
            puzzle: result.puzzle,
            clues: result.clues,
            nodes: SudokuSolver.rateDifficulty(result.puzzle),
        });

        if (candidates.length % 250 === 0) {
            const rate = candidates.length / ((Date.now() - started) / 1000);
            const left = Math.round((args.pool - candidates.length) / rate);
            process.stdout.write(`  ${candidates.length}/${args.pool}  (~${left}s remaining)\n`);
        }
    }
    if (candidates.length < args.pool) throw new Error(`Attempt limit reached: found ${candidates.length}/${args.pool} distinct puzzles`);

    // Hardest first by search effort, tie-broken by fewer clues.
    candidates.sort((a, b) => b.nodes - a.nodes || a.clues - b.clues);
    const chosen = candidates.slice(0, args.count);

    // Presented easiest-first, so level number tracks difficulty.
    chosen.reverse();

    const nodes = chosen.map((c) => c.nodes).sort((a, b) => a - b);
    const clues = chosen.map((c) => c.clues).sort((a, b) => a - b);
    const at = (arr, k) => arr[Math.floor(arr.length * k)];

    console.log(`\nSelected ${chosen.length} in ${Math.round((Date.now() - started) / 1000)}s`);
    console.log(`  search nodes  min ${nodes[0]}  median ${at(nodes, 0.5)}  p90 ${at(nodes, 0.9)}  max ${nodes[nodes.length - 1]}`);
    console.log(`  clues         min ${clues[0]}  median ${at(clues, 0.5)}  max ${clues[clues.length - 1]}`);
    console.log(`  pure-logic    ${Math.round(nodes.filter((n) => n === 0).length / nodes.length * 100)}%`);

    // Every puzzle must still be uniquely solvable before it can ship.
    const invalid = chosen.filter((c) => SudokuSolver.countSolutions(c.puzzle, 2) !== 1);
    if (invalid.length) {
        console.error(`\nABORT: ${invalid.length} puzzles are not uniquely solvable`);
        process.exit(1);
    }
    console.log('  uniqueness    all verified');

    const entries = chosen.map(c => ({ id: puzzleId(c.puzzle), puzzle: c.puzzle }));

    if (!args.write) {
        const out = path.resolve(args.out || `${args.difficulty}-regenerated.json`);
        fs.writeFileSync(out, JSON.stringify(entries, null, 2) + '\n', { flag: 'wx' });
        console.log(`\nDry run. Wrote ${out}\nAssess candidates with assess-v4.js before proposing a bank change.`);
        return;
    }

    patchBank(args.difficulty, entries);
    console.log(`\nPatched puzzle-bank.js — "${args.difficulty}" now holds ${entries.length} puzzles.`);
    console.log('Existing leaderboard scores for this tier now refer to different puzzles.');
}

/**
 * Build a tier from an external list of puzzles — one per line, 81 characters,
 * `0` or `.` for empty. Intended for catalogues that cannot be generated at
 * runtime, above all the published 17-clue set: digging to 17 clues by random
 * removal is impractical for ordinary runtime budgets, so catalogue import is preferred.
 *
 * The hardest `count` of the file are kept, which is the whole point of feeding
 * in a large source: selecting the top slice of a big catalogue produces a far
 * more consistent tier than sampling it arbitrarily.
 */
function importTier(args, SudokuSolver) {
    const file = path.resolve(args.import);
    console.log(`Importing "${args.difficulty}" from ${file}\n`);

    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    const puzzles = [];
    const seen = new Set();
    let malformed = 0;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const board = trimmed.replace(/\./g, '0');
        if (!/^[0-9]{81}$/.test(board)) {
            malformed++;
            continue;
        }
        if (seen.has(board)) continue;
        seen.add(board);
        puzzles.push(board);
    }

    console.log(`  ${puzzles.length} distinct puzzles read` +
        (malformed ? `, ${malformed} malformed lines skipped` : ''));
    if (puzzles.length < args.count) {
        console.error(`\nABORT: need ${args.count} puzzles, found ${puzzles.length}`);
        process.exit(1);
    }

    // Uniqueness is verified for every candidate, not just the chosen ones —
    // an imported catalogue is only trustworthy once checked here.
    console.log('  verifying unique solutions...');
    const started = Date.now();
    const valid = [];
    let ambiguous = 0;

    for (let i = 0; i < puzzles.length; i++) {
        if (SudokuSolver.countSolutions(puzzles[i], 2) !== 1) {
            ambiguous++;
            continue;
        }
        valid.push({ puzzle: puzzles[i], nodes: SudokuSolver.rateDifficulty(puzzles[i]) });

        if ((i + 1) % 5000 === 0) {
            process.stdout.write(`    ${i + 1}/${puzzles.length}\n`);
        }
    }

    console.log(`  ${valid.length} uniquely solvable` +
        (ambiguous ? `, ${ambiguous} REJECTED as ambiguous` : '') +
        ` (${Math.round((Date.now() - started) / 1000)}s)`);

    if (valid.length < args.count) {
        console.error(`\nABORT: only ${valid.length} valid puzzles, need ${args.count}`);
        process.exit(1);
    }

    // Hardest first, then presented easiest-first so level tracks difficulty.
    valid.sort((a, b) => b.nodes - a.nodes);
    const chosen = valid.slice(0, args.count).reverse();

    const nodes = chosen.map((c) => c.nodes);
    const all = valid.map((v) => v.nodes).sort((a, b) => a - b);
    console.log(`\n  whole file:  median ${all[Math.floor(all.length / 2)]} nodes, ` +
        `${Math.round(all.filter((n) => n === 0).length / all.length * 100)}% pure-logic`);
    console.log(`  kept ${chosen.length}: min ${nodes[0]}, median ${nodes[Math.floor(nodes.length / 2)]}, max ${nodes[nodes.length - 1]}, ` +
        `${Math.round(nodes.filter((n) => n === 0).length / nodes.length * 100)}% pure-logic`);

    const entries = chosen.map(c => ({ id: puzzleId(c.puzzle), puzzle: c.puzzle }));

    if (!args.write) {
        const out = path.resolve(args.out || `${args.difficulty}-imported.json`);
        fs.writeFileSync(out, JSON.stringify(entries, null, 2) + '\n', { flag: 'wx' });
        console.log(`\nDry run. Wrote ${out}\nAssess candidates with assess-v4.js before proposing a bank change.`);
        return;
    }
    patchBank(args.difficulty, entries);
    console.log(`\nPatched puzzle-bank.js — "${args.difficulty}" now holds ${entries.length} puzzles.`);
    console.log('Existing leaderboard scores for this tier now refer to different puzzles.');
}

/**
 * Sort an existing tier by measured difficulty instead of generating new
 * puzzles — keeps exactly the same puzzles and rechecks unique solvability,
 * then makes the level number track this search metric. Useful for the nightmare tier,
 * whose 17-clue puzzles come from a published catalogue in arbitrary order and
 * range from trivial-for-a-solver to genuinely brutal.
 */
function reorderTier(args, SudokuSolver, existing) {
    console.log(`Reordering "${args.difficulty}" (${existing.length} puzzles) by measured difficulty\n`);

    if (existing.some(entry => SudokuSolver.countSolutions(entry.puzzle, 2) !== 1)) throw new Error('Tier contains a puzzle without a unique solution');
    const rated = existing
        .map((entry) => ({ ...entry, nodes: SudokuSolver.rateDifficulty(entry.puzzle) }))
        .sort((a, b) => a.nodes - b.nodes);

    const nodes = rated.map((r) => r.nodes);
    console.log(`  level 1 needs ${nodes[0]} search nodes, level ${rated.length} needs ${nodes[nodes.length - 1]}`);
    console.log(`  median ${nodes[Math.floor(nodes.length / 2)]}`);

    const entries = rated.map(entry => ({ id: puzzleId(entry.puzzle), puzzle: entry.puzzle }));

    if (!args.write) {
        if (args.out) fs.writeFileSync(path.resolve(args.out), JSON.stringify(entries, null, 2) + '\n', { flag: 'wx' });
        console.log('\nDry run. Assess candidates with assess-v4.js before proposing a bank change.');
        return;
    }
    patchBank(args.difficulty, entries);
    console.log(`\nPatched puzzle-bank.js — "${args.difficulty}" now runs easiest to hardest.`);
    console.log('Existing leaderboard scores for this tier now refer to different puzzles.');
}

/** Replace one difficulty's array in puzzle-bank.js, leaving the rest byte-identical. */
export function patchBank(difficulty, entries, file = path.join(root, 'puzzle-bank.js')) {
    if (!Object.hasOwn(PUZZLES, difficulty) || !entries.length) throw new Error('Invalid tier');
    const seen = new Set();
    for (const entry of entries) {
        if (!/^[0-9]{81}$/.test(entry.puzzle) || seen.has(entry.puzzle) || SudokuSolver.countSolutions(entry.puzzle, 2) !== 1) throw new Error('Invalid, repeated or non-unique puzzle');
        seen.add(entry.puzzle);
    }
    const source = fs.readFileSync(file, 'utf8');

    const startMarker = `    ${difficulty}: [`;
    const start = source.indexOf(startMarker);
    if (start === -1) throw new Error(`Could not locate "${difficulty}" in puzzle-bank.js`);

    const end = source.indexOf('\n    ],\n', start);
    if (end === -1) throw new Error(`Could not locate the end of "${difficulty}"`);

    // Bare strings: puzzle-bank.js derives ids from position at load time.
    const body = entries
        .map((e) => `        '${e.puzzle}',`)
        .join('\n');

    const replaced = `${startMarker}\n${body}\n    ],\n`;
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, source.slice(0, start) + replaced + source.slice(end + '\n    ],\n'.length), { flag: 'wx' });
    try { fs.renameSync(temporary, file); } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
