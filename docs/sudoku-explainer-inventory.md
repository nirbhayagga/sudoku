# SudokuExplainer review inventory

Pinned revision: `b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e`.

166 tracked files; 101 Java files containing 22,848 lines.

This appendix identifies the complete source tree covered by the
[comparison review](sudoku-explainer-review.md). Coverage was repository-wide
static inspection, with detailed algorithm/state-path review and targeted GUI
and helper inspection. Listing a file does not claim every line was independently
proved correct. HTML templates were reviewed for explanation structure; binary
assets were inventoried. The initial static review did not execute Java. The later
[full-bank comparison](full-bank-se-comparison.md) and
[size smoke checks](sudoku-adoption-roadmap.md) executed the official release binaries;
those results are separate from this source inventory.

| Directory | Files | Java files |
|---|---:|---:|
| `.` | 3 | 0 |
| `META-INF` | 1 | 0 |
| `diuf/sudoku` | 5 | 5 |
| `diuf/sudoku/applet` | 1 | 1 |
| `diuf/sudoku/generator` | 3 | 3 |
| `diuf/sudoku/gui` | 24 | 9 |
| `diuf/sudoku/io` | 3 | 3 |
| `diuf/sudoku/solver` | 13 | 13 |
| `diuf/sudoku/solver/checks` | 20 | 10 |
| `diuf/sudoku/solver/rules` | 34 | 20 |
| `diuf/sudoku/solver/rules/chaining` | 22 | 9 |
| `diuf/sudoku/solver/rules/unique` | 22 | 13 |
| `diuf/sudoku/test` | 5 | 5 |
| `diuf/sudoku/tools` | 10 | 10 |

## .

| File | Kind |
|---|---|
| [BUILDME.md](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/BUILDME.md) | Documentation |
| [License.txt](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/License.txt) | License |
| [README.md](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/README.md) | Documentation |

## META-INF

| File | Kind |
|---|---|
| [MANIFEST.MF](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/META-INF/MANIFEST.MF) | Build manifest |

## diuf/sudoku

| File | Kind |
|---|---|
| [Cell.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/Cell.java) | Java source |
| [Grid.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/Grid.java) | Java source |
| [Link.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/Link.java) | Java source |
| [Settings.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/Settings.java) | Java source |
| [SolvingTechnique.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/SolvingTechnique.java) | Java source |

## diuf/sudoku/applet

| File | Kind |
|---|---|
| [SudokuApplet.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/applet/SudokuApplet.java) | Java source |

## diuf/sudoku/generator

| File | Kind |
|---|---|
| [Generator.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/generator/Generator.java) | Java source |
| [Point.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/generator/Point.java) | Java source |
| [Symmetry.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/generator/Symmetry.java) | Java source |

## diuf/sudoku/gui

| File | Kind |
|---|---|
| [AboutDialog.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/AboutDialog.java) | Java source |
| [AutoBusy.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/AutoBusy.java) | Java source |
| [BigClue.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/BigClue.html) | Explanation/UI template |
| [Diabolical.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/Diabolical.html) | Explanation/UI template |
| [Easy.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/Easy.html) | Explanation/UI template |
| [Fiendish.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/Fiendish.html) | Explanation/UI template |
| [GenerateDialog.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/GenerateDialog.java) | Java source |
| [Hard.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/Hard.html) | Explanation/UI template |
| [HintNode.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/HintNode.java) | Java source |
| [HintsTreeBuilder.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/HintsTreeBuilder.java) | Java source |
| [Knife.gif](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/Knife.gif) | Binary image |
| [Light.gif](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/Light.gif) | Binary image |
| [Medium.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/Medium.html) | Explanation/UI template |
| [Multiple.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/Multiple.html) | Explanation/UI template |
| [SmallClue.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/SmallClue.html) | Explanation/UI template |
| [SolutionPath.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/SolutionPath.html) | Explanation/UI template |
| [Sudoku.gif](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/Sudoku.gif) | Binary image |
| [SudokuExplainer.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/SudokuExplainer.java) | Java source |
| [SudokuFrame.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/SudokuFrame.java) | Java source |
| [SudokuPanel.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/SudokuPanel.java) | Java source |
| [TechniquesSelectDialog.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/TechniquesSelectDialog.java) | Java source |
| [Valid.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/Valid.html) | Explanation/UI template |
| [Warning.gif](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/Warning.gif) | Binary image |
| [Welcome.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/gui/Welcome.html) | Explanation/UI template |

## diuf/sudoku/io

| File | Kind |
|---|---|
| [ErrorMessage.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/io/ErrorMessage.java) | Java source |
| [FastSinCos.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/io/FastSinCos.java) | Java source |
| [SudokuIO.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/io/SudokuIO.java) | Java source |

## diuf/sudoku/solver

| File | Kind |
|---|---|
| [DirectHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/DirectHint.java) | Java source |
| [DirectHintProducer.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/DirectHintProducer.java) | Java source |
| [Hint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/Hint.java) | Java source |
| [HintProducer.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/HintProducer.java) | Java source |
| [HintsAccumulator.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/HintsAccumulator.java) | Java source |
| [IndirectHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/IndirectHint.java) | Java source |
| [IndirectHintProducer.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/IndirectHintProducer.java) | Java source |
| [Rule.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/Rule.java) | Java source |
| [SingleHintAccumulator.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/SingleHintAccumulator.java) | Java source |
| [SmallestHintAccumulator.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/SmallestHintAccumulator.java) | Java source |
| [Solver.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/Solver.java) | Java source |
| [WarningHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/WarningHint.java) | Java source |
| [WarningHintProducer.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/WarningHintProducer.java) | Java source |

## diuf/sudoku/solver/checks

| File | Kind |
|---|---|
| [Analyser.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/Analyser.java) | Java source |
| [Analysis.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/Analysis.html) | Explanation/UI template |
| [AnalysisInfo.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/AnalysisInfo.java) | Java source |
| [BruteForceAnalysis.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/BruteForceAnalysis.java) | Java source |
| [DoubleSolution.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/DoubleSolution.html) | Explanation/UI template |
| [DoubleSolutionWarning.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/DoubleSolutionWarning.java) | Java source |
| [DoubleValue.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/DoubleValue.html) | Explanation/UI template |
| [MissingCandidates.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/MissingCandidates.html) | Explanation/UI template |
| [NoDoubles.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/NoDoubles.java) | Java source |
| [NoSolution.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/NoSolution.html) | Explanation/UI template |
| [NumberOfFilledCells.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/NumberOfFilledCells.java) | Java source |
| [NumberOfValues.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/NumberOfValues.java) | Java source |
| [Solution.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/Solution.html) | Explanation/UI template |
| [Solution.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/Solution.java) | Java source |
| [SolutionHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/SolutionHint.java) | Java source |
| [SudokuSolved.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/SudokuSolved.html) | Explanation/UI template |
| [TooFewCells.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/TooFewCells.html) | Explanation/UI template |
| [TooFewValues.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/TooFewValues.html) | Explanation/UI template |
| [UnderConstruction.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/UnderConstruction.html) | Explanation/UI template |
| [WarningMessage.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/checks/WarningMessage.java) | Java source |

## diuf/sudoku/solver/rules

| File | Kind |
|---|---|
| [AlignedExclusion.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/AlignedExclusion.java) | Java source |
| [AlignedExclusionHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/AlignedExclusionHint.html) | Explanation/UI template |
| [AlignedExclusionHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/AlignedExclusionHint.java) | Java source |
| [AlignedPairExclusion.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/AlignedPairExclusion.java) | Java source |
| [AlignedPairExclusionHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/AlignedPairExclusionHint.html) | Explanation/UI template |
| [DirectHiddenSetHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/DirectHiddenSetHint.html) | Explanation/UI template |
| [DirectHiddenSetHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/DirectHiddenSetHint.java) | Java source |
| [DirectLockingHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/DirectLockingHint.html) | Explanation/UI template |
| [DirectLockingHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/DirectLockingHint.java) | Java source |
| [Fisherman.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/Fisherman.java) | Java source |
| [HasParentPotentialHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/HasParentPotentialHint.java) | Java source |
| [HiddenSet.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/HiddenSet.java) | Java source |
| [HiddenSetHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/HiddenSetHint.html) | Explanation/UI template |
| [HiddenSetHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/HiddenSetHint.java) | Java source |
| [HiddenSingle.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/HiddenSingle.java) | Java source |
| [HiddenSingleHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/HiddenSingleHint.html) | Explanation/UI template |
| [HiddenSingleHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/HiddenSingleHint.java) | Java source |
| [Locking.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/Locking.java) | Java source |
| [LockingGHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/LockingGHint.html) | Explanation/UI template |
| [LockingGHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/LockingGHint.java) | Java source |
| [LockingHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/LockingHint.html) | Explanation/UI template |
| [LockingHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/LockingHint.java) | Java source |
| [NakedSet.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/NakedSet.java) | Java source |
| [NakedSetHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/NakedSetHint.html) | Explanation/UI template |
| [NakedSetHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/NakedSetHint.java) | Java source |
| [NakedSingle.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/NakedSingle.java) | Java source |
| [NakedSingleHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/NakedSingleHint.html) | Explanation/UI template |
| [NakedSingleHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/NakedSingleHint.java) | Java source |
| [SimpleLockingHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/SimpleLockingHint.html) | Explanation/UI template |
| [Single.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/Single.html) | Explanation/UI template |
| [XYWing.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/XYWing.java) | Java source |
| [XYWingHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/XYWingHint.html) | Explanation/UI template |
| [XYWingHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/XYWingHint.java) | Java source |
| [XYZWingHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/XYZWingHint.html) | Explanation/UI template |

## diuf/sudoku/solver/rules/chaining

| File | Kind |
|---|---|
| [BinaryChainingHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/BinaryChainingHint.java) | Java source |
| [CellChainingHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/CellChainingHint.java) | Java source |
| [Chaining.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/Chaining.java) | Java source |
| [ChainingHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/ChainingHint.java) | Java source |
| [CycleHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/CycleHint.java) | Java source |
| [DynamicCellReductionHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/DynamicCellReductionHint.html) | Explanation/UI template |
| [DynamicContradictionHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/DynamicContradictionHint.html) | Explanation/UI template |
| [DynamicReductionHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/DynamicReductionHint.html) | Explanation/UI template |
| [DynamicRegionReductionHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/DynamicRegionReductionHint.html) | Explanation/UI template |
| [ForcingChain.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/ForcingChain.html) | Explanation/UI template |
| [ForcingChainHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/ForcingChainHint.java) | Java source |
| [ForcingXChain.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/ForcingXChain.html) | Explanation/UI template |
| [FullChain.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/FullChain.java) | Java source |
| [NishioHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/NishioHint.html) | Explanation/UI template |
| [Potential.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/Potential.java) | Java source |
| [RegionChainingHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/RegionChainingHint.java) | Java source |
| [StaticCellReductionHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/StaticCellReductionHint.html) | Explanation/UI template |
| [StaticRegionReductionHint.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/StaticRegionReductionHint.html) | Explanation/UI template |
| [UnderConstruction.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/UnderConstruction.html) | Explanation/UI template |
| [X-Cycle.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/X-Cycle.html) | Explanation/UI template |
| [XY-Cycle.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/XY-Cycle.html) | Explanation/UI template |
| [Y-Cycle.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/chaining/Y-Cycle.html) | Explanation/UI template |

## diuf/sudoku/solver/rules/unique

| File | Kind |
|---|---|
| [BivalueUniversalGrave.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/BivalueUniversalGrave.java) | Java source |
| [BivalueUniversalGrave1.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/BivalueUniversalGrave1.html) | Explanation/UI template |
| [BivalueUniversalGrave2.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/BivalueUniversalGrave2.html) | Explanation/UI template |
| [BivalueUniversalGrave3.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/BivalueUniversalGrave3.html) | Explanation/UI template |
| [BivalueUniversalGrave4.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/BivalueUniversalGrave4.html) | Explanation/UI template |
| [Bug1Hint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/Bug1Hint.java) | Java source |
| [Bug2Hint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/Bug2Hint.java) | Java source |
| [Bug3Hint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/Bug3Hint.java) | Java source |
| [Bug4Hint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/Bug4Hint.java) | Java source |
| [BugHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/BugHint.java) | Java source |
| [UniqueLoopHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/UniqueLoopHint.java) | Java source |
| [UniqueLoopType1.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/UniqueLoopType1.html) | Explanation/UI template |
| [UniqueLoopType1Hint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/UniqueLoopType1Hint.java) | Java source |
| [UniqueLoopType2.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/UniqueLoopType2.html) | Explanation/UI template |
| [UniqueLoopType2Hint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/UniqueLoopType2Hint.java) | Java source |
| [UniqueLoopType3Hidden.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/UniqueLoopType3Hidden.html) | Explanation/UI template |
| [UniqueLoopType3HiddenHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/UniqueLoopType3HiddenHint.java) | Java source |
| [UniqueLoopType3Naked.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/UniqueLoopType3Naked.html) | Explanation/UI template |
| [UniqueLoopType3NakedHint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/UniqueLoopType3NakedHint.java) | Java source |
| [UniqueLoopType4.html](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/UniqueLoopType4.html) | Explanation/UI template |
| [UniqueLoopType4Hint.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/UniqueLoopType4Hint.java) | Java source |
| [UniqueLoops.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/solver/rules/unique/UniqueLoops.java) | Java source |

## diuf/sudoku/test

| File | Kind |
|---|---|
| [Tester.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/test/Tester.java) | Java source |
| [batch.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/test/batch.java) | Java source |
| [hints.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/test/hints.java) | Java source |
| [serate.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/test/serate.java) | Java source |
| [validate.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/test/validate.java) | Java source |

## diuf/sudoku/tools

| File | Kind |
|---|---|
| [Asker.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/tools/Asker.java) | Java source |
| [CommonTuples.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/tools/CommonTuples.java) | Java source |
| [HtmlLoader.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/tools/HtmlLoader.java) | Java source |
| [LinkedSet.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/tools/LinkedSet.java) | Java source |
| [Pair.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/tools/Pair.java) | Java source |
| [Permutations.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/tools/Permutations.java) | Java source |
| [SingletonBitSet.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/tools/SingletonBitSet.java) | Java source |
| [StrongReference.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/tools/StrongReference.java) | Java source |
| [Twomutations.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/tools/Twomutations.java) | Java source |
| [ValuesFormatter.java](https://github.com/1to9only/SudokuExplainer/blob/b1f9ed4dd28dc3a7ad51975d4a8b9dd1d74d6a0e/diuf/sudoku/tools/ValuesFormatter.java) | Java source |
