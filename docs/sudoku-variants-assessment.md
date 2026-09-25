# Board sizes and variant assessment

Reviewed 2026-09-24 alongside the [SudokuExplainer comparison](sudoku-explainer-review.md).
This records the requested roadmap and engineering recommendations, not shipped
variant support. Its baseline working tree supported classic **9×9 only**.
The historical assessment is preserved here. Current capabilities are documented
in [small boards](small-boards.md) and [activities](activities.md).

The [broader adoption review](sudoku-adoption-roadmap.md) adds actual smoke checks
of the SE 4×4/6×6/16×16 release CLIs and comparisons with other geometry/variant engines.

## Requested sequence

1. **Finish 9×9:** shared reasoning, stronger techniques, repeatable assessment,
   reviewed ratings, repaired generation tools and the remaining release checks.
2. **Build challenging 4×4 and 6×6 collections:** evaluate their own difficulty
   ranges, verify uniqueness, and remove equivalent/repetitive boards.
3. **Consider 16×16 from easy through the hardest curated examples:** run a pilot
   and review input, printing, rating quality and runtime before a larger collection.

“Hardest” must mean hardest under a documented assessment within that size and
candidate pool. It does not mean a 4×4 puzzle rivals a difficult 9×9. A 4×4 set has
limited structural variety; avoid padding it with digit swaps and rotations sold
as distinct challenges. Exhaustive small-board evaluation is a useful offline
project before deciding its collection size. For 6×6, start with a candidate pool
and retain varied deduction paths. For 16×16, establish the range empirically;
more cells can add repetition without requiring a harder technique.

Keep all 5,500 current 9×9 puzzles during this work. Do not choose new collection
sizes from available hosting quota. Each size needs separate calibrated labels,
stable puzzle identities, progress and score categories.

## How to read the catalogue comparison

The requested [variants list](https://sudoku-online-puzzles.com/blog/sudoku-variations-list/)
is used as a checklist of names. Aliases and repeated entries are grouped below;
the decisions and implementation assessments are ours. This is not a reproduction
of the site's descriptions or an endorsement of a universal popularity/difficulty ranking.

**SE** below refers to the source revision pinned in the main review. “Custom”
means its configurable extra-region machinery may express the geometry, not that
a named puzzle type was run and verified. “Release” means separately generated
binaries, not generic board-size support proven in the checked-out Java source.
For all rows except classic 9×9, this project currently has **no playable support**.

### Board sizes and multiple boards

| Names / family | SE overlap | Our decision and implementation implication |
|---|---|---|
| Classic / 9×9 | Native | Existing product; finish assessment and hints first |
| Mini; 4×4; 6×6 | Release | Requested next: 2×2 or 2×3 boxes, separate ratings and curated challenge sets |
| 8×8; 12×12 | Release | Defer; additional sizes add testing/content work without meeting the selected roadmap |
| 16×16 / Hexadoku | Release | Later pilot across difficulty; 4×4 boxes, explicit symbols, desktop/print and touch review |
| 25×25 | Release | Defer; 625-cell input and candidate display need a distinct usability design |
| Samurai; Gattai; Overlapping; Multi-grid | Not found in reviewed implementation | Defer; shared cell identity across boards, topology-aware solving and a much larger viewport |

The upstream [size release](https://github.com/1to9only/SudokuExplainer/releases/tag/2024.1.18)
uses generated builds and describes display/generation limitations. Our priority
is a coherent implementation of the chosen sizes, not matching its size menu.

### Regions and extra houses

| Names / family | SE overlap | Our decision and implementation implication |
|---|---|---|
| Jigsaw / Irregular / Squiggly | Custom regions with Latin mode can represent replacement regions; not runtime-certified here | Good later candidate; explicit region map, boundary drawing and technique geometry audits |
| Hyper / Windoku / NRC | Windoku built in | Recommended first wave after size work; reuse all-different houses with visible region overlays |
| Girandola; Asterisk; Center Dot | Custom-region concept | Low incremental engine cost after arbitrary houses; keep as presets later, not separate top-level modes |

### Arithmetic and cages

| Names / family | SE overlap | Our decision and implementation implication |
|---|---|---|
| Killer; Sum | Not found | Strong later candidate; cage validation, sum combinations, explanations and cage labels |
| Killer X; Mini Killer; Hyper Killer | Geometry/size components only | Compose only after each underlying rule is tested independently |
| Calcudoku / KenKen-style | Latin mode is only one component | Defer as a separate puzzle family; arithmetic operators and different region assumptions |
| Kakuro hybrid | Not found | Defer; run/clue topology and a substantially different editor and solver |

For implementation, do not assume every sum-marked group has the same repeat rule.
Use explicit sum, allowed repeats and cell membership. Ordinary KenKen specifies
row/column uniqueness and arithmetic cages, rather than classic Sudoku boxes.
[Official KenKen rules](https://www.kenkenpuzzle.com/howto_simple)
support treating it as a distinct family.

### Lines and paths

| Names / family | SE overlap | Our decision and implementation implication |
|---|---|---|
| Thermo | Not found | Recommended second wave; ordered-path propagation and understandable bounds explanations |
| Arrow; Double Arrow | Not found | Later; sum constraints over paths and bulb cells, with repeat rules preserved |
| Renban | Not found | Later; consecutive-set domain reasoning, not a fixed ordering along the line |
| Between Lines; Lockout Lines | Not found | Later; endpoint domains and interior restrictions, including explicit threshold parameters |
| Palindrome | Not found | Useful later; equality links need propagation and proof support |
| German Whispers | Not found | Later; pairwise difference constraints with thresholds defined for the chosen size |
| Region Sum Lines | Not found | Defer until sums and region segmentation are robust |
| Entropic Lines | Not found | Defer; overlapping windows and digit-set membership need a new propagator |

Sources for concrete first candidates: [Thermo rules](https://www.gmpuzzles.com/blog/sudoku-rules-and-info/thermo-sudoku-rules-and-info/)
and [Arrow rules](https://www.gmpuzzles.com/blog/sudoku-rules-and-info/arrow-sudoku-rules-and-info/).
Thermo requires increasing values along its orientation; an arrow's arithmetic
does not itself imply all values on that path differ. That distinction must
survive validation, generation, notes and hints.

### Global and marked-cell constraints

| Names / family | SE overlap | Our decision and implementation implication |
|---|---|---|
| X-Sudoku / Diagonal / Sudoku X | Built in, including single-diagonal options | Best first variant candidate; two explicit extra houses and simple visual rules |
| Disjoint Groups | Built in | Good later preset once extra-house explanations work |
| Anti-Knight; Anti-King | Not found | Later; extra peer edges are feasible, but human techniques must respect their premise types |
| Non-Consecutive / Anti-Consecutive | Not found | Later; value-dependent neighbor restrictions, not ordinary same-digit peers |
| Odd-Even; Even; Odd | Not found | Low-cost later feature after marked-cell schema/rendering; explicit allowed-value masks |
| Consecutive | Not found | Later; marked adjacency plus an explicit policy for unmarked pairs |

Upstream's [region selection](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/Grid.java#L591)
confirms the built-in extra-house cases. No cage, thermometer or chess constraint
engine was found in this reviewed tree; those cannot simply be enabled from SE.

### Comparisons and neighboring pairs

| Names / family | SE overlap | Our decision and implementation implication |
|---|---|---|
| Greater Than / Less Than; Futoshiki hybrid | Not found | Later; inequality relations can share infrastructure with Thermo |
| XV | Not found | Later; sum pairs plus explicit complete/partial marking semantics |
| Kropki; Ratio | Not found | Good later candidates after pair constraints; distinguish positive clues from negative rules |
| Consecutive Pairs | Not found | Same relation infrastructure; explicit partial-marking profile |

Do not infer a negative rule merely from a name. A published
[mixed Kropki puzzle](https://www.gmpuzzles.com/blog/2021/08/arrow-killer-kropki-thermo-sudoku-by-michael-rios/)
allows unmarked pairs to meet dot relationships, whereas the publisher's
[Consecutive rules](https://www.gmpuzzles.com/blog/sudoku-rules-and-info/consecutive-sudoku-rules-and-info/)
forbid the relationship on unmarked pairs. The puzzle schema must say which
interpretation applies, and the UI must explain it.

### Outside clues and alternative topology

| Names / family | SE overlap | Our decision and implementation implication |
|---|---|---|
| Sandwich | Not found | Later; endpoint placement and sum reasoning, plus space around the grid |
| Skyscraper | Not found | Later; visibility constraints and row/column sequence reasoning |
| Outside | Not found | Later; membership clues scoped to specified cells, with explicit orientation |
| Little Killer | Not found | Later; diagonal sum paths and explicit repeat permissions |
| Sudo-Kurve | Not found | Defer; arbitrary houses and non-rectangular presentation need separate tests |
| Border; Clueless | No general matching implementation | No mode from the name alone; require a concrete rule/profile and puzzle examples |

### Relations between cells or groups

| Names / family | SE overlap | Our decision and implementation implication |
|---|---|---|
| Clone; Mirror | Not found as general equality/relation constraints | Later; explicit correspondences can reuse equality/pair propagators |
| Twin | Not found | Defer with multi-grid support; relationship and cell mapping must be serialized |
| Modular | Not found | Later; represent explicit digit classes, not a hardcoded nine-digit assumption |
| Battenburg | Not found | Later; four-cell parity rules and explicit negative-marking policy |
| Quadruple / Quad | Not found | Later; set/multiset containment across small groups needs precise clue semantics |

### Symbols, labels and altered rule systems

| Names / family | SE overlap | Our decision and implementation implication |
|---|---|---|
| Alphabet / Letter; Symbol; Roman Numeral | Symbol-format options, not a matching general symbol-theme product | Optional display layer later; keep canonical values, accessible labels and parsable exports |
| Wordoku | Letter formats only; no hidden-word collection verified | Optional curated content later, not a new difficulty engine |
| Zero | Alternate representation possible | Optional alphabet profile; separate zero-as-value from the current zero-as-empty format |
| No 1 | No verified named mode | Defer; a deliberate blank symbol must differ from an unfilled cell |
| Missing Digits | No verified matching implementation | Defer until the permitted symbol domain is precisely defined |
| No Repeats Outside Region | Custom houses are only a possible component | Specify actual cells and constraints; an umbrella label cannot define a solver |
| Greater Area; Deficit | Not safely covered by ordinary nine-cell houses | Defer; varying region cardinality changes the validity of single/subset deductions |

The guide's Deficit description should not be used as our specification.
The defining publisher describes regions with fewer cells than the available
digits: values cannot repeat there, but some digits need not appear. This matters
because “the only place in a region for digit X” no longer necessarily forces X.
[Grandmaster Puzzles' Deficit/Surplus rules](https://www.gmpuzzles.com/blog/sudoku-rules-and-info/deficit-surplus-sudoku-rules-and-info/)
explain the different region requirements.

### Hybrids and names needing precise rules

| Names / family | SE overlap | Our decision and implementation implication |
|---|---|---|
| Chaos Construction | Not found | Defer; unknown regions add a second layer of state/search, not just an overlay |
| Domino; Capsule | Not found as generic rule families | Define pair/tiling semantics first; reuse relation primitives where possible |
| Triple Dot | Not found | Define the exact three-cell relation before considering support |
| Fortress; Maximum; Minimum | Not found | Later; reusable inequalities with precise marked/unmarked behavior |
| Colored / Color | Appearance settings are not puzzle constraints | Theme coloring already exists; logical coloring needs explicit typed rules |
| Extreme | Classic difficulty labels only | Already covered in intent by harder classic puzzles; improve ratings instead of another mode |
| Monster / Giant | Larger release sizes | Treat as size descriptions; 16×16 follows the requested pilot, 25×25 stays deferred |

These tables account for the list's repeated size, alias, hybrid and newspaper
names. They deliberately do not translate every name into a separate button.
The smallest useful additions can come from a few well-tested rule primitives.

## Technical foundation before any variant ships

Represent a puzzle with a versioned schema: board size, symbol domain, base regions,
givens, typed constraints and parameters. Keep a human-readable rules summary with
each board. Unknown constraint types must be rejected; importing only the digits
of a variant as classic can silently change its solutions.

Shared primitives can cover many families: all-different houses, allowed-value
masks, inequality/equality/difference relations, sums, ordered paths, and grouped
set constraints. Region-changing and multi-grid families need additional geometry.
For every primitive, implement both complete-solver propagation/validation and
human explanations; raw search support alone is not full hint support.

Audit classic deductions before applying them to variants. A subset may remain
valid in a normal house, while uniqueness patterns or assumptions about rectangular
boxes may not. Extra constraints can make a board unique when its classic projection
is ambiguous; validate under the actual variant. A verified answer is a fallback,
not an explanation of an unsupported variant deduction.

Auto-notes should still derive only from the visible position and declared rules.
They may filter by a cage, thermometer or extra house once that rule is supported;
they must not consult a stored answer. If advanced logical pruning becomes an
option, identify it separately from ordinary candidate bookkeeping.

Selection, import, save, backup, handoff, print, completion, daily mapping and scores
must all preserve the same schema. The first versions should expose only tested
profiles rather than arbitrary combinations of every rule. Generated puzzles need
uniqueness under the full rules, useful explanations and a documented source/seed.

## Recommendation after the selected size roadmap

Start with **Diagonal**, then **Hyper**. They reuse house-based reasoning and have
compact rules that are easy to communicate. Then consider **Killer** and **Thermo**
for more distinct play, with Jigsaw and Anti-Knight as subsequent choices depending
on feedback. These are engineering/product recommendations, not measured popularity
rankings or promises about difficulty.

Keep heavy generation, candidate-pool ranking and exhaustive experiments in offline
maintenance modules. Bring a variant to the public player only when import, hints,
notes, undo, printing and accessibility work together. Moving computation to a
self-hosted server does not remove those UI and correctness requirements.
