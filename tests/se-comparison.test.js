import { it, expect } from 'vitest';
import { compareSe, parseSeRatings, spearman } from '../scripts/lib/se-comparison.js';

it('joins by puzzle identity, drops timings and preserves SE failure status', () => {
    const a = '0'.repeat(81), b = '1' + '0'.repeat(80);
    const parsed = parseSeRatings(`${b} 20 1.2 1.2 2.30s\n${a} 4.5 2.6 1.2 0.03s`);
    const report = { policy: { version: 'test' }, records: [a, b].map((puzzle, i) => ({ puzzle, difficulty: 'test', level: i + 1, searchNodes: i,
        human: { status: i ? 'unresolved' : 'solved', family: i ? null : 'subsets' } })) };
    const result = compareSe(report, parsed);
    expect(result.records.map(r => r.se.er)).toEqual([4.5, 20]);
    expect(result).toMatchObject({ total: 2, rated: 1, failed: 1 });
    expect(() => parseSeRatings(`${a} 1.2 1.2 1.2\n${a} 1.2 1.2 1.2`)).toThrow('Duplicate');
    expect(() => compareSe(report, parseSeRatings(`${a} 1.2 1.2 1.2`))).toThrow('matching');
    expect(() => parseSeRatings('bad row')).toThrow('Expected SE');
});

it('uses tied ranks and does not invent correlation for a constant variable', () => {
    expect(spearman([[1, 1], [2, 2], [2, 2], [3, 3]])).toBe(1);
    expect(spearman([[1, 3], [2, 2], [3, 1]])).toBe(-1);
    expect(spearman([[1, 2], [1, 3]])).toBeNull();
});
