/** Shared grouping without moving either game's state into its view. */
export function arrangePlayerControls({ actions, timer, hint, check, undo, redo, notes, fill, auto, pause, tools, result }) {
    actions.classList.add('player-actions');
    const primary = document.createElement('div'); primary.className = 'btn-group player-primary';
    primary.setAttribute('role', 'group'); primary.setAttribute('aria-label', 'Board actions');
    for (const button of [hint, check, undo, redo, notes]) if (button) primary.append(button);
    const options = document.createElement('details'); options.className = 'notes-options';
    const summary = document.createElement('summary'); summary.textContent = 'Notes options'; options.append(summary);
    const copy = document.createElement('p'); copy.textContent = 'Fill once to edit candidates yourself, or keep them updated automatically.';
    options.append(copy, fill, auto);
    const more = document.createElement('div'); more.className = 'player-more';
    if (result) more.append(result);
    const toolButton = document.createElement('button'); toolButton.type = 'button'; toolButton.className = 'btn';
    toolButton.textContent = 'Puzzle tools'; toolButton.onclick = tools; more.append(toolButton);
    const secondary = document.createElement('div'); secondary.className = 'player-secondary'; secondary.append(options, more);
    actions.replaceChildren(primary, secondary);
    const clock = document.createElement('div'); clock.className = 'player-clock';
    timer.before(clock); clock.append(timer, pause);
}
