import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { BANK_SIZES } from '../difficulties.js';

/**
 * Each suite gets a fresh module instance (so the in-memory rate limiter resets)
 * pointed at a throwaway DATA_FILE, then binds port 0 and talks to it over HTTP.
 */
async function startServer(env = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-lb-'));
    const dataFile = path.join(dir, 'leaderboard.json');

    vi.resetModules();
    const previous = { ...process.env };
    Object.assign(process.env, { DATA_FILE: dataFile, RATE_LIMIT_MAX: '1000', CORS_ORIGIN: '', ...env });

    const { default: app } = await import('../leaderboard-api/server.js');
    let server;
    try {
        server = await new Promise((resolve, reject) => {
            const s = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(s));
        });
    } catch (error) {
        fs.rmSync(dir, { recursive: true, force: true });
        process.env = previous;
        throw error;
    }
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
        body: JSON.stringify(body && typeof body === 'object' && !Array.isArray(body) ? { bankVersion: 2, ...body } : body),
    });

const validScore = { bankVersion: 2, name: 'Nirb', difficulty: 'easy', time: 120, hints: 0, level: 7 };

let server;
beforeEach(async () => {
    server = undefined;
    server = await startServer();
});
afterEach(async () => {
    await server?.close();
});

describe('GET /api/health', () => {
    it('reports ok — this is what gates the leaderboard UI', async () => {
        const resp = await fetch(`${server.base}/api/health`);
        expect(resp.status).toBe(200);
        expect(await resp.json()).toEqual({ status: 'ok', bankVersion: 2 });
    });
});

describe('POST /api/leaderboard', () => {
    it('refuses oversized bodies — a score is under 1 kB', async () => {
        const resp = await post(server.base, { ...validScore, name: 'x'.repeat(20000) });
        expect(resp.status).toBe(413);
        expect(await resp.json()).toEqual({ error: 'Request body too large' });
    });

    it('accepts a valid score and returns its rank', async () => {
        const resp = await post(server.base, validScore);
        expect(resp.status).toBe(200);

        const body = await resp.json();
        expect(body.success).toBe(true);
        expect(body.rank).toBe(1);
        expect(body.entry).toMatchObject({ name: 'Nirb', difficulty: 'easy', time: 120, level: 7 });
        expect(body.entry.date).toBeTruthy();
    });

    it('can reload a name truncated at whitespace', async () => {
        await post(server.base, { ...validScore, name: 'x'.repeat(19) + ' more' });
        const response = await fetch(`${server.base}/api/leaderboard/easy`);
        expect((await response.json())[0].name).toBe('x'.repeat(19) + ' ');
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

    it.each(['nonsense', 'constructor', '__proto__', 'toString'])('rejects invalid difficulty %s', async (difficulty) => {
        const response = await fetch(`${server.base}/api/leaderboard/${difficulty}`);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'Invalid difficulty' });
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

describe('mistakes', () => {
    it('records a bounded mistake count', async () => {
        expect((await (await post(server.base, { ...validScore, mistakes: 3 })).json()).entry.mistakes).toBe(3);
        expect((await (await post(server.base, { ...validScore, mistakes: -4 })).json()).entry.mistakes).toBe(0);
        expect((await (await post(server.base, { ...validScore, mistakes: 5000 })).json()).entry.mistakes).toBe(5000);
    });

    // A client from before the field is an unknown, not a perfect game.
    it('stores null when the client sends none', async () => {
        expect((await (await post(server.base, validScore)).json()).entry.mistakes).toBeNull();
    });

    it('never stores markup sent as mistakes', async () => {
        const entry = (await (await post(server.base, { ...validScore, mistakes: '<b>1</b>' })).json()).entry;
        expect(entry.mistakes).toBeNull();
    });
});

describe('level bounds', () => {
    // A level is a position in the bank; the API must know how big that is.
    it('caps levels at the size of each tier, matching the bank', async () => {
        const { LEVEL_LIMITS } = await import('../leaderboard-api/server.js');
        expect(LEVEL_LIMITS).toEqual(BANK_SIZES);
    });

    it('drops a level past the end of the bank rather than the score', async () => {
        const resp = await post(server.base, { ...validScore, level: 99999 });
        expect(resp.status).toBe(200);
        expect((await resp.json()).entry.level).toBeNull();
    });

    it('keeps the last level in a tier', async () => {
        const resp = await post(server.base, { ...validScore, difficulty: 'nightmare', level: BANK_SIZES.nightmare });
        expect((await resp.json()).entry.level).toBe(BANK_SIZES.nightmare);
    });
});

describe('data file', () => {
    it('leaves no temporary file behind after a write', async () => {
        await post(server.base, validScore);
        expect(fs.existsSync(`${server.dataFile}.tmp`)).toBe(false);
        expect(server.readData().easy).toHaveLength(1);
    });

    /**
     * Returning an empty board is the only way to keep serving, but the next
     * save would then overwrite whatever was salvageable. The original is
     * moved aside first so the loss is recoverable rather than silent.
     */
    it('sets a corrupt file aside instead of overwriting it', async () => {
        fs.writeFileSync(server.dataFile, '{"easy": [{"name": "half-writ');
        const read = await fetch(`${server.base}/api/leaderboard/easy`);
        expect(await read.json()).toEqual([]);

        await post(server.base, validScore);
        expect(server.readData().easy).toHaveLength(1);

        const dir = path.dirname(server.dataFile);
        const aside = fs.readdirSync(dir).filter((f) => f.includes('.corrupt-'));
        expect(aside).toHaveLength(1);
        expect(fs.readFileSync(path.join(dir, aside[0]), 'utf8')).toContain('half-writ');
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
    it.each([82, 1000, Number.MAX_SAFE_INTEGER])('persists and reloads cumulative safe-integer counters: %s', async count => {
        const response = await post(server.base, { ...validScore, hints: count, mistakes: count });
        expect(response.status).toBe(200);
        expect((await response.json()).entry).toMatchObject({ hints: count, mistakes: count });
        expect(server.readData().easy[0]).toMatchObject({ hints: count, mistakes: count });
        const entries = await (await fetch(`${server.base}/api/leaderboard/easy`)).json();
        expect(entries[0]).toMatchObject({ hints: count, mistakes: count });
    });

    it('bounds counters above the safe-integer range', async () => {
        const response = await post(server.base, {
            ...validScore, hints: Number.MAX_SAFE_INTEGER + 1, mistakes: Number.MAX_SAFE_INTEGER + 1,
        });
        expect(response.status).toBe(200);
        expect((await response.json()).entry).toMatchObject({
            hints: Number.MAX_SAFE_INTEGER, mistakes: Number.MAX_SAFE_INTEGER,
        });
    });

    it('retains the 24-hour leaderboard eligibility boundary', async () => {
        expect((await post(server.base, { ...validScore, time: 86400 })).status).toBe(200);
        expect((await post(server.base, { ...validScore, time: 86401 })).status).toBe(400);
    });

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

    it('preserves cumulative hints beyond the number of cells', async () => {
        const resp = await post(server.base, { ...validScore, hints: 99999 });
        expect((await resp.json()).entry.hints).toBe(99999);
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


describe('audit regressions', () => {
    it('persists assistance and mistakes through the real client-to-API contract', async () => {
        vi.stubGlobal('window', {
            SUDOKU_API_BASE: server.base,
            location: { protocol: 'http:', href: `${server.base}/` },
        });
        try {
            const client = await import('../leaderboard-client.js');
            expect(await client.checkHealth()).toBe(true);
            const result = await client.submitScore({ ...validScore, mistakes: 7, autoNotes: true });
            expect(result).toMatchObject({ success: true, ranked: true, rank: 1 });
            expect(server.readData().easy[0]).toMatchObject({ mistakes: 7, autoNotes: true });
            expect((await client.fetchLeaderboard('easy'))[0]).toMatchObject({ mistakes: 7, autoNotes: true });
        } finally { vi.unstubAllGlobals(); }
    });

    it('propagates rename failure and cleans the temporary file without altering stored scores', async () => {
        await post(server.base, validScore);
        const original = fs.readFileSync(server.dataFile, 'utf8');
        const rename = vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('disk failure'); });
        try {
            const response = await post(server.base, { ...validScore, name: 'Lost' });
            expect(response.status).toBe(500);
            expect(await response.json()).toEqual({ error: 'Unable to access leaderboard' });
            expect(fs.readFileSync(server.dataFile, 'utf8')).toBe(original);
            expect(fs.existsSync(`${server.dataFile}.tmp`)).toBe(false);
        } finally { rename.mockRestore(); }
    });

    it('never overwrites malformed data when backing it up fails', async () => {
        fs.writeFileSync(server.dataFile, '{broken');
        const rename = vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('backup failure'); });
        try {
            const response = await post(server.base, validScore);
            expect(response.status).toBe(500);
            expect(await response.json()).toEqual({ error: 'Unable to access leaderboard' });
            expect(fs.readFileSync(server.dataFile, 'utf8')).toBe('{broken');
        } finally { rename.mockRestore(); }
    });

    it('returns an explicit successful unranked result beyond the top 100', async () => {
        const entry = (await (await post(server.base, validScore)).json()).entry;
        fs.writeFileSync(server.dataFile, JSON.stringify({
            easy: Array.from({ length: 100 }, (_, i) => ({ ...entry, time: i, name: `P${i}` })),
        }));
        const response = await post(server.base, { ...validScore, time: 500 });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ success: true, ranked: false, rank: null });
        expect(server.readData().easy).toHaveLength(100);
        expect(server.readData().easy.some(e => e.time === 500)).toBe(false);
    });

    it('ranks duplicate submissions by identity rather than matching fields', async () => {
        const first = await (await post(server.base, validScore)).json();
        const second = await (await post(server.base, validScore)).json();
        expect(first.rank).toBe(1);
        expect(second.rank).toBe(2);
        expect(second.ranked).toBe(true);
    });

    it('propagates a failed atomic write and preserves the previous file', async () => {
        await post(server.base, validScore);
        const original = fs.readFileSync(server.dataFile, 'utf8');
        fs.mkdirSync(`${server.dataFile}.tmp`);
        const response = await post(server.base, { ...validScore, name: 'Lost' });
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: 'Unable to access leaderboard' });
        expect(fs.readFileSync(server.dataFile, 'utf8')).toBe(original);
    });

    it.each(['{broken secret', 'null', '[]', '42'])('returns generic JSON for invalid body %s', async body => {
        const response = await fetch(`${server.base}/api/leaderboard`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
        });
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'Invalid request body' });
    });

    it.each(['<<b>Bob</b>>', '<b title=">">Bob</b>', 'Bob<unfinished', '<'.repeat(9000) + 'Bob'])('never leaves angle brackets in extracted names (%#)', async name => {
        const response = await post(server.base, { ...validScore, name });
        const body = await response.json();
        if (response.status === 200) expect(body.entry.name).not.toMatch(/[<>]/);
        else expect(response.status).toBe(400);
    });

    it('preserves explicitly unknown mistakes as null', async () => {
        const body = await (await post(server.base, { ...validScore, mistakes: null })).json();
        expect(body.entry.mistakes).toBeNull();
    });

    it.each([null, [], 42, { easy: {} }, { constructor: [] }, { easy: [null] },
        { easy: [{ ...validScore, date: 'today', time: 'fast' }] },
    ])('backs up invalid persisted schema (%#)', async data => {
        const original = JSON.stringify(data);
        fs.writeFileSync(server.dataFile, original);
        const response = await fetch(`${server.base}/api/leaderboard`);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({});
        const backup = fs.readdirSync(path.dirname(server.dataFile)).find(f => f.includes('.corrupt-'));
        expect(backup).toBeTruthy();
        expect(fs.readFileSync(path.join(path.dirname(server.dataFile), backup), 'utf8')).toBe(original);
        expect((await post(server.base, validScore)).status).toBe(200);
    });

    it.each([
        { time: -1 }, { hints: '<b>1</b>' }, { name: '<b>Bob</b>' },
        { difficulty: 'evil' }, { level: BANK_SIZES.easy + 1 }, { mistakes: Number.MAX_SAFE_INTEGER + 1 },
        { hints: Number.MAX_SAFE_INTEGER + 1 },
        { autoNotes: 'true' }, { date: null },
    ])('rejects invalid persisted entry fields (%#)', async fields => {
        const entry = (await (await post(server.base, validScore)).json()).entry;
        fs.writeFileSync(server.dataFile, JSON.stringify({ easy: [{ ...entry, ...fields }] }));
        const response = await fetch(`${server.base}/api/leaderboard/easy`);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([]);
        expect(fs.existsSync(server.dataFile)).toBe(false);
    });

    it('loads and sorts current-bank entries with optional fields omitted', async () => {
        const old = (await (await post(server.base, validScore)).json()).entry;
        delete old.mistakes; delete old.autoNotes;
        fs.writeFileSync(server.dataFile, JSON.stringify({ easy: [old, { ...old, time: 10 }] }));
        const entries = await (await fetch(`${server.base}/api/leaderboard/easy`)).json();
        expect(entries.map(e => e.time)).toEqual([10, 120]);
        expect(entries[0]).toMatchObject({ mistakes: null, autoNotes: false });
    });
});

describe('CORS configuration', () => {
    it('does not grant cross-origin access by default', async () => {
        const response = await fetch(`${server.base}/api/health`, { headers: { Origin: 'https://other.example' } });
        expect(response.status).toBe(200);
        expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });

    it.each(['https://sudoku.example', '*', 'null'])('honors explicit CORS_ORIGIN %s', async origin => {
        const configured = await startServer({ CORS_ORIGIN: origin });
        try {
            const response = await fetch(`${configured.base}/api/leaderboard`, {
                method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
            });
            expect(response.status).toBe(204);
            expect(response.headers.get('access-control-allow-origin')).toBe(origin);
        } finally { await configured.close(); }
    });
});


describe('direct-run process shutdown', () => {
    async function launch() {
        const child = spawn(process.execPath, [fileURLToPath(new URL('../leaderboard-api/server.js', import.meta.url))], {
            env: { ...process.env, PORT: '0', DATA_FILE: server.dataFile },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let output = '';
        child.stdout.on('data', chunk => { output += chunk; });
        child.stderr.on('data', chunk => { output += chunk; });
        const closed = once(child, 'close');
        const cleanup = async () => {
            if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
            await closed;
        };
        try {
            await vi.waitFor(() => {
                expect(child.exitCode, output).toBeNull();
                expect(output).toMatch(/running on port (\d+)/);
            }, { timeout: 5000, interval: 10 });
            const port = Number(output.match(/running on port (\d+)/)[1]);
            return { child, closed, cleanup, port, output: () => output };
        } catch (error) {
            await cleanup();
            throw error;
        }
    }

    // Expect: 100-continue establishes that Express is reading an active body
    // before the signal, so this tests draining rather than just idle shutdown.
    async function beginUpload(port) {
        const body = JSON.stringify(validScore);
        const request = http.request({
            hostname: '127.0.0.1', port, path: '/api/leaderboard', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Expect: '100-continue' },
        });
        request.on('error', () => {}); // Forced shutdown deliberately closes the socket.
        const continued = once(request, 'continue');
        request.flushHeaders();
        await continued;
        return { request, body };
    }

    it.each(['SIGTERM', 'SIGINT'])('drains active requests, saves the score and exits cleanly on %s', async signal => {
        const process = await launch();
        let upload;
        try {
            upload = await beginUpload(process.port);
            expect(process.child.kill(signal)).toBe(true);
            await vi.waitFor(() => expect(process.output()).toContain(`Received ${signal}`), { timeout: 2000 });
            // A second signal is harmless while the first shutdown is draining.
            process.child.kill(signal);
            const response = once(upload.request, 'response');
            upload.request.end(upload.body);
            const [res] = await response;
            res.resume();
            expect(res.statusCode).toBe(200);
            await vi.waitFor(() => expect(process.child.exitCode).toBe(0), { timeout: 3000 });
            expect(await process.closed).toEqual([0, null]);
            expect(server.readData().easy[0]).toMatchObject(validScore);
        } finally {
            upload?.request.destroy();
            await process.cleanup();
        }
    });

    it('forces a bounded exit when an active upload never completes', async () => {
        const process = await launch();
        let upload;
        try {
            upload = await beginUpload(process.port);
            process.child.kill('SIGTERM');
            await vi.waitFor(() => expect(process.child.exitCode).toBe(1), { timeout: 8000, interval: 20 });
            expect(await process.closed).toEqual([1, null]);
            expect(process.output()).toContain('Leaderboard shutdown timed out');
            expect(server.readData()).toEqual({});
        } finally {
            upload?.request.destroy();
            await process.cleanup();
        }
    });
});


describe('bank revision contract', () => {
    it('rejects old or unversioned clients and mismatched board identities', async () => {
        for (const bankVersion of [undefined, 1, 3, '2']) {
            const response = await post(server.base, { ...validScore, bankVersion });
            expect(response.status).toBe(409);
        }
        expect((await post(server.base, { ...validScore, puzzleId: 'p0000000000000000' })).status).toBe(400);
        expect(server.readData()).toEqual({});
    });
    it('leaves an explicitly configured old-bank score file untouched', async () => {
        const old = { easy: [{ name: 'Previous', difficulty: 'easy', time: 123, hints: 0, level: 1, date: '2026-09-01T00:00:00.000Z' }] };
        const original = JSON.stringify(old);
        fs.writeFileSync(server.dataFile, original);
        expect((await fetch(`${server.base}/api/leaderboard/easy`)).status).toBe(500);
        expect((await post(server.base, validScore)).status).toBe(500);
        expect(fs.readFileSync(server.dataFile, 'utf8')).toBe(original);
        expect(fs.readdirSync(path.dirname(server.dataFile)).some(f => f.includes('.corrupt-'))).toBe(false);
    });
});
