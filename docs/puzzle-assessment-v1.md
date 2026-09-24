# Persistent-candidate difficulty assessment — v1

**Assessment only. No bank positions, tiers, daily puzzles, scores or gameplay changed.**

Policy: `persistent-candidates-v1`. Coverage: **5500 puzzles** (all).

## Method

Each pass starts from the original givens. Candidate eliminations persist between
placements; placing a digit only prunes its peers. Singles are retried after every
deduction. There is no four-elimination hint limit, guessing, or answer fallback.

Technique order: `naked-single` → `hidden-single` → `pointing-pair` → `claiming-pair` → `naked-pair` → `hidden-pair` → `naked-triple` → `x-wing` → `xy-wing`.

Independent passes permit singles, then locked candidates, then subsets, then wings.
The first successful pass supplies the observed family and workload. This establishes
what this implementation solved, not the mathematically minimum technique a person
must use. A different supported technique order can produce different work.

The complete solver validates uniqueness and audits every applied placement and
explicit candidate removal. Its answer is not used to choose deductions. A failed
audit aborts the assessment. Unresolved puzzles receive no difficulty family or rank.

## Results

The persistent engine finishes **4191/5500**, versus **2929/5500**
through the existing production hint assessment. **1262 additional finishes;
0 previously finished boards now unresolved.**

**1309 unresolved boards remain unranked.** They are gaps in this assessment's
coverage, not proof that those boards belong above every solved board.

| Existing tier | Puzzles | Production finished | Singles | Locked | Subsets | Wings | Unresolved |
|---|---:|---:|---:|---:|---:|---:|---:|
| easy | 500 | 499 | 499 | 0 | 0 | 0 | 1 |
| medium | 500 | 480 | 462 | 7 | 4 | 9 | 18 |
| hard | 500 | 400 | 332 | 42 | 20 | 20 | 86 |
| expert | 500 | 296 | 200 | 62 | 40 | 19 | 179 |
| evil | 500 | 84 | 0 | 70 | 52 | 15 | 363 |
| nightmare | 3000 | 1170 | 0 | 1389 | 869 | 80 | 662 |

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
| subsets | 985 | 1 / 9 / 14 / 22 | 3 / 25 / 41 / 67 | 4 / 20 / 28 / 39 | 1 / 6 / 10 / 17 |
| wings | 143 | 1 / 7 / 15 / 24 | 1 / 17 / 39 / 79 | 0 / 19 / 30 / 37 | 1 / 5 / 9 / 16 |

Across all attempted passes, **388206 placements** and
**119605 candidate removals** passed the independent answer audit.
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

### nightmare · Level 1728

subsets: median observed workload

Observed result: **subsets**; 64 placements,
9 elimination steps, 21 candidate removals,
0 cells unresolved. Longest elimination run: 7.

```text
.........
.....1..2
..3....45
.....216.
..5......
.78......
...58.9..
2........
3..7.....
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

### nightmare · Level 2467

wings: median observed workload

Observed result: **wings**; 64 placements,
7 elimination steps, 23 candidate removals,
0 cells unresolved. Longest elimination run: 3.

```text
........1
.......2.
..3..4...
........3
..5...1.6
.7..28...
...6..5..
28.......
9.......4
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

### nightmare · Level 1663

unresolved: fewest cells remaining (not a difficulty rank)

Observed result: **unresolved**; 53 placements,
13 elimination steps, 41 candidate removals,
11 cells unresolved. Longest elimination run: 6.

```text
.........
.....1..2
..3.4..5.
.......16
..473....
..5.....8
.......4.
.1.......
82...6...
```

### nightmare · Level 541

unresolved: median cells remaining

Observed result: **unresolved**; 25 placements,
13 elimination steps, 39 candidate removals,
39 cells unresolved. Longest elimination run: 10.

```text
.........
.......12
..3.45...
.........
.....36.5
17.......
...1.....
...78..6.
..52..4..
```

### nightmare · Level 2819

unresolved: most cells remaining (not a difficulty rank)

Observed result: **unresolved**; 0 placements,
1 elimination steps, 3 candidate removals,
64 cells unresolved. Longest elimination run: 1.

```text
........1
.......2.
..3..4..5
.....6...
.7..3.4..
21.....8.
....1....
...25....
..9...7..
```

### medium · Level 258

previous production assessment stalled

Observed result: **wings**; 49 placements,
6 elimination steps, 7 candidate removals,
0 cells unresolved. Longest elimination run: 6.

```text
.6......9
9.74....2
.8.92...7
8...5....
.5..49...
....7362.
.2679..1.
...61..74
7...84..6
```

### easy · Level 98

existing Easy label requires review

Observed result: **unresolved**; 18 placements,
2 elimination steps, 4 candidate removals,
25 cells unresolved. Longest elimination run: 2.

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

Source-set SHA-256: `e57619fc8f89fb704220cb0f8e71abc2f88e99fd40656dc170daf872969ccbcc`

```bash
node scripts/assess-difficulty.js --all --out=e2e-results/deep-v1-rerun.json --report=e2e-results/deep-v1-rerun.md
```

The original production assessment remains in `rating.js`, `scripts/rate-human.js`,
and [the earlier report](puzzle-rating.md). This assessment does not replace them.
