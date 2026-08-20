/**
 * Regenerate one difficulty tier of puzzle-bank.js.
 *
 *   node scripts/generate-bank.js --difficulty evil --count 500 --pool 4000
 *   node scripts/generate-bank.js --difficulty evil --write
 *   node scripts/generate-bank.js --difficulty nightmare --reorder --write
 *   node scripts/generate-bank.js --difficulty nightmare --import 17clue.txt --count 3000 --write
 *
 * Selection is by SudokuSolver.rateDifficulty (search nodes needed beyond pure
 * constraint propagation), not clue count. Clue count does not separate tiers:
 * the bank's expert and evil tiers had near-identical clue counts and turned out
 * to be the same difficulty. This generates a large pool and keeps the hardest
 * `count` of it, so the tier is defined by measured difficulty.
 *
 * Puzzle position is the user-visible level number and is recorded in
 * leaderboard entries, so rewriting a tier invalidates existing scores for it.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function parseArgs(argv) {
    const args = {
        difficulty: 'evil', count: 500, pool: 4000,
        write: false, reorder: false, import: null,
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--write') args.write = true;
        else if (arg === '--reorder') args.reorder = true;
        else if (arg === '--import') args.import = argv[++i];
        else if (arg === '--difficulty') args.difficulty = argv[++i];
        else if (arg === '--count') args.count = Number(argv[++i]);
        else if (arg === '--pool') args.pool = Number(argv[++i]);
    }
    return args;
}

/** Load the frontend scripts, which are globals rather than modules. */
function loadEngine() {
    const context = vm.createContext({ performance, console, Math, Date, JSON });
    for (const file of ['solver.js', 'generator.js', 'puzzle-bank.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    }
    return vm.runInContext('({ SudokuSolver, SudokuGenerator, PUZZLES })', context);
}

/** Id format used by the bank: prefix letter + zero-padded position. */
function idFormat(existing) {
    const sample = existing[0].id;
    const prefix = sample[0];
    const width = sample.length - 1;
    return (n) => prefix + String(n).padStart(width, '0');
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const { SudokuSolver, SudokuGenerator, PUZZLES } = loadEngine();

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
        importTier(args, SudokuSolver, existing);
        return;
    }

    console.log(`Regenerating "${args.difficulty}": keeping the hardest ${args.count} of a ${args.pool}-puzzle pool\n`);

    const seen = new Set();
    const candidates = [];
    const started = Date.now();

    while (candidates.length < args.pool) {
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

    const makeId = idFormat(existing);
    const entries = chosen.map((c, i) => ({ id: makeId(i + 1), puzzle: c.puzzle }));

    if (!args.write) {
        const out = path.join(root, `${args.difficulty}-regenerated.json`);
        fs.writeFileSync(out, JSON.stringify(entries, null, 2));
        console.log(`\nDry run. Wrote ${out}\nRe-run with --write to patch puzzle-bank.js.`);
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
 * removal is computationally hopeless, so those puzzles can only be imported.
 *
 * The hardest `count` of the file are kept, which is the whole point of feeding
 * in a large source: selecting the top slice of a big catalogue produces a far
 * more consistent tier than sampling it arbitrarily.
 */
function importTier(args, SudokuSolver, existing) {
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

    const makeId = idFormat(existing);
    const entries = chosen.map((c, i) => ({ id: makeId(i + 1), puzzle: c.puzzle }));

    if (!args.write) {
        const out = path.join(root, `${args.difficulty}-imported.json`);
        fs.writeFileSync(out, JSON.stringify(entries, null, 2));
        console.log(`\nDry run. Wrote ${out}\nRe-run with --write to patch puzzle-bank.js.`);
        return;
    }
    patchBank(args.difficulty, entries);
    console.log(`\nPatched puzzle-bank.js — "${args.difficulty}" now holds ${entries.length} puzzles.`);
    console.log('Existing leaderboard scores for this tier now refer to different puzzles.');
}

/**
 * Sort an existing tier by measured difficulty instead of generating new
 * puzzles — keeps exactly the same puzzles, so nothing has to be re-verified,
 * but makes the level number track difficulty. Useful for the nightmare tier,
 * whose 17-clue puzzles come from a published catalogue in arbitrary order and
 * range from trivial-for-a-solver to genuinely brutal.
 */
function reorderTier(args, SudokuSolver, existing) {
    console.log(`Reordering "${args.difficulty}" (${existing.length} puzzles) by measured difficulty\n`);

    const rated = existing
        .map((entry) => ({ ...entry, nodes: SudokuSolver.rateDifficulty(entry.puzzle) }))
        .sort((a, b) => a.nodes - b.nodes);

    const nodes = rated.map((r) => r.nodes);
    console.log(`  level 1 needs ${nodes[0]} search nodes, level ${rated.length} needs ${nodes[nodes.length - 1]}`);
    console.log(`  median ${nodes[Math.floor(nodes.length / 2)]}`);

    const makeId = idFormat(existing);
    const entries = rated.map((entry, i) => ({ id: makeId(i + 1), puzzle: entry.puzzle }));

    if (!args.write) {
        console.log('\nDry run. Re-run with --write to patch puzzle-bank.js.');
        return;
    }
    patchBank(args.difficulty, entries);
    console.log(`\nPatched puzzle-bank.js — "${args.difficulty}" now runs easiest to hardest.`);
    console.log('Existing leaderboard scores for this tier now refer to different puzzles.');
}

/** Replace one difficulty's array in puzzle-bank.js, leaving the rest byte-identical. */
function patchBank(difficulty, entries) {
    const file = path.join(root, 'puzzle-bank.js');
    const source = fs.readFileSync(file, 'utf8');

    const startMarker = `    ${difficulty}: [`;
    const start = source.indexOf(startMarker);
    if (start === -1) throw new Error(`Could not locate "${difficulty}" in puzzle-bank.js`);

    const end = source.indexOf('\n    ],\n', start);
    if (end === -1) throw new Error(`Could not locate the end of "${difficulty}"`);

    const body = entries
        .map((e) => `        { id: '${e.id}', puzzle: '${e.puzzle}' }`)
        .join(',\n');

    const replaced = `${startMarker}\n${body},\n    ],\n`;
    fs.writeFileSync(file, source.slice(0, start) + replaced + source.slice(end + '\n    ],\n'.length));
}

main();
