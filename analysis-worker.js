import { assessPuzzleEnhanced } from './enhanced-assessment.js';
import { generatePuzzle } from './puzzle-generation.js';
import { findHintPath } from './hint-path.js';
import { SudokuSolver } from './solver.js';
import { SMALL_GEOMETRIES, VARIANT_GEOMETRIES } from './geometry.js';
import { generateSized } from './sized-generation.js';
import { newSmallGame } from './small-state.js';
import { assessSized, solveSized } from './sized-solver.js';

self.onmessage = ({ data }) => {
    const { id, kind, input } = data;
    try {
        let result;
        if (kind === 'assess') result = assessPuzzleEnhanced(input.puzzle, { ...input.options, profile: 'interactive' });
        else if (kind === 'generate') result = generatePuzzle(input, progress => self.postMessage({ id, progress }));
        else if (kind === 'hint') result = findHintPath(input.puzzle, { continuation: input.continuation });
        else if (kind === 'sized-generate' || kind === 'sized-import') {
            const g = input.rule === 'classic' ? SMALL_GEOMETRIES[input.size] : VARIANT_GEOMETRIES[input.rule];
            if (!g || g.size !== input.size) throw new Error('Unsupported geometry');
            const generated = kind === 'sized-generate' ? generateSized(g, input.seed, { requireExplained: true }) : null;
            const puzzle = generated?.puzzle || input.puzzle;
            result = { state: newSmallGame(puzzle, g), assessment: generated?.assessment || assessSized(puzzle, g), answer: solveSized(puzzle, g, { limit: 1 }).solutions[0] };
        }
        else throw new Error('Unknown analysis request.');
        if (kind === 'assess' && input.prepare && result.playable) result.solution = SudokuSolver.solveSudoku(input.puzzle).solution;
        if (kind === 'generate') result.assessment.solution = SudokuSolver.solveSudoku(result.puzzle).solution;
        self.postMessage({ id, result });
    } catch (error) { self.postMessage({ id, error: error.message || 'Analysis failed.' }); }
};
