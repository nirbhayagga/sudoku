import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
};

/** A private static host per test. Closing its listener produces real connection
 * refusal for the page AND service worker. Disable HTTP caching so an unavailable
 * network reload must use the installed worker, not the browser's HTTP cache.
 */
export async function offlineHost() {
    const root = resolve('dist');
    const server = createServer(async (req, res) => {
        try {
            const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
            const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
            if (!file.startsWith(root + sep)) {
                res.writeHead(403); res.end(); return;
            }
            const body = await readFile(file);
            res.writeHead(200, {
                'content-type': TYPES[extname(file)] || 'application/octet-stream',
                'cache-control': 'no-store',
                'service-worker-allowed': '/',
            });
            res.end(body);
        } catch {
            res.writeHead(404); res.end();
        }
    });
    const listen = port => new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
    });
    await listen(0);
    const port = server.address().port;
    const close = async () => {
        if (!server.listening) return;
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    };
    return {
        url: `http://127.0.0.1:${port}/`,
        disconnect: close,
        reconnect: () => listen(port),
        close,
    };
}
