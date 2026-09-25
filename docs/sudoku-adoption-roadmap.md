# Broader Sudoku engine and product review

Implementation follow-up: [v4 assessment](puzzle-assessment-v4.md) and
[v4 SE comparison](full-bank-se-comparison-v4.md) now cover uniqueness rectangles,
BUG+1, shorter-chain selection, bounded alternative paths, opening measurements,
candidate maps and external benchmark preparation. The original review below is
retained as a record of its baseline and remaining research candidates.


Reviewed September 24, 2026. This supplements the preserved
[SE source review](sudoku-explainer-review.md), [feature matrix](sudoku-feature-comparison.md)
and [complete variant-name checklist](sudoku-variants-assessment.md).
It records recommendations, not promises that every upstream feature is implemented here.

## Decision

Maintain one independently implemented JavaScript reasoning core with two work
profiles: a generous offline maintenance assessment and a cancellable browser
profile. Both accept arbitrary valid classic puzzles. Docker self-hosting runs
the same whole app as static hosting; it does not require a separate analysis service.
Optional external executables are development comparators, not runtime dependencies.

The new `human-v3.0` maintenance profile completes **all 5,500 bank puzzles**.
It adds dynamic candidate implications and binary forcing convergence to the
preserved v2 core. Every new proof has independently checked parent implications;
every placement/removal passes the complete solver's answer audit.
This establishes coverage of this bank, not full SE feature parity or coverage of
every possible Sudoku. See the [v3 results and reproduction commands](puzzle-assessment-v3.md).

**Do not reorder yet.** Full coverage fixes the 199-board gap, but a long proof can
obscure a simpler human deduction. Our observed families and SE ratings correlate
well while disagreeing on important examples. The [full-bank comparison](full-bank-se-comparison.md)
retains both measurements. Keep every existing board and old assessment for review.

## SE ideas: adopted, still useful, and deliberately separate

This checklist covers the rule registration, grading, generator, input/output,
warnings, proof model, GUI, settings and release variants. The source inventory
records the complete reviewed tree; new projects below received targeted review,
not an every-line security or correctness audit.

| Area | Current result here | Remaining adaptation and purpose |
|---|---|---|
| Singles, locked candidates, subsets and fish | Shared pure detectors; triples/quads, degree-2/3/4 fish | Distinguish direct placement patterns and scanning methods when they shorten an explanation |
| XY/XYZ wings | Implemented and audited | Add named W-Wing, coloring, Skyscraper/Two-string Kite/Empty Rectangle where they explain a chain more clearly; check other projects rather than attributing every name to SE |
| Static chains | Explicit implication paths with work/depth bounds | Deduplicate equivalent conclusions and prefer shorter readable proofs |
| Dynamic implications | Implemented; cell/house alternatives change inside an assumption | Current hypothetical propagation uses exclusions and singles; it does not run every subset/wing inside a branch |
| Multiple alternatives | Both truth values of one candidate can prove a shared consequence | SE also has cell/region multibranch forms; these may produce shorter paths than binary convergence |
| Unique rectangles/loops and BUG | Not implemented | Next useful named techniques: uniqueness is an explicit premise, independently verified for the actual puzzle rules |
| Aligned pair/triplet exclusion | Not implemented | Retain as an offline candidate; evaluate shorter explanations, runtime and new-corpus coverage |
| Nishio, dynamic-plus and nested rescue | Not separate implementations | Useful beyond this bank; record hypothetical depth/complexity, and never label generic search as a named human technique |
| Candidate-level proof views | Text steps, collapsible branches, supporting cells | Add candidate/link diagrams with accessible text and theme contrast; avoid making hundreds of implications the default view |
| Alternate deductions | First valid path, deterministic order | Bounded “another explanation”/shortest-path selection could improve teaching and reduce scan-order bias |
| Bad or ambiguous input | Invalid/no-solution/multiple/complete statuses | A two-solution difference view would help Solver users understand ambiguity |
| Persistent state | Logical candidates are separate from manual and automatic notes | Keep that separation; missing personal notes cannot be used as elimination premises |
| Generator | Seed, symmetry, clue requests, uniqueness, honest target misses | Later add technique-specific training targets, additional symmetries and batch generation; avoid silently accepting an easier target |
| Exports | Text, chat, PNG, print sheets, links, backups; CLI proof traces | Candidate-state and browser proof-path exports need a versioned format; not just another flat grid style |
| UI and distribution | Mobile PWA, standalone build, themes, daily, progress, optional scores | These are strengths to retain; a desktop solver's dense menus and Java runtime are not necessary for them |

Primary sources: SE's [registered producers](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/Solver.java),
[dynamic chaining](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/Chaining.java),
[proof representation](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/Potential.java),
[generator](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/generator/Generator.java)
and [GUI controller](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/SudokuExplainer.java).

## Rating: more than completing the puzzle

SE distinguishes overall ER, first-placement EP, and opening ED. Its chain scores
include complexity adjustments; direct singles and direct subset forms have
distinct values. A fixed table mapping a technique name to one decimal is not
an exact implementation of this grading procedure. Rule selection and application
order also affect the route taken. Sources: [rating CLI](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/test/serate.java),
[chain complexity](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/ChainingHint.java),
and [published rating table](https://github.com/SudokuMonster/SukakuExplainer/wiki/Difficulty-ratings-in-Sudoku-Explainer-v1.2.1).

| Measure | Our current implementation | Recommendation |
|---|---|---|
| Hardest observed family/technique | Recorded for the successful pass | Keep; describe it as an observed route, not proof that no easier route exists |
| Workload | Placements, elimination steps/removals, longest elimination run; dynamic work/proof size | Keep separate from family, so repetition and conceptual complexity are not collapsed |
| Opening | V2 report measures initial singles and first-placement family; SE comparison retains EP/ED for every bank board | Make these first-class per-puzzle fields in a later grading policy before fine calibration |
| Exact SE rating | Only an externally measured comparator | Preserve ER/EP/ED, executable hash, options and status; do not put an invented SE number on imported puzzles |
| New/imported puzzles | Shared evaluator, recorded profile/version, explicit work-limit result | Maintenance uses a larger budget; reaching a phone limit is not evidence of greater difficulty |
| Repeatability | Source/input hashes, deterministic operations, old CLIs/reports retained; Node 22/24 outputs agree | Include geometry/rules in provenance when adding sizes/variants |
| Human tier calibration | Existing search-based bank labels still in place | Review representative boards and disagreements; then choose documented boundaries |
| Transformation sensitivity | Earlier assessment includes robustness work | Repeat digit/row/column transformations for new policies and record ranges, not just a favored orientation |

Example: **Expert 445 receives SE 4.5**, but our v3 route uses dynamic chains.
SE's inspected path uses a uniqueness rectangle. Putting every dynamic-chain
board at the top would therefore still misclassify some puzzles. Named simpler
techniques remain worthwhile even after every board can be completed.

## What SE actually provides for 4×4, 6×6 and 16×16

The [size release](https://github.com/1to9only/SudokuExplainer/releases/tag/2024.1.18)
contains separate generated Java builds. The checked-in reference source is 9×9;
it is not a ready-made generic geometry module to drop into our app. The release
documents limits in generation and large-grid presentation.

| Target | Upstream capability checked | Our adaptation |
|---|---|---|
| 4×4 | Separate 2×2-box JAR; simple test rated successfully | Exhaustively review a small candidate pool and equivalence classes before choosing a compact challenge set |
| 6×6 | Separate JAR; both 2-row×3-column and 3-row×2-column examples rated successfully | Explicit box dimensions; choose one default orientation, serialize the geometry and keep ratings separate from 9×9 |
| 16×16 | Separate JAR; a 256-cell A–P-encoded test rated successfully | A geometry abstraction, symbol codec, 16-bit candidates, large-board input/print design and its own benchmark corpus |

These were **four simple constructed smoke cases**, not tests of hard large-board
grading, generation quality, every technique, or the Java GUI. For the 6×6 JAR,
the tested CLI switches are `-2` and `-3`; `-H2` is not accepted. Square-box builds
use their default geometry. CLI input above 9×9 uses A–Y values; a conversion
adapter is needed if our UI chooses 1–9/A–G for 16×16.

Do not copy source by replacing every `9` with another number. Introduce explicit
geometry, domains, complete houses, peers and symbol conversion. Candidate bit
masks remain practical through 16 values, but the current 512-entry lookup tables,
81-character validation, note layout, literal indexing, save/link schema, puzzle
IDs and score categories all need deliberate changes. A zero-as-value alphabet
must never conflict with today's zero-as-empty encoding.

The size roadmap remains **finish 9×9 → challenging 4×4/6×6 → 16×16 pilot**.
Ratings should be calibrated within each size; “hardest 4×4” is not a claim that it
is harder than a difficult 9×9. Adding more sizes is deferred to the agreed review.

## Other projects worth learning from

These are primary-project documentation/source reviews, not measured speed or
parity certifications. License labels describe the reviewed projects; none of
their implementations or binaries has been copied into this application.

| Project | Useful ideas | Fit and limitations |
|---|---|---|
| [SukakuExplainer](https://github.com/SudokuMonster/SukakuExplainer) — LGPL-2.1 | Candidate-grid input and established ER/EP/ED batch grading | Another optional comparator; a candidate puzzle needs a different input contract from ordinary notes |
| [HoDoKu / Hodoku2](https://hodoku.dev/docs_cre) — GPL-3.0 | Training by selected technique, configurable step/workload scores, batch creation | Strong model for a future practice mode. Configurable HoDoKu scores and SE grades remain separate |
| [hodoku-py](https://github.com/alexdej/hodoku-py) — project declares GPL-3.0 | Technique-isolation regression corpus and explicit parity tests | Useful testing approach and optional offline cross-check; advertised parity has not been independently verified here |
| [Tdoku](https://github.com/t-dillon/tdoku) | Optimized solver, multiple hard/easy corpora, permutation-aware benchmarks and targeted generation | Benchmark before replacing our already-fast classic solver. Native SIMD-oriented speed is not a browser speed guarantee or a human rating |
| [sudokuNxM](https://github.com/hkociemba/sudokuNxM) — GPL-3.0 | Explicit rectangular geometry, uniqueness, logical simplification followed by SAT | Especially relevant to 6×6/16×16 generation. SAT results need a separate explanation layer; no desktop runtime required in our PWA |
| [Interactive Sudoku Solver](https://github.com/sigh/Interactive-Sudoku-Solver) — MIT | Browser worker engine, many geometries/constraints, solution-space exploration | Best geometry/variant architecture reference found. It explicitly prioritizes raw solving over human technique grading |
| [Rangsk's SudokuSolver](https://github.com/dclamage/SudokuSolver) — GPL-3.0 | Variant constraints, f-puzzles integration, logical paths and true-candidate analysis | Good later variant/interoperability reference. True candidates are answer-based assistance and must not replace ordinary auto-notes |
| [QQWing](https://qqwing.com/instructions.html) — GPL-2.0-or-later | Portable generator CLI, symmetry, history/statistics, batch output | Useful generator UX and independent input pool; its difficulty categories are not an SE-equivalent advanced rating |
| [Sudoku Exchange bank](https://sudokuexchange.com/puzzle-bank/) | Offline generation plus grading, small runtime selections | Supports the proposed maintenance workflow. External puzzles need verified provenance, uniqueness and deduplication before import |
| [sudoku-core](https://github.com/kcirtapfromspace/sudoku-core) — MIT | Modular Rust/WASM core, constraints and proof-oriented tests | Interesting research lead. Its README's SE-style fixed scores and custom additions do not establish exact SE grading parity; unresolved→Extreme and requested-vs-achieved labels are not policies to copy |
| [sudoku.js](https://github.com/robatron/sudoku.js) — MIT | Small JS API and familiar puzzle strings | Heavy overlap with our existing complete solver; its clue-count difficulty model would be a regression for this task |

ISS's [engine architecture](https://github.com/sigh/Interactive-Sudoku-Solver/blob/a9609672cb1e5888edaa214ea0f3f9f4f0b1b623/js/solver/SOLVER_ENGINE.md)
is particularly relevant: geometry is distinct from mutable candidates; constraint
handlers declare affected cells; propagation runs in a worker. Borrow those
separations when implementing variants, while retaining independently explainable
deductions. Custom scripting and a full setter interface are separate products,
not prerequisites for a playable 6×6 board.

## The requested Sudoku Online Puzzles site

The [variant catalogue](https://sudoku-online-puzzles.com/blog/sudoku-variations-list/)
remains a discovery checklist. The existing [variant assessment](sudoku-variants-assessment.md)
groups aliases and flags rule ambiguities; it should remain the detailed record.
Some labels are presentation styles, and some describe different rule systems.
Its descriptions should not become our solver specification without a precise
publisher-defined rule and examples.

Its [generator](https://sudoku-online-puzzles.com/sudoku-generator/) exposes size,
sheet count, separate puzzle/answer layouts, paper and large-print choices.
Our printing already supports multiple grids and optional answers; separate
answer density, paper presets and an explicit large-print preset are useful later
refinements. The site's own description uses clue targets for ordinary generated
tiers and prepared banks for advanced ones. We should retain technique assessment
and honest target misses rather than copy clue count as difficulty.

The [trainer](https://sudoku-online-puzzles.com/sudoku-trainer/) is a useful product
direction: practice one named technique with feedback. Our current free hint
preview helps during ordinary play, but is not a dedicated lesson curriculum.
OCR/scanning, multiplayer and the site's many separate variant solvers remain
optional larger features; their existence is not a reason to crowd the current
play controls. A compact generator entry, progressive hint details and a future
practice area are a better fit for this app.

## Priorities recorded at the assessment review

This section preserves the assessment's original recommendations. The current
approved release scope is recorded in the release sequence below.

1. Improve simpler explanations and rating fidelity: uniqueness patterns with
   verified premises, direct-pattern labels, bounded alternate/shorter chains,
   and per-puzzle opening measurements. Keep explicit incomplete/work-limit states.
2. Reassess with fixed policy and representative external corpora; review tier
   boundaries before moving any levels. No rank is improved merely by filling a quota.
3. Add technique practice and print refinements if wanted, without exposing
   maintenance controls in ordinary play.
4. Implement the selected small sizes using shared geometry, then pilot 16×16.
5. After that, consider X/Hyper/Jigsaw, then Killer/Thermo and pair constraints.
   Follow the detailed variant checklist for rule semantics and serialization.

No extra puzzles are needed to close a performance or content gap today. A future
harder collection should add distinct reasoning challenges, not digit-swapped
duplicates or more 17-clue boards solely because they are sparse. Tdoku's harder
benchmark corpora are useful for testing beyond this bank before claiming a
full-strength human grader; benchmark data is not automatically publishable content.

## Release sequence

Keep the 9×9 rating revision separate from new sizes and variant rules. The
reviewed reclassification is in v1.1.0; subsequent work is divided as follows.

| Release stage | Contents | Gate |
|---|---|---|
| v1.1.0 | Verified 9×9 gameplay/import/export/generator improvements, shared proofs, maintenance tooling and bank revision 2 | Reviewed technique boundaries, all 5,500 boards retained, complete checks and explicit fresh bank progress |
| v1.2.0 | Curated 4×4 and 6×6 and targeted additional 9×9 puzzles | Shared geometry, uniqueness/equivalence checks, repeatable grading and touch tests |
| v1.3.0 | Self-paced progression, technique practice and selected rule variants | Persistent progression; each selected rule supported consistently by validation, solver, hints, imports, saves, print and sharing |
| Future 16×16 pilot | Small collection spanning its own difficulty range | Symbol/input design, readable notes and print layout, measured runtime and corpus quality |

Do not move the published `v1.0.0` tag again. Prefer stable puzzle identities and
a versioned bank mapping before reordering, so an old link still identifies its
original board and old scores do not attach to a different puzzle. If a deliberate
incompatible migration is chosen instead, document it clearly and decide the
release number around that change. Do not hide it inside a size-feature release.

The six labels can remain if review produces useful, distinct boundaries. There
is no need to force one UI tier per technique family, equal tier populations, or
more puzzles merely to occupy hosting capacity. Decide the boundaries from fixed
rules and review data; then freeze that policy for the release.

## Additional project provenance

Public README/source revisions used in the targeted project review:

| Project | Revision |
|---|---|
| [1to9only/sudokuNxM](https://github.com/1to9only/sudokuNxM/tree/add40c35b65266bb71ba30d70b59e1937731cd6e) | `add40c35b65266bb71ba30d70b59e1937731cd6e` |
| [SudokuMonster/SukakuExplainer](https://github.com/SudokuMonster/SukakuExplainer/tree/362854eea4e983017726d406ac9ee8a28909bcc7) | `362854eea4e983017726d406ac9ee8a28909bcc7` |
| [alexdej/hodoku-py](https://github.com/alexdej/hodoku-py/tree/8ba1922d42409ba524270f35f0480facc3d7091c) | `8ba1922d42409ba524270f35f0480facc3d7091c` |
| [dclamage/SudokuSolver](https://github.com/dclamage/SudokuSolver/tree/46eef14c4bc4409ef3d4178eede36112fbcdf859) | `46eef14c4bc4409ef3d4178eede36112fbcdf859` |
| [hkociemba/sudokuNxM](https://github.com/hkociemba/sudokuNxM/tree/bd5237096108fd729962198ecece3b0e360d9c6f) | `bd5237096108fd729962198ecece3b0e360d9c6f` |
| [kcirtapfromspace/sudoku-core](https://github.com/kcirtapfromspace/sudoku-core/tree/84696bec4003d129a2c11f12610cd1fb3cdb8c13) | `84696bec4003d129a2c11f12610cd1fb3cdb8c13` |
| [sigh/Interactive-Sudoku-Solver](https://github.com/sigh/Interactive-Sudoku-Solver/tree/a9609672cb1e5888edaa214ea0f3f9f4f0b1b623) | `a9609672cb1e5888edaa214ea0f3f9f4f0b1b623` |
| [stephenostermiller/qqwing](https://github.com/stephenostermiller/qqwing/tree/6048c90d84dded879e8e388c4da3da7acf0b5780) | `6048c90d84dded879e8e388c4da3da7acf0b5780` |
| [wyzelli/Hodoku2](https://github.com/wyzelli/Hodoku2/tree/31374a80e2b08adf29077a454fa7ae0ce0e3b383) | `31374a80e2b08adf29077a454fa7ae0ce0e3b383` |

The other linked official pages were read on the review date. Upstream claims
about correctness, formal proofs or cross-engine parity were not independently
certified by this review.


## Release sequence after the rating review

v1.1.0 applies [bank revision 2](bank-revision-2.md), retains every 9×9 board and
ships the completed gameplay/reasoning improvements. Compatibility conversion of
old levels and scores is intentionally omitted; this revision starts fresh bank
progress and uses content identities for new shares.

v1.2.0 will combine the prepared 36-class 4×4 collection and 120 curated 6×6
challenges with targeted 9×9 additions. Expert patterns and the dynamic-chain end
of Nightmare are the first expansion candidates. Additions must pass uniqueness,
identity/equivalence filtering and the same offline grading policy; no quota is
filled with transformed duplicates or unresolved boards labelled hardest.
16×16 remains a separate future pilot. Self-paced progression, technique practice
and selected rule variants are planned for v1.3.0; the precise initial variant
set remains to be selected from the existing assessment.

### Progression scope for v1.3.0

Progression is planned, not yet implemented. Small boards already retain completion
progress and offer a manual Next challenge button. The complete mode should:

- Follow the ordered 9×9 bank from Easy through Nightmare, with an independent
  challenge sequence for each small size.
- Record progress only when a progression puzzle is completed. Offer the next
  challenge afterward and let the player choose when to start it; no daily
  schedule or automatic board replacement.
- Remember completed content identities and the next challenge across reloads,
  with backup support. An active saved game continues to use normal resume.
- Count each completion once, including after undo/recompletion. Other play
  activities, such as imports or Daily, do not silently move the progression.
- Keep completed challenges replayable and show current progress without adding
  a separate top-level tab for each size.

Keep navigation compact: one board-size selector and grouped play options. In
v1.3, add a separate rules selector showing only supported choices rather than
a tab for every combination. Practice should let players choose a technique
without exposing offline maintenance controls in ordinary play.
