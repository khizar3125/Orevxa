#!/usr/bin/env node
/**
 * Orvexa Studio static server.
 *
 *   node scripts/serve.mjs            # dev: serves the repository root
 *   node scripts/serve.mjs --preview  # preview: serves dist/
 *   node scripts/serve.mjs --dist     # alias for --preview
 *   PORT=8080 node scripts/serve.mjs
 *
 * Production behaviour: gzip, ETag/Last-Modified revalidation, immutable cache
 * for content-hashed assets, no-cache HTML, HEAD support, SPA fallback and
 * path-traversal protection. Binds 0.0.0.0 so container previews work.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const preview = args.has('--preview') || args.has('--dist');
const base = path.resolve(root, preview ? 'dist' : '.');

const PORT = Number(process.env.PORT || (preview ? 4173 : 5173));
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
  '.realm': 'text/plain; charset=utf-8',
  '.orv': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt', '.map', '.realm', '.orv']);
const ROUTE_ALIASES = new Map([
  ['/play', '/play.html'],
  ['/modeler', '/modeler.html'],
  ['/studio', '/index.html'],
]);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};

function log(message) {
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(`\x1b[2m${stamp}\x1b[0m ${message}`);
}

function cacheControlFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath);
  if (ext === '.html') return 'no-cache';
  // Content-hashed build output can live forever; source files revalidate.
  if (/[-.][0-9a-z]{8,}\.(?:js|mjs|css|woff2?|png|svg|webp)$/i.test(name)) return 'public, max-age=31536000, immutable';
  if (preview) return 'public, max-age=3600, must-revalidate';
  return 'no-cache';
}

function etagFor(buffer) {
  return `"${createHash('sha1').update(buffer).digest('base64url').slice(0, 22)}"`;
}

function safeResolve(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const aliased = ROUTE_ALIASES.get(decoded) || decoded;
  const resolved = path.resolve(base, `.${aliased.startsWith('/') ? aliased : `/${aliased}`}`);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  return resolved;
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function resolveFile(urlPath) {
  if (urlPath === '/' || urlPath === '') {
    const file = path.join(base, 'index.html');
    try { return { file, size: (await stat(file)).size }; } catch { return null; }
  }
  const resolved = safeResolve(urlPath);
  if (!resolved) return null;
  try {
    const info = await stat(resolved);
    if (info.isDirectory()) {
      const index = path.join(resolved, 'index.html');
      return (await exists(index)) ? { file: index, size: (await stat(index)).size } : null;
    }
    return { file: resolved, size: info.size };
  } catch {
    // In dev the site root also serves public/ assets (manifest, icons, sw.js).
    if (!preview) {
      const publicRoot = path.join(base, 'public');
      const candidate = path.join(publicRoot, path.relative(base, resolved));
      if (candidate.startsWith(publicRoot + path.sep)) {
        try {
          const info = await stat(candidate);
          if (info.isFile()) return { file: candidate, size: info.size };
        } catch { /* fall through to SPA handling */ }
      }
    }
    // Extension-less routes get the SPA shell so deep links keep working.
    if (!path.extname(resolved)) {
      const shell = path.join(base, 'index.html');
      if (await exists(shell)) return { file: shell, size: (await stat(shell)).size, spa: true };
    }
    return null;
  }
}

const server = createServer(async (req, res) => {
  const started = process.hrtime.bigint();
  const send = (status, body, headers = {}) => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    log(`${status} ${req.method} ${req.url} \x1b[2m${ms.toFixed(1)}ms\x1b[0m`);
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    if (req.method === 'HEAD') res.end();
    else res.end(body);
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(405, 'Method not allowed', { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
  }

  let urlPath;
  try { urlPath = new URL(req.url, 'http://localhost').pathname; }
  catch { return send(400, 'Bad URL', { 'Content-Type': 'text/plain; charset=utf-8' }); }

  let target;
  try { target = await resolveFile(urlPath); }
  catch { return send(400, 'Bad URL', { 'Content-Type': 'text/plain; charset=utf-8' }); }
  if (!target || !target.file) {
    return send(404, `Not found: ${urlPath}`, { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  const ext = path.extname(target.file).toLowerCase();
  let body;
  try { body = await readFile(target.file); }
  catch { return send(500, 'Could not read file', { 'Content-Type': 'text/plain; charset=utf-8' }); }

  const etag = etagFor(body);
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': cacheControlFor(target.file),
    ETag: etag,
    'Last-Modified': new Date((await stat(target.file)).mtimeMs).toUTCString(),
    Vary: 'Accept-Encoding',
  };
  if (target.spa) headers['X-Orvexa-SPA-Fallback'] = '1';

  if (req.headers['if-none-match'] === etag) {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    log(`304 ${req.method} ${req.url} \x1b[2m${ms.toFixed(1)}ms\x1b[0m`);
    res.writeHead(304, { ...SECURITY_HEADERS, ...headers });
    return res.end();
  }

  const acceptsGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
  if (acceptsGzip && COMPRESSIBLE.has(ext) && body.length > 1024) {
    body = gzipSync(body, { level: 9 });
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = String(body.length);
  } else {
    headers['Content-Length'] = String(body.length);
  }
  send(200, body, headers);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try: PORT=${PORT + 1} node scripts/serve.mjs${preview ? ' --preview' : ''}`);
  } else {
    console.error('Server error:', error.message);
  }
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log(`Stopping Orvexa ${preview ? 'preview' : 'dev'} server…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}

server.listen(PORT, HOST, () => {
  log(`Orvexa Studio ${preview ? '\x1b[35mpreview\x1b[0m' : '\x1b[36mdev\x1b[0m'} server → \x1b[4mhttp://localhost:${PORT}\x1b[0m \x1b[2m(${path.relative(root, base) || '.'})\x1b[0m`);
});
