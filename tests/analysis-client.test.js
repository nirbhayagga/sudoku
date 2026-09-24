import { describe, expect, it, vi } from 'vitest';
import { createAnalysisClient } from '../analysis-client.js';

const fakeWorker = () => ({ postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null });
describe('worker request lifecycle', () => {
    it('terminates a replaced request and discards its late result', async () => {
        const workers = [];
        const client = createAnalysisClient({ factory: () => { const worker = fakeWorker(); workers.push(worker); return worker; } });
        const first = client.request('assess', {});
        const cancelled = expect(first).rejects.toMatchObject({ name: 'AbortError' });
        await new Promise(resolve => setTimeout(resolve, 0));
        const second = client.request('assess', {});
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(workers[0].terminate).toHaveBeenCalledOnce();
        workers[0].onmessage({ data: { id: 1, result: 'stale' } });
        workers[1].onmessage({ data: { id: 2, result: 'current' } });
        await cancelled;
        await expect(second).resolves.toBe('current');
        expect(workers[1].terminate).toHaveBeenCalledOnce();
    });
    it('bounds a hung worker and permits a subsequent request', async () => {
        const worker = fakeWorker();
        const client = createAnalysisClient({ factory: () => worker });
        await expect(client.request('generate', {}, { timeoutMs: 5 })).rejects.toMatchObject({ name: 'TimeoutError' });
        expect(worker.terminate).toHaveBeenCalledOnce();
    });
    it('cancels while a worker factory is still loading', async () => {
        let ready;
        const client = createAnalysisClient({ factory: () => new Promise(resolve => { ready = resolve; }) });
        const request = client.request('hint', {});
        const cancelled = expect(request).rejects.toMatchObject({ name: 'AbortError' });
        await Promise.resolve();
        client.cancel();
        const worker = fakeWorker(); ready(worker);
        await cancelled;
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(worker.terminate).toHaveBeenCalledOnce();
        expect(worker.postMessage).not.toHaveBeenCalled();
    });
});
