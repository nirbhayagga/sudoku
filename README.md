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
- **Mobile optimized** — On-screen numpad, touch-friendly targets, no virtual keyboard popup
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
  docker-compose.yml  Compose config (frontend + leaderboard API)
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

## Deploying with Docker

### With Traefik (default)

The included `docker-compose.yml` builds both services from the Forgejo repo:

```bash
docker compose up -d --build
```

This serves the app at `sudoku.local.nirbslab.com` via HTTPS, with nginx proxying `/api/` requests to the leaderboard container. Scores persist in a Docker volume (`leaderboard-data`).

### Without Traefik (standalone)

For standalone deployment, uncomment the `ports` line and remove the Traefik labels and network:

```yaml
services:
  sudoku:
    build:
      context: .
    ports:
      - "8080:80"
    depends_on:
      - leaderboard
  leaderboard:
    build:
      context: ./leaderboard-api
    volumes:
      - leaderboard-data:/app/data
volumes:
  leaderboard-data:
```

The app will be available at `http://localhost:8080`.

### Updating

```bash
docker compose up -d --build
```

Docker clones the repo fresh and rebuilds both images.

## Graceful Degradation

The app is designed to work in three modes:

1. **Full Docker deployment** — Frontend + Leaderboard API (full features)
2. **Local dev server** — `python3 -m http.server` + `node leaderboard-api/server.js` (full features)
3. **Just open `index.html`** — No server needed; leaderboard hidden, everything else works

## Browser Compatibility

Tested in Chrome, Firefox, Safari, and Edge. Full mobile support for iOS and Android.
