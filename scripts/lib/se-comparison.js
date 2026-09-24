import { distribution } from './assessment-v2-report.js';

export function parseSeRatings(raw) {
    const ratings = new Map();
    for (const row of raw.trim().split(/\r?\n/)) {
        const match = row.trim().match(/^([0-9.]{81})\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?:\s+\d+(?:\.\d+)?s)?$/);
        if (!match) throw new Error('Expected SE rows formatted as %g %r %p %d (optional %e).');
        const puzzle = match[1].replaceAll('.', '0');
        if (ratings.has(puzzle)) throw new Error('Duplicate SE puzzle.');
        const [er, ep, ed] = match.slice(2).map(Number);
        const status = er > 0 && er < 20 && ep > 0 && ep <= er && ed > 0 && ed <= ep ? 'rated' : 'failed';
        ratings.set(puzzle, { er, ep, ed, status });
    }
    return ratings;
}

function ranks(values) {
    const sorted = values.map((value, i) => ({ value, i })).sort((a, b) => a.value - b.value);
    const result = new Array(values.length);
    for (let start = 0; start < sorted.length;) {
        let end = start + 1;
        while (end < sorted.length && sorted[start].value === sorted[end].value) end++;
        for (let i = start; i < end; i++) result[sorted[i].i] = (start + end - 1) / 2;
        start = end;
    }
    return result;
}

export function spearman(pairs) {
    if (pairs.length < 2) return null;
    const x = ranks(pairs.map(p => p[0])), y = ranks(pairs.map(p => p[1]));
    const mean = (pairs.length - 1) / 2;
    let xy = 0, xx = 0, yy = 0;
    for (let i = 0; i < x.length; i++) { xy += (x[i] - mean) * (y[i] - mean); xx += (x[i] - mean) ** 2; yy += (y[i] - mean) ** 2; }
    return xx && yy ? Number((xy / Math.sqrt(xx * yy)).toFixed(6)) : null;
}

export function compareSe(report, ratings) {
    if (!Array.isArray(report.records) || report.records.length !== ratings.size
        || new Set(report.records.map(r => r.puzzle)).size !== ratings.size) throw new Error('Need matching, unique puzzle sets.');
    const records = report.records.map(row => {
        const se = ratings.get(row.puzzle);
        if (!se) throw new Error('Missing SE puzzle.');
        return { difficulty: row.difficulty, level: row.level, puzzle: row.puzzle, searchNodes: row.searchNodes,
            humanFamily: row.human.family, humanStatus: row.human.status, se };
    });
    const rated = records.filter(r => r.se.status === 'rated');
    const families = report.policy.version === 'human-v4.0'
        ? ['singles', 'locked-candidates', 'subsets', 'wings', 'uniqueness', 'chains', 'dynamic-chains']
        : ['singles', 'locked-candidates', 'subsets', 'wings', 'chains', 'dynamic-chains'];
    const solved = rated.filter(r => r.humanStatus === 'solved' && families.includes(r.humanFamily));
    const groups = key => Object.fromEntries([...new Set(records.map(key))].map(name => {
        const rows = rated.filter(r => key(r) === name);
        return [name, { count: rows.length, er: distribution(rows.map(r => r.se.er)), ep: distribution(rows.map(r => r.se.ep)), ed: distribution(rows.map(r => r.se.ed)) }];
    }));
    return { policy: report.policy.version, total: records.length, rated: rated.length, failed: records.length - rated.length,
        correlations: { searchNodesVsSe: spearman(rated.filter(r => Number.isFinite(r.searchNodes)).map(r => [r.searchNodes, r.se.er])),
            resolvedFamilyVsSe: spearman(solved.map(r => [families.indexOf(r.humanFamily), r.se.er])), familySample: solved.length },
        tiers: groups(r => r.difficulty), families: groups(r => r.humanFamily || 'unresolved'), records };
}

export function renderSeComparison(result) {
    const range = d => d ? `${d.min} / ${d.median} / ${d.p90} / ${d.max}` : '—';
    return ['# Full-bank comparison with Sudoku Explainer', '',
        `Our policy: \`${result.policy}\`. SE rated **${result.rated}/${result.total}**; failed/sentinel results: **${result.failed}**.`, '',
        'The tables compare observed results, not interchangeable numeric scales. A family',
        'names our first successful family-capped pass; SE ER is its hardest applied rating.',
        'EP measures the path to the first placement; ED the first placement or elimination.',
        'All ranges below are min / upper median / nearest-rank P90 / max.', '',
        '| Existing tier | Count | SE ER | SE EP | SE ED |', '|---|---:|---|---|---|',
        ...Object.entries(result.tiers).map(([name, g]) => `| ${name} | ${g.count} | ${range(g.er)} | ${range(g.ep)} | ${range(g.ed)} |`), '',
        '| Our observed family | Count | SE ER |', '|---|---:|---|',
        ...Object.entries(result.families).map(([name, g]) => `| ${name} | ${g.count} | ${range(g.er)} |`), '',
        `Spearman correlation (average ranks for ties): search nodes versus SE ER **${result.correlations.searchNodesVsSe ?? 'not measured'}**;`,
        `our ordered families versus SE ER **${result.correlations.resolvedFamilyVsSe}** across **${result.correlations.familySample}** explained/rated boards.`, '',
        'Correlation is not rating agreement or a validated mapping to human difficulty.',
        'Families are broad and overlap. Unresolved boards are excluded from family correlation,',
        'never assigned a maximum rank. Timing is discarded from SE rows before comparison.', '',
        'No puzzle positions, labels, daily references or scores were changed.', '',
        '## Provenance', '',
        `SE JAR SHA-256: \`${result.provenance.jarSha256}\``, '',
        `Our report SHA-256: \`${result.provenance.reportSha256}\``, '',
        `Normalized SE data SHA-256: \`${result.provenance.ratingsSha256}\``, '',
        'Command format: `%g %r %p %d %e`, classic 9×9, default techniques, no saved-technique override.',
        '[Official SE release used](https://github.com/1to9only/SudokuExplainer/releases/tag/2024.1.18).', '',
    ].join('\n');
}
