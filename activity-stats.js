import { AUX_KEYS, readAuxiliary, smallProgress } from './storage.js';
import { validateModeResults } from './complete-backup.js';
import { practiceHistory } from './learning-history.js';
import { formatTime } from './format.js';

export function activityStats(document) {
    const section = document.createElement('section'); section.className = 'activity-statistics';
    const results = validateModeResults(readAuxiliary(AUX_KEYS.results)) || {}, completed = smallProgress();
    const heading = document.createElement('h3'); heading.textContent = 'Other activities'; section.append(heading);
    const table = document.createElement('table'); table.className = 'stats-table';
    table.innerHTML = '<thead><tr><th>Activity</th><th>Puzzles completed</th><th>Recorded best</th></tr></thead><tbody></tbody>';
    for (const [track, label] of [['4', 'Introduction 4×4'], ['6', 'Quick 6×6'], ['9-diagonal', 'Diagonal'], ['9-hyper', 'Hyper']]) {
        const row = document.createElement('tr'), records = Object.entries(results).filter(([id]) => id.startsWith(track + '-'));
        const values = [label, String(completed.filter(id => id.startsWith(track + '-')).length), records.length ? formatTime(Math.floor(Math.min(...records.map(([, r]) => r.elapsedMs)) / 1000)) : '—'];
        for (const value of values) { const td = document.createElement('td'); td.textContent = value; row.append(td); }
        table.querySelector('tbody').append(row);
    }
    const scroll = document.createElement('div'); scroll.className = 'table-scroll'; scroll.append(table); section.append(scroll);
    const note = document.createElement('p'); note.textContent = 'Each activity keeps separate results. Older completions may have no recorded time; imported games keep their result in the saved game.'; section.append(note);
    const history = Object.values(practiceHistory()), learned = document.createElement('p');
    learned.textContent = `${history.length} exercises practised · ${history.reduce((n, h) => n + h.independent, 0)} independent and ${history.reduce((n, h) => n + h.assisted, 0)} assisted completed attempts. This is practice history, not a mastery score.`;
    section.append(learned); return section;
}
