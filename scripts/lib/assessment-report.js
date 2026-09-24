import { HUMAN_FAMILIES } from '../../human-rating.js';

const sum = (records, pick) => records.reduce((total, record) => total + pick(record), 0);
export function distribution(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return { min: sorted[0], median: sorted[Math.floor(sorted.length / 2)],
        p90: sorted[Math.ceil(sorted.length * 0.9) - 1], max: sorted.at(-1) };
}

// This key chooses review examples within a family, not a published ordering.
const workloadKey = record => [record.human.workload.eliminationSteps,
    record.human.workload.candidateEliminations,
    record.human.techniqueCounts['hidden-single'], record.human.workload.placements];
function compareWorkload(a, b) {
    const left = workloadKey(a), right = workloadKey(b);
    for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] - right[i];
    return a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0;
}

export function summarizeAssessments(records) {
    const solved = records.filter(record => record.human.status === 'solved');
    const unresolved = records.filter(record => record.human.status === 'unresolved');
    const families = Object.fromEntries(HUMAN_FAMILIES.map(family => {
        const group = solved.filter(record => record.human.family === family);
        return [family, { count: group.length, placements: distribution(group.map(r => r.human.workload.placements)),
            eliminationSteps: distribution(group.map(r => r.human.workload.eliminationSteps)),
            candidateEliminations: distribution(group.map(r => r.human.workload.candidateEliminations)),
            hiddenSingles: distribution(group.map(r => r.human.techniqueCounts['hidden-single'])),
            longestEliminationRun: distribution(group.map(r => r.human.workload.longestEliminationRun)) }];
    }));
    const tiers = {};
    for (const difficulty of [...new Set(records.map(r => r.difficulty))]) {
        const group = records.filter(record => record.difficulty === difficulty);
        tiers[difficulty] = {
            count: group.length,
            productionSolved: group.filter(r => r.production.solved).length,
            families: Object.fromEntries(HUMAN_FAMILIES.map(family => [family, group.filter(r => r.human.family === family).length])),
            unresolved: group.filter(r => r.human.status === 'unresolved').length,
            newlySolved: group.filter(r => !r.production.solved && r.human.status === 'solved').length,
            noLongerSolved: group.filter(r => r.production.solved && r.human.status !== 'solved').length,
        };
    }
    const review = new Map();
    const add = (record, purpose) => {
        if (!record) return;
        const key = `${record.difficulty}/${record.level}`;
        if (!review.has(key)) review.set(key, { difficulty: record.difficulty, level: record.level, purposes: [] });
        review.get(key).purposes.push(purpose);
    };
    for (const family of HUMAN_FAMILIES) {
        const group = solved.filter(r => r.human.family === family).sort(compareWorkload);
        for (const [position, purpose] of [[0, 'low'], [Math.floor(group.length / 2), 'median'], [group.length - 1, 'high']]) {
            add(group[position], `${family}: ${purpose} observed workload`);
        }
    }
    const stalled = [...unresolved].sort((a, b) => a.human.remaining - b.human.remaining || compareWorkload(a, b));
    add(stalled[0], 'unresolved: fewest cells remaining (not a difficulty rank)');
    add(stalled[Math.floor(stalled.length / 2)], 'unresolved: median cells remaining');
    add(stalled.at(-1), 'unresolved: most cells remaining (not a difficulty rank)');
    add(records.find(r => !r.production.solved && r.human.status === 'solved'), 'previous production assessment stalled');
    add(records.find(r => r.production.solved && r.human.status !== 'solved'), 'regression/disagreement to investigate before ordering');
    add(records.find(r => r.difficulty === 'easy' && r.human.status === 'unresolved'), 'existing Easy label requires review');
    add([...records].sort((a, b) => b.searchNodes - a.searchNodes || compareWorkload(a, b))[0], 'highest search-node board: compare algorithmic search with human deductions');
    return {
        total: records.length, solved: solved.length, unresolved: unresolved.length,
        productionSolved: records.filter(r => r.production.solved).length,
        newlySolved: records.filter(r => !r.production.solved && r.human.status === 'solved').length,
        noLongerSolved: records.filter(r => r.production.solved && r.human.status !== 'solved').length,
        audit: { placements: sum(records, r => r.human.audit.placements),
            candidateEliminations: sum(records, r => r.human.audit.candidateEliminations) },
        families, tiers, reviewCases: [...review.values()],
    };
}

const range = values => values ? `${values.min} / ${values.median} / ${values.p90} / ${values.max}` : '—';
export function renderAssessmentReport(report) {
    const { summary: s, provenance: p } = report;
    const lines = [
        '# Persistent-candidate difficulty assessment — v1', '',
        '**Assessment only. No bank positions, tiers, daily puzzles, scores or gameplay changed.**', '',
        `Policy: \`${report.policy.version}\`. Coverage: **${s.total} puzzles** (${p.selection}).`, '',
        '## Method', '',
        'Each pass starts from the original givens. Candidate eliminations persist between',
        'placements; placing a digit only prunes its peers. Singles are retried after every',
        'deduction. There is no four-elimination hint limit, guessing, or answer fallback.', '',
        `Technique order: ${report.policy.techniqueOrder.map(type => `\`${type}\``).join(' → ')}.`, '',
        'Independent passes permit singles, then locked candidates, then subsets, then wings.',
        'The first successful pass supplies the observed family and workload. This establishes',
        'what this implementation solved, not the mathematically minimum technique a person',
        'must use. A different supported technique order can produce different work.', '',
        'The complete solver validates uniqueness and audits every applied placement and',
        'explicit candidate removal. Its answer is not used to choose deductions. A failed',
        'audit aborts the assessment. Unresolved puzzles receive no difficulty family or rank.', '',
        '## Results', '',
        `The persistent engine finishes **${s.solved}/${s.total}**, versus **${s.productionSolved}/${s.total}**`,
        `through the existing production hint assessment. **${s.newlySolved} additional finishes;`,
        `${s.noLongerSolved} previously finished boards now unresolved.**`, '',
        `**${s.unresolved} unresolved boards remain unranked.** They are gaps in this assessment's`,
        'coverage, not proof that those boards belong above every solved board.', '',
        '| Existing tier | Puzzles | Production finished | Singles | Locked | Subsets | Wings | Unresolved |',
        '|---|---:|---:|---:|---:|---:|---:|---:|',
        ...Object.entries(s.tiers).map(([tier, r]) => `| ${tier} | ${r.count} | ${r.productionSolved} | ${HUMAN_FAMILIES.map(f => r.families[f]).join(' | ')} | ${r.unresolved} |`), '',
        '## Workload within observed families', '',
        'Each distribution is **min / upper median / nearest-rank P90 / max**. Counts below',
        'describe the successful pass only; lower-family trial passes are reported separately',
        'in JSON. Placement count mostly reflects empty cells, so it is not a difficulty score.',
        'Elimination steps count useful patterns applied; candidate removals count distinct',
        'cell/digit exclusions. Peer pruning after placements is recorded separately.', '',
        '| Family | Boards | Elimination steps | Candidate removals | Hidden singles | Longest elimination run |',
        '|---|---:|---|---|---|---|',
        ...Object.entries(s.families).map(([family, r]) => `| ${family} | ${r.count} | ${range(r.eliminationSteps)} | ${range(r.candidateEliminations)} | ${range(r.hiddenSingles)} | ${range(r.longestEliminationRun)} |`), '',
        `Across all attempted passes, **${s.audit.placements} placements** and`,
        `**${s.audit.candidateEliminations} candidate removals** passed the independent answer audit.`,
        'This checks the evaluated boards, not every possible Sudoku.', '',
        '## Representative review pack', '',
        'The cases below are selected deterministically. Within each solved family, review',
        'selection uses elimination steps, candidate removals, hidden singles, then placements;',
        'a puzzle hash breaks ties. This is a workload sampling key, not a proposed level order.',
        'Unresolved examples sample remaining-cell counts without assigning a hardness rank.', '',
        '**Player review is still pending.** Before choosing tier boundaries, play or inspect',
        'these boards and record: hardest deduction noticed, scanning/repetition burden, whether',
        'a simpler route exists, and whether examples in the same family feel comparable.',
        'Machine-verified deductions cannot substitute for that judgement.', '',
        'Paste a board into Import → Play puzzle. The review pack contains no solutions.',
        'For an opt-in deduction trace, run the single-puzzle CLI with `--trace`.', '',
    ];
    for (const item of s.reviewCases) {
        const record = report.records.find(r => r.difficulty === item.difficulty && r.level === item.level);
        const { human: h } = record;
        lines.push(`### ${item.difficulty} · Level ${item.level}`, '', item.purposes.join('; '), '',
            `Observed result: **${h.family || 'unresolved'}**; ${h.workload.placements} placements,`,
            `${h.workload.eliminationSteps} elimination steps, ${h.workload.candidateEliminations} candidate removals,`,
            `${h.remaining} cells unresolved. Longest elimination run: ${h.workload.longestEliminationRun}.`, '',
            '```text', ...record.puzzle.replaceAll('0', '.').match(/.{9}/g), '```', '');
    }
    lines.push('## Reproduction and provenance', '',
        'Run the same selection and policy against unchanged source/input hashes to reproduce',
        'the JSON byte for byte. Outputs contain no timestamps, local paths or timing measurements.',
        'The CLI refuses to overwrite existing output files. Keep a new output path for reruns.', '',
        `Input SHA-256: \`${p.inputSha256}\``, '',
        `Source-set SHA-256: \`${p.sourceSha256}\``, '',
        '```bash',
        `node scripts/assess-difficulty.js ${p.selection === 'all' ? '--all' : `--sample=${p.samplePerTier}`} --out=e2e-results/deep-v1-rerun.json --report=e2e-results/deep-v1-rerun.md`,
        '```', '',
        'The original production assessment remains in `rating.js`, `scripts/rate-human.js`,',
        'and [the earlier report](puzzle-rating.md). This assessment does not replace them.', '');
    return lines.join('\n');
}
