/**
 * Serve dist/ one directory down, standing in for a static host serving the
 * site from a subdirectory rather than the domain root.
 *
 * Used by the Playwright "subpath" project. An absolute asset path anywhere in
 * the build would 404 here while working perfectly at the domain root, which is
 * exactly the failure this catches before a deploy rather than after.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PREFIX = '/sudoku';
const PORT = Number(process.env.SUBPATH_PORT) || 4322;
const dist = path.resolve('dist');

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);

    if (!url.startsWith(PREFIX)) {
        res.writeHead(404).end('outside the project path');
        return;
    }

    let file = path.join(dist, url.slice(PREFIX.length) || '/');
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file)) {
        res.writeHead(404).end('not found');
        return;
    }

    res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => {
    console.log(`Serving dist/ at http://127.0.0.1:${PORT}${PREFIX}/`);
});
