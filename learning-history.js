import { AUX_KEYS, readAuxiliary, writeAuxiliary } from './storage.js';

const count = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000;
export function validatePracticeHistory(raw) {
    if (raw === null) return {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length > 2000) return null;
    const result = {};
    for (const [id, value] of Object.entries(raw)) {
        if (!/^practice-p[a-f0-9]{16}-\d{1,3}$/.test(id) || !value ||
            !['attempts', 'independent', 'assisted', 'incorrect', 'lastAt'].every(k => count(value[k])) ||
            value.independent + value.assisted > value.attempts || !['learn', 'guided', 'challenge'].includes(value.mode)) return null;
        result[id] = Object.fromEntries(['attempts', 'independent', 'assisted', 'incorrect', 'lastAt', 'mode'].map(k => [k, value[k]]));
    }
    return result;
}
export const practiceHistory = () => validatePracticeHistory(readAuxiliary(AUX_KEYS.practice)) || {};
/** One completed attempt, not each answer click. Dates are epoch days. */
export function recordPractice(id, { mode, assisted, incorrect = 0 }) {
    const history = practiceHistory(), old = history[id] || { attempts: 0, independent: 0, assisted: 0, incorrect: 0 };
    history[id] = { attempts: old.attempts + 1, independent: old.independent + (assisted ? 0 : 1),
        assisted: old.assisted + (assisted ? 1 : 0), incorrect: old.incorrect + incorrect,
        lastAt: Math.floor(Date.now() / 86400000), mode };
    return validatePracticeHistory(history) !== null && writeAuxiliary(AUX_KEYS.practice, history);
}
