# Repeatable difficulty assessment

> Historical assessment of the bank before revision 2. Level references below use that order.
> See [the current bank definitions](bank-revision-2.md); the original measurements are preserved.

**Preserved v1 assessment guide.** The current browser and generation paths now
use the [shared v2 engine](puzzle-assessment-v2.md). The maintenance CLI is repaired.
The v1 measurements and reproduction commands below remain unchanged as historical
evidence; see the [SE check](unresolved-puzzles-se-check.md) for the completed external comparison.


Two assessments are retained. They answer different questions:

| Assessment | Purpose | Candidate handling | Existing report |
|---|---|---|---|
| Production hint assessment | What explanations can the current player/importer supply? | Recomputed after each placement; four eliminations per hint | [Original report](puzzle-rating.md) |
| `persistent-candidates-v1` | What can a longer, stateful deduction path establish about this board? | Retained within a pass; no hint-length budget | [New full-bank report and review pack](puzzle-assessment-v1.md) |

`rating.js` and `scripts/rate-human.js` remain unchanged. The new assessment is
`human-rating.js`, run through `scripts/assess-difficulty.js`. It is an offline
tool; it does not change browser hints, auto-notes, import labels, level order,
daily mappings, saved games or leaderboard references. It adds no browser download.

## The four assessment requirements

1. **Retain deductions.** Each pass initializes visible candidates once. Explicit
   eliminations persist after placements; a placement only removes that digit from
   peers. Every useful deduction restarts the search at singles. A monotonic
   progress bound prevents loops without imposing a short explanation budget.
2. **Measure techniques and work.** Independent passes start from the original
   givens, permitting singles; then pointing/claiming; then pairs/triples; then
   X-Wing/XY-Wing. The first successful pass supplies its observed family and
   counts of placements, useful elimination patterns, candidate removals, hidden
   singles, and consecutive eliminations. Failed lower-family passes remain in
   the JSON. Counts are unweighted observations, not a universal difficulty score.
3. **Leave unsupported boards unresolved.** An unresolved puzzle has `family: null`.
   Its partial deductions are recorded, but it is not assigned a hardest tier.
   Invalid, impossible, ambiguous and already-complete inputs have distinct statuses.
   Uniqueness and every applied deduction are checked against the complete solver;
   the answer never selects a deduction or fills a stalled cell. An unsound step
   aborts the assessment rather than becoming a rating.
4. **Review concrete examples before boundaries.** The report selects low, median
   and high observed workloads within each solved family, a sample of unresolved
   positions, and notable disagreements with older labels/assessments. It includes
   the boards for player review. Record the hardest deduction you noticed, the
   amount of scanning/repetition, simpler alternative routes, and comparisons
   within a family before choosing Easy–Nightmare boundaries.

The observed family is the lowest successful cap **under this deterministic
strategy**. It does not prove that every simpler strategy would fail. Scan order,
digit labels, and the implemented technique repertoire can affect results. The
workload sampling key is used to select review examples, not to reorder levels.

## Reusable for future puzzles

The requirement includes newly generated, newly added and player-imported grids,
not just reproducing a report for the current bank. A saved report is evidence;
it is not a lookup table that supplies difficulty for known boards only.

Current implementation and remaining integration work:

| Entry point | Current behavior | Required next step |
|---|---|---|
| `assessHumanPuzzle(board)` | Accepts arbitrary canonical 81-cell grids; validates uniqueness and assesses supported deductions without consulting bank membership | Expand technique coverage and calibrate a versioned difficulty estimate |
| Single-puzzle CLI | Accepts `--puzzle` and `--puzzle-file` through the shared text parser | Keep this path equivalent to the eventual browser assessment |
| Full-bank report | Reads the bank at run time, so newly added entries are included | Use the same core and rating policy for candidate batches before adding them |
| Browser Import | Uses the earlier `rating.js` assessment, not the deeper engine | Integrate the shared engine with bounded work and cancellation off the UI thread |
| Generation/catalogue maintenance | Selection still uses search-node counts; the legacy maintenance script's VM loader currently fails on ES-module source | Repair and verify the maintenance CLI, then assess generated/catalogue candidates through the shared core |

The recommended architecture is a project-owned JavaScript assessment core used
by the bank tools and browser importer. Once calibrated, fixed versioned rules
should map technique/workload observations to approximate tiers. Adding puzzles
must not change an existing puzzle's estimate merely because bank percentiles
changed. Cache results by normalized board and rating-policy version, and label
unsupported techniques or exhausted work budgets explicitly.

Verify it on new generated and imported boards, independent examples, and valid
grid transformations, as well as the current bank. Measure any scan-order effects
instead of claiming identical human ratings for equivalent layouts without testing.
Hints can share the deduction rules while presenting short explanations; rating
may continue through a longer deduction sequence. Auto-notes remain visible-board
bookkeeping. None of these integrations or new tier boundaries is completed by
the current report alone.

An external grader is optional development evidence for coverage and calibration.
The intended application and maintenance workflow should work using this project's
code without requiring Java, an external service, or an external tool per import.

The [SudokuExplainer source review](sudoku-explainer-review.md) compares the full
upstream tree with this project. It recommends persistent proof-bearing deductions,
larger subsets/fish and XYZ-Wing before bounded chain reasoning, followed by measured
coverage and calibrated ratings. It also records the maintenance CLI defect and
the separate scope of supporting board sizes beyond 9×9. These are proposed next
steps, not changes already included in the v1 assessment.

## Run and preserve results

Use the project's Node 24 environment. The CLI uses built-in Node modules and the
repository's own solver/techniques; it makes no network calls.

```bash
# Full assessment; choose unused output paths.
node scripts/assess-difficulty.js --all \
  --out=e2e-results/deep-v1-run1.json \
  --report=e2e-results/deep-v1-run1.md

# An independent repeat for byte comparisons.
node scripts/assess-difficulty.js --all \
  --out=e2e-results/deep-v1-run2.json \
  --report=e2e-results/deep-v1-run2.md
cmp e2e-results/deep-v1-run1.json e2e-results/deep-v1-run2.json
cmp e2e-results/deep-v1-run1.md e2e-results/deep-v1-run2.md

# Faster deterministic sample: evenly spaced, including tier endpoints.
node scripts/assess-difficulty.js --sample=100 --out=e2e-results/deep-v1-sample.json

# Any supported text export; the ordinary output omits the answer and trace.
node scripts/assess-difficulty.js --puzzle-file=export.txt
# Opt in to a deduction trace, which reveals placements.
node scripts/assess-difficulty.js --puzzle-file=export.txt --trace
```

Output files are created exclusively: an existing JSON or Markdown file is an
error, never overwritten. The original report and comparison tool remain available.
Keep full JSON snapshots outside the shipped app, for example under the ignored
`e2e-results/` directory. The public Markdown summary/review pack is small enough
to retain in documentation.

Each JSON output records the policy version, per-source SHA-256 digests, a combined
source digest, and a digest of the selected boards with their original identities
and positions. It contains no timestamp, absolute local path, random sampling or
runtime measurement. With the same source, input and options it reproduces byte
for byte. A source/input digest change means a new assessment snapshot even if the
headline counts happen to match. Change the policy version when changing technique
order, family caps or workload definitions; preserve earlier snapshots.

## What the current results mean

The new full-bank pass finishes **4,191/5,500**, compared with **2,929/5,500** through
the production assessment. All 1,262 additional finishes are audited deductions,
and no earlier finish is lost. There are still **1,309 unresolved puzzles**.

The solved families contain 1,493 singles, 1,570 locked-candidate, 985 subset, and
143 wing puzzles. Those counts are not six release tiers. Easy 98 remains unresolved;
Nightmare 3000 finishes with subsets, despite having the highest search-node count.
These are useful review cases, not reasons to force unresolved puzzles into Nightmare.

## Next assessment: the 1,309 unresolved boards

These boards have unique solutions; our current technique set stalls before
finishing them. They can receive an independent difficulty assessment without
putting an advanced grading engine in the browser.

1. **Optionally batch-grade the unresolved pool for an independent comparison.**
   [SudokuExplainer provides a batch-rating command](https://github.com/1to9only/SudokuExplainer).
   Save each result against the board's SHA-256, original tier and level, including
   failures or timeouts. Keep the external score separate from this report's
   observed families; do not splice two scales into one ranking.
2. **Identify the deductions our rater lacks.** Inspect representative solution
   paths using a broader solver such as HoDoKu. Its
   [solver configuration](https://hodoku.sourceforge.net/en/docs_solv.php)
   covers larger subsets, fish, coloring and chains. Technique order, enabled
   techniques and chain limits affect the result, so preserve the exact tool
   revision, executable checksum, configuration, command and input digest.
   Candidate additions include hidden triples/quads, larger fish, coloring,
   X/XY-chains and alternating inference chains; choose their order from measured
   coverage gains and reviewable explanations, not an assumption that any one
   technique will finish all 1,309.
3. **Extend the project-owned assessment in a new version.** Audit every added deduction,
   retain v1, and report coverage gains and disagreements. Record forcing-chain
   results distinctly from brute-force fallback. A timeout or fallback is a
   limitation of that run, not proof of a puzzle's absolute difficulty.
4. **Apply the same project-owned grading policy to all 5,500 before reordering.**
   Compare its results with this report and any external reference run, review disagreements and representative
   boards, then choose tier boundaries. Keep the strongest observed technique and
   deduction workload alongside any numeric score. A tool's total ordering remains
   an estimate of human difficulty, even when it produces a score for every board.

An external comparison has **not yet been run** and is not a prerequisite for
extending the local engine. It is an offline bank
assessment: it requires no player-data upload, Cloudflare request or runtime
dependency. Bank grading and readable in-game hints can advance separately.

To prepare an external batch from a saved full-bank JSON report, export one board
per line. The JSON retains each board's identity and hash for joining results back.
This also refuses to overwrite an earlier batch:

```bash
node --input-type=module <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
const report = JSON.parse(readFileSync('e2e-results/deep-v1-run1.json', 'utf8'));
const boards = report.records.filter(r => r.human.status === 'unresolved');
writeFileSync('e2e-results/unresolved-v1.txt',
  boards.map(r => r.puzzle.replaceAll('0', '.')).join('\n') + '\n', { flag: 'wx' });
console.log(`${boards.length} boards exported; no difficulty scores assigned.`);
NODE
```

**Keep all 5,500 puzzles and review the classification before adding volume.**
There are already many boards to work with, and a substantial unresolved pool to
investigate. After reviewing boundaries, add uniquely solvable puzzles to fill
specific technique or workload gaps—potentially more varied advanced examples—if
the existing bank lacks them. The 143 observed wing puzzles are a smaller group,
but that alone does not establish a shortage. Filling a hosting quota is not a
reason to expand the bank.

No new tier definitions, reclassification, progression mode, commit or release is
implied by running this tool. The report is evidence for that next decision.
