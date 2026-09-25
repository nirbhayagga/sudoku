# Controls and sharing

Play mode provides a bank level selector and date-derived daily puzzle. A daily
key represents a local calendar date. Scores from all levels in a difficulty
share one leaderboard; there is no daily-only or per-level ranking.

On desktop, select a cell and type. Touch devices use the on-screen numpad.
On touch, the manual Notes toggle lives beside Erase; the action row keeps Fill
notes and Auto-notes without duplicating that toggle.
Shortcuts are shown by default on keyboard devices and collapsed on touch.
Show/Hide remembers your choice. Board shortcuts apply with a grid cell focused;
form fields keep their normal editing behavior. Ctrl shortcuts also accept Cmd
on macOS. Modified digits are left to the browser or operating system.

| Key | Solver | Play |
|---|---|---|
| 1–9 | Enter digit | Enter digit / toggle note |
| 0, Delete, Backspace | Clear cell | Clear cell / notes |
| Arrow keys | Navigate | Navigate |
| Enter | Solve | Check errors / clear marked errors |
| Escape | Close dialog / deselect | Close dialog / cancel preview / deselect |
| N | — | Toggle notes |
| A | — | Toggle auto-notes |
| F | — | Fill notes once |
| H | — | Free preview / reveal (+1 hint) |
| P | — | Pause / resume |
| Ctrl+Z | — | Undo |
| Ctrl+Y / Ctrl+Shift+Z | — | Redo |
| Ctrl+I | Import | Import |
| Ctrl+V | Paste grid | — |

Escape never clears or resets a puzzle; use the labelled buttons for those actions.
Escape closes an open dialog before applying a board shortcut. Auto-notes derive
candidates from the visible board, not the solution. Wrong placements are counted
but the count is shown at the win, rather than revealing errors as you type.

**Notes** lets you enter pencil marks yourself. **Fill notes** generates visible
candidates once, leaving them editable; it is the lighter assistance option.
**Auto-notes** keeps them updated after every move and disables manual note edits
while enabled. Both include single candidates. Hiding singles would make the
candidate list incomplete, so neither mode does that. Undo restores the previous
notes and manual/live mode, and undoing a digit restores affected peer notes.
Using either generated-notes option marks the game as assisted even after undo.

Hint explanations use visible candidates. If an earlier entry is wrong, the
hint offers a verified correction instead of reasoning from that mistake. When
no supported deduction is available, it explicitly offers the verified answer.
**Hint (free)** always previews before filling anything, including for a selected
cell. The status says **Explained hint** when there is a deduction, or **Answer
preview** when the offer uses the verified solution without that explanation.
**Reveal (+1 hint)** is the only step that fills the cell and increments the hint
count, even if you later undo it. Selecting another cell cancels the old preview.
On touch, tap the status text to clear selection and let the engine choose a cell.
Advanced searches show a cancel action and run without blocking the page.
**Follow the explanation** expands candidate exclusions and chain implications.
These deductions are kept separately from your pencil marks and do not change
what Auto-notes shows. A board edit invalidates the old proof.
Leaderboard ordering uses time alone; hints, mistakes, and generated-notes use
are displayed as context.

Import accepts 81 digits/dots, nine rows, or separated grids. `0` and `.` are
empty cells; alternate markers include `*`, `_`, `?`, `x`, `X`, and `-`.
Use **Import → Play puzzle** for a unique, unfinished standard 9×9 grid, or
**Open in solver** to edit or solve a grid, including one with multiple solutions.
The import preview describes what the current explanation engine can solve; it
is an approximate technique assessment, not an Easy–Nightmare tier. Imported
games have normal timer, notes, hints, undo, completion review, saving, export,
and sharing. They have their own Imported stats row and do not submit bank scores.
An imported puzzle link starts the same board in Play; older raw-grid links still
open in Solver. Imported games also support snapshot handoff while unfinished.
Export offers five formats: `line`, `zeros`, `rows`, `grid`, and `chat`. The boxed
grid needs a monospace font; keycap emoji rendering varies between messaging apps.
The pause panel and completion screen let you export the original puzzle or
current position. Use the dot or zero line for solver interchange. The chat
format avoids space-based alignment, but fonts and narrow message bubbles can
still change its layout. **Save PNG image** gives a fixed grid for messaging;
use Print / Save PDF for paper or a document.

Open **Export → Print / save PDF** to print the selected board, or choose a bank
worksheet from one difficulty. Select **Random, without repeats** or
**Consecutive levels** beginning at a chosen level. Consecutive follows bank
positions; it is not a promise of steadily increasing difficulty. Ranges stop
at the end of the tier, so an oversized request is rejected rather than wrapping.

Choose 1, 2, 4, or 6 grids per page, then enter either the total number of puzzles
or the number of puzzle pages. A batch contains at most 24 puzzles; for example,
at 6 per page you can request up to 4 puzzle pages. Page-count requests fill each
puzzle page. Optional answers go on separate additional pages, and the preview
shows both counts: 8 puzzles at 4 per page means 2 puzzle pages plus 2 answer pages.
Select the paper size in the browser print dialog and disable browser
headers/footers for a clean worksheet.
Answer pages require a uniquely solvable board; a mistaken or incomplete current
position may need to be replaced by the original puzzle. Drawing worksheets does
not change played levels or statistics. The feature uses the browser's print
dialog and adds no PDF library or network service.

## Generate your own puzzle

Open **Solver → Generate**. Choose a technique level, clue symmetry and an
automatic, exact or ranged clue count. These technique levels describe the
explanation engine rather than the bank's Easy–Nightmare labels. Lower clue
counts are not necessarily harder, and some combinations cannot be reached.

The seed and attempt budget are optional advanced settings. Leaving the seed
empty makes a new one; the result records the seed and settings for reuse.
Generation stays on your device and can be cancelled. When the budget ends
without meeting the target, the closest unique puzzle is clearly labelled.
A timeout does not claim success.

The preview does not replace your board. Choose **Play puzzle**, **Export**, or
**Print / Save PDF** when ready. Generated puzzles play in the Imported category,
with normal saves, notes, hints and sharing; they do not submit bank scores.

## After completion

The result identifies the difficulty, level or generated puzzle, daily date when
applicable, time, hints, mistakes, clue count, and generated-notes usage. Share and
Export remain available. **Review puzzle** returns to the board; **Results** opens
the recorded result again. Undo, edit, and re-solve without recording another win
or replacing the original score. The review clock stays stopped. Review edits can
be saved and resumed in this browser; completed reviews do not support handoff.
Reset explicitly starts a new attempt with fresh statistics and a running clock.


Puzzle links carry a stable board identity, a versioned tier/level or daily date, or an 81-cell grid. Handoff links
carry a snapshot including notes, hints, and elapsed time. Treat that link as
shared game data; it is not a live connection or a backup of personal stats.

Ten themes are available. Choose **System** to follow the OS light/dark setting,
including changes while the app is open. Choose a specific theme to pin it. Automated contrast and layout checks cover selected states;
they are not a guarantee of accessibility in every browser or interaction state.

## Choosing the next puzzle

Leave Level blank and use New Game for a random unplayed board, or type a level
for a specific one. **Random** starts a random board even when Level is filled.
The status line identifies the board being played; changing the next difficulty
does not change the active game or its score. After a win, New Game draws again.
Daily status and completion both include the date, difficulty, and bank level.

## Backups and updates

Open **Stats → Download backup** to save a JSON file containing personal stats,
settings, recent daily completions, played levels, and any saved game. **Restore
backup** validates that file before replacing local data and asks for confirmation.
Keep the file private if it contains a player name or game you do not want shared.
A failed restore attempts to roll back the old values and reports if recovery fails.

When a newly installed service worker takes control, **Update available** lets
you reload deliberately. The app saves an active game before reloading and refuses
to reload if that save fails. A handoff link carries a snapshot, not live sync;
if automatic copying fails, your source save remains until you confirm copying.


## Bank revision 2 (v1.1.0)

In v1.1.0, all 5,500 boards were assigned human-technique tiers, with increasing
levels inside each tier. That release had 192 Nightmare boards.
Easy uses singles, Medium locked candidates, Hard subsets, Expert wings and
uniqueness, Evil static chains, and Nightmare dynamic chains.

This revision deliberately starts fresh bank games, played lists, per-tier stats
and daily completions. Theme, player name, shortcut preference and calendar streak
remain. Previous storage is left under its old keys; there is no automatic
conversion or old-backup restore. Older numbered/daily/handoff links display a
bank-change notice rather than opening a different board. Raw grid links still
work. New shared bank links carry a stable board identity.

## More classic challenges (v1.2.0)

The 9×9 bank now has 5,692 puzzles, including 384 Expert and 256 Nightmare.
Nightmare 256 is highest under the app's observed-path policy. Added puzzles are
inserted in technique order, so a display level may move. Content-ID share links,
saved games and self-hosted stored scores still follow the same board. Daily uses
its original pool, preserving existing dates. v1.1 stats and backups remain usable.

Use the board-size selector for 4×4 or 6×6. Their controls include notes, hints,
generation, imports, exports and bulk printing; see [small boards](small-boards.md).
Full progression, technique practice and selected rule variants are planned for
v1.3; small boards already remember completions and offer Next challenge.
