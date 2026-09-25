# Sudoku

Browser-based Sudoku player and solver: 5,692 classic 9×9 puzzles, plus 36 minimal
4×4 puzzle classes and 120 curated 6×6 challenges. Six 9×9 difficulty tiers, ten
themes, hints, pencil marks, daily puzzles, and offline play after caching.
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

**Progression and practice** offers a saved, self-paced path and 56 lessons across
14 techniques. The 9×9 **Rules** selector adds Diagonal and Hyper, with 24 curated
puzzles each. See [activities](docs/activities.md) for rules, backups, provenance
and repeatable curation tools.

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

All original **5,500 puzzles** are retained, with **192 new Expert and Nightmare
puzzles** added in v1.2. Every 9×9 tier is ordered by technique, proof complexity
and deduction workload. Small-board ratings are specific to their size; see
[small classic boards](docs/small-boards.md).

| Tier | Puzzles | Observed solving path |
|---|---:|---|
| Easy | 1,493 | Naked and hidden singles |
| Medium | 1,570 | Locked candidates: pointing and claiming |
| Hard | 997 | Naked and hidden subsets |
| Expert | 384 | Wings, fish and uniqueness patterns |
| Evil | 992 | Static forcing chains |
| Nightmare | 256 | Dynamic chains and forcing convergence |

Choose a higher level for a harder path under this policy. **Nightmare 256** is
the highest-ranked current board; this is an engine-defined ordering, not a
promise that every person will find it hardest. Clue count is not the ranking.
See [bank revision 2](docs/bank-revision-2.md) for the exact order, transformation
checks, boundaries and repeatable commands for the v1.1 collection. The
[v1.2 expansion](docs/bank-expansion-1.2.md) records the additions and reproducible
selection; [current measurements](docs/bank-expansion-1.2-validation.md) show
min/median/P90/max for every expanded tier. The [independent validation](docs/bank-revision-2-validation.md) includes
min/median/P90/max SE measurements for the v1.1 tiers, not the new additions.
Content identities survive display reordering. v1.2 preserves v1.1 saves, stats
and the Daily pool; display levels can move. No puzzle has been removed.

The [v4 assessment](docs/puzzle-assessment-v4.md) explains the original 5,500 boards
with checked deductions; the same engine verifies every added board. Browser
hints and imported-puzzle assessment share its rules
with smaller work budgets, so an interactive assessment can reach its limit.
Candidate maps and proof details are available in the free hint preview. The
seeded generator retains its v2 targeting policy for reproducibility.
The [independent SE comparison](docs/full-bank-se-comparison-v4.md) benchmarks
technique bands; its scores are not interchangeable with ours. Earlier reports
remain available with their original level references. The harder external
benchmark explains 40/80 sampled boards; unresolved boards remain unranked.

The [engine review](docs/sudoku-explainer-review.md) and
[adoption roadmap](docs/sudoku-adoption-roadmap.md) describe implemented techniques
and future sizes, variants and practice features.

The initial JavaScript entry stays below **32 KiB gzipped**. The puzzle bank and
analysis worker are loaded on demand; the bank is about 123 kB gzipped. Tests cap
all compressed assets plus the service worker at **285 KiB**, including the bundled
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
The bank includes 3,000 puzzles from Gordon Royle's published 49,158-puzzle
17-clue catalogue, now distributed across technique tiers. Imports are checked
for unique solvability.

Application code is [MIT licensed](LICENSE). Bundled fonts use SIL OFL 1.1;
see [third-party notices](THIRD_PARTY_NOTICES.md) and [full font licenses](public/licenses/).
