# Full-bank comparison with Sudoku Explainer

Our policy: `human-v4.0`. SE rated **5500/5500**; failed/sentinel results: **0**.

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
| chains | 992 | 4.6 / 7.1 / 7.2 / 7.4 |
| subsets | 997 | 2 / 2.6 / 3.4 / 4.2 |
| wings | 152 | 3.2 / 4.2 / 4.2 / 4.4 |
| locked-candidates | 1570 | 1.7 / 2.6 / 2.6 / 2.8 |
| uniqueness | 104 | 4.5 / 4.5 / 5.6 / 5.6 |
| dynamic-chains | 192 | 7.2 / 8.3 / 8.9 / 9.1 |

Spearman correlation (average ranks for ties): search nodes versus SE ER **not measured**;
our ordered families versus SE ER **0.910782** across **5500** explained/rated boards.

Correlation is not rating agreement or a validated mapping to human difficulty.
Families are broad and overlap. Unresolved boards are excluded from family correlation,
never assigned a maximum rank. Timing is discarded from SE rows before comparison.

No puzzle positions, labels, daily references or scores were changed.

## Provenance

SE JAR SHA-256: `04d4bf4367136570644b434137a203a1006ffce076106d6405d7f93ca8874621`

Our report SHA-256: `9c62008424fe7b346bd44fdf23324469e1612af342324f308d9d2b40544bc2c8`

Normalized SE data SHA-256: `69cc7e64565d11b9ad5f1b332c4d3b7383a54e65315a25dde35ccc52a8531aef`

Command format: `%g %r %p %d %e`, classic 9×9, default techniques, no saved-technique override.
[Official SE release used](https://github.com/1to9only/SudokuExplainer/releases/tag/2024.1.18).
