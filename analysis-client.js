const abortError = () => Object.assign(new Error('Analysis cancelled.'), { name: 'AbortError' });

/** One active request per client. Termination interrupts even synchronous worker search. */
export function createAnalysisClient({ factory = async () => (await import('./worker-factory.js')).createWorker() } = {}) {
    let active = null;
    let serial = 0;
    const cancel = () => {
        if (!active) return;
        const job = active;
        active = null;
        clearTimeout(job.timer);
        job.worker?.terminate();
        job.reject(abortError());
    };
    const request = (kind, input, { onProgress = () => {}, timeoutMs = 20000 } = {}) => {
        cancel();
        return new Promise((resolve, reject) => {
            const job = { id: ++serial, worker: null, reject, timer: null };
            active = job;
            const finish = (error, result) => {
                if (active !== job) return;
                active = null;
                clearTimeout(job.timer);
                job.worker?.terminate();
                if (error) reject(error); else resolve(result);
            };
            job.timer = setTimeout(() => finish(Object.assign(new Error('Analysis reached its time limit. Try again or choose an easier target.'), { name: 'TimeoutError' })), timeoutMs);
            Promise.resolve().then(factory).then(worker => {
                if (active !== job) { worker.terminate(); return; }
                job.worker = worker;
                worker.onmessage = ({ data }) => {
                    if (active !== job || data.id !== job.id) return;
                    if (data.progress) { onProgress(data.progress); return; }
                    finish(data.error ? new Error(data.error) : null, data.result);
                };
                worker.onerror = () => finish(new Error('The analysis worker could not start. Reload and try again.'));
                worker.postMessage({ id: job.id, kind, input });
            }).catch(error => finish(error));
        });
    };
    return { request, cancel };
}
