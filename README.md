# Sudoku

Browser-based Sudoku player and solver: 5,500 classic 9×9 puzzles, six difficulty tiers,
ten themes, hints, pencil marks, daily puzzles, and offline play after caching.
Vanilla JavaScript with **zero frontend runtime package dependencies**. The
optional leaderboard uses Express and CORS.

## Quick start

With Docker, no Traefik or external network required:

```bash
docker compose -f docker-compose.standalone.yml up -d --build
```

Open [localhost:8080](http://localhost:8080). To run only the frontend, append
`sudoku` to that command. The leaderboard hides when its API is unavailable.

For local development (Node 24):

```bash
npm ci
npm run dev
```

Open [localhost:8000](http://localhost:8000).

To play directly from disk:

```bash
npm ci
npm run build:standalone
```

Open `dist-standalone/index.html`. Keep the **whole output directory** together;
it contains separate CSS, fonts, icons, and license files alongside the script.

## Play and solve

The board-size selector also offers **36 distinct 4×4 puzzle classes** and
**120 curated 6×6 challenges**, with separate saves/progress, imports, hints,
notes, text/PNG export and printable worksheets. See [small boards](docs/small-boards.md)
for their geometry, grading and reproducible curation. 16×16 play is deferred.

- Play a bank level, draw a random puzzle, choose a daily puzzle, or share a link.
- Use manual notes, Fill notes for one-time candidates, or live Auto-notes.
  Generated notes and digit changes support undo/redo, including peer notes.
- **Hint (free)** previews a deduction or clearly labelled verified-answer offer.
  **Reveal (+1 hint)** fills the cell. A selected cell also gets a free preview.
- Pause, resume a saved game, or carry a game snapshot to another device by link.
  Snapshots do not synchronize subsequent moves between devices.
- In Solver mode, enter or paste a grid. Export as a line, rows, a boxed grid, or
  keycap emoji. Emoji alignment varies by app, font, and available width.
- Generate a unique 9×9 puzzle in Solver → Generate: technique target, symmetry,
  automatic/exact/ranged clue count, seed, progress and cancellation. Preview before playing.
- Export a fixed-layout PNG image for messaging, alongside the text formats and printable worksheets.
- Import a unique puzzle directly into Play, with a technique assessment, saving,
  hints, and separate Imported statistics. Ambiguous grids can be opened in Solver.
- Print the current board or a random/consecutive bank worksheet with 1, 2, 4,
  or 6 puzzles per page. Choose a puzzle or page total, up to 24 puzzles, with
  optional separate answers. The browser's print dialog can save a PDF.
- Completion shows the puzzle identity and result. Share, export, or return to
  the board to review and undo; re-solving preserves the first recorded result.

The optional leaderboard ranks **per difficulty tier**, mixing different levels
and daily puzzles. Level numbers are metadata, not separate rankings. Times and
assistance counts are client-reported; the server does not verify completed games.

See [controls and sharing](docs/playing.md) for shortcuts and import formats.

## Difficulty and download size

Easy through Evil contain 500 puzzles each; Nightmare contains 3,000. This
solver's search-node rating measures work beyond its constraint propagation,
not universal human difficulty. Zero nodes means this algorithm needed no search.

| Tier | Min nodes | Median | P90 | Max | Zero-search share |
|---|---:|---:|---:|---:|---:|
| Easy | 0 | 0 | 0 | 1 | 99.8% |
| Medium | 0 | 0 | 0 | 6 | 92.4% |
| Hard | 0 | 0 | 4 | 22 | 66.4% |
| Expert | 0 | 1 | 7 | 45 | 40% |
| Evil | 7 | 11 | 20 | 122 | 0% |
| Nightmare | 19 | 33 | 106 | 3262 | 0% |

Measured across the full bank on September 24, 2026; P90 uses nearest rank. Evil and Nightmare
are ordered by increasing rating; Nightmare 3000 has the largest search-node
rating in this bank. Easy–Expert are unordered. Released level positions are stable.

The tiers overlap: Nightmare 1 rates at 19 search nodes, while Hard 82 rates at
22 and Evil 500 at 122. Seventeen clues alone do not guarantee greater human
difficulty. See the [technique report](docs/puzzle-rating.md) for deduction-based
measurements and their limits; no levels have been reclassified.
The [v4 maintenance assessment](docs/puzzle-assessment-v4.md) finishes **5,500/5,500**
with checked deductions, including uniqueness rectangles and BUG+1, shorter-chain
selection, opening measurements and bounded alternative paths. Its shared rules
also power browser hints and imported-puzzle assessment with smaller work budgets.
Candidate maps and detailed proofs are available inside the free hint preview.
The seeded generator retains its documented v2 targeting policy for reproducibility.
The [v4 SE comparison](docs/full-bank-se-comparison-v4.md) records an independent
benchmark, not an interchangeable rating scale. Earlier v1–v3 reports remain available.
The harder external benchmark explains 40/80 sampled boards; unresolved boards remain
unranked. No levels have been reclassified.

The separate [persistent-candidate assessment](docs/puzzle-assessment-v1.md)
retains eliminations across steps and includes representative boards for review.
Its [reproduction guide](docs/difficulty-assessment.md) preserves the earlier method
and explains why unresolved puzzles remain unranked.
The [engine and feature review](docs/sudoku-explainer-review.md) compares
SudokuExplainer with this project, records the implemented 9×9 improvements,
and separates the deferred board-size and variant work.
The [broader adoption review](docs/sudoku-adoption-roadmap.md) compares other Sudoku
projects, SE's size builds, rating features, and possible future improvements.

The initial JavaScript entry stays below **30 KiB gzipped**. The puzzle bank and
analysis worker are loaded on demand; the bank is about 115 kB gzipped. Tests cap
all compressed assets plus the service worker at **265 KiB**, including the bundled
fonts. The service worker caches optional chunks and the bank too, so the complete
first visit costs more than the initial entry script. HTML and icons add to that
transfer; actual compression depends on the server.

## Storage and offline use

Games, settings, played levels, and personal stats stay in this browser's
localStorage. Clearing site data removes them; storage can also be evicted.
Use Stats → Download backup / Restore backup to keep a personal JSON backup.
There is no account or cloud synchronization. Submitting a leaderboard score
sends the chosen name and game statistics to the configured API. Game handoff
links contain the game state and can be read by anyone with the link.

HTTPS deployments (and localhost during development) support service workers
and PWA installation where the browser allows it; offline play requires a
successful initial cache. Browser updates and storage policies affect
availability. The disk build does not use a service worker.

## Development and deployment

- [Development, architecture, testing, and build modes](docs/development.md)
- [Docker, static hosting, optional API, and CI publishing](docs/deployment.md)

## Credits and license

The solving engine follows Peter Norvig's constraint-propagation approach.
Nightmare draws from Gordon Royle's published 49,158-puzzle 17-clue catalogue;
imports are checked for unique solvability.

Application code is [MIT licensed](LICENSE). Bundled fonts use SIL OFL 1.1;
see [third-party notices](THIRD_PARTY_NOTICES.md) and [full font licenses](public/licenses/).
