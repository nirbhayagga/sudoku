import { assessPuzzleDeep } from './deep-assessment.js';
import { generatePuzzle } from './puzzle-generation.js';
import { findHintPath } from './hint-path.js';
import { SudokuSolver } from './solver.js';

self.onmessage = ({ data }) => {
    const { id, kind, input } = data;
    try {
        let result;
        if (kind === 'assess') result = assessPuzzleDeep(input.puzzle, { ...input.options, profile: 'interactive' });
        else if (kind === 'generate') result = generatePuzzle(input, progress => self.postMessage({ id, progress }));
        else if (kind === 'hint') result = findHintPath(input.puzzle, { continuation: input.continuation });
        else throw new Error('Unknown analysis request.');
        if (kind === 'assess' && input.prepare && result.playable) result.solution = SudokuSolver.solveSudoku(input.puzzle).solution;
        if (kind === 'generate') result.assessment.solution = SudokuSolver.solveSudoku(result.puzzle).solution;
        self.postMessage({ id, result });
    } catch (error) { self.postMessage({ id, error: error.message || 'Analysis failed.' }); }
};
