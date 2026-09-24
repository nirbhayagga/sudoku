import { SudokuSolver } from './solver.js';
import { nextStep } from './techniques.js';

/** A repeatable assessment of supported deductions, not a six-tier human rating. */
export function assessPuzzle(puzzle) {
    if (typeof puzzle !== 'string' || !/^[0-9]{81}$/.test(puzzle)) return { playable: false, label: 'Enter a complete 81-cell grid.' };
    const solutions = SudokuSolver.countSolutions(puzzle, 2);
    if (!solutions) return { playable: false, solutions: 0, label: 'No solution. Check the givens, or open in Solver to edit.' };
    if (solutions > 1) return { playable: false, solutions: 2, label: 'Multiple solutions. Add givens, or open in Solver to explore.' };
    const solution = SudokuSolver.solveSudoku(puzzle).solution;
    const board = [...puzzle];
    const techniques = new Set();
    let placements = 0;
    while (board.includes('0')) {
        const step = nextStep(board.join(''));
        if (!step) break;
        if (board[step.idx] !== '0' || step.digit !== solution[step.idx]) throw new Error('Invalid deduction in puzzle assessment');
        board[step.idx] = step.digit;
        placements++;
        for (const type of step.via || []) techniques.add(type);
    }
    const solved = !board.includes('0');
    const label = !puzzle.includes('0') ? 'Already complete.' : !solved ? 'Beyond the current explained techniques.'
        : !techniques.size ? 'Solved with singles.'
            : [...techniques].some(type => /wing/.test(type)) ? 'Solved with wing techniques.'
                : [...techniques].some(type => /naked-pair|hidden-pair|naked-triple/.test(type)) ? 'Solved with pairs or triples.'
                    : 'Solved with locked candidates.';
    return { playable: puzzle.includes('0'), solutions: 1, solution, label, solved, placements,
        clues: puzzle.replace(/0/g, '').length, techniques: [...techniques], searchNodes: SudokuSolver.rateDifficulty(puzzle) };
}
