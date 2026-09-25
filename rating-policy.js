/** Versioned presentation policy over verified human-v4 maintenance paths.
 * These are ordered technique bands, not calibrated numerical human ratings.
 */
export const RATING_POLICY = 'human-order-v1';
export const RATING_FAMILIES = ['singles', 'locked-candidates', 'subsets', 'wings', 'uniqueness', 'chains', 'dynamic-chains'];
export const FAMILY_TIERS = ['easy', 'medium', 'hard', 'expert', 'expert', 'evil', 'nightmare'];
const TECHNIQUES = [
    ['naked-single', 'hidden-single'],
    ['pointing-pair', 'pointing-triple', 'claiming-pair', 'claiming-triple'],
    ['naked-pair', 'hidden-pair', 'naked-triple', 'hidden-triple', 'naked-quad', 'hidden-quad'],
    ['x-wing', 'xy-wing', 'xyz-wing', 'swordfish', 'jellyfish'],
    ['unique-rectangle-1', 'unique-rectangle-2', 'unique-rectangle-4', 'bug-plus-one'],
    ['forcing-chain'],
    ['dynamic-forcing-chain', 'forcing-convergence'],
];
export function ratingKey(human) {
    const family = RATING_FAMILIES.indexOf(human?.family);
    if (human?.version !== 'human-v4.0' || human.profile !== 'maintenance' || human.status !== 'solved' || family < 0) {
        throw new TypeError('Ranking requires a completed human-v4 maintenance assessment');
    }
    const used = Object.keys(human.techniqueCounts || {});
    if (!used.length || used.some(t => !TECHNIQUES.flat().includes(t))) throw new TypeError('Unknown technique');
    const technique = Math.max(...used.map(t => TECHNIQUES[family].indexOf(t)));
    if (technique < 0) throw new TypeError('Missing family technique');
    // Chain shape is not an intrinsic difficulty score: compare proof size and
    // depth before workload, rather than assuming every convergence is harder.
    const named = family >= 5 ? 0 : technique;
    const w = human.workload;
    const key = [family, named, w.deepestProof, w.largestProof, w.largestBranchCount,
        w.eliminationSteps, w.candidateEliminations, w.totalSteps,
        human.opening.precedingEliminations];
    if (!key.every(n => Number.isSafeInteger(n) && n >= 0)) throw new TypeError('Invalid assessment workload');
    return key;
}
export function difficultyFor(human) { return FAMILY_TIERS[ratingKey(human)[0]]; }
export function compareRatingKeys(a, b) {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
}
