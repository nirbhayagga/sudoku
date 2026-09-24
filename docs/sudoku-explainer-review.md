# SudokuExplainer comparison and recommendations

Reviewed 2026-09-24 against upstream commit
[`b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e`](https://github.com/1to9only/SudokuExplainer/tree/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e).
This is an engineering assessment, not an implementation or a new difficulty scale.

Read this report with its detailed appendices:

- [Feature-by-feature comparison: existing, overlapping and proposed capabilities](sudoku-feature-comparison.md).
- [Board-size roadmap and the complete variant-list assessment](sudoku-variants-assessment.md).
- [Pinned upstream file inventory and inspection scope](sudoku-explainer-inventory.md).

## Recommendation

Build out this project's JavaScript reasoning engine. Share its deduction rules
between hints, imported-puzzle assessment and bank maintenance, with different
work budgets and presentation for each use. SudokuExplainer supplies useful
design examples and an optional independent comparison; players should not need
Java, a remote grader or a known-bank lookup to rate an imported puzzle.

The most valuable additions are persistent logical candidates with replayable
proofs, broader techniques, calibrated versioned ratings, and generation filtered
through the same rating policy. Preserve the current fast complete solver for
validation and explicit answer reveals. The requested sequence is to finish 9×9,
build challenging 4×4 and 6×6 collections, then consider a 16×16 collection ranging
from easy through its hardest curated examples. Difficulty must be assessed within
each size; a hardest-in-set label is not a claim of a globally hardest puzzle.

The initial review baseline was **4,191 solved / 1,309 unresolved out of 5,500**.
The v2 implementation and independent SudokuExplainer benchmark are recorded in
the follow-up below; the original measurements remain available.
Keep the [original assessment](puzzle-rating.md) and
[persistent-candidate assessment](puzzle-assessment-v1.md), and measure each extension.

## Implementation follow-up

The later **v3** profile completes all 5,500 boards, including the remaining 199,
using independently implemented dynamic chains and binary convergence. Its
techniques now support live hints and imported puzzles, with separate browser
and maintenance work limits. See the [v3 report](puzzle-assessment-v3.md),
[full-bank SE comparison](full-bank-se-comparison.md) and
[broader adoption review](sudoku-adoption-roadmap.md) for current results.

The initial review below records the pre-implementation baseline. The maintenance
CLI loader/writer has since been repaired and tested on disposable fixtures.
The shared v2 engine adds larger subsets/fish/XYZ-Wing and bounded static chains:
**5,301/5,500 solved, 199 unresolved**, with all old reports retained. Sudoku
Explainer completed all 199 in a separate local benchmark. See the
[v2 assessment](puzzle-assessment-v2.md) and [external check](unresolved-puzzles-se-check.md).
Browser integration and release verification are described in the current development guide.

## Scope and evidence

The checkout contains 166 tracked files: 101 Java files (22,848 lines), 57 HTML
templates, four GIF assets, two Markdown files, a license and a manifest.
The [file inventory](sudoku-explainer-inventory.md) records the whole tree.

The review examined the core representation, deduction producers, chains,
uniqueness rules, rating paths, generator, validation, import/export, settings,
CLI tools, and hint presentation. Algorithm and state-management paths received
detailed inspection; GUI plumbing and supporting wrappers received structural
and targeted inspection. Templates were examined for explanation structure;
binary assets were inventoried. This is not a formal proof of every algorithm,
an executed Java test run, or an audit of every separately generated release binary.

The source reviewed is the 9×9 reference. Its release documents other sizes built
by separate generation scripts that are absent from this checkout. The
[build instructions](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/BUILDME.md)
also require additional FlatLaf and JSON source directories from another project.
No upstream Java was copied into this repository or executed for this review.

## What to adopt, keep or defer

| Area | Upstream design | Decision for this project |
|---|---|---|
| Candidate state | Retains useful eliminations between deductions | Integrate persistent logical state; keep it distinct from player notes |
| Hint evidence | Candidate removals, supporting regions, links and nested proofs | Extend our structured explanations and add a focused reasoning view |
| Technique coverage | Larger subsets/fish, XYZ-Wing, uniqueness and forcing chains | Add in measured, independently tested batches |
| Difficulty | Rule weights, chain complexity and opening difficulty | Use versioned, calibrated observations; do not copy its numeric scale blindly |
| Complete solving | Propagation plus most-constrained search | Keep our typed-array solver; benchmark before replacing working code |
| Generation | Symmetry plus human-technique difficulty filtering | Add those capabilities to a repaired, bounded maintenance pipeline |
| Import/export | Many symbol formats, candidates, solution paths and PNG | Keep strict text imports; consider PNG and proof export |
| Interface | Full hint browser, configurable techniques, automatic basic solving | Keep Play concise; put advanced controls in Solver/Learn views |
| Board sizes | Separate generated builds and variant options | 6×6/4×4 later; defer larger grids and extra-region variants |
| App infrastructure | Desktop Java application | Keep our PWA, optional leaderboard, themes and browser test coverage |

## 1. Candidate state and explanations are the foundation

Upstream separates rebuilding candidates from cancelling candidates after a
placement. Its cells retain eliminations, so a later deduction can depend on an
earlier one. Hints carry placements or removal maps, and indirect hints expose
candidate highlights, regions and links.
Sources: [candidate lifecycle](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/Solver.java#L181),
[cell updates](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/Cell.java#L106),
[indirect hints](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/IndirectHint.java).

Our [human-rating.js](../human-rating.js) already retains candidates during an
assessment. Browser hints still follow a different, short deduction path, and the
assessment trace currently records outcomes without retaining all the supporting
evidence returned by [techniques.js](../techniques.js). Sharing only technique
names is insufficient for a trustworthy explanation UI.

Define a common deduction record with technique, premises, affected candidates,
placement/removals, supporting cells/regions and any assumption. Make it replayable
against a specific candidate state. For chains, preserve parent implications so
the UI can explain why each conclusion follows.

Maintain three separate concepts:

- **Manual notes:** the player's marks, restored by undo.
- **Auto-notes:** legal digits from the visible board, including singles; no answer lookup.
- **Logical candidates:** deductions established by the reasoning engine, with their proof history.

An edit, erase, undo or imported position must restore compatible logical state or
recompute it. Never retain a proof after changing its premises. Applying a displayed
deduction should be one undoable action, including affected notes where appropriate.
Do not adopt upstream's coupling between editable pencil marks and the solver's
candidate truth: incomplete personal notes must not produce invalid deductions.

## 2. Expand techniques in stages

Current shared rules cover naked/hidden singles, pointing, claiming, naked pairs,
hidden pairs, naked triples, X-Wing and XY-Wing. Upstream's
[producer registration](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/Solver.java#L95)
and rule implementations show these useful extensions:

| Stage | Additions | Reason and constraints |
|---|---|---|
| A | Hidden triples, naked/hidden quads, Swordfish, Jellyfish, XYZ-Wing | Extend existing subset/fish/wing machinery; explainable without a general chain UI |
| B | Implication graph, then coloring, X/XY chains and alternating inference chains | Reusable foundation for more advanced deductions and explicit proofs |
| C | Unique rectangles/loops and BUG techniques | Require verified uniqueness; clearly identify the uniqueness assumption |
| D | Aligned exclusion, multiple/dynamic forcing and nested chains | Add only if measured coverage justifies implementation, explanation and runtime costs |

[HiddenSet](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/HiddenSet.java),
[NakedSet](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/NakedSet.java)
and [Fisherman](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/Fisherman.java)
parameterize pattern size. Use that idea to avoid separate near-identical detectors
for each subset or fish. Names for fish larger than Jellyfish exist in source,
but their registration is commented out; they are not evidence of enabled coverage.
[XYWing](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/XYWing.java)
also handles XYZ-Wing.

[UniqueLoops](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/UniqueLoops.java)
and [BivalueUniversalGrave](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/BivalueUniversalGrave.java)
need special care for imports: a syntactically valid board is not necessarily unique.
Our assessment already verifies uniqueness; any broader Solver integration must
retain that gate. Almost-locked-set techniques remain another possible future
direction, but are not a distinct standalone producer in this checkout.

Run each stage against all 5,500 boards and independent fixtures. Record newly
resolved puzzles, changed paths, workload and runtime before choosing the next stage.
No individual addition is guaranteed to resolve all 1,309 remaining puzzles.

## 3. Chains need proofs and work budgets

Upstream models a candidate being true or false, with parent implications and
optional nested reasoning. Chains find contradictions or consequences shared by
all alternatives. Dynamic chains update candidate state and attach the removals
that made later implications possible. Hints can be sorted by difficulty and
complexity and deduplicated by their conclusions.
Sources: [Potential](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/Potential.java),
[Chaining](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/Chaining.java),
[ChainingHint](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/ChainingHint.java).

Adopt the explicit implication/proof model in JavaScript. Among a bounded set of
valid deductions, prefer a short readable explanation, with deterministic tie
breaking. Keep answer checks as an audit; a correct final digit alone does not
prove that its explanation is valid.

Do not copy its one-thread-per-eligible-cell search strategy into the PWA. Use a
bounded worker, cancellation, work limits and stale-result checks after board
changes. Cache by board, candidates, rules and policy version; future geometry
must also be part of that key. A timeout should return a partial/unresolved result,
never a fabricated high difficulty. Unrestricted nested search on every import
keystroke would be a poor phone experience.

## 4. Ratings must work for unknown puzzles

Upstream distinguishes the hardest applied rule from opening difficulty and the
work required to reach a first placement. Its regular and batch rating paths use
different application strategies. Its generation filter can also stop early and
uses a narrower technique configuration than the full grader.
Sources: [rating paths](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/Solver.java#L474),
[serate CLI](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/test/serate.java),
[analysis summary](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/AnalysisInfo.java).

The numeric scale is an authored policy. For example, upstream ranks hidden
singles differently by region and below naked singles; it is not the same ordering
as our current engine. Copying its decimals would not validate our six tiers.

Our next rating version should report strongest observed technique, placements,
eliminations, sustained reasoning workload, opening difficulty, status and policy
version. Calibrate approximate tier boundaries with representative boards and
player review. Preserve the underlying observations beside the label.

Use the same pure core for an arbitrary import, a new generated puzzle, a candidate
catalogue and the existing bank. Fixed policy rules must not change a board's tier
just because more puzzles were added. Preserve old reports, and measure effects
of digit relabeling, row/column transformations and deterministic scan order.

An optional external comparison can reveal missing techniques or suspicious
disagreements. It does not define the application's runtime architecture. If run,
pin the executable, source revision, settings, standard/batch mode and inputs;
validate boards first. Upstream's failure sentinel of 20.0 is not a genuine hardest
rating. Record failures/timeouts separately. Do not merge two incompatible scales.

## 5. Keep the complete solver; repair generation tooling

Upstream's [BruteForceAnalysis](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/BruteForceAnalysis.java)
also combines singles, most-constrained branching and state copies. It can compare
solutions found in opposite search orders and warn about missing pencil marks.
This does not establish a speed advantage over our [solver.js](../solver.js).
Keep our 9-bit typed-array representation, propagation and `countSolutions(..., 2)`.
An optional two-solution comparison could help explain ambiguous Solver imports;
ambiguous puzzles must remain ineligible for ordinary imported Play.

Upstream's [generator](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/generator/Generator.java)
removes clue groups according to [symmetry](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/generator/Symmetry.java),
checks uniqueness and filters by human-technique difficulty. Those are useful
extensions. Its retry-until-match loop is not a model for bounded browser work.
Retain explicit attempt/work/time limits and a result that says whether the target
was met; add injectable seeded randomness for repeatable maintenance fixtures.

**Defect found during the initial review (now repaired):** [scripts/generate-bank.js](../scripts/generate-bank.js)
loaded ES modules through `vm.runInContext` as classic scripts. A read-only
probe failed at `export` in `solver.js`, before a bank write. It now uses normal
imports, with dry-run, argument-failure and disposable writer/import tests.
The bank itself remains unchanged pending the requested classification review.

The intended pipeline is: generate/import candidate boards → validate and deduplicate
→ assess using the shared versioned policy → inspect distribution and examples
→ write a reviewed bank update. Human workload should guide selection; search
nodes can remain a separate diagnostic. Preserve all 5,500 current puzzles during
assessment. Add puzzles later to fill demonstrated variety or difficulty gaps,
not to consume a hosting quota. No replacement bank is present in the reviewed tree.

## 6. Hint UI, exports and themes

Upstream offers small clues, larger clues, full explanations, alternate deductions
and a complete solution path. Its
[controller](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/SudokuExplainer.java)
filters repeated outcomes and snapshots candidate state for undo.

Keep our free explanation preview and explicit **Reveal (+1)**. Add optional
progressive detail: technique → supporting cells/candidates → full proof. Keep
wrong-entry correction explicitly answer-based. A technique selection panel and
alternative-hint browser belong in an advanced Solver/Learn view, not the normal
phone action row. Automatic application of basics is optional solver assistance,
not a change to auto-notes.

For chain diagrams, use existing theme tokens, text labels and line styles, with
keyboard and screen-reader equivalents. Upstream's
[HTML color substitutions](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/tools/HtmlLoader.java)
are not a replacement for the ten-theme contrast checks. Keep the current themes.

[SudokuIO](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/io/SudokuIO.java)
supports additional symbol and candidate representations, but some input paths
accept at least 81 cells and consume the first 81. Keep our exactly-81-cell parser
and existing text round-trip tests. Candidate-state imports would need their own
explicit format and validation; player notes are not proof of legal eliminations.

The strongest optional export addition is **PNG**, following upstream's
[grid image export](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/SudokuPanel.java#L691).
It gives a stable layout in messaging apps without relying on proportional text
or emoji rendering. Keep text for solver interoperability, links for playable
sharing, and the existing bulk print flow for paper/PDF. A structured proof/path
export can follow once our proof model exists; more cosmetic text formats are
lower priority.

## 7. Browser, offline tools and self-hosting the whole app

The lightweight solver is already a **complete search solver for classic 9×9**.
It is not limited to the techniques the hint engine can explain. Adding a larger
human-reasoning engine improves explanations, classification and generation
targets; it does not unlock the first ability to finish difficult classic boards.

Keep one codebase with explicit execution profiles:

| Profile | Purpose | Proposed delivery |
|---|---|---|
| Complete solver | Validate, check uniqueness, compute an answer | Existing small JS module |
| Interactive reasoning | Short hints and bounded imported-board assessment | Shared rule engine, cancellable worker; advanced code loaded when requested |
| Full maintenance analysis | Deep chains, batch ranking, generation and exhaustive small-board experiments | Node CLI modules in this repository, optional tool container |
| Whole-app self-hosting | Run the site on personal hardware, optionally with its leaderboard | Existing Docker/Podman deployment, same frontend and reasoning worker |

There is no need to split into separately maintained “lite” and “full” engines.
The same board, policy and deterministic work limits should give the same result
across interfaces. A longer offline budget can finish more analysis, but must
report which profile was used. Default public play can remain backend-free.

Self-hosting here means the entire application on your own hardware. The same
frontend capabilities work on static hosting and on Docker/Podman. No separate
analysis service is planned. Browser analysis still uses the visiting device;
maintenance CLI jobs run on whichever machine invokes Node. The leaderboard
remains a separate optional component of the whole-app deployment.

Our current service worker precaches all build outputs. Merely lazy-importing an
advanced chunk would therefore not remove its first-install download. Optional
packs need an explicit download/cache policy and clear offline availability.
Likewise, the standalone `file://` build needs a deliberate compatible worker
strategy; ordinary module-worker assumptions cannot silently break that target.
Measure bundle size, memory and phone responsiveness before setting browser limits.

## 8. A generator in the web UI

Recommend **Generate puzzle** within Solver tools, not another main tab yet.
Once it is reliable, a secondary link from new-puzzle setup can improve discovery.
At the initial review the generator library was a fallback; its broken maintenance loader and
search-based targets mean there is no finished user-facing generator to expose today.

The initial form should generate one puzzle, with a concise default and expandable
advanced controls:

| Control | Intended behavior |
|---|---|
| Size | 9×9 initially; show further sizes only after their implementation is verified |
| Difficulty | Target the reviewed human rating, with “Any” for clue-focused requests |
| Symmetry | None or a supported pattern such as 180° rotation |
| Clues | Automatic, exact count, or an inclusive range; validate against size and symmetry |
| Seed | Optional advanced reproducibility control once the generator supports it |
| Technique restrictions | Later advanced profile, once detection and generation targets agree |
| Generate / Cancel | Worker-based work with progress and an enforced budget |

Clue count and human difficulty are separate constraints. Some combinations are
infeasible or cannot be found within the budget. Report `targetMet` and the actual
clue count, assessed difficulty/status and symmetry. Offer retry/change targets,
or a clearly labelled closest valid result that the user can choose to accept.
Never silently substitute an easier result with the requested difficulty label.

Preview before **Play / Export / Print**. Keep an existing game intact until the
player chooses to replace it, using the existing replacement flow. Generated
boards should use custom/imported identities and stats, not borrow bank levels or
enter ranked bank scores by accident. Advanced output can record the seed, engine
version and deterministic attempt/work budget; a seed alone cannot reproduce a
wall-clock-limited search identically on different machines.

Bulk generation, rare target searches, exhaustive ranking and bank writes belong
in the offline tools. The web form should stay responsive and should not make an
expensive self-hosted service mandatory.

## 9. Board sizes and variants

Requested roadmap: finish 9×9, then build challenging collections for **4×4 with
2×2 boxes** and **6×6 with 2×3 boxes**. After that, consider **16×16 with 4×4 boxes**
across a measured difficulty range. Keep 25×25 deferred. The
[variant assessment](sudoku-variants-assessment.md) covers all names from the
requested list, grouped by shared rules, aliases and implementation needs.

The [4×4–25×25 release](https://github.com/1to9only/SudokuExplainer/releases/tag/2024.1.18)
uses separate generated builds. Its 5×5 and 7×7 modes omit boxes; the notes also
describe cramped larger GUIs, incomplete display testing and possible generator
limitations. The 9×9 source review does not validate those binaries.

Our required changes would include:

- Parameterized geometry, box dimensions, units, peers and technique detectors.
- Symbols and formats beyond decimal single digits; wider candidate storage for 25 values.
- Grid sizing, candidate layout, keyboard entry and a usable touch number pad.
- Versioned saves/share links, puzzle identity, import validation and print layouts.
- Size-aware stats, daily puzzles, leaderboards, tests and separate rating calibration.

For 25 symbols, the current `Uint16Array` candidate storage is insufficient;
`Uint32Array` can hold the required masks, but changing that alone does not make
the engine generic. Preserve current 9×9 links and separate size-specific scores.
Do not compare a 4×4 difficulty number directly with a 9×9 one.

## 10. Verification and implementation order

The upstream `test/` directory contains CLI validation/rating/trace programs,
not an automated soundness suite comparable to this project's current checks.
Static inspection does not establish that its algorithms are bug-free or faster.
Its [license](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/License.txt)
is LGPL 2.1; independent implementations of the techniques are the recommended
approach for this MIT project. Direct reuse of upstream source would need to
preserve its applicable license requirements.

Proposed implementation batches, subject to review of this assessment:

1. Repair the maintenance CLI and define the shared candidate/proof contract.
2. Add Stage A techniques with positive, negative and proof-replay fixtures.
3. Produce a new full-bank report, preserving v1; inspect coverage and rating disagreements.
4. Add bounded chain reasoning where the measured gaps justify it, then reassess.
5. Integrate the same core into browser imports and hint presentation using cancellable workers.
6. Calibrate and review six-tier boundaries; only then decide reordering and progression.
7. Expose bounded web generation with clue/symmetry controls; consider PNG/proof export.
8. Build and assess the requested challenging 4×4/6×6 collections, then evaluate 16×16.

Variant recommendations are Diagonal/Hyper first, then Killer/Thermo, after the
selected size work. These remain recommendations rather than authorization to
implement every listed variant. Offline maintenance modules remain part of the
project even when their full workload is unsuitable for the web UI.

Before a new rating policy is accepted, verify deduction soundness against valid
solutions, replay the stated premises, test transformations and previously unseen
boards, distinguish invalid/ambiguous/unresolved/budget-exhausted states, and measure
browser responsiveness. Repeat the complete bank assessment after each substantive
engine change. For UI integration, cover wrong entries, undo, stale worker results,
touch input, accessibility and all themes.

This review itself changes documentation only. It does not reorder puzzles,
integrate a new engine, resolve the maintenance defect, create commits, or release
a build. The previous 839-test check remains the last full code verification;
upstream Java performance and coverage remain unmeasured.
