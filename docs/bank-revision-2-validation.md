# Revision 2: independent comparison and release checks

The [published ordering](bank-revision-2.md) retains the same 5,500 boards. The
Sudoku Explainer measurements below join the existing full-bank SE results to
the new tiers **by the exact puzzle string**, not by an old level number.
No SE score is used to choose a tier or break a tie.

| New tier | Boards | SE ER minimum | Median | P90 | Maximum |
|---|---:|---:|---:|---:|---:|
| Easy | 1,493 | 1.2 | 1.2 | 2.0 | 2.3 |
| Medium | 1,570 | 1.7 | 2.6 | 2.6 | 2.8 |
| Hard | 997 | 2.0 | 2.6 | 3.4 | 4.2 |
| Expert | 256 | 3.2 | 4.2 | 5.6 | 5.6 |
| Evil | 992 | 4.6 | 7.1 | 7.2 | 7.4 |
| Nightmare | 192 | 7.2 | 8.3 | 8.9 | 9.1 |

Median is the upper middle observation; P90 uses nearest rank. The former
Nightmare median was 2.6 versus Evil's 7.1. The new grouping removes that broad
inversion, but neighboring bands still overlap under SE: for example, Evil can
reach 7.4 while Nightmare starts at 7.2. A technique policy cannot promise the
same subjective difficulty order for every solver or every person.

The [original full-bank comparison](full-bank-se-comparison-v4.md) records the
SE release, JAR hash, normalized-data hash and original tier results. Reproduce
with the current bank using `scripts/assess-v4.js --all`, then the existing
`scripts/compare-se.js` and the same pinned SE executable/results. This reruns
the assessment under the new labels without overwriting the historical report.

All 5,500 original grids and their three tested transformations are solvable
with the maintenance explanation profile. The single orientation-sensitive
family result is documented in the bank policy. No unresolved external benchmark
is added to the bank or assigned a speculative hardest rating.

Release validation covers bank membership and uniqueness, identity collisions,
ordered grading keys and independently reassessed tier boundaries; storage,
sharing and optional API revision boundaries; normal and standalone builds;
Chromium/mobile/iPhone WebKit, all ten themes, and Docker-compatible image builds
with non-root API persistence across restart. The static hosted app needs no
leaderboard or server migration.
