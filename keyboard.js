/** Grid navigation stops at edges; Home/End stay within the current row. */
export function navigationCell(key, cell, size) {
    const row = Math.floor(cell / size), col = cell % size;
    switch (key) {
        case 'ArrowLeft': return col > 0 ? cell - 1 : cell;
        case 'ArrowRight': return col < size - 1 ? cell + 1 : cell;
        case 'ArrowUp': return row > 0 ? cell - size : cell;
        case 'ArrowDown': return row < size - 1 ? cell + size : cell;
        case 'Home': return cell - col;
        case 'End': return cell - col + size - 1;
        default: return null;
    }
}

const SINGLE_PRESS_ACTIONS = new Set(['n', 'a', 'f', 'h', 'p', ' ', 'enter', '?']);

/** No debounce: a fresh press works immediately, held action keys fire once. */
export function isRepeatedAction(event) {
    return event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey
        && SINGLE_PRESS_ACTIONS.has(event.key.toLowerCase());
}
