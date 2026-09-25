import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let client;
let fetchMock;
const score = { name: 'Nirb', difficulty: 'easy', time: 120, hints: 2, level: 7, mistakes: 3, autoNotes: true };
const jsonResponse = body => ({ ok: true, json: async () => body });

beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('window', { location: { protocol: 'https:', href: 'https://sudoku.example/game/' } });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    client = await import('../leaderboard-client.js');
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

async function enable() {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'ok', bankVersion: 2 }));
    expect(await client.checkHealth()).toBe(true);
    fetchMock.mockClear();
}

describe('leaderboard client contract', () => {
    it('short circuits reads and submissions until health succeeds', async () => {
        expect(await client.fetchLeaderboard('easy')).toEqual([]);
        expect(await client.submitScore(score)).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([null, [], {}, { status: 'error' }, { status: 'ok' }, { status: 'ok', bankVersion: 1 }, 'ok'])('rejects an unexpected health JSON body (%#)', async body => {
        fetchMock.mockResolvedValue(jsonResponse(body));
        expect(await client.checkHealth()).toBe(false);
        expect(client.isAvailable()).toBe(false);
    });

    it('resets availability after a failed health probe, including a 200 HTML page', async () => {
        await enable();
        fetchMock.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('HTML'); } });
        expect(await client.checkHealth()).toBe(false);
        expect(client.isAvailable()).toBe(false);
    });

    it('serializes mistakes and auto-notes alongside existing score fields', async () => {
        await enable();
        const result = { success: true, ranked: true, rank: 1, entry: score };
        fetchMock.mockResolvedValue(jsonResponse(result));
        expect(await client.submitScore(score)).toEqual(result);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('https://sudoku.example/game/api/leaderboard');
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)).toEqual({ ...score, bankVersion: 2 });
        expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('preserves successful unranked results for the UI', async () => {
        await enable();
        const result = { success: true, ranked: false, rank: null, entry: score };
        fetchMock.mockResolvedValue(jsonResponse(result));
        expect(await client.submitScore(score)).toEqual(result);
    });

    it('encodes difficulty and returns the score list', async () => {
        await enable();
        fetchMock.mockResolvedValue(jsonResponse([score]));
        expect(await client.fetchLeaderboard('easy/evil')).toEqual([score]);
        expect(fetchMock.mock.calls[0][0]).toContain('/easy%2Fevil');
    });

    it.each([null, {}, { error: 'failed' }])('rejects non-list leaderboard JSON (%#)', async body => {
        await enable();
        fetchMock.mockResolvedValue(jsonResponse(body));
        expect(await client.fetchLeaderboard('easy')).toEqual([]);
    });

    it.each([null, {}, { success: false }, { success: true, rank: 0 }])('rejects invalid submission results (%#)', async body => {
        await enable();
        fetchMock.mockResolvedValue(jsonResponse(body));
        expect(await client.submitScore(score)).toBeNull();
    });

    it.each(['network', 'http', 'json'])('fails soft on %s failures for every request', async failure => {
        await enable();
        if (failure === 'network') fetchMock.mockRejectedValue(new Error('offline'));
        if (failure === 'http') fetchMock.mockResolvedValue({ ok: false });
        if (failure === 'json') fetchMock.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError(); } });
        expect(await client.fetchLeaderboard('easy')).toEqual([]);
        expect(await client.submitScore(score)).toBeNull();
        expect(await client.checkHealth()).toBe(false);
    });

    it.each(['health', 'read', 'submit'])('times out stalled headers and body for %s', async operation => {
        await enable();
        vi.useFakeTimers();
        for (const stalledBody of [false, true]) {
            fetchMock.mockImplementation(() => stalledBody
                ? Promise.resolve({ ok: true, json: () => new Promise(() => {}) })
                : new Promise(() => {}));
            const pending = operation === 'health' ? client.checkHealth()
                : operation === 'read' ? client.fetchLeaderboard('easy') : client.submitScore(score);
            await vi.advanceTimersByTimeAsync(2000);
            expect(await pending).toEqual(operation === 'health' ? false : operation === 'read' ? [] : null);
            expect(fetchMock.mock.calls.at(-1)[1].signal.aborted).toBe(true);
            expect(vi.getTimerCount()).toBe(0);
        }
    });

    it('clears timeout timers after successful requests', async () => {
        vi.useFakeTimers();
        await enable();
        fetchMock.mockResolvedValue(jsonResponse([]));
        await client.fetchLeaderboard('easy');
        expect(vi.getTimerCount()).toBe(0);
    });
});
