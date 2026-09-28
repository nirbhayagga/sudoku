import { formatTime } from './format.js';

/** All players present the immutable first result using the same vocabulary. */
export function renderResultSummary({ identityElement, detailsElement, identity, time, hints, mistakes = null, clues, generatedNotesUsed }) {
    identityElement.textContent = identity;
    const parts = [`Time: ${formatTime(time)}`, hints ? `${hints} hint${hints === 1 ? '' : 's'} used` : 'No hints used'];
    if (mistakes !== null) parts.push(mistakes ? `${mistakes} mistake${mistakes === 1 ? '' : 's'}` : 'no mistakes');
    parts.push(`${clues} clues`, generatedNotesUsed === null ? 'note assistance not recorded' : generatedNotesUsed ? 'generated notes used' : 'no generated notes');
    detailsElement.textContent = parts.join(' — ');
}
