# Expanded human difficulty assessment — v2

> Historical assessment of the bank before revision 2. Level references below use that order.
> See [the current bank definitions](bank-revision-2.md); the original measurements are preserved.

**Assessment only. No bank positions, tiers, daily puzzles, scores or gameplay changed.**

Policy: `human-v2.1`. Coverage: **5500 puzzles** (all).

## Method

Each pass starts from the original givens. Candidate eliminations persist between
placements; placing a digit only prunes its peers. Singles are retried after every
deduction. There is no four-elimination hint limit, guessing, or answer fallback.

Technique order: `naked-single` → `hidden-single` → `pointing-pair` → `claiming-pair` → `naked-pair` → `hidden-pair` → `naked-triple` → `hidden-triple` → `naked-quad` → `hidden-quad` → `x-wing` → `xy-wing` → `xyz-wing` → `swordfish` → `jellyfish` → `forcing-chain`.

Independent passes permit singles, then locked candidates, then subsets, wings, and bounded static forcing chains.
The first successful pass supplies the observed family and workload. This establishes
what this implementation solved, not the mathematically minimum technique a person
must use. A different supported technique order can produce different work.

The complete solver validates uniqueness and audits every applied placement and
explicit candidate removal. Its answer is not used to choose deductions. A failed
audit aborts the assessment. Unresolved puzzles receive no difficulty family or rank.

## Results

The persistent engine finishes **5301/5500**, versus **4191/5500**
through the preserved persistent-candidate v1 assessment. **1110 additional finishes;
0 previously finished boards now unresolved.**

**199 unresolved boards remain unranked.** They are gaps in this assessment's
coverage, not proof that those boards belong above every solved board.

Work-budget exhaustion was reported for 0 boards; other unfinished paths stalled within the configured techniques/depth.

| Existing tier | Puzzles | V1 finished | Singles | Locked | Subsets | Wings | Chains | Unresolved |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| easy | 500 | 499 | 499 | 0 | 0 | 0 | 1 | 0 |
| medium | 500 | 482 | 462 | 7 | 4 | 9 | 18 | 0 |
| hard | 500 | 414 | 332 | 42 | 20 | 22 | 79 | 5 |
| expert | 500 | 321 | 200 | 62 | 40 | 20 | 151 | 27 |
| evil | 500 | 137 | 0 | 70 | 52 | 19 | 246 | 113 |
| nightmare | 3000 | 2338 | 0 | 1389 | 881 | 82 | 594 | 54 |

## Opening observations

**5,483 boards have an immediate single.** Of the other 17, the shared engine's
first-placement path uses locked candidates on 4, subsets on 11 and chains on 2.
All 17 reach a placement. These are observed paths, not proofs of the least
possible opening technique. An easy first step does not mean the whole puzzle is easy.

The singles-only pass records how many cells can be placed before needing any
other family (or completing the board). Counts are **min / upper median / max**:

| Existing tier | Singles before the first bottleneck or completion |
|---|---|
| easy | 18 / 43 / 43 |
| medium | 8 / 49 / 49 |
| hard | 2 / 54 / 54 |
| expert | 1 / 24 / 58 |
| evil | 0 / 9 / 35 |
| nightmare | 0 / 11 / 37 |

This separates an approachable opening from later difficulty without inventing a
numeric tier. Reproduce these observations from the saved JSON and the same core:

```js
import fs from 'node:fs';
import { runReasoning } from './reasoning.js';
const { records } = JSON.parse(fs.readFileSync('e2e-results/human-v2-chains/report.json'));
const openings = records.map(row => ({
  difficulty: row.difficulty, level: row.level,
  singles: row.human.passes[0].workload.placements,
  first: row.human.passes[0].workload.placements > 0 ? 'singles'
    : runReasoning(row.puzzle, { stopAfterPlacement: true }).highestFamilyUsed,
}));
console.log(openings);
```

The single-board API works identically for newly generated/imported puzzles.
The report stores the entire singles-only pass; its placement count supplies the
opening workload above. A failure to find an opening must be reported separately,
not assigned a difficulty family.

## Workload within observed families

Each distribution is **min / upper median / nearest-rank P90 / max**. Counts below
describe the successful pass only; lower-family trial passes are reported separately
in JSON. Placement count mostly reflects empty cells, so it is not a difficulty score.
Elimination steps count useful patterns applied; candidate removals count distinct
cell/digit exclusions. Peer pruning after placements is recorded separately.

| Family | Boards | Elimination steps | Candidate removals | Hidden singles | Longest elimination run |
|---|---:|---|---|---|---|
| singles | 1493 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 16 / 29 | 0 / 0 / 0 / 0 |
| locked-candidates | 1570 | 1 / 4 / 8 / 15 | 1 / 10 / 20 / 39 | 1 / 23 / 31 / 42 | 1 / 3 / 6 / 12 |
| subsets | 997 | 1 / 9 / 14 / 22 | 3 / 25 / 41 / 67 | 4 / 20 / 28 / 39 | 1 / 6 / 10 / 17 |
| wings | 152 | 1 / 8 / 15 / 24 | 1 / 17 / 39 / 79 | 0 / 19 / 30 / 37 | 1 / 5 / 9 / 16 |
| chains | 1089 | 0 / 12 / 21 / 43 | 0 / 24 / 43 / 80 | 2 / 21 / 32 / 44 | 0 / 6 / 11 / 30 |

Across all attempted passes, **457251 placements** and
**151613 candidate removals** passed the independent answer audit.
This checks the evaluated boards, not every possible Sudoku.

## Representative review pack

The cases below are selected deterministically. Within each solved family, review
selection uses elimination steps, candidate removals, hidden singles, then placements;
a puzzle hash breaks ties. This is a workload sampling key, not a proposed level order.
Unresolved examples sample remaining-cell counts without assigning a hardness rank.

**Player review is still pending.** Before choosing tier boundaries, play or inspect
these boards and record: hardest deduction noticed, scanning/repetition burden, whether
a simpler route exists, and whether examples in the same family feel comparable.
Machine-verified deductions cannot substitute for that judgement.

Paste a board into Import → Play puzzle. The review pack contains no solutions.
For an opt-in deduction trace, run the single-puzzle CLI with `--trace`.

### easy · Level 234

singles: low observed workload

Observed result: **singles**; 43 placements,
0 elimination steps, 0 candidate removals,
0 cells unresolved. Longest elimination run: 0.

```text
.28.6....
1.7389...
.537....1
.792..46.
3.6...12.
.4....359
..5..68..
...83.51.
.34..1796
```

### hard · Level 452

singles: median observed workload

Observed result: **singles**; 54 placements,
0 elimination steps, 0 candidate removals,
0 cells unresolved. Longest elimination run: 0.

```text
36.85....
....21.6.
..23.4...
29....8..
.71.4.5.6
..6...1..
....3...5
..8..9.2.
..4.....7
```

### expert · Level 147

singles: high observed workload

Observed result: **singles**; 55 placements,
0 elimination steps, 0 candidate removals,
0 cells unresolved. Longest elimination run: 0.

```text
........2
...3.9...
..5.6.97.
.1....69.
26.7....5
4.9...7..
9..53....
..49...6.
.5..2.4..
```

### hard · Level 422

locked-candidates: low observed workload

Observed result: **locked-candidates**; 54 placements,
1 elimination steps, 1 candidate removals,
0 cells unresolved. Longest elimination run: 1.

```text
39..15..2
5........
.8.4..3..
2......64
41.3.....
..7..95..
.78.2...5
.....89..
.2....78.
```

### nightmare · Level 143

locked-candidates: median observed workload

Observed result: **locked-candidates**; 64 placements,
4 elimination steps, 11 candidate removals,
0 cells unresolved. Longest elimination run: 3.

```text
........1
.......2.
..3..4...
.....5...
..6...3.7
.7.12....
...6.38..
.8....4..
1........
```

### nightmare · Level 2230

locked-candidates: high observed workload

Observed result: **locked-candidates**; 64 placements,
15 elimination steps, 39 candidate removals,
0 cells unresolved. Longest elimination run: 6.

```text
.........
.......12
..3.45...
......4..
...6....1
..78.....
....7.5..
.6.....9.
81.2.....
```

### hard · Level 497

subsets: low observed workload

Observed result: **subsets**; 54 placements,
1 elimination steps, 3 candidate removals,
0 cells unresolved. Longest elimination run: 1.

```text
..532..9.
...5....8
..2....51
5......3.
9..6.7.4.
...45....
...89....
.4...5..7
2.3..691.
```

### nightmare · Level 2835

subsets: median observed workload

Observed result: **subsets**; 64 placements,
9 elimination steps, 21 candidate removals,
0 cells unresolved. Longest elimination run: 6.

```text
.........
.......12
..3.45...
......4.3
.6.......
71...8...
...9.....
..5.3....
.8.2...7.
```

### nightmare · Level 2929

subsets: high observed workload

Observed result: **subsets**; 64 placements,
22 elimination steps, 63 candidate removals,
0 cells unresolved. Longest elimination run: 9.

```text
........1
.......23
..4.56...
.......1.
.5.....7.
.68.4....
......5..
1..3.....
9..2.....
```

### evil · Level 80

wings: low observed workload

Observed result: **wings**; 57 placements,
1 elimination steps, 1 candidate removals,
0 cells unresolved. Longest elimination run: 1.

```text
....58.7.
5.134....
...2.15..
...53..1.
.....2.98
..4......
.2....3..
....97.5.
4.......9
```

### nightmare · Level 1083

wings: median observed workload

Observed result: **wings**; 64 placements,
8 elimination steps, 11 candidate removals,
0 cells unresolved. Longest elimination run: 6.

```text
.........
.......12
..3..4..5
.....26.3
.7.......
18.......
....1.78.
...3.9...
..4......
```

### nightmare · Level 2721

wings: high observed workload

Observed result: **wings**; 64 placements,
24 elimination steps, 79 candidate removals,
0 cells unresolved. Longest elimination run: 13.

```text
.........
.......12
..3.45...
......6.7
..4......
.7.1.....
...8..3..
..6...45.
.9.2.....
```

### medium · Level 294

chains: low observed workload

Observed result: **chains**; 49 placements,
0 elimination steps, 0 candidate removals,
0 cells unresolved. Longest elimination run: 0.

```text
...31....
7.3.8....
61..9.8..
8.25.....
....416.8
13..689..
.7.95..1.
5.1.....7
.....4589
```

### evil · Level 396

chains: median observed workload

Observed result: **chains**; 57 placements,
12 elimination steps, 19 candidate removals,
0 cells unresolved. Longest elimination run: 5.

```text
....42.3.
.97......
...58....
..4..8...
.5.3..16.
9..1...78
1..9....6
....2.5..
3......1.
```

### nightmare · Level 2912

chains: high observed workload

Observed result: **chains**; 64 placements,
43 elimination steps, 77 candidate removals,
0 cells unresolved. Longest elimination run: 20.

```text
........1
........2
..3..4...
.....345.
.1.......
6....78..
....5.3..
.9.26....
2........
```

### nightmare · Level 2527

unresolved: fewest cells remaining (not a difficulty rank)

Observed result: **unresolved**; 39 placements,
6 elimination steps, 13 candidate removals,
25 cells unresolved. Longest elimination run: 3.

```text
.........
.....1..2
.34....5.
.......3.
1....2...
6.....74.
....5....
...43...8
2.7......
```

### expert · Level 228

unresolved: median cells remaining

Observed result: **unresolved**; 12 placements,
10 elimination steps, 22 candidate removals,
45 cells unresolved. Longest elimination run: 7.

```text
..6.1...4
..2..478.
.5....2..
1......26
.7..6.8..
..8....5.
86...3...
.9..78...
...4.....
```

### nightmare · Level 2556

unresolved: most cells remaining (not a difficulty rank)

Observed result: **unresolved**; 2 placements,
23 elimination steps, 51 candidate removals,
62 cells unresolved. Longest elimination run: 12.

```text
.........
.....1..2
.34....5.
.......6.
....72...
..5...43.
...3.....
..64.....
7...1...8
```

### easy · Level 98

persistent-candidate v1 assessment stalled

Observed result: **chains**; 43 placements,
2 elimination steps, 4 candidate removals,
0 cells unresolved. Longest elimination run: 2.

```text
.2.6..34.
1..7.4.56
.4..3..1.
..6.5.4.3
354.6....
27.14....
...31..7.
.312.569.
7.24.6.3.
```

### nightmare · Level 3000

highest search-node board: compare algorithmic search with human deductions

Observed result: **subsets**; 64 placements,
9 elimination steps, 24 candidate removals,
0 cells unresolved. Longest elimination run: 5.

```text
........1
.....2..3
..4.5....
....6..5.
.3......7
.8.1.....
...3..28.
..6......
1....7...
```

## Reproduction and provenance

Run the same selection and policy against unchanged source/input hashes to reproduce
the JSON byte for byte. Outputs contain no timestamps, local paths or timing measurements.
The CLI refuses to overwrite existing output files. Keep a new output path for reruns.

Input SHA-256: `2c7e4efa0cbd2bfa846405ae9b27072e5bd35e823052527c7ba7794da97dc130`

Source-set SHA-256: `a30ffceddd107689cb0ab309cae15928fdc728a2d4cfb35ea144a6c29e146bef`

```bash
node scripts/assess-v2.js --all --out=e2e-results/deep-v2-rerun.json --report=e2e-results/deep-v2-rerun.md
```

The original production and persistent-candidate v1 assessments remain available,
with [the v1 report](puzzle-assessment-v1.md). This assessment does not replace it.

## Independent check of the unresolved set

The released Sudoku Explainer 9×9 engine completed all 199 unresolved boards.
See [the reproducible comparison](unresolved-puzzles-se-check.md). This does not
assign those boards a v2 family or change any existing bank level.
