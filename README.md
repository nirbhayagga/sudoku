# Sudoku

Sudoku player and solver with 5,500 puzzles graded by measured solving effort
rather than clue count. Installable PWA, plays offline, 20 kB first load, zero
runtime dependencies.

Difficulty is set by how much search a puzzle actually needs beyond pure logic,
not by how many clues it starts with — two puzzles with the same number of
givens routinely differ tenfold in effort. The Nightmare tier is the hardest
3,000 of the published 49,158 seventeen-clue puzzles, the proven minimum.

There is no framework and nothing to install to play: the standalone build is a
single self-contained script that runs straight off the filesystem.

## Modes

The app has two modes, toggled via tabs at the top:

### Play Mode

Play sudoku puzzles with built-in hints, pencil marks, undo/redo, and more.

- **6 difficulty levels** — Easy, Medium, Hard, Expert, Evil, Nightmare, graded by measured solving effort rather than clue count alone
- **5,500 pre-generated puzzles** — 500 per difficulty (Easy–Evil) + 3,000 Nightmare (the hardest 17-clue puzzles from the published 49,158-puzzle catalogue), served instantly from a puzzle bank
- **Level selector** — Enter a specific level number or leave blank for a random puzzle
- **Share a puzzle** — Copy a link to the board you are on: `?d=evil&level=42` for a bank puzzle, `?p=<81 digits>` for any grid, `?daily=YYYY-MM-DD` for a day. Opening one loads it straight away
- **Daily puzzle** — One board a day, derived from the date so everyone gets the same one; difficulty ramps across the week and the leaderboard for that level compares like with like
- **7 color themes** — Midnight, Sakura, Ocean, Forest, Arctic, Naruto, Wicked — saved in localStorage, all meeting WCAG AA contrast
- **Digit highlighting** — Focus a cell and all matching digits glow across the board (works on both desktop and mobile)
- **Numpad completion** — Completed digits (placed 9 times) are greyed/crossed out on the mobile numpad
- **Pencil marks / Notes** — Toggle with `N`, type digits to add/remove candidate marks
- **Auto-notes** — Toggle with `A`: fills every empty cell with the digits its row, column and box still allow, and keeps them current as you play. Derived from the board, never from the solution — it reveals no answers, but it does remove the scanning, so games that used it are marked on the leaderboard and in stats
- **Hints** — Press `H`. With a cell selected it reveals that one; otherwise it picks a cell you could actually deduce right now — a naked single, or the only home left for a digit in some unit — and says which (`R4C7 — the only place for 7 in this box`)
- **Error checking** — Click "Check" or press `Enter` to highlight incorrect entries
- **Conflict detection** — Duplicates in the same row/column/box flash orange immediately
- **Undo / Redo** — `Ctrl+Z` / `Ctrl+Y` with full history
- **Timer** — Counts up during gameplay
- **Win detection** — Celebration overlay with your time and hint count
- **Save / Resume** — Game auto-saves to localStorage; offers to resume on reload
- **Stats** — Games solved, win rate, daily streak, best and average time, hints and auto-notes used, per difficulty and overall
- **Leaderboard** — Submit scores to a self-hosted leaderboard (optional; app works fine without it)
- **Accessible** — Live-announced status, labelled cells, dialogs with focus trapping and Escape to close, pinch zoom enabled
- **Mobile optimized** — On-screen numpad, touch-friendly 44px targets, no virtual keyboard popup, safe-area-inset support for iPhone notch/Dynamic Island, landscape mode handling
- **Pause** — Freezes the timer, blurs the grid, and blocks all input until resumed
- **Installable / offline** — Add to home screen and play with no network

### Solver Mode

Paste or type a puzzle and solve it instantly. Uses constraint propagation + backtracking with the MRV heuristic — most puzzles solve in under 5 ms.

Switching from Play → Solver retains your current puzzle so you can have the solver finish it.

## Input Methods (Solver Mode)

| Method | How to use |
|---|---|
| **Click and type** | Click any cell and type a digit (1-9). Auto-advances to next empty cell. |
| **Quick paste** | Press `Ctrl+V` with an 81-character puzzle string on the clipboard. |
| **Import modal** | Press `Ctrl+I`. Paste an 81-char string or 9 lines of 9 digits. |
| **Example loader** | Click Example to cycle through 5,500+ built-in puzzles. |

## Keyboard Shortcuts

| Key | Solver Mode | Play Mode |
|---|---|---|
| `1`-`9` | Enter a digit | Enter digit / Toggle note |
| `0`, `Del`, `Backspace` | Clear cell | Clear cell / notes |
| Arrow keys | Navigate | Navigate |
| `Enter` | Solve | Check for errors |
| `Escape` | Clear grid | Reset puzzle |
| `N` | — | Toggle notes mode |
| `A` | — | Toggle auto-notes |
| `H` | — | Reveal a hint |
| `Ctrl+Z` | — | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | — | Redo |
| `Ctrl+I` | Open import modal | — |
| `Ctrl+V` | Quick paste | — |

## Project Structure

```
sudoku/
  index.html          Main page
  style.css           Styles, themes, and animations
  solver.js           Constraint propagation + backtracking engine
  generator.js        Runtime puzzle generator with uniqueness verification
  puzzle-bank.js      5,500 pre-generated puzzles (bare strings; ids derived at load)
  app.js              UI controller (grid, cell input, play and solver modes)
  format.js           Time and HTML-escaping helpers
  storage.js          All localStorage access, failure-tolerant
  theme.js            Theme application
  dialogs.js          Focus trap, Escape, focus restore for overlays
  leaderboard-client.js  Optional API client

  vite.config.js      Build config — two targets, see The Build
  difficulties.js     Labels and tier sizes, kept out of the lazy bank chunk
  daily.js            Date-derived puzzle of the day
  share.js            Puzzle links: build, parse, clipboard
  sw-template.js      Service worker source (asset list injected at build)
  public/             Copied verbatim into dist/ — manifest, icons, _headers
  eslint.config.js    Lint rules
  vitest.config.js    Test config
  scripts/generate-bank.js  Regenerate or reorder a difficulty tier
  scripts/check-contrast.js Audit (and fix) theme contrast
  tests/              Test suite (460 tests)

  Dockerfile          Multi-stage build -> nginx-alpine
  nginx.conf.template Nginx config (envsubst at container start)
  docker-compose.yml            Local build, Traefik (recommended)
  docker-compose.remote.yml     Builds from git repo
  docker-compose.standalone.yml No Traefik, localhost:8080
  netlify.toml                  Static host build settings

  leaderboard-api/    Self-hosted leaderboard backend
    server.js         Express.js API (scores stored in JSON file)
    package.json      Dependencies
    Dockerfile        Node.js container
```

## Development

```bash
npm install                     # dev dependencies (vite, eslint, vitest)
npm ci --prefix leaderboard-api # leaderboard deps, needed for its tests

npm run dev      # Vite dev server at :8000 with hot reload, /api/ proxied to :3001
npm run lint     # eslint
npm test         # 460 tests
npm run build    # produce dist/
npm run check    # lint + test + build, what CI runs
```

### Regenerating a difficulty tier

Tiers are defined by measured solving difficulty — `SudokuSolver.rateDifficulty()`
returns the search nodes a puzzle needs beyond pure constraint propagation, where
0 means logic alone cracks it. Clue count does not separate tiers on its own:
puzzles with the same number of givens routinely differ tenfold in effort.

```bash
# Generate a large pool, keep the hardest N (dry run writes a .json to inspect)
node scripts/generate-bank.js --difficulty evil --count 500 --pool 6000
node scripts/generate-bank.js --difficulty evil --count 500 --pool 6000 --write

# Keep the same puzzles, just order them easiest to hardest
node scripts/generate-bank.js --difficulty nightmare --reorder --write
```

Both modes verify every puzzle is uniquely solvable before writing, and refuse to
write if any is not.

**A puzzle's position in its array is its level number**, and that number is
recorded in leaderboard entries — so rewriting or reordering a tier invalidates
existing scores for it.

### Theme contrast

```bash
node scripts/check-contrast.js         # report
node scripts/check-contrast.js --fix   # adjust failing colours in place
```

Every theme is checked against WCAG AA (4.5:1) and a test fails the build if one
slips. `--fix` walks a colour's lightness while preserving hue and saturation, so
fixes are the smallest change that passes and the theme still looks like itself.

`--accent` is the saturated brand colour used for borders and glows;
`--accent-text` is its readable counterpart and the only one allowed as a text
colour.

### Tests

| File | Covers |
|---|---|
| `tests/solver.test.js` | Solving, validation, solution counting, malformed input |
| `tests/generator.test.js` | Uniqueness, clue targets, solution consistency |
| `tests/puzzle-bank.test.js` | All 5,500 puzzles: format, ids, clue counts, solvability |
| `tests/app.dom.test.js` | Full UI in jsdom — play, solver, notes, hints, undo, save/resume, themes |
| `tests/leaderboard-api.test.js` | API routes, validation, sanitisation, rate limiting |
| `tests/build.test.js` | Build output shape, determinism, and that the bundle still runs |
| `tests/service-worker.test.js` | Precache manifest, cache lifecycle, and every fetch strategy |
| `tests/format.test.js` | Time formatting and HTML escaping |
| `tests/storage.test.js` | Persistence, including when storage throws |
| `tests/contrast.test.js` | WCAG AA contrast for every theme |
| `tests/daily.test.js` | Deterministic puzzle of the day |
| `tests/share.test.js` | Link building and parsing |

```bash
npx vitest run tests/solver.test.js      # one file
npx vitest -t "detects a completed"      # one test by name
npm run test:watch                       # watch mode
FULL_BANK_CHECK=1 npm test               # verify all 5,500 puzzles, not a sample
```

By default the bank suite checks a deterministic 100-puzzle sample per
difficulty (~1s). `FULL_BANK_CHECK=1` verifies every puzzle (~10s) and is what
CI runs.

Unit tests import the modules directly. UI tests use `tests/helpers/boot-app.js`,
which bundles the app in-memory with esbuild and runs it against the real
`index.html` in jsdom — jsdom cannot execute a module graph itself.

## The Build

The source is ES modules bundled by Vite. `npm run build` writes `dist/`: one
minified JS bundle, one CSS file, and an `index.html` pointing at them.

Filenames carry a content hash (`index.DpVtReIW.js`), which is the point — a
file's name changes whenever its bytes do, so assets can be cached forever while
`index.html` stays uncached. Stale CSS on a phone after a deploy becomes
structurally impossible, which is why the app carries no manual "force refresh"
control: `index.html` is served `no-cache`, the service worker fetches
navigations network-first, and `sw.js` is itself uncached, so a reload always
picks up a new deploy.

There are **two build targets**, because they want opposite things:

| | `npm run build` | `npm run build:standalone` |
|---|---|---|
| Output | `dist/` | `dist-standalone/` |
| Format | ES modules, code-split | One classic-script IIFE |
| Initial load | **~17 kB gzipped** | ~130 kB gzipped |
| Puzzle bank | Separate chunk, fetched on first game | Inlined |
| Service worker | Yes | No |
| Runs from `file://` | No | **Yes** |

The default build splits the puzzle bank out. It is over 90% of the payload and
is not needed to draw the grid, resume a saved game (the board is in
localStorage) or use solver mode, so deferring it takes first load from ~130 kB
to ~17 kB gzipped. The service worker still precaches the chunk, so offline play
is unaffected.

Code splitting only works in ES module format, and browsers refuse to load
module scripts over `file://` (opaque origin, so CORS rejects them). That is why
the standalone target exists: a single classic-script IIFE with everything
inlined, which opens straight off a disk or a USB stick. No single build can do
both.

`base: './'` in both, so assets resolve relatively and the build works from a
subpath — which is how GitHub Pages serves a project site.

```bash
npm run dev              # dev server with hot reload
npm run build            # dist/ — modular, lazy-loaded bank
npm run build:standalone # dist-standalone/ — single file, opens from file://
npm run build:all        # both
npm run preview          # serve the built dist/

# Point a static deployment at a leaderboard hosted elsewhere:
SUDOKU_API_BASE=https://sudoku-api.example.com npm run build
```

Development needs the dev server: `file://` cannot load ES modules, so the raw
source tree is not directly openable even though the standalone build is.

## Running Locally

```bash
npm install
npm run dev      # http://localhost:8000
```

Or build the standalone target and open it with no server at all:

```bash
npm run build:standalone && xdg-open dist-standalone/index.html
```

The leaderboard is unavailable without a backend; everything else works.

## Leaderboard Setup (Optional)

The leaderboard is a lightweight Express.js API that stores scores in a JSON file. It's completely optional — the app auto-detects whether the backend is available and silently hides leaderboard features when it's not.

### Running the leaderboard locally

```bash
cd leaderboard-api
npm install
node server.js
```

The API runs on `http://localhost:3001`. The frontend auto-detects this when opened via `file://` or `localhost`.

The leaderboard API includes rate limiting (5 submissions/minute per IP) and difficulty validation. To restrict CORS to your domain, set the `CORS_ORIGIN` environment variable:

```bash
CORS_ORIGIN=https://sudoku.example.com node server.js
```

## Deploying

Two shapes of deployment, and they can be combined:

| | Frontend | Leaderboard | Best for |
|---|---|---|---|
| **Docker** | nginx container | Express container | Self-hosting the whole thing |
| **Static host** | CDN (Pages/Netlify/S3) | none, or a remote API | Fast public frontend, no servers |

### Docker

| File | Build source | Notes |
|---|---|---|
| `docker-compose.yml` | Local directory | Traefik labels, recommended |
| `docker-compose.remote.yml` | Git repo URL | No clone needed on the host |
| `docker-compose.standalone.yml` | Local directory | No Traefik, `localhost:8080` |

Host and repo come from the environment, so nothing site-specific lives in the
compose files. Copy `.env.example` to `.env` and set them:

```bash
git clone https://github.com/nirb/sudoku.git
cd sudoku
cp .env.example .env      # set SUDOKU_HOST (and SUDOKU_REPO for remote builds)
docker compose up -d --build

# Update:
git pull && docker compose up -d --build
```

The image is multi-stage: Node builds `dist/`, then nginx serves it. Nothing but
the build output ships, and adding a frontend file needs no Dockerfile change.

Frontend-only, no backend at all:

```bash
docker compose -f docker-compose.standalone.yml up -d --build sudoku
```

That works because nginx resolves the leaderboard hostname **per request**
rather than at startup. With a literal upstream hostname nginx refuses to boot
when the backend is missing; via a variable it starts fine, `/api/` returns 502,
and the app hides its leaderboard UI.

Container environment:

| Variable | Default | Purpose |
|---|---|---|
| `NGINX_RESOLVER` | `127.0.0.11` | DNS for the upstream lookup (Docker's embedded DNS) |
| `LEADERBOARD_UPSTREAM` | `http://leaderboard:3001` | Where `/api/` is proxied |

### Static hosting

`npm run build` produces `dist/`, which any static host can serve. The generated
`public/_headers` is copied into `dist/` and sets long-lived caching for hashed assets and no-cache for
`index.html`; Cloudflare Pages and Netlify both read it.

| Host | Setup |
|---|---|
| **Cloudflare Pages** | Build command `npm run build`, output directory `dist` |
| **Netlify** | `netlify.toml` is committed — connect the repo |
| **GitHub Pages** | `.github/workflows/pages.yml` deploys on push to `main` |
| **S3 / any nginx** | Upload `dist/`; mirror the `public/_headers` rules in your config |

A static deployment has no backend, so the leaderboard hides itself. To keep it,
point the frontend at a leaderboard you host (through Traefik, for example):

```bash
SUDOKU_API_BASE=https://sudoku-api.example.com npm run build
```

Set the same value as an environment variable in the host's dashboard (or as the
`SUDOKU_API_BASE` repository variable for GitHub Pages). The API needs a matching
`CORS_ORIGIN`:

```bash
CORS_ORIGIN=https://sudoku.example.com node server.js
```

## Offline / Install

The app is a PWA: it installs to a home screen and plays with no network.

`sw-template.js` is the service worker source; the `pwa()` plugin in
`vite.config.js` reads the finished `dist/` and writes `dist/sw.js` with the
precache list and a cache version derived from the file names. Nothing is
hardcoded, so new icons or assets are picked up automatically.

The caching rules, and the reasoning:

| Request | Strategy | Why |
|---|---|---|
| Navigations | Network first, cache fallback | A stale document would pin clients to old asset hashes, and a bad deploy could not be fixed by reloading |
| Hashed assets | Cache first | The filename changes whenever the bytes do, so a cached copy is never wrong |
| `/api/` | Never cached | Cached scores would be replayed, and a cached health check would report a backend that is down as available |

`sw.js` itself is served `no-cache` (in both `nginx.conf.template` and
`public/_headers`) — a cached service worker cannot be replaced.

There is no service worker in development; `npm run dev` serves none, so there
is nothing to unregister while iterating.

## Continuous Integration

### Dependency updates

`.github/dependabot.yml` watches four ecosystems weekly — frontend dev
dependencies, the leaderboard API, both Dockerfiles' base images, and the
GitHub Actions themselves — and opens PRs for new versions and published
advisories. Routine minor/patch bumps are grouped into one PR; majors stay
separate so they get read. CI runs on each, so a green check means the suite
passed against the new version.

### Lighthouse

`.github/workflows/lighthouse.yml` audits the **built** output on every push and
fails if performance or accessibility drops below the thresholds in
`lighthouserc.json`. It exists to protect what has already been earned: a ~17 kB
initial load and AA contrast on every theme.

PWA installability is deliberately not asserted there — Lighthouse 12 removed
the PWA category, and `tests/service-worker.test.js` already checks the manifest,
icons, precache list and every caching rule directly.

The thresholds are a first estimate. Read the first run's report and move them to
sit just under what the app actually scores.

### Test and build

`.forgejo/workflows/ci.yml` and `.github/workflows/ci.yml` run the same checks —
lint, the full test suite with `FULL_BANK_CHECK=1`, the build, and a Docker build
that asserts the frontend serves standalone with no leaderboard present.

The Forgejo workflow needs a runner registered on your instance
(`forgejo-runner register`); without one the file is simply inert.

## Graceful Degradation

The app runs in four configurations, and detects which one it is in:

1. **Docker, full stack** — frontend + leaderboard
2. **Docker, frontend only** — leaderboard UI hidden
3. **Static host** — leaderboard hidden, or pointed at a remote API
4. **`index.html` opened from disk** — no server at all

Everything except the leaderboard works identically in all four.

## Credits

The Nightmare tier is drawn from the published catalogue of 49,158 known
17-clue sudoku puzzles compiled by Gordon Royle (University of Western
Australia). 17 is the proven minimum: McGuire, Tugemann and Civario showed in
2012 that no 16-clue puzzle with a unique solution exists.

Every imported puzzle is re-verified as uniquely solvable by `solver.js` before
it reaches the bank — see `scripts/generate-bank.js`.

The solving engine follows Peter Norvig's constraint-propagation approach.

## License

MIT — see [LICENSE](LICENSE).

## Browser Compatibility

Tested in Chrome, Firefox, Safari, and Edge. Full mobile support for iOS and Android.

- **iPhone** — Safe-area insets for notch/Dynamic Island, iOS Safari bounce prevention, 16px minimum font to prevent auto-zoom, landscape support, compact layout for iPhone SE/Mini
- **Android** — Touch-friendly numpad, responsive grid scaling, no virtual keyboard interference
- **Tablet** — Adaptive cell sizing, works in both portrait and landscape
