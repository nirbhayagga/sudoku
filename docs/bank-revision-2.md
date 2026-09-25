# Bank revision 2 — human-technique ladder

Policy: human-order-v1. All 5500 original boards retained and uniquely solvable.

| Tier | Puzzles | Verified path families |
|---|---:|---|
| easy | 1493 | singles |
| medium | 1570 | locked-candidates |
| hard | 997 | subsets |
| expert | 256 | wings, uniqueness |
| evil | 992 | chains |
| nightmare | 192 | dynamic-chains |

## Measurements

Ranges are minimum / upper median / nearest-rank P90 / maximum. Clue count is descriptive, never a ranking input.

| Tier | Clues | Elimination steps | Largest proof nodes | Total steps |
|---|---|---|---|---|
| easy | 23 / 32 / 38 / 38 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 43 / 49 / 56 / 58 |
| medium | 17 / 17 / 24 / 32 | 1 / 3 / 7 / 14 | 0 / 0 / 0 / 0 | 50 / 67 / 71 / 78 |
| hard | 17 / 17 / 24 / 32 | 1 / 8 / 13 / 21 | 0 / 0 / 0 / 0 | 52 / 72 / 77 / 85 |
| expert | 17 / 17 / 27 / 32 | 0 / 7 / 15 / 23 | 0 / 0 / 0 / 0 | 49 / 69 / 78 / 87 |
| evil | 17 / 17 / 26 / 38 | 0 / 12 / 21 / 52 | 6 / 8 / 14 / 18 | 46 / 73 / 82 / 109 |
| nightmare | 17 / 24 / 26 / 28 | 3 / 22 / 35 / 48 | 9 / 37 / 58 / 119 | 59 / 81 / 94 / 112 |

## Transformation review

Transformation assessments: 16500; all solved. Changed observed family: 1.

- p9abe62bf41552483: original uniqueness, transformed chains. Keep the simpler verified original path; this records an order-sensitive search result, not a change in the mathematical puzzle.

These checks reverse digits, transpose the board and swap the first two rows. They cover the entire bank but do not enumerate every legal Sudoku symmetry. Step counts and selected paths can differ; no claim of complete transformation invariance is made.

## Ordering and boundaries

Order: family, named technique within that family, deepest proof, largest proof, largest branch count, elimination steps, candidate eliminations, total steps, opening eliminations, content identity. Chain shapes share one named band; their proof complexity determines order.

The exact named-pattern sequence is in rating-policy.js. Every level and its comparison key are recorded in bank-ranking.json; these maintenance files are not downloaded by the app.

- easy: level 1 p00170929413071b5; level 1493 pfea364e78f0400d3.
- medium: level 1 p02153617698523a3; level 1570 p6735f860965ef834.
- hard: level 1 pea164c30de728e04; level 997 p54ce020000247e74.
- expert: level 1 p4665a223fd19febf; level 256 pa96d135259269766.
- evil: level 1 p7183466bed31e787; level 992 p3fbeb42351bb0417.
- nightmare: level 1 p8a68230840aafbac; level 192 p31a4742caf005f60.

The policy orders observed reasoning paths. It does not prove a globally simplest path or a universal human difficulty order. SE is an independent comparison, not the source of these labels.

## Release behavior

This is an intentional bank revision: no compatibility mapping for old numbered links, saved games, played lists or score records. Settings and calendar streaks are retained. Old storage is left untouched under its previous keys; old backups cannot be restored into this bank. New shared bank links use stable board identities.

Expert and Nightmare are the first candidates for targeted expansion in v1.2.0. Smaller counts are not a defect to fix by adding symmetry duplicates or unresolved puzzles. No new puzzles or board sizes are included in v1.1.0.

## Repeat the assessment

Run from the repository root, using new output paths:

```bash
node scripts/assess-v4.js --all --transforms --out=e2e-results/new-rating.json
node scripts/reclassify-bank.js --assessment=e2e-results/new-rating.json --out=e2e-results/new-proposal
```

Review the generated files before using --apply with another fresh output directory. The tool refuses incomplete/stale inputs, unresolved variants or a transformed path with a simpler family that has not been reviewed. The same assessor accepts --puzzle=GRID and --file=LINES for imported and newly generated boards.

Earlier reports retain the previous level references. Re-running them on this bank produces the same puzzles grouped under their new labels; their original result files are not overwritten.

Assessment SHA-256: 86380b620419de42f72e6499056973a589c6631b8ee8326cf3addfaa82493cae
Board-set SHA-256: aa7715daeb96aad1621bc767fdf511819566fc51b887c3cdd1856b8bda270440
