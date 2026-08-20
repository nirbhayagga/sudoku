/**
 * Zero-dependency static file server, so `npm run dev` works without python.
 *
 *   node scripts/serve.js .      serve the source tree (no build needed)
 *   node scripts/serve.js dist   serve a production build
 *
 * Requests to /api/* are proxied to the leaderboard API (default :3001) so the
 * local setup matches what nginx does in Docker. If nothing is listening there,
 * the proxy fails and the app hides its leaderboard UI, exactly as in production.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] || '.');
const port = Number(process.env.PORT) || 8000;
const apiPort = Number(process.env.API_PORT) || 3001;

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

function proxyToApi(req, res) {
    const upstream = http.request(
        { host: '127.0.0.1', port: apiPort, path: req.url, method: req.method, headers: req.headers },
        (up) => {
            res.writeHead(up.statusCode, up.headers);
            up.pipe(res);
        }
    );
    upstream.on('error', () => {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end('{"error":"leaderboard API not running"}');
    });
    req.pipe(upstream);
}

const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) return proxyToApi(req, res);

    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = path.join(dir, urlPath);

    // Contain the resolved path inside the served directory.
    if (!filePath.startsWith(dir)) {
        res.writeHead(403).end('Forbidden');
        return;
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
    }

    res.writeHead(200, {
        'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream',
        // No caching in dev — the whole point is seeing edits immediately.
        'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
    console.log(`Serving ${dir} at http://localhost:${port}`);
    console.log(`Proxying /api/ to http://localhost:${apiPort}`);
});
