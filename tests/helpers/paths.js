import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Read a file from the repo root. */
export function readSource(file) {
    return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}
