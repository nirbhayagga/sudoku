# Sudoku

A fast, browser-based sudoku solver and player with 5,500 pre-generated puzzles, 7 color themes, pencil marks, a self-hosted leaderboard, and a polished gameplay experience. No dependencies, no build step — just open `index.html`.

## Modes

The app has two modes, toggled via tabs at the top:

### Play Mode

Play sudoku puzzles with built-in hints, pencil marks, undo/redo, and more.

- **6 difficulty levels** — Easy, Medium, Hard, Expert, Evil, Nightmare
- **5,500 pre-generated puzzles** — 500 per difficulty (Easy–Evil) + 3,000 Nightmare (17-clue), served instantly from a puzzle bank
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
- **Pause** — Pause the timer and blur the grid to prevent peeking
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
  Dockerfile          Nginx-alpine container for frontend
  docker-compose.yml  Compose config (local build, recommended)
  docker-compose.remote.yml  Compose config (builds from git repo)
  nginx.conf          Nginx config (proxies /api/ to leaderboard)
  leaderboard-api/    Self-hosted leaderboard backend
    server.js         Express.js API (scores stored in JSON file)
    package.json      Dependencies
    Dockerfile        Node.js container
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

## Deploying with Docker

Two compose files are included for different deployment strategies:

| File | Build Source | Best For |
|------|-------------|----------|
| `docker-compose.yml` | Local directory | Fastest builds, test before committing |
| `docker-compose.remote.yml` | Git repo URL | Deploy without cloning repo on host |

### Option A: Local Build (recommended)

Clone the repo on your server and build from the local directory:

```bash
git clone https://git.local.nirbslab.com/nirb/sudoku.git
cd sudoku
docker compose up -d --build
```

To update:

```bash
git pull
docker compose up -d --build
```

### Option B: Remote Build (from Git repo)

Build directly from the Forgejo repo — no local clone needed. All changes **must be committed and pushed** before rebuilding.

```bash
docker compose -f docker-compose.remote.yml up -d --build
```

### Without Traefik (standalone)

For either option, uncomment the `ports` line and remove the Traefik labels/network:

```yaml
services:
  sudoku:
    build: .
    ports:
      - "8080:80"
    depends_on:
      - leaderboard
  leaderboard:
    build: ./leaderboard-api
    volumes:
      - leaderboard-data:/app/data
volumes:
  leaderboard-data:
```

The app will be available at `http://localhost:8080`.

## Graceful Degradation

The app is designed to work in three modes:

1. **Full Docker deployment** — Frontend + Leaderboard API (full features)
2. **Local dev server** — `python3 -m http.server` + `node leaderboard-api/server.js` (full features)
3. **Just open `index.html`** — No server needed; leaderboard hidden, everything else works

## Browser Compatibility

Tested in Chrome, Firefox, Safari, and Edge. Full mobile support for iOS and Android.

- **iPhone** — Safe-area insets for notch/Dynamic Island, iOS Safari bounce prevention, 16px minimum font to prevent auto-zoom, landscape support, compact layout for iPhone SE/Mini
- **Android** — Touch-friendly numpad, responsive grid scaling, no virtual keyboard interference
- **Tablet** — Adaptive cell sizing, works in both portrait and landscape
