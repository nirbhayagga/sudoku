# Expanded human difficulty assessment — v3

**Assessment only. No bank positions, tiers, daily puzzles, scores or gameplay changed.**

Policy: `human-v3.0`. Coverage: **5500 puzzles** (all).

## Method

Each pass starts from the original givens. Candidate eliminations persist between
placements; placing a digit only prunes its peers. Singles are retried after every
deduction. Hypothetical chains carry explicit premises and proof parents; there is no answer fallback.

Technique order: `naked-single` → `hidden-single` → `pointing-pair` → `claiming-pair` → `naked-pair` → `hidden-pair` → `naked-triple` → `hidden-triple` → `naked-quad` → `hidden-quad` → `x-wing` → `xy-wing` → `xyz-wing` → `swordfish` → `jellyfish` → `forcing-chain` → `dynamic-forcing-chain` → `forcing-convergence`.

Independent passes permit singles, locked candidates, subsets, wings, static chains, then dynamic chains and on/off convergence.
The first successful pass supplies the observed family and workload. This establishes
what this implementation solved, not the mathematically minimum technique a person
must use. A different supported technique order can produce different work.

The complete solver validates uniqueness and audits every applied placement and
explicit candidate removal. Its answer is not used to choose deductions. A failed
audit aborts the assessment. Unresolved puzzles receive no difficulty family or rank.

## Results

The persistent engine finishes **5500/5500**, versus **4191/5500**
through the preserved persistent-candidate v1 assessment. **1309 additional finishes;
0 previously finished boards now unresolved.**

**0 unresolved boards remain unranked.** They are gaps in this assessment's
coverage, not proof that those boards belong above every solved board.

Work-budget exhaustion was reported for 0 boards; other unfinished paths stalled within the configured techniques/depth.

| Existing tier | Puzzles | V1 finished | Singles | Locked | Subsets | Wings | Chains | Dynamic | Unresolved |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| easy | 500 | 499 | 499 | 0 | 0 | 0 | 1 | 0 | 0 |
| medium | 500 | 482 | 462 | 7 | 4 | 9 | 18 | 0 | 0 |
| hard | 500 | 414 | 332 | 42 | 20 | 22 | 79 | 5 | 0 |
| expert | 500 | 321 | 200 | 62 | 40 | 20 | 151 | 27 | 0 |
| evil | 500 | 137 | 0 | 70 | 52 | 19 | 246 | 113 | 0 |
| nightmare | 3000 | 2338 | 0 | 1389 | 881 | 82 | 594 | 54 | 0 |

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
| dynamic-chains | 199 | 4 / 21 / 35 / 51 | 6 / 32 / 52 / 82 | 2 / 15 / 28 / 36 | 3 / 10 / 20 / 32 |

Across all attempted passes, **468858 placements** and
**158390 candidate removals** passed the independent answer audit.
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

### expert · Level 267

dynamic-chains: low observed workload

Observed result: **dynamic-chains**; 56 placements,
4 elimination steps, 6 candidate removals,
0 cells unresolved. Longest elimination run: 4.

```text
..581.9..
...43..27
.7.....1.
..4..2...
.5.94.8.3
7.....4..
812......
.....8.9.
....2....
```

### evil · Level 342

dynamic-chains: median observed workload

Observed result: **dynamic-chains**; 56 placements,
21 elimination steps, 26 candidate removals,
0 cells unresolved. Longest elimination run: 12.

```text
..682....
.........
..36917..
.1....3.7
..9....42
7....8.6.
.971.....
..5....29
2.....5..
```

### nightmare · Level 1430

dynamic-chains: high observed workload

Observed result: **dynamic-chains**; 64 placements,
51 elimination steps, 72 candidate removals,
0 cells unresolved. Longest elimination run: 21.

```text
........1
........2
..3..4...
.....5.6.
.1.....4.
72.......
....1.8.7
...92....
.36......
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

Source-set SHA-256: `ccb29ee6e52a1eb7d79689e79979d075285e09336a3047710163b5aae920ada2`

```bash
node scripts/assess-deep.js --all --out=e2e-results/deep-v3-rerun.json --report=e2e-results/deep-v3-rerun.md
```

The original production and persistent-candidate v1 assessments remain available,
with [the v1 report](puzzle-assessment-v1.md). This assessment does not replace it.

## Current use and limits

`human-v3.0` extends the preserved v2 core with dynamic candidate implications and
binary forcing convergence. Each new implication records every prerequisite;
proof replay checks those prerequisites independently of discovery. The complete
solver audits outcomes but supplies no deductions. All **837 dynamic proof steps**
in the additional 199 finishes passed those checks. Across all attempted passes,
468,858 placements and 158,390 explicit removals passed the answer audit.

The full JSON and Markdown outputs reproduced byte for byte under Node 22.22.2
and Node 24 in the verification container. Old v1/v2 results and commands remain
available. The source snapshot accompanying this run is retained with local QA
outputs; source hashes above identify the exact implementation.

The maintenance profile permits 2,000,000 primitive dynamic operations per step.
The browser uses the same rules with 100,000, plus cancellable workers and elapsed
job limits. Static chains retain their separate 150,000-edge/16-depth limits.
A future puzzle may still exceed those techniques or budgets; an unfinished run
gets no difficulty family. The 5,500-board result is not a completeness theorem
for the human engine. The separate complete solver still handles ordinary
solvability/uniqueness and explicit answer reveals.

The app's hints and imported-puzzle assessment use the interactive profile.
Generation retains `seeded-human-v1` with v2 targets so existing seeded requests
keep the same results. Offline candidate pools can be checked with this v3 CLI
without importing them into the live bank.

For a new/imported puzzle:

```bash
node scripts/assess-deep.js --puzzle-file=grid.txt --out=e2e-results/new-puzzle.json
node scripts/assess-deep.js --puzzle-file=grid.txt --trace
```

Trace output contains deductions and may reveal the answer through its placements.
Ordinary report records omit the solution and trace. Existing outputs are never
overwritten. The assessment accepts the app's text formats and distinguishes
invalid, impossible, ambiguous, complete, explained and incomplete puzzles.

Read the [full-bank SE comparison](full-bank-se-comparison.md) and
[adoption recommendations](sudoku-adoption-roadmap.md) before choosing tier boundaries.
Finishing a puzzle with dynamic chains does not prove a simpler technique is unavailable.
