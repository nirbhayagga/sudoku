# Progression, practice and variants

These activities share the existing offline app. No analysis server, account or
new frontend runtime package is required. Classic 9×9 ratings and the bank order
remain unchanged from v1.2.

## Progression

Open **New game → Classic → Progression → Continue progression**. The path
starts at Easy 1 and follows the ordered bank through Nightmare. Completing a
puzzle records its content identity once. **Next progression puzzle** offers the
next unfinished challenge; no date or completion automatically replaces a board.
Daily, random games, imports and ordinary numbered games do not advance this path.
Replay any completed board using its difficulty and level.

Quick 6×6, Diagonal and Hyper have independent progression choices in **New game**.
Their ordinary completion totals also include numbered/random bank games; the
progression path counts only games explicitly started in progression. Older 4×4
progression saves remain resumable, while its normal entry is now a beginner
introduction under Learn.

The active game remembers whether it belongs to progression. Undo/recompletion
does not count twice. Complete backups include all paths, saved games and ordinary
completion totals. Older backups lacking a field leave that data alone. Handoff
links include the current game and activity, not the complete progression history.

## Technique practice

Choose **Learn → Technique lessons & practice**. The active game pauses while a
separate lesson opens. The collection still contains **56 positions across 14
techniques**, four per technique, reconstructed from verified deductions in our
own bank. Candidates are logical state, not personal notes or solution digits.

- **Learn:** read the rule and step through evidence, consequence and updated
  candidates on the same board. Previous step reverses the view.
- **Guided practice:** select the pattern's cells and digits, check its premises,
  then identify a consequence. Guidance reveals a region, evidence and a target
  progressively. A subset with extra candidates or cells outside one house gets
  a specific explanation of that failed premise.
- **Challenge:** find the deduction with no outlined evidence or preselected
  answer. Assistance remains available and is recorded separately.

Every recorded exclusion of the chosen pattern is accepted. Other deductions
are acknowledged only when the bounded technique detectors verify them; matching
the solution alone is never sufficient. These detectors do not enumerate every
possible alternative pattern, so unrecognized moves are not declared impossible.
Correct answers apply the deduction to the board; **Show before/after** compares
it without switching to a second diagram. **Play the full source puzzle** starts
from its original givens, before the deductions leading to the lesson position.

History records completed attempts by exercise identity. A correct challenge
without guidance or incorrect attempts counts as independent; guided/corrected
attempts count as assisted. **Review assisted exercises** offers another attempt.
Reading a worked example does not count as completing a challenge. “Practised”
is not a mastery percentage. Arrows move the selected cell without wrapping;
Home/End move to the first/last cell in its row; digits answer. In a
guided pattern, Space toggles a cell and digits toggle its proposed digits.

Only techniques with curated examples appear. Hidden quads and Jellyfish had no
selected examples under this curation path; chains and uniqueness lessons are
deferred until their teaching interface is ready.

Recreate the collection after adding bank puzzles:

```bash
node scripts/generate-practice.js --count=4 --out=e2e-results/practice.json
npx vitest run tests/practice.test.js
```

The curator refuses to overwrite a file. Review its output before replacing
`practice-bank.js`. Its source-bank hash, policy, puzzle and position make each
lesson repeatable. Runtime preparation checks that its technique still matches
and independently audits the deduction against the puzzle's unique solution.

## Diagonal and Hyper

Choose **New game → Diagonal** or **New game → Hyper**:

- **Diagonal:** ordinary rows, columns and boxes, plus both marked diagonals
  contain 1–9 once each.
- **Hyper:** ordinary rows, columns and boxes, plus the four shaded 3×3 regions
  contain 1–9 once each. Their top-left cells are r2c2, r2c6, r6c2 and r6c6.

Each rule starts with **24 curated puzzles** selected from 64 seeded candidates.
All are uniquely solvable and complete using the generic explanation engine's
singles, locked candidates and subsets. Curation retains clues needed for a
supported path; these are not claimed to be minimal or globally hardest puzzles.
Ratings and ordering apply within the rule. Generation runs in a cancellable
worker, preserving uniqueness and an explained path, with explicit work limits.

Extra houses are part of validation, solving, visible-board notes, hints, saves,
links and exports. Text exports carry a rules header; importing that header with
the wrong selected rule is rejected. A raw grid uses the currently selected rule.
PNG and printed sheets name and shade the extra regions. Links carry the rule;
they never fall back silently to Classic. Variant games do not use the classic
9×9 leaderboard or Daily pool. Each rule keeps its own saved game.

```bash
node scripts/generate-variants.js --attempts=64 --count=24 --out=e2e-results/variants.json
npx vitest run tests/variants.test.js
```

Review before updating `variant-bank.js`. Duplicate filtering covers digit
renaming and the eight square symmetries that preserve these rule layouts.
Classic within-band row permutations are deliberately excluded: they can change
the variant constraints. This is not a claim of exhaustive variant equivalence.

## What we take from other solvers

| Source | Used here | Kept separate or deferred |
|---|---|---|
| [SudokuExplainer review](sudoku-explainer-review.md) | Explicit proof premises, candidate maps, bounded explanation work; extra houses now have shared geometry | Exact SE grading remains an external comparison. More named patterns and nested chains require soundness tests and measured teaching benefit before changing the rating policy |
| [HoDoKu practice documentation](https://hodoku.dev/docs_cre) | Lessons begin at a position containing a chosen technique | A full desktop-style solver configuration menu and every advanced training pattern |
| [Tdoku](https://github.com/t-dillon/tdoku) | Reproducible hard-corpus and transformation benchmarks, separate correctness and runtime measurements | Native SIMD solver replacement, using search effort as a human grade, or copying benchmark puzzles into the playable bank |

The offline benchmark works on newly generated/imported classic puzzles too:

```bash
node scripts/benchmark-solver.js --out=e2e-results/solver-report.json --cross-check
node scripts/prepare-benchmarks.py --out=e2e-results/external-inputs --count=40
node scripts/benchmark-solver.js --input=e2e-results/external-inputs/puzzles.txt --limit=80 --out=e2e-results/hard-solver-report.json --cross-check
```

It checks each original, digit-reversed, transposed and row-permuted board. The
optimized solver is checked against expected transformed answers; `--cross-check`
also runs the independent generic solver with an explicit work budget. Exhaustion
is recorded separately, never treated as agreement or proof of unsolvability.
Hashes identify input and engine; timings are hardware-dependent diagnostics,
not deterministic human difficulty. Hard benchmark data stays in ignored research
outputs. No upstream source code or binaries are incorporated.

Keep the next additions focused: more verified lessons and shorter explanations
before new modes. Killer/Thermo and the 16×16 pilot need separate rule, input,
print, grading and corpus work; they are not part of this release.
