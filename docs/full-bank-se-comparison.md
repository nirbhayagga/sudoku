# Full-bank comparison with Sudoku Explainer

> Historical assessment of the bank before revision 2. Level references below use that order.
> See [the current bank definitions](bank-revision-2.md); the original measurements are preserved.

Our policy: `human-v3.0`. SE rated **5500/5500**; failed/sentinel results: **0**.

The tables compare observed results, not interchangeable numeric scales. A family
names our first successful family-capped pass; SE ER is its hardest applied rating.
EP measures the path to the first placement; ED the first placement or elimination.
All ranges below are min / upper median / nearest-rank P90 / max.

| Existing tier | Count | SE ER | SE EP | SE ED |
|---|---:|---|---|---|
| easy | 500 | 1.2 / 1.2 / 1.2 / 6.6 | 1 / 1.2 / 1.2 / 1.2 | 1 / 1.2 / 1.2 / 1.2 |
| medium | 500 | 1.2 / 1.2 / 2 / 7.2 | 1 / 1.2 / 1.2 / 1.5 | 1 / 1.2 / 1.2 / 1.5 |
| hard | 500 | 1.2 / 1.5 / 6.6 / 8.4 | 1.2 / 1.2 / 1.2 / 1.5 | 1.2 / 1.2 / 1.2 / 1.5 |
| expert | 500 | 1.2 / 2.5 / 7.2 / 9.1 | 1.2 / 1.2 / 1.2 / 2 | 1.2 / 1.2 / 1.2 / 2 |
| evil | 500 | 1.7 / 7.1 / 8.3 / 9 | 1.2 / 1.2 / 1.2 / 7.1 | 1.2 / 1.2 / 1.2 / 2.8 |
| nightmare | 3000 | 1.7 / 2.6 / 6.7 / 9 | 1.2 / 1.2 / 1.5 / 6.7 | 1.2 / 1.2 / 1.5 / 2.6 |

| Our observed family | Count | SE ER |
|---|---:|---|
| singles | 1493 | 1.2 / 1.2 / 2 / 2.3 |
| chains | 1089 | 4.5 / 6.7 / 7.2 / 7.4 |
| subsets | 997 | 2 / 2.6 / 3.4 / 4.2 |
| wings | 152 | 3.2 / 4.2 / 4.2 / 4.4 |
| locked-candidates | 1570 | 1.7 / 2.6 / 2.6 / 2.8 |
| dynamic-chains | 199 | 4.5 / 8.3 / 8.9 / 9.1 |

Spearman correlation (average ranks for ties): search nodes versus SE ER **0.486351**;
our ordered families versus SE ER **0.909651** across **5500** explained/rated boards.

Correlation is not rating agreement or a validated mapping to human difficulty.
Families are broad and overlap. Unresolved boards are excluded from family correlation,
never assigned a maximum rank. Timing is discarded from SE rows before comparison.

No puzzle positions, labels, daily references or scores were changed.

## Provenance

SE JAR SHA-256: `04d4bf4367136570644b434137a203a1006ffce076106d6405d7f93ca8874621`

Our report SHA-256: `8cd6c6f2f13dc3a1573ff258ef2e8dd955d8c1ced9a7a189134d167bac997c83`

Normalized SE data SHA-256: `69cc7e64565d11b9ad5f1b332c4d3b7383a54e65315a25dde35ccc52a8531aef`

Command format: `%g %r %p %d %e`, classic 9×9, default techniques, no saved-technique override.
[Official SE release used](https://github.com/1to9only/SudokuExplainer/releases/tag/2024.1.18).

## Interpretation and recommendation

The preserved v2 assessment explained 5,301 boards; its family correlation with
SE ER was **0.898794** on those boards. V3 explains all 5,500 and reaches
**0.909651**. These are rank correlations, not percentages of exact agreement.
All 199 ER/EP/ED triples from the earlier subset run matched their full-bank run.

The existing Evil median is **SE 7.1**, while Nightmare's is **SE 2.6**. The hardest
Expert in this comparison reaches **9.1**, above the maximum **9.0** in Nightmare.
That confirms that clue count and search effort do not produce a strictly ordered
human difficulty ladder. Nightmare 3000 remains the highest *search-node* board,
not a verified hardest-human puzzle.

Our v3 dynamic family spans **SE 4.5–9.1**. Expert 445 is an important disagreement:
SE's inspected path uses a uniqueness rectangle, whereas ours currently uses
longer dynamic reasoning. Add simpler named explanations and review sample boards
before using family boundaries to reorganize levels. Preserve every board and
keep the old reports; do not turn this comparison into an automatic migration.

## Repeat the comparison for an updated bank

First run the maintenance assessment into new files:

```bash
node scripts/assess-deep.js --all --out=e2e-results/review/report.json --report=e2e-results/review/report.md
node --input-type=module <<'JS'
import fs from 'node:fs';
const report = JSON.parse(fs.readFileSync('e2e-results/review/report.json'));
fs.writeFileSync('e2e-results/review/input.81', report.records.map(r => r.puzzle).join('\n') + '\n', { flag: 'wx' });
JS
```

Download and verify the separately supplied official JAR. Run it from a separate
directory, since SE writes settings there. Substitute absolute input/output paths:

```bash
java -Xmx512m -Djava.awt.headless=true -cp Sudoku9Explainer.jar diuf.sudoku.test.serate --input=/path/to/input.81 --output=/path/to/ratings.txt '--format=%g %r %p %d %e'
```

Then, from this project:

```bash
node scripts/compare-se.js --assessment=e2e-results/review/report.json --ratings=/path/to/ratings.txt --jar=/path/to/Sudoku9Explainer.jar --out=e2e-results/review/comparison.json --report=e2e-results/review/comparison.md
```

The join uses exact puzzle strings, rejects missing/duplicate records, records
executable/input hashes, and separates sentinel failures from valid ratings.
It does not invoke SE automatically or require it for gameplay. Use the same
release/options for comparable grades; changing engines or policies requires a
new comparison rather than silently relabelling old scores.
