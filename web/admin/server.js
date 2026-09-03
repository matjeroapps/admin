import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5173;
const HOST = process.env.HOSTNAME || '0.0.0.0';
const DIST_DIR = path.resolve(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

export function createStaticServer(distPath = DIST_DIR) {
  const indexPath = path.join(distPath, 'index.html');

  return http.createServer((req, res) => {
    try {
      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = parsedUrl.pathname;

      // 1. Do NOT swallow API routes with SPA fallback
      if (pathname.startsWith('/v1/') || pathname.startsWith('/api/')) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'not_found', message: 'API route not found' } }));
        return;
      }

      // 2. Normalize asset file path for static lookup
      const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
      const filePath = path.join(distPath, safePath);

      // Prevent directory traversal
      if (!filePath.startsWith(distPath)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      // 3. Serve actual static asset if file exists
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // 4. SPA Fallback: serve index.html for application routes (e.g. /auth/callback?code=...&state=..., /)
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
        fs.createReadStream(indexPath).pipe(res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createStaticServer();
  server.listen(PORT, HOST, () => {
    console.log(`Admin SPA static server running at http://${HOST}:${PORT}`);
  });
}
