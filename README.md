# Sudoku Solver

A fast, browser-based sudoku solver and player with runtime puzzle generation, pencil marks, and a polished gameplay experience. No dependencies, no build step — just open `index.html`.

## Modes

The app has two modes, toggled via tabs at the top:

### Solver Mode

Paste or type a puzzle and solve it instantly. The solver implements Peter Norvig's constraint propagation strategy combined with depth-first search and the Minimum Remaining Values (MRV) heuristic. Most puzzles solve in under 5 milliseconds.

### Play Mode

Play sudoku puzzles with built-in hints, pencil marks, undo/redo, and more.

- **6 difficulty levels** — Easy, Medium, Hard, Expert, Evil, Nightmare
- **Auto-generated puzzles** — Each "New Game" creates a fresh puzzle with a guaranteed unique solution using constraint propagation
- **Pencil marks / Notes** — Toggle with `N`, type digits to add/remove small candidate marks in cells. Notes auto-clear when you place a digit or when peers eliminate a candidate.
- **Hints** — Reveals one correct cell in amber (press `H`)
- **Error checking** — Click "Check" or press `Enter` to highlight incorrect entries
- **Conflict detection** — Real-time: duplicates in the same row/column/box flash orange immediately
- **Digit highlighting** — Focus a cell and all matching digits across the grid get a subtle glow
- **Undo / Redo** — `Ctrl+Z` / `Ctrl+Y` with full history
- **Timer** — Counts up during gameplay
- **Win detection** — Celebration overlay with your time and hint count
- **Save / Resume** — Game auto-saves to localStorage; offers to resume on reload
- **Stats** — Tracks games played, best time, and average time per difficulty

## Input Methods (Solver Mode)

| Method | How to use |
|---|---|
| **Click and type** | Click any cell and type a digit (1-9). Auto-advances to next empty cell. |
| **Quick paste** | Press `Ctrl+V` with an 81-character puzzle string on the clipboard. |
| **Import modal** | Press `Ctrl+I`. Paste an 81-char string or 9 lines of 9 digits. |
| **Example loader** | Click Example to cycle through 55+ built-in puzzles. |

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
  style.css           Dark theme styles and animations
  solver.js           Constraint propagation + backtracking engine
  generator.js        Runtime puzzle generator with uniqueness verification
  puzzles.js          55+ fallback puzzles across 6 difficulty levels
  app.js              UI controller (modes, notes, undo, stats, save)
  Dockerfile          Nginx-alpine container
  docker-compose.yml  Traefik-ready compose with volume mounts
  nginx.conf          Nginx server config
```

## Running Locally

Open `index.html` in any modern browser. No server required.

```bash
# Or use a dev server:
python3 -m http.server 8000
```

## Deploying with Docker + Traefik

```bash
docker compose up -d --build
```

The `docker-compose.yml` routes to `sudoku.local.nirbslab.com` via Traefik. Source files are volume-mounted for live editing — edit and refresh, no rebuild needed.

**Without Traefik:** Replace the Traefik labels with `ports: ["8080:80"]` in `docker-compose.yml`.

See the compose file for customization options (network name, entrypoint, cert resolver).

## Browser Compatibility

Tested in Chrome, Firefox, Safari, and Edge. Requires ES6 support.
