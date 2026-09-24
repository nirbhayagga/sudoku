# Puzzle rating report — September 24, 2026

**Keep all 5,500 puzzles. Review a new rating policy before changing any level.**
The current tiers overlap, and the current hint engine is useful evidence about
deductions but is not yet a sufficient basis for six strict human-difficulty bands.
No bank positions, shared links, daily mappings, or score references changed.

## What was measured

Every board was played forward using production `nextStep()`, comparing the
expanded techniques to commit `08b2fbb`. Each hint permits up to four elimination
steps leading to a placement. Candidates are recomputed from the visible board
after each placement; deductions are not retained between hints. No search or
answer-based fallback finishes a stalled puzzle in this measurement.

The audit separately verifies returned placements and reported eliminations
against the solved board. It found no incorrect returned placements or reported
eliminations. This is evidence over the bank, not a mathematical proof covering
every possible board. The ordinary app still supplies a verified answer when its
supported deductions stall.

Reproduce from the repository root:

```bash
node scripts/rate-human.js --all --details --baseline-ref=08b2fbb > rating-report.json
```

## Supported deductions finish more puzzles

| Current tier | Boards | Previous engine | Expanded engine | Additional finishes |
|---|---:|---:|---:|---:|
| Easy | 500 | 499 | 499 | 0 |
| Medium | 500 | 472 | 480 | 8 |
| Hard | 500 | 382 | 400 | 18 |
| Expert | 500 | 275 | 296 | 21 |
| Evil | 500 | 72 | 84 | 12 |
| Nightmare | 3,000 | 1,106 | 1,170 | 64 |
| **Total** | **5,500** | **2,806** | **2,929** | **123** |

No previously finished board was lost. Added claiming pairs/triples, hidden pairs,
and XY-Wing improve explanation coverage without consulting the answer. The
existing technique sequence runs first, then the expanded sequence if needed,
so added eliminations cannot consume the short chain budget of an old success.

Single-run mean hint-call times were below 0.3 ms in every tier on this machine.
That is a local observation under concurrent load, not a phone performance claim.

## What the engine actually used

Counts below classify each completed solve by its highest technique family used.
They **do not prove the minimum technique required**: another deduction order may
solve the same board differently. A stalled board may yield to other techniques
or a solver that retains candidates across longer chains.

| Current tier | Singles only | Locked candidates | Subsets | Wings | Stalled |
|---|---:|---:|---:|---:|---:|
| Easy | 499 | 0 | 0 | 0 | 1 |
| Medium | 462 | 0 | 9 | 9 | 20 |
| Hard | 332 | 7 | 46 | 15 | 100 |
| Expert | 200 | 8 | 69 | 19 | 204 |
| Evil | 0 | 15 | 60 | 9 | 416 |
| Nightmare | 0 | 355 | 786 | 29 | 1,830 |

Locked candidates includes pointing and claiming. Subsets includes naked pairs,
hidden pairs, and naked triples. Wings includes X-Wing and XY-Wing.

The labels need care: 462 of 500 Medium boards use singles alone, while one Easy
board stalls. The expanded engine finishes 39% of Nightmare but only 16.8% of
Evil. Thus the existing names do not define a strict human-difficulty ladder.

## Search effort and clue counts

Search nodes measure this particular constraint-propagation/search algorithm.
They are deterministic here, but depend on search order and are not a human rating.
Median is the upper middle observation and P90 uses nearest rank.

| Tier | Clues min / median / max | Nodes min / median / P90 / max |
|---|---|---|
| Easy | 38 / 38 / 38 | 0 / 0 / 0 / 1 |
| Medium | 32 / 32 / 32 | 0 / 0 / 0 / 6 |
| Hard | 27 / 27 / 28 | 0 / 0 / 4 / 22 |
| Expert | 23 / 24 / 28 | 0 / 1 / 7 / 45 |
| Evil | 22 / 25 / 28 | 7 / 11 / 20 / 122 |
| Nightmare | 17 / 17 / 17 | 19 / 33 / 106 / 3262 |

**Nightmare 1 is below Hard 82 by search effort: 19 versus 22 nodes.** There are
412 Nightmare boards below 22 nodes, and 2,745 below Evil 500's 122 nodes.
Nightmare 3000 remains the highest search-node board in the app, at 3,262 nodes;
it is a sensible search-hard challenge, not a guarantee of the hardest human solve.
Evil and Nightmare are sorted by search nodes; Easy–Expert level numbers do not
currently express a progression. Seventeen clues is a puzzle property, not proof
of greater difficulty than a puzzle with more clues.

## Recommendation for a future reorder

1. Retain all 5,500 boards and the six familiar names for now. There is no measured
   performance reason to discard boards; the bank remains a separate lazy chunk.
2. Before assigning new tiers, build an offline rater that retains candidate
   eliminations across steps and has a documented technique order. Use technique
   family first, then deduction workload within each family. Report stalls
   explicitly; do not label every unsupported board the hardest automatically.
3. Inspect the resulting distributions and representative puzzles before choosing
   six tier boundaries. Do not force equally sized tiers or use clue count to fill
   them. Some nominal tiers may reasonably have very different populations.
4. If approved, reclassify once, publish the new definitions and level mappings,
   and deliberately handle existing scores, daily references, played lists, and
   saved games. Keeping the original puzzle in a saved game protects the board,
   but its old level label alone no longer identifies a newly reordered bank.

The generator, uniqueness validator, search-node rater, and maintenance scripts
remain in this repository (`generator.js`, `solver.js`, `scripts/generate-bank.js`).
The new comparison tool is `scripts/rate-human.js`. The external 17-clue source
catalogue remains intentionally untracked. Add puzzles when they fill a demonstrated
technique/difficulty gap; filling a hosting quota is not itself a quality target.

This report is the review point. Reclassification and the release remain pending.

## Assessing an imported puzzle

The comparison script is a repository tool. It also
accepts `--puzzle-file=export.txt` or `--puzzle=<81-digits-or-dots>` and uses the same
`rating.js` assessment shown in Import. That assessment reports uniqueness,
supported technique families, and search effort without printing the solution.
It does not assign one of the six bank tiers. The bank comparison above remains
repeatable separately with `--all --details --baseline-ref=08b2fbb`.

## Proposed progression mode

A separate, self-paced progression could start with easier puzzles and offer the
next board after each completion, remembering the furthest completion and the
current in-progress game. Earlier puzzles should remain replayable, with no
one-per-day restriction. The existing Daily would remain the shared calendar
challenge rather than becoming an individual difficulty schedule.

Choose the rating/order policy first: Easy–Expert are currently unordered, so
incrementing their level number is not a reliable difficulty ramp. Progression
should store puzzle identity as well as position so a future bank revision can
retain completed work. This is a proposal for after the rating review, not an
implemented game mode in the current changes.
