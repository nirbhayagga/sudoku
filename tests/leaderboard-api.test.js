import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Each suite gets a fresh module instance (so the in-memory rate limiter resets)
 * pointed at a throwaway DATA_FILE, then binds port 0 and talks to it over HTTP.
 */
async function startServer(env = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-lb-'));
    const dataFile = path.join(dir, 'leaderboard.json');

    vi.resetModules();
    const previous = { ...process.env };
    Object.assign(process.env, { DATA_FILE: dataFile, RATE_LIMIT_MAX: '1000', ...env });

    const { default: app } = await import('../leaderboard-api/server.js');
    const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}`;

    return {
        base,
        dataFile,
        readData: () => (fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : {}),
        async close() {
            await new Promise((resolve) => server.close(resolve));
            fs.rmSync(dir, { recursive: true, force: true });
            process.env = previous;
        },
    };
}

const post = (base, body) =>
    fetch(`${base}/api/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

const validScore = { name: 'Nirb', difficulty: 'easy', time: 120, hints: 0, level: 7 };

let server;
beforeEach(async () => {
    server = await startServer();
});
afterEach(async () => {
    await server.close();
});

describe('GET /api/health', () => {
    it('reports ok — this is what gates the leaderboard UI', async () => {
        const resp = await fetch(`${server.base}/api/health`);
        expect(resp.status).toBe(200);
        expect(await resp.json()).toEqual({ status: 'ok' });
    });
});

describe('POST /api/leaderboard', () => {
    it('accepts a valid score and returns its rank', async () => {
        const resp = await post(server.base, validScore);
        expect(resp.status).toBe(200);

        const body = await resp.json();
        expect(body.success).toBe(true);
        expect(body.rank).toBe(1);
        expect(body.entry).toMatchObject({ name: 'Nirb', difficulty: 'easy', time: 120, level: 7 });
        expect(body.entry.date).toBeTruthy();
    });

    it('persists the score to disk', async () => {
        await post(server.base, validScore);
        expect(server.readData().easy).toHaveLength(1);
    });

    it('ranks faster times first', async () => {
        await post(server.base, { ...validScore, name: 'Slow', time: 300 });
        await post(server.base, { ...validScore, name: 'Fast', time: 100 });
        const resp = await post(server.base, { ...validScore, name: 'Middle', time: 200 });

        expect((await resp.json()).rank).toBe(2);
        expect(server.readData().easy.map((e) => e.name)).toEqual(['Fast', 'Middle', 'Slow']);
    });

    it('keeps difficulties in separate tables', async () => {
        await post(server.base, { ...validScore, difficulty: 'easy' });
        await post(server.base, { ...validScore, difficulty: 'nightmare' });

        const data = server.readData();
        expect(data.easy).toHaveLength(1);
        expect(data.nightmare).toHaveLength(1);
    });

    it('rounds fractional times', async () => {
        const resp = await post(server.base, { ...validScore, time: 42.7 });
        expect((await resp.json()).entry.time).toBe(43);
    });

    it('defaults hints and level when omitted', async () => {
        const resp = await post(server.base, { name: 'A', difficulty: 'easy', time: 10 });
        const { entry } = await resp.json();
        expect(entry.hints).toBe(0);
        expect(entry.level).toBeNull();
    });

    it('accepts a time of zero', async () => {
        // `time === undefined` is the guard, so a legitimate 0 must not be rejected.
        const resp = await post(server.base, { ...validScore, time: 0 });
        expect(resp.status).toBe(200);
    });

    describe('validation', () => {
        it('rejects a missing name', async () => {
            const resp = await post(server.base, { difficulty: 'easy', time: 10 });
            expect(resp.status).toBe(400);
        });

        it('rejects a missing difficulty', async () => {
            const resp = await post(server.base, { name: 'A', time: 10 });
            expect(resp.status).toBe(400);
        });

        it('rejects a missing time', async () => {
            const resp = await post(server.base, { name: 'A', difficulty: 'easy' });
            expect(resp.status).toBe(400);
        });

        it('rejects an unknown difficulty', async () => {
            const resp = await post(server.base, { ...validScore, difficulty: 'impossible' });
            expect(resp.status).toBe(400);
            expect((await resp.json()).error).toBe('Invalid difficulty');
        });

        it('rejects a name that is only whitespace', async () => {
            const resp = await post(server.base, { ...validScore, name: '   ' });
            expect(resp.status).toBe(400);
        });

        it('rejects a name that is only HTML', async () => {
            const resp = await post(server.base, { ...validScore, name: '<script></script>' });
            expect(resp.status).toBe(400);
        });
    });

    describe('sanitisation', () => {
        it('strips HTML tags from names', async () => {
            const resp = await post(server.base, { ...validScore, name: '<b>Bob</b>' });
            expect((await resp.json()).entry.name).toBe('Bob');
        });

        it('truncates names to 20 characters', async () => {
            const resp = await post(server.base, { ...validScore, name: 'x'.repeat(50) });
            expect((await resp.json()).entry.name).toHaveLength(20);
        });

        it('trims surrounding whitespace', async () => {
            const resp = await post(server.base, { ...validScore, name: '  Bob  ' });
            expect((await resp.json()).entry.name).toBe('Bob');
        });

        it('coerces a non-string name', async () => {
            const resp = await post(server.base, { ...validScore, name: 12345 });
            expect((await resp.json()).entry.name).toBe('12345');
        });
    });

    it('keeps at most 100 entries per difficulty', async () => {
        for (let i = 0; i < 105; i++) {
            await post(server.base, { ...validScore, name: `P${i}`, time: 1000 - i });
        }
        const data = server.readData();
        expect(data.easy).toHaveLength(100);
        // The slowest entries are the ones dropped.
        expect(data.easy[0].time).toBe(896);
    });
});

describe('GET /api/leaderboard/:difficulty', () => {
    it('returns the scores for one difficulty, fastest first', async () => {
        await post(server.base, { ...validScore, name: 'Slow', time: 300 });
        await post(server.base, { ...validScore, name: 'Fast', time: 100 });

        const entries = await (await fetch(`${server.base}/api/leaderboard/easy`)).json();
        expect(entries.map((e) => e.name)).toEqual(['Fast', 'Slow']);
    });

    it('returns an empty array for a difficulty with no scores', async () => {
        expect(await (await fetch(`${server.base}/api/leaderboard/evil`)).json()).toEqual([]);
    });

    it('returns an empty array for an unknown difficulty', async () => {
        expect(await (await fetch(`${server.base}/api/leaderboard/nonsense`)).json()).toEqual([]);
    });

    it('caps the response at 50 entries', async () => {
        for (let i = 0; i < 60; i++) {
            await post(server.base, { ...validScore, name: `P${i}`, time: 100 + i });
        }
        const entries = await (await fetch(`${server.base}/api/leaderboard/easy`)).json();
        expect(entries).toHaveLength(50);
    });
});

describe('GET /api/leaderboard', () => {
    it('summarises every difficulty with its top 10', async () => {
        for (let i = 0; i < 12; i++) {
            await post(server.base, { ...validScore, name: `E${i}`, time: 100 + i });
        }
        await post(server.base, { ...validScore, difficulty: 'evil', name: 'V', time: 50 });

        const summary = await (await fetch(`${server.base}/api/leaderboard`)).json();
        expect(summary.easy).toHaveLength(10);
        expect(summary.evil).toHaveLength(1);
    });

    it('returns an empty object when nothing has been submitted', async () => {
        expect(await (await fetch(`${server.base}/api/leaderboard`)).json()).toEqual({});
    });
});

describe('rate limiting', () => {
    it('rejects submissions past the limit with 429', async () => {
        const limited = await startServer({ RATE_LIMIT_MAX: '3' });
        try {
            for (let i = 0; i < 3; i++) {
                expect((await post(limited.base, validScore)).status).toBe(200);
            }
            const blocked = await post(limited.base, validScore);
            expect(blocked.status).toBe(429);
            expect((await blocked.json()).error).toMatch(/too many/i);
        } finally {
            await limited.close();
        }
    });

    /**
     * Behind nginx every request arrives from nginx's own address. Without
     * trusting that hop the whole site shared one bucket, and the sixth player
     * to finish in a minute was told to try again later.
     */
    it('limits per client, not per proxy, when TRUST_PROXY is set', async () => {
        const proxied = await startServer({ TRUST_PROXY: '1', RATE_LIMIT_MAX: '1' });
        try {
            const from = (ip) => fetch(`${proxied.base}/api/leaderboard`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
                body: JSON.stringify(validScore),
            });
            expect((await from('203.0.113.1')).status).toBe(200);
            expect((await from('203.0.113.2')).status).toBe(200);
            expect((await from('203.0.113.1')).status).toBe(429);
        } finally {
            await proxied.close();
        }
    });

    // A process reachable directly must not let a client name its own address.
    it('ignores X-Forwarded-For unless told to trust a proxy', async () => {
        const direct = await startServer({ RATE_LIMIT_MAX: '1' });
        try {
            const from = (ip) => fetch(`${direct.base}/api/leaderboard`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
                body: JSON.stringify(validScore),
            });
            expect((await from('203.0.113.1')).status).toBe(200);
            expect((await from('203.0.113.2')).status).toBe(429);
        } finally {
            await direct.close();
        }
    });

    it('does not rate limit reads', async () => {
        const limited = await startServer({ RATE_LIMIT_MAX: '1' });
        try {
            await post(limited.base, validScore);
            for (let i = 0; i < 5; i++) {
                expect((await fetch(`${limited.base}/api/leaderboard/easy`)).status).toBe(200);
            }
        } finally {
            await limited.close();
        }
    });

    it('allows submissions again once the window passes', async () => {
        const limited = await startServer({ RATE_LIMIT_MAX: '1', RATE_LIMIT_WINDOW_MS: '50' });
        try {
            expect((await post(limited.base, validScore)).status).toBe(200);
            expect((await post(limited.base, validScore)).status).toBe(429);
            await new Promise((r) => setTimeout(r, 80));
            expect((await post(limited.base, validScore)).status).toBe(200);
        } finally {
            await limited.close();
        }
    });
});

describe('data file handling', () => {
    it('starts empty when no data file exists yet', async () => {
        expect(fs.existsSync(server.dataFile)).toBe(false);
        expect(await (await fetch(`${server.base}/api/leaderboard`)).json()).toEqual({});
    });

    it('recovers from a corrupt data file instead of crashing', async () => {
        fs.writeFileSync(server.dataFile, 'not valid json{{{');
        const resp = await fetch(`${server.base}/api/leaderboard`);
        expect(resp.status).toBe(200);
        expect(await resp.json()).toEqual({});
    });
});

describe('numeric field hardening', () => {
    // hints and level are rendered by the frontend. Unvalidated they were a
    // stored XSS vector: only `name` was ever sanitised.
    it('coerces a markup payload in hints to a number', async () => {
        const resp = await post(server.base, {
            ...validScore,
            hints: '<img src=x onerror=alert(1)>',
        });
        expect(resp.status).toBe(200);
        expect((await resp.json()).entry.hints).toBe(0);
    });

    it('coerces a markup payload in level to null', async () => {
        const resp = await post(server.base, { ...validScore, level: '<b>x</b>' });
        expect((await resp.json()).entry.level).toBeNull();
    });

    it('stores no string values for numeric fields', async () => {
        await post(server.base, { ...validScore, hints: '3', level: '9', time: '55' });
        const [entry] = server.readData().easy;
        expect(typeof entry.hints).toBe('number');
        expect(typeof entry.level).toBe('number');
        expect(typeof entry.time).toBe('number');
    });

    it('rejects a non-numeric time rather than storing NaN', async () => {
        const resp = await post(server.base, { ...validScore, time: 'fast' });
        expect(resp.status).toBe(400);
        expect(server.readData()).toEqual({});
    });

    it('rejects a negative time', async () => {
        expect((await post(server.base, { ...validScore, time: -5 })).status).toBe(400);
    });

    it('rejects an absurdly large time', async () => {
        expect((await post(server.base, { ...validScore, time: 1e12 })).status).toBe(400);
    });

    it('clamps hints to the number of cells', async () => {
        const resp = await post(server.base, { ...validScore, hints: 99999 });
        expect((await resp.json()).entry.hints).toBe(81);
    });

    it('floors a negative hint count at zero', async () => {
        const resp = await post(server.base, { ...validScore, hints: -3 });
        expect((await resp.json()).entry.hints).toBe(0);
    });

    it('rejects a level below 1 as null', async () => {
        const resp = await post(server.base, { ...validScore, level: 0 });
        expect((await resp.json()).entry.level).toBeNull();
    });
});

describe('auto-notes flag', () => {
    it('records when auto-notes was used', async () => {
        const resp = await post(server.base, { ...validScore, autoNotes: true });
        expect((await resp.json()).entry.autoNotes).toBe(true);
    });

    it('defaults to false when omitted', async () => {
        const resp = await post(server.base, validScore);
        expect((await resp.json()).entry.autoNotes).toBe(false);
    });

    // Only a real boolean counts, so a truthy string cannot smuggle it through
    // — or, worse, reach the leaderboard table as markup.
    it('coerces any non-boolean to false', async () => {
        for (const value of ['yes', 1, {}, '<b>x</b>']) {
            const resp = await post(server.base, { ...validScore, autoNotes: value });
            expect((await resp.json()).entry.autoNotes, String(value)).toBe(false);
        }
    });

    it('persists the flag', async () => {
        await post(server.base, { ...validScore, autoNotes: true });
        expect(server.readData().easy[0].autoNotes).toBe(true);
    });
});
