# Feature comparison: this project and SudokuExplainer

> Review snapshot before bank revision 2. The [current bank policy](bank-revision-2.md) supersedes the reorder recommendations below.

Status at 2026-09-24. **This project** means the repository code described here,
not a claim about the currently deployed website. **SE** means the
[pinned source review](sudoku-explainer-review.md); release-only capabilities are
identified separately. **Proposed** features below are not implemented. The
[v3 assessment](puzzle-assessment-v3.md), [full SE comparison](full-bank-se-comparison.md)
and [broader project review](sudoku-adoption-roadmap.md) update the initial review.

This comparison covers product capabilities and algorithm families. It does not
claim identical performance or every edge case has been executed in Java.
Existing overlap predates this source review: **no SE source has been ported**.

## Complete solving, deductions and rating

| Capability | This project now | SE | Decision / remaining work |
|---|---|---|---|
| Complete classic 9×9 solver | Propagation + MRV search, typed-array masks | Propagation + MRV search, Grid/BitSet state | Keep ours; it already searches beyond human techniques |
| Uniqueness checking | Counts up to two solutions | Compares results from opposite search orders | Keep ours; require uniqueness for imported Play |
| Conflict/impossible-board detection | Validation and import status | Dedicated warnings/check producers | Overlap; preserve clear statuses |
| Show two solutions to explain ambiguity | No comparison UI | Double-solution warning views | Optional Solver teaching feature |
| Naked and hidden singles | Yes | Yes; finer direct-single classifications | Existing overlap; improve descriptions only where useful |
| Pointing and claiming | Yes | Yes, including direct-placement forms | Existing overlap; preserve evidence across deductions |
| Naked pairs/triples and hidden pairs | Yes | Yes | Existing overlap |
| Hidden triples and naked/hidden quads | Yes, shared v2 core | Yes | Implemented independently and audited |
| X-Wing | Yes | Yes | Existing overlap; generalize fish detection carefully |
| Swordfish and Jellyfish | Yes, generalized degree-3/4 fish | Yes | Implemented independently and audited |
| XY-Wing | Yes | Yes | Existing overlap |
| XYZ-Wing | Yes | Yes | Targets must see pivot and both wings |
| Unique rectangles/loops and BUG | No | Yes, multiple types | Proposed later; verify uniqueness and disclose that premise |
| Aligned pair/triple exclusion | No | Yes | Defer until coverage warrants cost |
| Forcing cycles/chains | Static implications, dynamic candidate propagation and binary forcing convergence | Yes, X/Y/mixed, multiple and dynamic reasoning | Cell/region multibranch forms and shorter alternative paths remain useful |
| Nested forcing chains | No | Yes | Offline analysis first; browser availability requires measurements |
| Persistent logical candidates | Shared assessment and consecutive hint reveals | Yes in solver state | Board edits invalidate the hint continuation |
| Full proof provenance | State-bound records, premises, exclusions and checked chain edges | Parent implications, candidate colors, regions, links and nested views | Richer diagrams and nested proofs remain separate work |
| Difficulty from human deductions | V3 core with browser/maintenance work profiles; no calibrated new six-tier scale | Technique ratings with chain complexity | Review observations before setting new tier boundaries |
| Opening difficulty | V2 bank report has opening measurements; full SE comparison retains EP/ED | Separate opening/first-placement metrics | Add first-class arbitrary-puzzle fields alongside overall workload |
| Arbitrary imported-board assessment | Yes, with current supported techniques | Yes, broader technique set | Shared improved JS core must work for new boards too |
| Honest unsupported result | Deeper assessor reports unresolved | Rating has failure sentinels | Keep explicit statuses; do not turn a failure into a tier |
| Whole-bank deterministic report | 5,500-board JSON/Markdown, source/input hashes, preserved snapshots | Batch CLI tools | Our reproducibility layer already exists; extend rather than replace |

Upstream evidence: [solver orchestration](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/Solver.java),
[rule inventory](sudoku-explainer-inventory.md),
[complete solver](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/BruteForceAnalysis.java),
[chain proofs](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/ChainingHint.java).
Local evidence: [solver.js](../solver.js), [techniques.js](../techniques.js),
[rating.js](../rating.js), [human-rating.js](../human-rating.js),
[assessment guide](difficulty-assessment.md).

## Playing, hints and interface

| Capability | This project now | SE | Decision / remaining work |
|---|---|---|---|
| Curated bank and numbered levels | 5,500 boards, six existing labels | No comparable bank in reviewed tree | Keep bank; review ratings before reordering |
| Daily puzzle | Yes, identity/date shown | No comparable daily player | Keep |
| Timer, pause and resume | Yes | Solver-oriented workflow | Keep |
| Personal stats and completion history | Yes, including imported games | No comparable gameplay statistics | Keep |
| Optional leaderboard | Yes, client-reported tier scores | No equivalent backend | Keep optional; does not establish verified competition |
| Manual pencil marks | Yes | Yes | Existing overlap |
| Fill notes once | Yes, undoable | Candidate rebuild/solve operations | Keep explicit action |
| Live auto-notes | Visible-board candidates, undoable mode changes | Editable solver candidate state | Do not merge our notes with logical proof state |
| Undo / redo | Both, including affected peer notes | Grid-snapshot undo; no comparable redo path found | Keep ours; extend to future logical state |
| Free hint preview / explicit reveal | Yes, with answer-based correction labelled | Clues, explanations and apply actions | Keep clear assistance accounting |
| Small clue → more detail → full proof | Free preview and expandable deduction/chain steps | Yes, progressive clues and detailed HTML | Keep labels and explicit Reveal action |
| Candidate/chain diagram | Cell evidence highlighting; no chain graph | Candidate-level colors, links, views | Add after proof model; test all themes/accessibility |
| Alternative hint tree | No | Yes, filtering duplicate outcomes | Optional Solver/Learn view |
| Technique configuration | Fixed project policy | Technique selection dialog | Developer/advanced option first; record profile with ratings |
| Apply singles/basics automatically | No dedicated teaching action | Yes | Optional Solver action, separate from Play and auto-notes |
| Completion review, share and undo | Yes; original recorded result retained | Solver path and undo | Keep ours; add reasoning replay separately |
| Keyboard/touch controls | Both, with shortcut guide | Desktop keyboard/mouse | Keep mobile-first behavior |
| Themes and system preference | Ten themes + system choice, browser contrast checks | Swing appearance options | Keep ours; do not copy hardcoded proof colors |
| Progressive campaign | Proposed, not implemented | No comparable campaign | After reviewed bank order; advance on completion only |

Upstream evidence: [controller](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/SudokuExplainer.java),
[window controls](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/SudokuFrame.java),
[technique dialog](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/TechniquesSelectDialog.java).
Local evidence: [playing guide](playing.md), [app.js](../app.js),
[storage.js](../storage.js), [index.html](../index.html).

## Import, export, generation and deployment

| Capability | This project now | SE | Decision / remaining work |
|---|---|---|---|
| Text import / clipboard | Strict shared parser; unique Play or ambiguous Solver | Multiple symbol/grid formats; some paths truncate extra cells | Keep strict validation |
| Text export | Five formats, original/current position | Line, formatted grid and other representations | Existing overlap; no need for many cosmetic additions |
| PNG export | Yes, fixed paper-style 1080×1200 grid | Yes | Messaging keeps its layout |
| Bulk worksheets / browser PDF | 1/2/4/6 per page, up to 24 boards, random/consecutive, optional answers | No comparable worksheet workflow found | Keep ours |
| Pencil-mark export | Only indirectly within saved/transfer state | Dedicated text export | Consider a validated candidate-state format later |
| Full deduction-path export | v2 CLI trace has full records; no browser path export | Path display/copy/save and CLI traces | Browser export remains optional |
| Puzzle links / device handoff | Both; snapshot includes game state | No comparable web handoff | Keep ours |
| Local backup / restore | JSON with validation | Files/preferences, different scope | Keep ours |
| Puzzle generation | Repaired maintenance CLI and worker-based web generator | User-facing generator and background generation | Preview before Play/Export/Print |
| Clue-count controls | Automatic, exact or ranged request | Difficulty/symmetry generator; not our exact-clue API | Closest result labelled when targets are missed |
| Human-rated generation | Shared v2 family target and uniqueness check | Yes, with a generation-specific filter | Legacy bank CLI keeps existing search ordering pending review |
| Symmetric clue removal | None or 180° rotational clue pattern | Multiple symmetry patterns | Other symmetries can follow demand |
| Seeded reproducible generation | Yes, with version/settings/attempt budget recorded | Default random generation | Completed runs repeat through the same shared core |
| Static hosted/offline PWA | Yes | Desktop Java/app entry points | Keep web distribution |
| Standalone file build | Yes, separate classic-script output | Java application | Keep; future worker features need an explicit compatible path |
| Self-hosted deployment | Static frontend + optional scoreboard | Run Java locally | Optional analysis CLI/container can be added without a separate fork |
| Heavy analysis service | No, and none planned | CLI programs | Whole-app self-hosting uses the same frontend workers |
| Other sizes | No | Separate release builds, 4–25 supported sizes | Finish 9×9, challenging 4×4/6×6, then assess 16×16 |
| Extra-region variants | No | Diagonals, disjoint groups, Windoku, custom regions, Latin mode | See the [variant assessment](sudoku-variants-assessment.md) |
| Cages, thermos, general modern variants | No | No generic cage/line engine in reviewed tree | New implementation; SE is not a universal variant engine |
| Automated project checks | Unit/DOM, bank, Chromium/WebKit, contrast, builds, API | CLI test/analysis programs; no comparable suite found in checkout | Keep ours and extend proof/budget/geometry tests |

Upstream evidence: [I/O](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/io/SudokuIO.java),
[image export](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/SudokuPanel.java#L691),
[generator](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/generator/Generator.java),
[geometry](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/Grid.java),
[size release](https://github.com/1to9only/SudokuExplainer/releases/tag/2024.1.18).
Local evidence: [format.js](../format.js), [printing.js](../printing.js),
[generator.js](../generator.js), [deployment guide](deployment.md).

## What can and cannot be adopted directly

The mathematical techniques and architectural ideas can inform our own code.
Java/Swing code is not a browser module, and direct source reuse brings the
upstream licensing requirements described in the main review. The current
implementation uses independently written JavaScript. No upstream Java source or binary is bundled.

We should retain expensive analysis, catalogue selection, exhaustive small-board
experiments and generation tools in this repository even if they remain offline.
The browser worker exposes the shared bounded reasoning core. Whole-app self-hosting
uses the existing Docker/Podman deployment; a separate analysis service is not planned.
Maintain one tested core with explicit profiles instead of independent “lite” and
“full” implementations that gradually disagree.
