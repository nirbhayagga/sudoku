/**
 * The frontend files are plain <script> globals, not modules, so tests can't
 * import them. This evaluates them into a shared vm context in load order and
 * hands back the globals they define.
 *
 * Top-level `const` declarations land in the context's global lexical scope
 * (shared across runInContext calls) rather than on globalThis, so the final
 * expression is what pulls them out.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const EXPORTED = ['SudokuSolver', 'SudokuGenerator', 'PUZZLES', 'ALL_PUZZLES', 'DIFFICULTY_LABELS'];

export function loadSudoku(files = ['solver.js', 'generator.js', 'puzzle-bank.js']) {
    const context = vm.createContext({ performance, console, Math, Date, JSON });

    for (const file of files) {
        const code = fs.readFileSync(path.join(root, file), 'utf8');
        vm.runInContext(code, context, { filename: file });
    }

    const available = EXPORTED.filter((name) =>
        vm.runInContext(`typeof ${name} !== 'undefined'`, context)
    );
    return vm.runInContext(`({ ${available.join(', ')} })`, context);
}

/** Read a file from the repo root. */
export function readSource(file) {
    return fs.readFileSync(path.join(root, file), 'utf8');
}

export const repoRoot = root;
