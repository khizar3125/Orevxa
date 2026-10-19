import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preview = process.argv.includes('--preview');
const base = path.join(root, preview ? 'dist' : '.');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json; charset=utf-8' };
const server = createServer(async (req, res) => {
  let urlPath; try { urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end('Bad URL'); return; }
  if (urlPath === '/') urlPath = '/index.html';
  const resolved = path.resolve(base, `.${urlPath}`);
  if (!resolved.startsWith(base + path.sep) && resolved !== path.join(base, 'index.html')) { res.writeHead(403).end('Forbidden'); return; }
  try {
    const info = await stat(resolved); const file = info.isDirectory() ? path.join(resolved, 'index.html') : resolved;
    const body = await readFile(file); res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(body);
  } catch {
    if (!path.extname(urlPath)) { try { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(await readFile(path.join(base, 'index.html'))); return; } catch {} }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found');
  }
});
const port = Number(process.env.PORT || (preview ? 4173 : 5173));
server.listen(port, '0.0.0.0', () => console.log(`Orvexa Studio ${preview ? 'preview' : 'dev'} server: http://localhost:${port}`));
