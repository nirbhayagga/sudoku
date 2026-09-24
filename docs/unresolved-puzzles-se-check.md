# Independent check of the 199 unresolved puzzles

**Historical v2 check.** The later [v3 core](puzzle-assessment-v3.md) now explains
all 199 itself. The [full-bank SE comparison](full-bank-se-comparison.md) covers all
5,500 puzzles; this earlier subset experiment is retained for provenance.

On 2026-09-24, Sudoku Explainer completed **all 199** puzzles left unresolved by
our `human-v2.1` assessment. Each resulting completed grid passed our independent
row/column/box validation, preserved its givens and matched our computer solver's
answer. The complete solver also reconfirmed unique solvability for every board.

Unresolved describes our explanation coverage. It does **not** mean unsolvable,
non-unique, or harder than every puzzle the explanation engine finishes.

## What was tested

- The full [v2 bank assessment](puzzle-assessment-v2.md): 5,301 solved and 199 unresolved.
- Official [Sudoku Explainer release 2024.1.18](https://github.com/1to9only/SudokuExplainer/releases/tag/2024.1.18),
  `Sudoku09x09Explainer/Sudoku9Explainer.jar` from `SudokuExplainers.zip`.
- JAR SHA-256: `04d4bf4367136570644b434137a203a1006ffce076106d6405d7f93ca8874621`.
- OpenJDK 25.0.3, classic 9×9 rules, default techniques, no variant flags or saved-technique override.
- `diuf.sudoku.test.serate` rated all 199; `diuf.sudoku.test.hints` produced their
  completed grids. No failed/zero/20.0 sentinel ratings occurred.

Their SE ratings ranged from **4.5 to 9.1**. These are SE's own ratings, not our
v2 family/workload scale. Rating only this subset is insufficient to reorder all
5,500 puzzles consistently. We have not changed the bank, daily mapping or score references.

## What the remaining options look like

Six complete SE paths were inspected in detail: the three lowest and three highest
SE ratings in this subset (puzzle text breaks ties deterministically).

| Existing puzzle | SE rating | Observed explanation methods beyond our basic rules |
|---|---:|---|
| Expert 445 | 4.5 | Unique Rectangle types 1 and 4 |
| Evil 152 | 7.1 | Unique Rectangle, BUG type 1 and forcing chains |
| Nightmare 521 | 7.2 | Forcing chains and single-digit chains |
| Evil 486 | 9.0 | Cell/region forcing chains and contradiction reasoning |
| Evil 291 | 9.0 | Cell/region forcing chains and contradiction reasoning |
| Expert 148 | 9.1 | Cell/region, double and contradiction forcing chains |

These are observed paths, not proofs of the easiest possible solving method.
Different rule ordering and retained exclusions can change the subsequent path.
We cannot attribute a coverage improvement to one added rule without implementing
it and rerunning the same assessment.

The next useful experiments are uniqueness-aware rectangles/BUG, richer static
chain consequences, then multiple and dynamic forcing. Uniqueness-dependent
rules must require a verified unique puzzle. Dynamic proofs need to record the
candidate changes supporting each new implication. Increasing our current chain
depth can also be measured, but cannot substitute for missing implication types.
Nested chains remain an option if those additions leave gaps.

The recommendation is to keep improving our shared explanation core in measured
stages, with proof replay and candidate soundness checks. SE is an independent
offline comparator; no Java code or binary is bundled into the app, and no
external service is needed for play, generation, import or hints.

## Reproduce with this bank or a future bank

First create a new v2 report (existing outputs are never overwritten):

```sh
node scripts/assess-v2.js --all --out=e2e-results/recheck/report.json --report=e2e-results/recheck/report.md
node --input-type=module <<'JS'
import fs from 'node:fs';
const report = JSON.parse(fs.readFileSync('e2e-results/recheck/report.json'));
const unresolved = report.records.filter(row => row.human.status !== 'solved');
fs.writeFileSync('e2e-results/recheck/unresolved.81',
  unresolved.map(row => row.puzzle).join('\n') + '\n', { flag: 'wx' });
JS
```

Download the linked official release separately, extract its 9×9 JAR, verify the
hash above and run these commands from that extracted directory. Replace the input
and output paths with your local assessment paths:

```sh
java -Xmx512m -Djava.awt.headless=true -cp Sudoku9Explainer.jar diuf.sudoku.test.serate --input=unresolved.81 --output=ratings.txt
java -Xmx512m -Djava.awt.headless=true -cp Sudoku9Explainer.jar diuf.sudoku.test.hints --input=unresolved.81 > hints.txt 2>&1
```

For a newly imported puzzle, our own repeatable assessment accepts the same text
formats as the app: `node scripts/assess-v2.js --puzzle-file=grid.txt`. Add `--trace`
only when you want the deductions revealed. The result distinguishes invalid,
impossible, ambiguous, complete, explained, unresolved and work-limit states.

## Computer solver scope

Our constraint-propagation/backtracking solver is complete for classic 9×9 Sudoku:
it explores remaining candidates when propagation stalls. Given sufficient
execution time, it can find a solution to a solvable classic board, reject an
impossible board, and count up to two solutions to test uniqueness. An ambiguous
board has multiple answers rather than one uniquely correct completion.

This is not a claim of optimal speed or a universal maximum runtime. No exhaustive
comparison against every specialized solver has been performed. Other sizes and
variant constraints are outside the current solver's contract. The 199-board
local recheck took about 0.17 ms median and 2.84 ms maximum per first solution;
those machine-specific observations are not browser performance guarantees.
