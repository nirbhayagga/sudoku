# Sudoku

A fast, browser-based sudoku solver and player with 5,500 pre-generated puzzles, 7 color themes, pencil marks, a self-hosted leaderboard, and a polished gameplay experience. No runtime dependencies and no build step required — just open `index.html`.

## Modes

The app has two modes, toggled via tabs at the top:

### Play Mode

Play sudoku puzzles with built-in hints, pencil marks, undo/redo, and more.

- **6 difficulty levels** — Easy, Medium, Hard, Expert, Evil, Nightmare, graded by measured solving effort rather than clue count alone
- **5,500 pre-generated puzzles** — 500 per difficulty (Easy–Evil) + 3,000 Nightmare (the hardest 17-clue puzzles from the published 49,158-puzzle catalogue), served instantly from a puzzle bank
- **Level selector** — Enter a specific level number or leave blank for a random puzzle
- **7 color themes** — Midnight, Sakura, Ocean, Forest, Arctic, Naruto, Wicked — saved in localStorage
- **Digit highlighting** — Focus a cell and all matching digits glow across the board (works on both desktop and mobile)
- **Numpad completion** — Completed digits (placed 9 times) are greyed/crossed out on the mobile numpad
- **Pencil marks / Notes** — Toggle with `N`, type digits to add/remove candidate marks
- **Hints** — Reveals one correct cell in amber (press `H`)
- **Error checking** — Click "Check" or press `Enter` to highlight incorrect entries
- **Conflict detection** — Duplicates in the same row/column/box flash orange immediately
- **Undo / Redo** — `Ctrl+Z` / `Ctrl+Y` with full history
- **Timer** — Counts up during gameplay
- **Win detection** — Celebration overlay with your time and hint count
- **Save / Resume** — Game auto-saves to localStorage; offers to resume on reload
- **Stats** — Tracks games played, best time, and average time per difficulty
- **Leaderboard** — Submit scores to a self-hosted leaderboard (optional; app works fine without it)
- **Mobile optimized** — On-screen numpad, touch-friendly 44px targets, no virtual keyboard popup, safe-area-inset support for iPhone notch/Dynamic Island, landscape mode handling
- **Pause** — Freezes the timer, blurs the grid, and blocks all input until resumed
- **Force Update** — Button in theme dropdown to reload with cache-busting

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
| `H` | — | Reveal a hint |
| `Ctrl+Z` | — | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | — | Redo |
| `Ctrl+I` | Open import modal | — |
| `Ctrl+V` | Quick paste | — |

## Project Structure

```
sudoku_solver/
  index.html          Main page
  style.css           Styles, themes, and animations
  solver.js           Constraint propagation + backtracking engine
  generator.js        Runtime puzzle generator with uniqueness verification
  puzzle-bank.js      5,500 pre-generated puzzles across 6 difficulty levels
  app.js              UI controller (modes, themes, notes, undo, stats, save)

  build.js            Optional build — minified, content-hashed dist/
  eslint.config.js    Lint rules
  vitest.config.js    Test config
  scripts/serve.js    Dependency-free dev server with /api/ proxy
  scripts/generate-bank.js  Regenerate or reorder a difficulty tier
  tests/              Test suite (229 tests)

  Dockerfile          Multi-stage build -> nginx-alpine
  nginx.conf.template Nginx config (envsubst at container start)
  docker-compose.yml            Local build, Traefik (recommended)
  docker-compose.remote.yml     Builds from git repo
  docker-compose.standalone.yml No Traefik, localhost:8080
  netlify.toml / _headers       Static host build + cache settings

  leaderboard-api/    Self-hosted leaderboard backend
    server.js         Express.js API (scores stored in JSON file)
    package.json      Dependencies
    Dockerfile        Node.js container
```

## Development

The source tree runs directly — there is no build step required at any point.
The tooling below is optional and exists for deployment and safety nets.

```bash
npm install                     # dev dependencies (esbuild, eslint, vitest)
npm ci --prefix leaderboard-api # leaderboard deps, needed for its tests

npm run dev      # serve the source tree at :8000, proxying /api/ to :3001
npm run lint     # eslint
npm test         # 229 tests
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

### Tests

| File | Covers |
|---|---|
| `tests/solver.test.js` | Solving, validation, solution counting, malformed input |
| `tests/generator.test.js` | Uniqueness, clue targets, solution consistency |
| `tests/puzzle-bank.test.js` | All 5,500 puzzles: format, ids, clue counts, solvability |
| `tests/app.dom.test.js` | Full UI in jsdom — play, solver, notes, hints, undo, save/resume, themes |
| `tests/leaderboard-api.test.js` | API routes, validation, sanitisation, rate limiting |
| `tests/build.test.js` | Build output shape, determinism, and that the bundle still runs |

```bash
npx vitest run tests/solver.test.js      # one file
npx vitest -t "detects a completed"      # one test by name
npm run test:watch                       # watch mode
FULL_BANK_CHECK=1 npm test               # verify all 5,500 puzzles, not a sample
```

By default the bank suite checks a deterministic 100-puzzle sample per
difficulty (~1s). `FULL_BANK_CHECK=1` verifies every puzzle (~10s) and is what
CI runs.

The frontend files are plain `<script>` globals rather than modules, so tests
load them through `tests/helpers/load-globals.js` (a `vm` context) or
`tests/helpers/boot-app.js` (jsdom with the real `index.html`).

## The Build Step

`npm run build` writes `dist/`: the four scripts concatenated and minified into
one file, CSS minified, and `index.html` rewritten to point at them.

The filenames carry a content hash (`app.a1b2c3d4.js`), which is the point — a
file's name changes whenever its bytes do, so assets can be cached forever while
`index.html` stays uncached. Stale CSS on a phone after a deploy becomes
impossible, and the "Force Update" button becomes a fallback rather than a
necessity.

The source tree is never modified and stays directly openable.

```bash
npm run build
npm run serve    # build, then serve dist/ at :8000

# Point a static deployment at a leaderboard hosted elsewhere:
SUDOKU_API_BASE=https://sudoku-api.example.com npm run build
```

## Running Locally

Open `index.html` in any modern browser. No server required. The leaderboard will be unavailable but everything else works perfectly.

```bash
# Or use a dev server:
python3 -m http.server 8000
```

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

```bash
git clone https://git.example.com/nirb/sudoku.git
cd sudoku
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
`dist/_headers` sets long-lived caching for hashed assets and no-cache for
`index.html`; Cloudflare Pages and Netlify both read it.

| Host | Setup |
|---|---|
| **Cloudflare Pages** | Build command `npm run build`, output directory `dist` |
| **Netlify** | `netlify.toml` is committed — connect the repo |
| **GitHub Pages** | `.github/workflows/pages.yml` deploys on push to `main` |
| **S3 / any nginx** | Upload `dist/`; mirror the `_headers` rules in your config |

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

## Continuous Integration

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

## Browser Compatibility

Tested in Chrome, Firefox, Safari, and Edge. Full mobile support for iOS and Android.

- **iPhone** — Safe-area insets for notch/Dynamic Island, iOS Safari bounce prevention, 16px minimum font to prevent auto-zoom, landscape support, compact layout for iPhone SE/Mini
- **Android** — Touch-friendly numpad, responsive grid scaling, no virtual keyboard interference
- **Tablet** — Adaptive cell sizing, works in both portrait and landscape
