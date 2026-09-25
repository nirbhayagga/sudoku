# Development

Use Node 24, matching `.node-version` and CI.

```bash
npm ci
npm ci --prefix leaderboard-api
npm run dev
npm run lint
npm test
FULL_BANK_CHECK=1 npm run check
npx playwright install --with-deps chromium webkit
npm run test:e2e
npm run test:coverage
```

`check` runs lint, unit/DOM tests, and both builds. The full-bank option checks
all 5,692 classic 9×9 puzzles instead of a deterministic sample; collection tests
also check all 156 small boards, 48 variants and 56 practice positions. Browser tests use production
output; installed browsers alone do not add coverage—projects in
`playwright.config.js` select which engines and flows run. Emulation is not a real
iPhone test. Contrast checks cover the states exercised, not a full accessibility
certification. Lighthouse thresholds live in `lighthouserc.json`.

WebKit offline tests close a dedicated static server after precaching because
Playwright's WebKit offline emulation rejects worker-backed reloads in the tested
engine. They require a fresh document with the server unavailable. Chromium uses
browser offline emulation directly; neither replaces testing an installed iOS PWA.

Unit tests import pure modules directly. DOM tests bundle the application with
esbuild and evaluate it against `index.html` in jsdom. Coverage excludes that
bundled DOM path; browser tests provide layout, input, and worker coverage.

## Build modes

| Command | Output | JavaScript | Service worker | Disk opening |
|---|---|---|---|---|
| `npm run build` | `dist/` | ES modules, lazy bank chunk | Yes | No |
| `npm run build:standalone` | `dist-standalone/` | One classic-script IIFE | No | Yes |
| `npm run build:all` | Both | Both formats | As above | Standalone only |

The standalone output is a directory, not a single HTML file. Both builds copy
`public/`, including the full font licenses. Assets use relative paths for subpath
hosting. Hashed JS/CSS names support long-lived caching; `index.html` and `sw.js`
should be revalidated. Worker activation and browser caching can delay updates;
a reload is not a guarantee of immediately displaying the newest deployment.

The production worker precaches output assets, including the lazy bank. It uses
network-first navigations with a deadline and cache fallback, cache-first hashed
assets, and excludes `/api/`. It checks navigation responses against its own
build's assets. These checks reduce mismatched-build failures but do not establish
that every same-origin response is valid application content.

## Module map

| Module | Responsibility |
|---|---|
| `solver.js` | Constraint propagation and MRV search over 9-bit candidates |
| `generator.js` | Unique puzzle generation and difficulty targets |
| `puzzle-bank.js`, `difficulties.js` | Lazy puzzle data; eagerly available tier metadata |
| `app.js` | Shared game state, grid input, timers, and UI wiring |
| `techniques.js` | Human deduction explanations, separate from the solution |
| `format.js` | Import parsing, five export formats, escaping, time formatting |
| `printing.js` | Local worksheet and answer-page DOM construction |
| `rating.js` | Preserved original assessment method |
| `human-rating.js` | Preserved v1 assessment with persistent candidate deductions |
| `assessment.js`, `reasoning.js`, `advanced-techniques.js`, `chains.js` | Shared v2 assessment, rule discovery, candidate state and proofs |
| `deep-assessment.js`, `extended-reasoning.js`, `dynamic-chains.js` | V3 assessment, work profiles and independently replayable dynamic implications |
| `analysis-client.js`, `analysis-worker.js`, `worker-factory.js` | Cancellable background analysis, shared by static and self-hosted apps |
| `hint-path.js` | Retained candidate exclusions across consecutive hint reveals |
| `puzzle-generation.js`, `generator-dialog.js` | Seeded unique generation and preview UI |
| `puzzle-image.js` | PNG export independent of theme and messaging fonts |
| `storage.js` | Browser persistence and stats |
| `daily.js`, `share.js` | Date mapping, puzzle links, and game snapshots |
| `theme.js`, `dialogs.js` | Themes and dialog focus management |
| `leaderboard-client.js` | Optional API integration |
| `progression.js` | Independent paths identified by puzzle content, with explicit next selection |
| `practice.js`, `practice-bank.js`, `practice-app.js` | Reconstructed verified technique lessons and lazy practice UI |
| `geometry.js`, `sized-solver.js`, `sized-generation.js` | Shared size/rule definitions, generic solver and reproducible generation |
| `small-app.js`, `small-state.js`, `sized-export.js` | Small/variant gameplay, validated state, interchange and print |
| `variant-bank.js`, `variant-tools.js` | Curated Diagonal/Hyper collections and rule-preserving equivalence checks |
| `sw-template.js`, `vite.config.js` | Offline strategy and generated builds |

Classic 9×9 boards are 81-character strings with `0` for empties. The solver uses candidate
bitmasks internally. Its `rateDifficulty` counts explored search nodes; it is an
algorithm-specific measure, not proof that a person must guess. The current
full-bank measurements are in the [README](../README.md#difficulty-and-download-size).

## Puzzle bank maintenance

`scripts/generate-bank.js` remains a search-node candidate collector. Its CLI
rejects `--write` so it cannot silently replace the human-technique ladder. Import
and reorder dry runs still verify uniqueness; output files are created exclusively.
Use `generatePuzzle()` for reproducible technique-targeted candidates.

```bash
node scripts/generate-bank.js --difficulty evil --count 500 --pool 6000
node scripts/assess-v4.js --all --transforms --out=e2e-results/new-rating.json
node scripts/reclassify-bank.js --assessment=e2e-results/new-rating.json --out=e2e-results/new-proposal
```

Review the proposal before repeating the last command with `--apply` and a fresh
output directory. It verifies input/source hashes, exact bank membership, unique
solutions and identity collisions, then generates the bank, API metadata and rank
manifest together. See [the policy](bank-revision-2.md). The external 17-clue
catalogue is intentionally untracked; reordering the retained bank does not need it.

See the [SudokuExplainer engineering review](sudoku-explainer-review.md) for the
feature comparison, shared reasoning/generation architecture, optional offline
tools, web generator controls, and selected board-size roadmap. Its
[variant assessment](sudoku-variants-assessment.md) distinguishes future rule
support from capabilities already implemented.

Hints must remain correct even when the visible board contains a mistake.
Supported deductions include singles, locked candidates, subsets through quads,
fish through Jellyfish, XY/XYZ wings, static chains, dynamic implications and
binary forcing convergence. Candidate exclusions persist through the hint path.
Proofs retain their premises and evidence without consulting the answer; the UI
independently verifies results and labels answer-based fallbacks.
Auto-notes must use visible candidates rather than the solution. Input changes
must cover desktop keyboard and touch numpad paths, paused games, undo/redo,
and persistence. Grid sizing relies on measurement and should be checked at
small viewport heights as well as full phone sizes.

To compare the hint engine with an earlier commit, run
`node scripts/rate-human.js --sample=100 --baseline-ref=<commit>` (or `--all`).
The report counts puzzles finished by supported deductions, placements, technique
usage, and timing. A stalled puzzle means this implementation could not finish
it; it does not prove that a person must guess. This report does not reorder the
bank or alter its current search-node ratings.

The full-bank [technique report](puzzle-rating.md) preserves the original results.
Add `--details` to retain per-puzzle outcomes. This measures the original hint
path, which recomputes visible candidates after each placement, rather than a
solver that retains all prior eliminations. That distinction matters for ranking.

For a single puzzle, use `node scripts/rate-human.js --puzzle-file=export.txt` or
`node scripts/rate-human.js --puzzle=<81-digits-or-dots>`. These use `rating.js`,
the preserved original assessment, accept the normal text formats, report uniqueness
and supported deductions, and omit the answer from the output. They do not need
a Git baseline. Import requires uniqueness for Play and uses the `imported`
statistics category; that key is allowed in saves and game links, never in bank
selection or the API's difficulty allowlist.

For the deeper offline assessment, use `node scripts/assess-difficulty.js --all`
or `--sample=100`, with optional exclusive `--out` / `--report` paths. It retains
candidates, tests independent technique-family caps, records workload, and keeps
unresolved boards unranked. It also accepts `--puzzle` / `--puzzle-file` and an
opt-in `--trace`. See the [reproduction guide](difficulty-assessment.md) and
[full-bank review report](puzzle-assessment-v1.md). It does not replace the importer
or production hint path.

Generated-notes actions store before/after snapshots in the same bounded undo
history as moves. Assistance remains sticky. A completion snapshot freezes the
first score through review and reload; later edits never create another win.
Browser tests exercise these flows in Chromium and iPhone-emulated WebKit.
Undefined variables fail lint. The optional leaderboard also has browser coverage
for rendered scores and late responses when switching difficulty tabs.
Printing tests check pagination and overflow; set `PRINT_QA_DIR` when running the
desktop project to also write A4 and Letter PDFs for visual review.
`planWorksheet` validates the shared puzzle/page counts, the 24-puzzle batch limit,
and consecutive ranges before bank selection. Answer pages are additional;
requesting a page total means that many full puzzle pages, never a truncated range.
Printing does not advance played levels, game progression, or statistics.

Startup shows a loading status while the grid is built and fitted, then reveals
the measured layout. It does not wait for the optional leaderboard or a bank
request to finish. Keep touch cells free of programmatic focus during clearing;
desktop focus uses `preventScroll` so setup does not move the viewport.


## Shared reasoning and generation

Import estimates and advanced hint paths run in a worker using the v3 extensions
over the preserved v2 reasoning core. Basic single hints use the same single detectors directly.
The first hint press is always free; answer offers are labelled, and filling a
cell still requires the explicit Reveal action. The proof details list candidate
exclusions and chain implications. Candidate deductions persist across consecutive
hint reveals, separately from pencil marks; a board edit, undo, new game or mode
change invalidates that continuation. Auto-notes only use visible digits.

The worker is loaded on first use, and the PWA precaches its chunk for offline use.
An inline worker also supports the standalone `file://` build. Closing a dialog,
changing its input, cancelling a job or starting a replacement terminates the
previous worker. Imports and hints have time limits; generation has an attempt
budget and a 60-second browser limit. Limits are reported honestly.

`node scripts/assess-v2.js --all --out=e2e-results/v2/report.json --report=e2e-results/v2/report.md`
repeats the full assessment. `--puzzle-file=grid.txt` accepts newly imported text,
and `--trace` opts into deduction spoilers. The [v2 report](puzzle-assessment-v2.md)
and [SE comparison](unresolved-puzzles-se-check.md) preserve the review evidence.
The v1 commands and reports remain unchanged.

For the stronger current maintenance assessment:

```bash
node scripts/assess-deep.js --all --out=e2e-results/maintenance/report.json --report=e2e-results/maintenance/report.md
node scripts/assess-deep.js --puzzle-file=grid.txt --trace
```

The `maintenance` profile allows 2,000,000 dynamic work operations per deduction;
`interactive` allows 100,000. Both use the same rules and checked proofs. Read the
[v3 report](puzzle-assessment-v3.md) and [full SE comparison](full-bank-se-comparison.md)
for provenance and rating limits. Neither CLI changes the bank. The seeded
generator remains on its v2 targeting policy so existing seeds/settings stay reproducible.

The web generator is under Solver → Generate. Clue count and technique level
are independent requests; impossible or unachieved combinations return a labelled
closest unique puzzle. A seed reproduces a completed run only with the same
settings, attempt budget and engine/policy version. Cancelled/timed-out runs are
not claimed to reproduce a completed search. Rotational symmetry applies to clue
positions. Exact 17-clue generation is not promised by this digging algorithm.

The same generator is callable from offline maintenance scripts:

```js
import { generatePuzzle } from './puzzle-generation.js';
const result = generatePuzzle({ seed: 'example', family: 'subsets', symmetry: 'rotate180',
  minClues: 26, maxClues: 30, maxAttempts: 30 });
console.log(result.puzzle, result.targetMet, result.assessment.label);
```

Cloud/static and whole-app Docker/Podman self-hosting share these frontend
capabilities. There is no analysis service or separate full-solver edition.
The optional leaderboard remains available in self-hosted deployments.


## Enhanced reasoning profile (v4)

`enhanced-reasoning.js` adds verified uniqueness patterns and short-chain selection
to the preserved v3 engine. `enhanced-assessment.js` runs family-capped passes and
records opening deductions, chain node/depth counts, and bounded alternate orders.
`named-techniques.js` never reads a solved board; uniqueness is a separately checked
premise. `hint-diagram.js` renders optional candidate maps from deduction premises.
The browser uses the interactive profile; maintenance uses larger limits.

Run `node scripts/assess-v4.js --help` for bank, arbitrary-board and external-corpus
assessment. `scripts/prepare-benchmarks.py` prepares pinned harder research inputs.
See [the v4 assessment](puzzle-assessment-v4.md) for current coverage, reproducibility
and limits. Historical CLIs and reports remain available.


## Small-board geometry

`geometry.js` owns size, box dimensions, symbols, houses and peers. The optimized
9×9 solver remains specialized; `sized-solver.js` supplies the generic solver and
small-board deductions, cross-checked against it. `sized-generation.js` and
`scripts/generate-small-bank.js` reproduce the curated banks. `small-state.js`
validates bounded saves and implements reversible notes/value changes.
`small-app.js` is lazy-loaded, and `sized-export.js` handles size-aware links,
images and worksheets. No server-side analysis service is needed.

See [small-board maintenance and contracts](small-boards.md). Small saves and
progress use separate versioned storage keys and never enter the 9×9 leaderboard.
The [activities guide](activities.md) covers practice/variant curation and the
offline correctness benchmark for newly added or imported puzzles. Build tests
cap the initial JavaScript at 32 KiB gzip and all assets plus the service worker
at 285 KiB, including fonts, banks, practice and the analysis worker.
