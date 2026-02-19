# Sudoku

A fast, browser-based sudoku solver and player with 5,500 pre-generated puzzles, 5 color themes, pencil marks, and a polished gameplay experience. No dependencies, no build step — just open `index.html`.

## Modes

The app has two modes, toggled via tabs at the top:

### Play Mode

Play sudoku puzzles with built-in hints, pencil marks, undo/redo, and more.

- **6 difficulty levels** — Easy, Medium, Hard, Expert, Evil, Nightmare
- **5,500 pre-generated puzzles** — 500 per difficulty (Easy–Evil) + 3,000 Nightmare (17-clue), served instantly from a puzzle bank. Generator fallback for Easy–Evil.
- **5 color themes** — Midnight (dark), Sakura (pink/cream), Ocean (blue-teal), Forest (green), Arctic (light) — saved in localStorage
- **Pencil marks / Notes** — Toggle with `N`, type digits to add/remove candidate marks
- **Hints** — Reveals one correct cell in amber (press `H`)
- **Error checking** — Click "Check" or press `Enter` to highlight incorrect entries
- **Conflict detection** — Duplicates in the same row/column/box flash orange immediately
- **Digit highlighting** — Focus a cell and all matching digits get a subtle glow
- **Undo / Redo** — `Ctrl+Z` / `Ctrl+Y` with full history
- **Timer** — Counts up during gameplay
- **Win detection** — Celebration overlay with your time and hint count
- **Save / Resume** — Game auto-saves to localStorage; offers to resume on reload
- **Stats** — Tracks games played, best time, and average time per difficulty
- **Mobile optimized** — On-screen numpad, touch-friendly targets, no virtual keyboard popup

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
  Dockerfile          Nginx-alpine container
  docker-compose.yml  Compose config (Traefik or standalone)
  nginx.conf          Nginx server config (used inside the Docker image)
```

## Running Locally

Open `index.html` in any modern browser. No server required.

```bash
# Or use a dev server:
python3 -m http.server 8000
```

## Deploying with Docker

### With Traefik (default)

The included `docker-compose.yml` builds the image directly from the Forgejo repo and routes via Traefik:

```bash
docker compose up -d --build
```

This serves the app at `sudoku.example.com` via HTTPS.

### Without Traefik (standalone)

For standalone deployment, uncomment the `ports` line and remove the Traefik labels and network:

```yaml
services:
  sudoku:
    build:
      context: https://git.example.com/nirb/sudoku.git
    container_name: sudoku
    restart: unless-stopped
    ports:
      - "8080:80"
```

Then run:

```bash
docker compose up -d --build
```

The app will be available at `http://localhost:8080`.

### Updating

To deploy the latest code, just rebuild:

```bash
docker compose up -d --build
```

Docker clones the repo fresh and rebuilds the image.

## Nginx Config

The `nginx.conf` is used inside the Docker image (baked in via the Dockerfile). It handles:
- Static file serving
- JS/CSS caching (1 hour)
- Gzip compression
- Security headers

You don't need nginx installed locally — it's only used inside the container.

## Browser Compatibility

Tested in Chrome, Firefox, Safari, and Edge. Full mobile support for iOS and Android.
