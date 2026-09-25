# Human assessment v4

> Historical assessment of the bank before revision 2. Level references below use that order.
> See [the current bank definitions](bank-revision-2.md); the original measurements are preserved.

**Review report only: no bank reorder or tier changes.**

Explained 5500/5500; other statuses retain no difficulty rank.

Profiles share rules; maintenance compares forward/reverse technique order within the first successful family cap. The selected path minimizes family, deepest proof, largest proof, elimination steps, then total steps. This is a declared selection policy, not a numerical SE grade.

Opening records the first deduction, first placement, preceding exclusions and highest family encountered before that placement. Proof complexity counts branches, nodes and maximum parent depth. Unique rectangles (types 1, 2, 4) and BUG+1 require a separately verified unique puzzle. Every selected move is audited against the complete solver.

| Family | Count | Exclusion steps min / median / p90 / max | Largest proof nodes |
|---|---:|---|---|
| singles | 1493 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| locked-candidates | 1570 | 1 / 3 / 7 / 14 | 0 / 0 / 0 / 0 |
| subsets | 997 | 1 / 8 / 13 / 21 | 0 / 0 / 0 / 0 |
| wings | 152 | 1 / 7 / 14 / 23 | 0 / 0 / 0 / 0 |
| uniqueness | 104 | 0 / 7 / 15 / 22 | 0 / 0 / 0 / 0 |
| chains | 992 | 0 / 12 / 21 / 52 | 6 / 8 / 14 / 18 |
| dynamic-chains | 192 | 3 / 22 / 35 / 48 | 9 / 37 / 58 / 119 |

Transformation checks: 0. Changed observed family: 0 boards. Differences are reported, not silently normalized away.

## Review examples

These sample the minimum, median and maximum workload of each family. No solutions are printed.

- hard 37: singles; 0 exclusions; proof 0 nodes. Board: `520400000008029000009506030071000920900800350005010000000000007050000040042005080`
- medium 82: singles; 0 exclusions; proof 0 nodes. Board: `496130200000000300703020496004500060305000000009004500540009030008050972000000850`
- easy 446: singles; 0 exclusions; proof 0 nodes. Board: `862900301000864000500003900014000008209138407070500190921000000700050010085091270`
- nightmare 190: locked-candidates; 1 exclusions; proof 0 nodes. Board: `000000000000001002003000045000000000006240000070000100000008000000107900504000006`
- nightmare 837: locked-candidates; 3 exclusions; proof 0 nodes. Board: `000000000000001023045060000000000400000002000006000507000070000020500000380000010`
- nightmare 2745: locked-candidates; 14 exclusions; proof 0 nodes. Board: `000000000000001002034000005000000030100000060205070000000503040000800000700000009`
- expert 167: subsets; 1 exclusions; proof 0 nodes. Board: `000400907009001060127060003006359000000074005000002000071030006068000030000000000`
- nightmare 1233: subsets; 8 exclusions; proof 0 nodes. Board: `000000000000001002003000040000000035000000460070008000000030700090000100500460000`
- nightmare 2757: subsets; 21 exclusions; proof 0 nodes. Board: `000000001000000020000034000000000500006000300007102000030060400050000000480000009`
- medium 419: wings; 1 exclusions; proof 0 nodes. Board: `500000300900021608001730902000093700839570000700010400000002814060107290000000000`
- nightmare 787: wings; 7 exclusions; proof 0 nodes. Board: `000000000000000012003004000000000300005000604020070000080500400210080000700000000`
- nightmare 2721: wings; 23 exclusions; proof 0 nodes. Board: `000000000000000012003045000000000607004000000070100000000800300006000450090200000`
- expert 279: uniqueness; 0 exclusions; proof 0 nodes. Board: `000090300500040000830007060024000000905200700007000083060720000008005000402100000`
- expert 101: uniqueness; 7 exclusions; proof 0 nodes. Board: `005100200001008000200900000000030000820000010503000400009061020002007003710000008`
- nightmare 1585: uniqueness; 22 exclusions; proof 0 nodes. Board: `000000001000000020003045000000004500010000006070008000000200070004000300805000000`
- medium 240: chains; 0 exclusions; proof 7 nodes. Board: `002900003000001200004000705200700090710869050400102000900000001631200070800307920`
- nightmare 2961: chains; 12 exclusions; proof 6 nodes. Board: `000000000000000012003045000000000000006000403070100000000200000000710800604000009`
- evil 78: chains; 52 exclusions; proof 16 nodes. Board: `000000407706000050023000600030600800508000000000007009610020504000005200000010008`
- expert 267: dynamic-chains; 3 exclusions; proof 45 nodes. Board: `005810900000430027070000010004002000050940803700000400812000000000008090000020000`
- nightmare 21: dynamic-chains; 22 exclusions; proof 18 nodes. Board: `000000000000001002003040050000000006000002107045300000008950000100000000700000000`
- nightmare 1430: dynamic-chains; 48 exclusions; proof 50 nodes. Board: `000000001000000002003004000000005060010000040720000000000010807000920000036000000`

Input SHA-256: `b27c55a4cce1e1ad15e9fb1017fa3cac9ebb9a51b94550c0f729cf18acdf50ec`

Source SHA-256: `2c968ec689656d762e7237f89e4bbc25e709897b356d53e0159c017e0f0b8841`

Earlier v1–v3 reports and executables remain available. New or imported puzzle collections use the identical --file or --puzzle path. Review technique disagreements and boundaries before applying a bank migration.

## Independent harder collections

The maintenance profile also tested 40 evenly spaced puzzles from each of two
pinned Tdoku benchmark collections: Magictour top1465 and the forum-hardest 11+
collection. It explained **40/40** in the first collection and **0/40** in the
second. All 80 have one solution according to the complete solver; the second
collection stalled in our explanation rules and remains unranked. This is a
coverage limit, not evidence that those puzzles cannot be solved.

The 5,500-board result therefore establishes bank coverage, not parity with all
Sudoku Explainer techniques. Nested reasoning and richer multibranch deduction
remain research candidates; no speculative SE score is assigned to these boards.

The transformation check ran three legal transformations on 60 evenly sampled
bank boards (180 additional assessments). Every transformed board was explained,
and none changed observed family. This sample is not a guarantee of invariance
for every puzzle or of identical step counts.

## Run it on new or imported puzzles

```bash
node scripts/assess-v4.js --all --out=e2e-results/new-v4/bank.json --report=e2e-results/new-v4/bank.md
node scripts/assess-v4.js --sample=10 --transforms --out=e2e-results/new-v4/transforms.json
node scripts/assess-v4.js --puzzle=YOUR_81_CELL_GRID --trace --out=e2e-results/new-v4/puzzle.json
python3 scripts/prepare-benchmarks.py --out=e2e-results/new-benchmarks
node scripts/assess-v4.js --file=e2e-results/new-benchmarks/puzzles.txt --out=e2e-results/new-benchmarks/assessment.json
```

The benchmark preparation tool verifies the archive hash, records source revision,
member hashes and sampled indices, and refuses to overwrite an earlier run. The
external collections stay in ignored research output; they are not added to the
playable bank. [Tdoku's primary project](https://github.com/t-dillon/tdoku) describes
the collections and their intended benchmarking use.

For the SE comparison, use the existing `scripts/compare-se.js` with this v4 JSON
and the pinned ratings described in [the v3 comparison](full-bank-se-comparison.md).
The v4 CLI deliberately does not calculate search-node difficulty; that comparator
field is reported as “not measured”.
