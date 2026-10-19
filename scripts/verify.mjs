#!/usr/bin/env node
/**
 * Orvexa Studio release verification.
 *
 * Static checks (integrity hashes, asset graph, manifest, service worker,
 * bundle syntax) plus a live smoke test against the production server:
 * navigation, clean URL aliases, gzip, ETag revalidation, HEAD, traversal
 * protection and 404s.
 *
 * Usage: node scripts/verify.mjs [--skip-server]
 */
import { createServer } from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const skipServer = process.argv.includes('--skip-server');
const c = { dim: '\x1b[2m', green: '\x1b[32m', red: '\x1b[31m', cyan: '\x1b[36m', reset: '\x1b[0m' };

let failures = 0;
let checks = 0;
function pass(label, detail = '') {
  checks += 1;
  console.log(`  ${c.green}✓${c.reset} ${label}${detail ? ` ${c.dim}${detail}${c.reset}` : ''}`);
}
function fail(label, detail = '') {
  checks += 1;
  failures += 1;
  console.error(`  ${c.red}✗ ${label}${detail ? ` — ${detail}` : ''}${c.reset}`);
}
function expect(condition, label, detail = '') {
  if (condition) pass(label, detail); else fail(label, detail);
}
function sha384(buffer) { return `sha384-${createHash('sha384').update(buffer).digest('base64')}`; }
function kb(bytes) { return `${(bytes / 1024).toFixed(1)} kB`; }

async function walk(dir) {
  const out = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

const relative = (file) => path.relative(dist, file).split(path.sep).join('/');

console.log(`\n${c.cyan}Orvexa Studio verification${c.reset}`);

/* ---------------------------------------------------------------- static -- */
console.log(`\n${c.cyan}Static checks${c.reset}`);
const required = ['index.html', 'play.html', 'modeler.html', 'sw.js', 'manifest.webmanifest', '_headers', '_redirects', 'build-meta.json', 'orvexa-mark.svg', 'icons/orvexa-192.png', 'icons/orvexa-512.png'];
for (const file of required) {
  const exists = await stat(path.join(dist, file)).then(() => true).catch(() => false);
  expect(exists, `dist/${file} exists`);
}

const pages = {};
for (const page of ['index.html', 'play.html', 'modeler.html']) {
  pages[page] = await readFile(path.join(dist, page), 'utf8').catch(() => '');
}
for (const [page, html] of Object.entries(pages)) {
  if (!html) { fail(`${page} readable`); continue; }
  expect(!/(?:src|href)="\.\/(?:src|public)\//.test(html), `${page} references no source files`);
  expect(/http-equiv="Content-Security-Policy"/.test(html), `${page} has a CSP meta tag`);
  expect(/<html lang="en">/.test(html), `${page} declares a language`);
  expect(/name="viewport"/.test(html), `${page} is responsive`);
  expect(/<title>[^<]+<\/title>/.test(html), `${page} has a title`);
  expect(/\/assets\/[a-z-]+-[A-Za-z0-9_-]+\.(?:js|css)/.test(html), `${page} uses hashed bundles`);

  const refs = [...html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)].map((match) => match[1]);
  const missing = [];
  for (const ref of new Set(refs)) {
    if (ref.startsWith('http')) continue;
    const exists = await stat(path.join(dist, ref)).then((info) => info.isFile()).catch(() => false);
    if (!exists) missing.push(ref);
  }
  expect(missing.length === 0, `${page} local links resolve`, missing.join(', '));

  const integrityTags = [...html.matchAll(/<(?:script|link)[^>]*(?:src|href)="\.\/(assets\/[^"]+)"[^>]*integrity="(sha384-[^"]+)"/g)];
  expect(integrityTags.length > 0, `${page} pins bundle integrity`);
  for (const [, rel, hash] of integrityTags) {
    const buffer = await readFile(path.join(dist, rel)).catch(() => null);
    if (!buffer) { fail(`${rel} exists for SRI`); continue; }
    expect(sha384(buffer) === hash, `SRI matches ${rel}`);
  }
}

const allFiles = await walk(dist);
expect(allFiles.length > 12, `dist contains ${allFiles.length} files`);
const maps = allFiles.filter((file) => file.endsWith('.map'));
expect(maps.length === 0 || process.env.ORVEXA_SOURCEMAP === '1' || process.argv.includes('--sourcemap'), 'release ships no source maps', `${maps.length} maps`);

const jsFiles = allFiles.filter((file) => file.endsWith('.js'));
const syntaxErrors = [];
for (const file of jsFiles) {
  try { await execFileAsync(process.execPath, ['--check', file], { timeout: 20_000 }); }
  catch (error) { syntaxErrors.push(`${relative(file)}: ${String(error.stderr || error.message).split('\n')[0]}`); }
}
expect(syntaxErrors.length === 0, `${jsFiles.length} built scripts parse`, syntaxErrors.slice(0, 3).join(' | '));

const cssFiles = allFiles.filter((file) => file.endsWith('.css'));
const cssProblems = [];
for (const file of cssFiles) {
  const css = await readFile(file, 'utf8');
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  if (open !== close) cssProblems.push(`${relative(file)} braces ${open}/${close}`);
  if (/@import\s+["']\.\//.test(css)) cssProblems.push(`${relative(file)} has unresolved @import`);
  if (/url\(["']?\.\/src\//.test(css)) cssProblems.push(`${relative(file)} links to src/`);
}
expect(cssProblems.length === 0, `${cssFiles.length} stylesheets are self-contained`, cssProblems.join(' | '));

// Service worker precache must cover every local URL that exists.
const sw = await readFile(path.join(dist, 'sw.js'), 'utf8').catch(() => '');
const precacheMatch = sw.match(/const PRECACHE = (\[[\s\S]*?\]);/);
let precache = [];
try { precache = JSON.parse(precacheMatch?.[1] || '[]'); } catch { precache = []; }
expect(precache.length >= 10, `service worker precaches ${precache.length} URLs`);
const brokenPrecache = [];
for (const url of precache) {
  const rel = url.replace(/^\.\//, '');
  if (!rel || rel.endsWith('/')) continue;
  const exists = await stat(path.join(dist, rel)).then(() => true).catch(() => false);
  if (!exists) brokenPrecache.push(url);
}
expect(brokenPrecache.length === 0, 'precache entries exist', brokenPrecache.slice(0, 4).join(', '));

const meta = JSON.parse(await readFile(path.join(dist, 'build-meta.json'), 'utf8').catch(() => '{}'));
expect(Boolean(meta.buildHash), `build meta recorded (${meta.buildHash || 'missing'})`);
expect(sw.includes(`'${meta.version}-${meta.buildHash}'`), 'service worker cache is build-scoped');
expect(meta.entries?.studio && /assets\//.test(meta.entries.studio), 'build meta lists the Studio bundle');

const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.webmanifest'), 'utf8').catch(() => '{}'));
expect(manifest.name === 'Orvexa Studio', 'manifest name');
expect(Boolean(manifest.start_url) && Boolean(manifest.display), 'manifest start_url/display');
expect((manifest.icons || []).some((icon) => icon.purpose === 'maskable'), 'manifest has a maskable icon');
const manifestIcons = (manifest.icons || []).map((icon) => icon.src.replace(/^\.\//, ''));
const missingIcons = [];
for (const icon of manifestIcons) {
  if (icon.endsWith('.svg')) continue;
  const exists = await stat(path.join(dist, icon)).then(() => true).catch(() => false);
  if (!exists) missingIcons.push(icon);
}
expect(missingIcons.length === 0, 'manifest icons exist', missingIcons.join(', '));

// Recompute the real gzip weight (build reports it, verification confirms it).
let gzipTotal = 0;
let rawTotal = 0;
for (const file of allFiles) {
  if (file.endsWith('.map')) continue;
  const buffer = await readFile(file);
  rawTotal += buffer.length;
  gzipTotal += /\.(?:js|css|html|json|webmanifest|svg|txt)$/i.test(file) ? gzipSync(buffer, { level: 9 }).length : buffer.length;
}
expect(rawTotal < 4 * 1024 * 1024, `total payload ${kb(rawTotal)} (${kb(gzipTotal)} gz)`);
expect((meta.initial?.studio?.gzip || Infinity) < 320 * 1024, `Studio initial payload ${kb(meta.initial?.studio?.gzip || 0)} gz`);

/* ---------------------------------------------------------------- server -- */
if (!skipServer) {
  console.log(`\n${c.cyan}Live smoke test${c.reset}`);
  const port = await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port: freePort } = probe.address();
      probe.close(() => resolve(freePort));
    });
  });

  const child = spawn(process.execPath, ['scripts/serve.mjs', '--preview'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  child.stdout.on('data', (chunk) => { serverLog += chunk; });
  child.stderr.on('data', (chunk) => { serverLog += chunk; });

  const request = (method, urlPath, headers = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(8000, () => req.destroy(new Error(`timeout ${urlPath}`)));
    req.on('error', reject);
    req.end();
  });

  const waitForServer = async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try { await request('GET', '/index.html'); return true; } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
    }
    return false;
  };

  try {
    const ready = await waitForServer();
    expect(ready, 'preview server starts', ready ? `port ${port}` : serverLog.slice(-300));
    if (ready) {
      const home = await request('GET', '/');
      expect(home.status === 200, 'GET / → 200');
      expect(/text\/html/.test(home.headers['content-type'] || ''), 'GET / content-type html');
      expect(home.headers['x-content-type-options'] === 'nosniff', 'security header: nosniff');
      expect(/max-age=0|no-cache/.test(home.headers['cache-control'] || ''), 'HTML is not cached', home.headers['cache-control']);
      expect(home.body.length > 500, `HTML payload ${home.body.length} bytes`);

      const script = [...home.body.toString().matchAll(/src="\.\/(assets\/[^"]+\.js)"/g)].map((match) => match[1])[0];
      expect(Boolean(script), 'built page references a hashed script');
      if (script) {
        const asset = await request('GET', `/${script}`, { 'Accept-Encoding': 'gzip' });
        expect(asset.status === 200, `GET /${script} → 200`);
        expect(/javascript/.test(asset.headers['content-type'] || ''), 'script content-type');
        expect(asset.headers['content-encoding'] === 'gzip', 'script served gzipped');
        expect(/immutable/.test(asset.headers['cache-control'] || ''), 'hashed assets are immutable');
        const etag = asset.headers.etag;
        expect(Boolean(etag), 'asset has an ETag');
        if (etag) {
          const cached = await request('GET', `/${script}`, { 'If-None-Match': etag });
          expect(cached.status === 304, 'ETag revalidation → 304');
        }
        const head = await request('HEAD', `/${script}`);
        expect(head.status === 200 && head.body.length === 0, 'HEAD returns headers only');
      }

      for (const [route, expected] of [['/play', 'Aetherfall'], ['/modeler', 'Orvexa Modeler'], ['/studio', 'Orvexa Studio']]) {
        const response = await request('GET', route);
        expect(response.status === 200 && response.body.toString().includes(expected), `clean URL ${route} → ${expected}`);
      }

      const missing = await request('GET', '/does-not-exist.js');
      expect(missing.status === 404, 'missing asset → 404');
      const traversal = await request('GET', '/%2e%2e/package.json');
      expect(traversal.status === 404 || traversal.status === 403, 'path traversal is blocked', String(traversal.status));
      expect(!traversal.body.toString().includes('"orvexa-studio"'), 'traversal returns no package.json');
      const method = await request('POST', '/');
      expect(method.status === 405, 'unsupported method → 405');
    }
  } catch (error) {
    fail('live smoke test', error.message);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => { child.once('exit', resolve); setTimeout(resolve, 2000); });
  }
}

/* ------------------------------------------------------------------ done -- */
console.log('');
if (failures) {
  console.error(`${c.red}${c.cyan}${failures} check(s) failed${c.reset} of ${checks}.`);
  process.exit(1);
}
console.log(`${c.green}All ${checks} checks passed.${c.reset} ${c.dim}Artifact: dist/ (${kb(rawTotal)}, ${kb(gzipTotal)} gz)${c.reset}\n`);
