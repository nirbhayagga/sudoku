# Small classic boards

Choose **4×4** or **6×6** in the board-size selector. Returning to 9×9 restores its
view; an active 9×9 game is paused before switching. Each small size has its own
saved game and content-ID completion list. Small-board progress and scores are
separate from the 9×9 leaderboard.

4×4 uses 2-row × 2-column boxes. 6×6 uses 2-row × 3-column boxes. Digits run from
1 to the board size; zero or a dot means empty. These are classic Sudoku rules,
not additional constraint variants.

## The collections

- **4×4: 36 minimal puzzle classes.** The curator enumerated all 288 completed
  grids, reduced them to two solution symmetry classes, examined all clue subsets
  of their representatives, and retained one representative of each minimal unique
  puzzle class. A minimal puzzle loses uniqueness if any given is removed.
- **6×6: 120 challenges selected from 2,400 seeded generations.** The candidate
  pool contained 2,284 distinct, logically assessed puzzle classes. Selection keeps
  the highest observed technique/workload paths from this pool. This is a curated
  challenge collection, not proof of the hardest possible 6×6 puzzles.

Equivalence filtering includes digit renaming, band/stack permutations and rows or
columns within their bands/stacks. Square geometry also includes transpose.
Rectangular transpose changes the box orientation, so the 6×6 collection stays
within its chosen 2×3 geometry. Every retained board is uniquely solvable, minimal,
and finishes with the small-board explanation engine.

The `small-human-v1` policy orders by observed family (singles, locked candidates,
subsets), elimination steps, hidden singles, fewer givens, and puzzle text. Ratings
are local to a size. A difficult 4×4 is not claimed to match difficult 9×9 Sudoku.
Every entry has a content-derived identity; progress survives a change in display
order. No solutions are shipped in the bank.

The shipped 4×4 collection solves with naked singles alone. In 6×6, 114 puzzles
solve with singles and six use locked candidates in the recorded path. These
are short games and introductions to the rules, rather than advanced 9×9-level
challenges; minimality describes uniqueness, not human difficulty.

## Controls and interchange

**Game setup…** opens the challenge number, rules and progression controls.
They fold away during play, and completion reveals the next-challenge choices.
**Import, export and print** has separate Puzzle text, Print and Backup panels,
so opening one tool does not expose every form. The number pad and main play
actions remain directly available. P (or Space) pauses, F fills notes, N toggles
notes, A toggles auto-notes, and H previews/reveals; form fields keep normal keys.

Select a cell, then type a digit or use the on-screen keypad. Givens are bold;
entered digits use the theme's readable accent. Notes and live Auto-notes support
undo/redo; value entry prunes peer notes, which undo restores. Fill notes populates
candidates once. All candidates come from the visible board.

Hint first previews a deduction or clearly identified answer offer for free.
Reveal applies the value and increments the hint count. Pause hides the values
and blocks entry, notes, hints and undo. Completion identifies the puzzle; undo
remains available, and the first completion is recorded only once.

**Import, export and print** contains:

- Text import into Play, after uniqueness validation.
- Line, zero-line, rows and boxed-grid text exports; original/current sources.
- A PNG image and board links containing the full puzzle and box geometry.
- Current, consecutive or random worksheets, up to 24 puzzles with 1/2/4/6 per
  page and optional separate answer sheets. Choose a puzzle count or puzzle-page
  count; the summary includes additional answer pages. Use the browser's PDF printer.
- Generation and import checking in a cancellable worker, with the seed reported
  for generation. The browser stops work after 20 seconds.
- A game-backup download and size/rule-checked restore, including that board's
  progression path. Stats backups include all progression paths; small active
  games still use their own backups. Clearing site data removes local progress.

The Progression disclosure starts or resumes a dedicated path. Completing a
progression game records its identity once and enables an explicit Next action.
Ordinary games still count toward the collection's completion total, but do not
advance that path. See [activities](activities.md) for progression and variants.

## Maintenance

```bash
node scripts/generate-small-bank.js --out=e2e-results/new-small-bank.json
npx vitest run tests/small-boards.test.js
npx playwright test e2e/small-boards.spec.js
```

The generator refuses an existing output path. Review its JSON, then update
`small-bank.js` intentionally; no command silently changes the live bank. Test
coverage verifies uniqueness, minimality, all logical paths, equivalent-board
filtering, seed reproduction, formats, state boundaries and touch/browser flows.

`geometry.js` defines immutable houses, peers, digit domains and rectangular box
layout. The generic solver is independently cross-checked against the optimized
9×9 solver. Geometry includes a tested 16×16 foundation, but **16×16 play is not
released**: input, layout, collection quality and grading need their own pilot.
