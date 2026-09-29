/** Shared cell scaffolding for the Classic player, other geometries and lessons.
 * Engines keep their state; this module only owns accessible presentation. */
export function createBoardCell({ size = 9, boxRows = 3, boxCols = 3, index, input = false, document: doc = document }) {
    const cell = doc.createElement(input ? 'div' : 'button');
    cell.className = 'board-cell';
    if (!input) cell.type = 'button';
    cell.dataset.cell = index;
    const row = Math.floor(index / size), col = index % size;
    if ((col + 1) % boxCols === 0 && col < size - 1) cell.style.borderRightWidth = '3px';
    if ((row + 1) % boxRows === 0 && row < size - 1) cell.style.borderBottomWidth = '3px';
    const value = doc.createElement(input ? 'input' : 'span');
    value.className = 'board-value';
    if (input) { value.type = 'text'; value.maxLength = 1; }
    const notes = doc.createElement('span'); notes.className = 'board-notes';
    notes.style.setProperty('--note-cols', Math.ceil(Math.sqrt(size)));
    const marks = Array.from({ length: size }, (_, d) => {
        const span = doc.createElement('span'); span.dataset.digit = String(d + 1); notes.append(span); return span;
    });
    cell.append(notes, value);
    return { cell, value, notes, marks };
}

export function renderBoardCell(view, { value = '0', candidates = [], given = false, selected = false, label, hidden = false }) {
    view.cell.classList.toggle('board-given', given);
    view.cell.classList.toggle('board-selected', selected);
    view.cell.setAttribute('aria-label', label);
    view.cell.setAttribute('aria-pressed', String(selected));
    view.cell.tabIndex = selected ? 0 : -1;
    view.value.textContent = hidden || value === '0' ? '' : value;
    view.notes.hidden = hidden || value !== '0';
    for (const mark of view.marks) mark.textContent = !hidden && candidates.includes(mark.dataset.digit) ? mark.dataset.digit : '';
}
