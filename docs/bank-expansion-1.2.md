# Classic bank expansion — v1.2.0

Generated 4000 minimal, unique candidates using seed 120026. Added 192 independently generated boards: 128 Expert and 64 Nightmare. All original 5500 boards remain.

Every accepted original and its digit reversal, transpose and first-row swap completes under human-v4 maintenance with the same observed family. Exact equivalence filtering covers digit relabelling, row/band and column/stack permutations and transpose; cheap necessary invariants only avoid redundant exact comparisons.

Candidates sample the available workload range. No transformed copies or unresolved puzzles fill the requested counts. Ratings describe bounded observed paths, not universal human difficulty or exact Sudoku Explainer grades.

| Tier | Total | Added |
|---|---:|---:|
| easy | 1493 | 0 |
| medium | 1570 | 0 |
| hard | 997 | 0 |
| expert | 384 | 128 |
| evil | 992 | 0 |
| nightmare | 256 | 64 |

New puzzles are inserted in technique order. Level numbers can move; content-ID shares, saves and stored scores follow the board. The original daily pool and ordering are retained, so date links still identify the same puzzle. Bank revision 2 storage remains in use.

## Reproduce

Run this command from the v1.1.0 bank with the expansion tooling present, using a new output directory:

```bash
node scripts/expand-bank.js --seed=120026 --attempts=4000 --expert=128 --nightmare=64 --out=e2e-results/new-expansion
node scripts/expand-bank.js --apply=e2e-results/new-expansion
```

Review the proposal before applying. Applying checks baseline/source/artifact hashes. The JSON companion records each board, generating attempt, complete original assessment and transformed comparison keys. The same grading engine also accepts newly imported puzzles through assess-v4.js.

Baseline SHA-256: aa7715daeb96aad1621bc767fdf511819566fc51b887c3cdd1856b8bda270440
