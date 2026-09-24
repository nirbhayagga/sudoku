export const MAX_WORKSHEET_PUZZLES = 24;
export const WORKSHEET_LAYOUTS = [1, 2, 4, 6];

/** Keep the preview, bank selection and printed pagination in agreement. */
export function planWorksheet({ amount, unit = 'puzzles', perPage = 4, order = 'random', start = 1, bankSize, answers = false }) {
    if (!WORKSHEET_LAYOUTS.includes(perPage)) throw new Error('Choose 1, 2, 4, or 6 puzzles per page.');
    if (!['puzzles', 'pages'].includes(unit) || !['random', 'consecutive'].includes(order)) throw new Error('Choose a worksheet selection.');
    const max = unit === 'pages' ? Math.floor(MAX_WORKSHEET_PUZZLES / perPage) : MAX_WORKSHEET_PUZZLES;
    if (!Number.isInteger(amount) || amount < 1 || amount > max) throw new Error(`Choose 1–${max} ${unit === 'pages' ? 'puzzle pages' : 'puzzles'}.`);
    const count = amount * (unit === 'pages' ? perPage : 1);
    if (!Number.isInteger(bankSize) || count > bankSize) throw new Error('Not enough distinct puzzles in this difficulty.');
    if (order === 'consecutive' && (!Number.isInteger(start) || start < 1 || start > bankSize)) throw new Error(`Start at a level from 1 to ${bankSize}.`);
    if (order === 'consecutive' && start + count - 1 > bankSize) throw new Error(`Only ${bankSize - start + 1} puzzles remain from level ${start}. Choose fewer puzzles or an earlier start.`);
    const puzzlePages = Math.ceil(count / perPage);
    return { count, puzzlePages, answerPages: answers ? puzzlePages : 0, totalPages: puzzlePages * (answers ? 2 : 1) };
}

/** Build ink-friendly worksheets; the browser supplies printing and Save as PDF. */
export function renderWorksheet(target, puzzles, { perPage = 4, answers = false } = {}) {
    if (!WORKSHEET_LAYOUTS.includes(perPage) || puzzles.length < 1 || puzzles.length > MAX_WORKSHEET_PUZZLES ||
        puzzles.some(item => !/^[0-9]{81}$/.test(item.puzzle) || (answers && !/^[1-9]{81}$/.test(item.solution)))) {
        throw new Error('Invalid worksheet');
    }
    const fragment = document.createDocumentFragment();
    for (const answerPage of answers ? [false, true] : [false]) {
        for (let start = 0; start < puzzles.length; start += perPage) {
            const page = document.createElement('section');
            page.className = `worksheet-page worksheet-${perPage}`;
            const heading = document.createElement('h1');
            heading.textContent = answerPage ? 'Sudoku · Answers' : 'Sudoku';
            page.append(heading);
            const boards = document.createElement('div');
            boards.className = 'worksheet-boards';
            for (const item of puzzles.slice(start, start + perPage)) {
                const card = document.createElement('article');
                const title = document.createElement('h2');
                title.textContent = item.title;
                card.append(title);
                const grid = document.createElement('div');
                grid.className = 'worksheet-grid';
                for (const digit of answerPage ? item.solution : item.puzzle) {
                    const cell = document.createElement('span');
                    cell.textContent = digit === '0' ? '' : digit;
                    grid.append(cell);
                }
                card.append(grid);
                boards.append(card);
            }
            page.append(boards);
            fragment.append(page);
        }
    }
    target.replaceChildren(fragment);
}
