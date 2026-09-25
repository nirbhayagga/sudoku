/** Stable board identity, independent of its difficulty and display position.
 * Two independent 32-bit hashes; curation checks the entire bank for collisions.
 * This is an identifier, not a cryptographic signature or proof of a score.
 */
export function puzzleId(board) {
    if (typeof board !== 'string' || !/^[0-9]{81}$/.test(board)) throw new TypeError('Invalid puzzle');
    let a = 0x811c9dc5, b = 0x9e3779b9;
    for (const digit of board) {
        a = Math.imul(a ^ digit.charCodeAt(0), 0x01000193) >>> 0;
        b = Math.imul(b ^ digit.charCodeAt(0), 0x85ebca6b) >>> 0;
    }
    return 'p' + a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
export const isPuzzleId = value => typeof value === 'string' && /^p[0-9a-f]{16}$/.test(value);
