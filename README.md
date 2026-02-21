# Sudoku

A fast, browser-based sudoku solver and player with 5,500 pre-generated puzzles, 5 color themes, pencil marks, and a polished gameplay experience. No dependencies, no build step — just open `index.html`.

## Modes

The app has two modes, toggled via tabs at the top:

### Play Mode

Play sudoku puzzles with built-in hints, pencil marks, undo/redo, and more.

- **6 difficulty levels** — Easy, Medium, Hard, Expert, Evil, Nightmare
- **5,500 pre-generated puzzles** — 500 per difficulty (Easy–Evil) + 3,000 Nightmare (17-clue), served instantly from a puzzle bank. Play a specific level or random ones.
- **7 color themes** — Midnight (dark), Sakura (pink/cream), Ocean (blue-teal), Forest (green), Arctic (light), Naruto (orange), Wicked (emerald) — saved in localStorage
- **Global & Local Leaderboard** — Track your times against others (if using the provided API backend), or just locally in your browser. Gracefully delegates to local if the backend is down.
- **Pencil marks / Notes** — Toggle with `N`, type digits to add/remove candidate marks
- **Hints** — Reveals one correct cell in amber (press `H`)
- **Error checking** — Click "Check" or press `Enter` to highlight incorrect entries
- **Target & Keypad Highlighting** — Focus a cell to see all matching digits glow. Or, tap a number on the mobile keypad without focusing a cell to instantly highlight all occurrences on the board.
- **Keypad Completing** — Once a number has been placed 9 times on the board, its mobile keypad button fades out automatically.
- **Conflict detection** — Duplicates in the same row/column/box flash orange immediately
- **Undo / Redo** — `Ctrl+Z` / `Ctrl+Y` with full history
- **Timer** — Counts up during gameplay
- **Save / Resume** — Game auto-saves to localStorage; offers to resume on reload
- **Stats** — Tracks games played, best time, and average time per difficulty
- **Mobile optimized** — Native-feeling header, segmented control tabs, on-screen numpad, touch-friendly targets, no virtual keyboard popup

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
  backend/            SQLite + Node.js backend for Global Leaderboard (`server.js`)
  Dockerfile          Nginx-alpine container for the frontend
  docker-compose.yml  Compose config (Traefik or standalone + backend API)
  nginx.conf          Nginx server config (used inside the Docker image)
```

## Running Locally (No Server Needed)

You don't need to deploy anything to play—just open `index.html` in any modern browser.

> [!NOTE]
> If you run the game directly from `index.html` without the backend, the Global Leaderboard API will gracefully fail silently. The app will continue tracking your statistics tracking fully locally without throwing errors.

If you prefer to run a local dev server:

```bash
python3 -m http.server 8000
```

## Deploying with Docker (Full Setup)

To use the **Global Leaderboard** feature and serve the app cleanly online, use Docker. This spins up the Nginx frontend, the Node.js API, and connects them.

### With Traefik (default)

The included `docker-compose.yml` builds the frontend and backend directly from the repo and routes via Traefik. The backend lives at `/api`:

```bash
docker compose up -d --build
```

This serves the app at `sudoku.local.nirbslab.com` via HTTPS.

### Without Traefik (standalone)

If you are not using Traefik, uncomment the `ports` lines in `docker-compose.yml` for the frontend and remove the Traefik labels/networks:

```yaml
services:
  sudoku:
    build:
      context: https://git.local.nirbslab.com/nirb/sudoku.git
    container_name: sudoku
    restart: unless-stopped
    ports:
      - "8080:80"
  
  sudoku-api:
    build: ./backend
    # ...
```

Then run:

```bash
docker compose up -d --build
```

The app will be available at `http://localhost:8080`, safely communicating with its Node backend in the Docker network.

### Updating the App

To deploy the latest code from the repository, just rebuild:

```bash
docker compose up -d --build
```

## Nginx Config

The `nginx.conf` is baked into the Docker frontend image. It handles:
- Static file serving
- Routing `/api/` traffic to the backend node application (`sudoku-api:3000`)
- JS/CSS caching (`1 hour`) with `index.html` caching disabled (always fetch fresh)
- Gzip compression and Security headers

## Browser Compatibility

Tested in Chrome, Firefox, Safari, and Edge. Full mobile support for iOS and Android with responsive layouts and touch-friendly controls.
