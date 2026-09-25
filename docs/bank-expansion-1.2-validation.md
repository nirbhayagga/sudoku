# Current bank measurements — v1.2.0

Ranges are minimum / upper median / nearest-rank P90 / maximum. These describe the current observed human-technique paths; clue count is descriptive, not a grading input. Earlier v1.1 reports remain historical snapshots.

| Tier | Puzzles | Clues | Elimination steps | Largest proof nodes | Total steps |
|---|---:|---|---|---|---|
| easy | 1493 | 23 / 32 / 38 / 38 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 43 / 49 / 56 / 58 |
| medium | 1570 | 17 / 17 / 24 / 32 | 1 / 3 / 7 / 14 | 0 / 0 / 0 / 0 | 50 / 67 / 71 / 78 |
| hard | 997 | 17 / 17 / 24 / 32 | 1 / 8 / 13 / 21 | 0 / 0 / 0 / 0 | 52 / 72 / 77 / 85 |
| expert | 384 | 17 / 24 / 27 / 32 | 0 / 6 / 14 / 23 | 0 / 0 / 0 / 0 | 49 / 65 / 77 / 87 |
| evil | 992 | 17 / 17 / 26 / 38 | 0 / 12 / 21 / 52 | 6 / 8 / 14 / 18 | 46 / 73 / 82 / 109 |
| nightmare | 256 | 17 / 24 / 26 / 28 | 3 / 22 / 35 / 48 | 9 / 35 / 56 / 119 | 59 / 79 / 93 / 112 |

The highest displayed challenge is Nightmare 256, identity `p31a4742caf005f60`. This is a policy ordering, not a claim that every person will find that board hardest.

The expansion JSON records all 192 new assessments and their transformation checks. Independent Sudoku Explainer measurements in the older validation report cover the original 5,500 only; new boards have not been assigned SE grades.

Regenerate this summary without changing the bank:

```bash
node scripts/summarize-bank.js > e2e-results/current-bank-measurements.md
```

