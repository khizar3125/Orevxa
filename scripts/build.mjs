#!/usr/bin/env node
/**
 * Orvexa Studio production build.
 *
 * - Bundles the Studio (with lazy World/export/path-trace chunks), Modeler and
 *   the standalone player with esbuild.
 * - Content-hashes every asset, adds Subresource Integrity to the HTML.
 * - Emits a build-specific service worker, deploy headers and a size report.
 *
 * Output: dist/ — a fully static site with zero runtime dependencies.
 */
import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const assetsDir = path.join(dist, 'assets');
const args = new Set(process.argv.slice(2));
const withSourcemaps = args.has('--sourcemap') || process.env.ORVEXA_SOURCEMAP === '1';
const buffered = new Map();
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const startedAt = Date.now();

const c = { dim: '\x1b[2m', bold: '\x1b[1m', green: '\x1b[32m', cyan: '\x1b[36m', magenta: '\x1b[35m', red: '\x1b[31m', reset: '\x1b[0m' };
const step = (message) => console.log(`${c.cyan}▸${c.reset} ${message}`);
const ok = (message) => console.log(`${c.green}✓${c.reset} ${message}`);
const fail = (message) => console.error(`${c.red}✗ ${message}${c.reset}`);

function sha384(buffer) { return `sha384-${createHash('sha384').update(buffer).digest('base64')}`; }
function shortHash(buffer) { return createHash('sha256').update(buffer).digest('hex').slice(0, 12); }
function kb(bytes) { return `${(bytes / 1024).toFixed(1)} kB`; }

/** Serve the two studio stylesheets as one bundle without adding a source file. */
const studioCssEntry = {
  name: 'orvexa-studio-css',
  setup(builder) {
    builder.onResolve({ filter: /^orvexa-studio-css$/ }, () => ({ path: 'orvexa-studio-css', namespace: 'orvexa-css' }));
    builder.onLoad({ filter: /.*/, namespace: 'orvexa-css' }, () => ({
      contents: '@import "./styles.css";\n@import "./ui.css";\n',
      resolveDir: path.join(root, 'src'),
      loader: 'css',
    }));
  },
};

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

step('Cleaning dist/');
await rm(dist, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });

step('Bundling Studio, Modeler and player');
let result;
try {
  result = await build({
    absWorkingDir: root,
    entryPoints: {
      studio: 'src/main.js',
      modeler: 'src/modeler.js',
      player: 'src/play.js',
      'studio-css': 'orvexa-studio-css',
      'modeler-css': 'src/modeler.css',
      'world-css': 'src/studio/aetherfall-game.css',
    },
    outdir: assetsDir,
    bundle: true,
    format: 'esm',
    splitting: true,
    minify: true,
    sourcemap: withSourcemaps ? true : false,
    target: ['es2022', 'chrome110', 'safari16', 'firefox110'],
    entryNames: '[name]-[hash]',
    chunkNames: 'chunk-[hash]',
    assetNames: '[name]-[hash]',
    metafile: true,
    legalComments: 'none',
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [studioCssEntry],
    banner: { js: '/* Orvexa Studio — production bundle. Source: github.com/khizar3125/Orevxa */' },
  });
} catch (error) {
  fail('Bundle failed');
  for (const item of error.errors || []) {
    console.error(`  ${item.text}${item.location ? ` (${item.location.file}:${item.location.line})` : ''}`);
  }
  process.exit(1);
}

/** Map an entry name to its emitted, content-hashed output file. */
function outputFor(entryName, extension) {
  const pattern = new RegExp(`(?:^|/)${entryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-[A-Za-z0-9_-]+\\.${extension}$`);
  for (const file of Object.keys(result.metafile.outputs)) {
    const rel = path.relative(dist, path.resolve(root, file)).split(path.sep).join('/');
    if (pattern.test(rel)) return rel;
  }
  return null;
}
const bundle = {
  studio: outputFor('studio', 'js'),
  modeler: outputFor('modeler', 'js'),
  player: outputFor('player', 'js'),
  studioCss: outputFor('studio-css', 'css'),
  modelerCss: outputFor('modeler-css', 'css'),
  worldCss: outputFor('world-css', 'css'),
};
for (const [key, value] of Object.entries(bundle)) {
  if (!value) { fail(`Missing bundle output for ${key}`); process.exit(1); }
}
ok(`studio ${c.dim}${bundle.studio}${c.reset}`);
ok(`modeler ${c.dim}${bundle.modeler}${c.reset}`);
ok(`player ${c.dim}${bundle.player}${c.reset}`);

const fileBuffer = async (rel) => readFile(path.join(dist, rel));
const integrity = {
  studio: sha384(await fileBuffer(bundle.studio)),
  modeler: sha384(await fileBuffer(bundle.modeler)),
  player: sha384(await fileBuffer(bundle.player)),
  studioCss: sha384(await fileBuffer(bundle.studioCss)),
  modelerCss: sha384(await fileBuffer(bundle.modelerCss)),
  worldCss: sha384(await fileBuffer(bundle.worldCss)),
};

const initial = { studio: initialPayload(bundle.studio), modeler: initialPayload(bundle.modeler), player: initialPayload(bundle.player) };
ok(`initial Studio payload ${kb(initial.studio.gzip)} gzipped (${initial.studio.files.length} files)`);

step('Rewriting HTML entry points');
const cssTag = (rel, hash) => `    <link rel="stylesheet" href="./${rel}" integrity="${hash}" crossorigin="anonymous" />`;
const scriptTag = (rel, hash) => `    <script type="module" src="./${rel}" integrity="${hash}" crossorigin="anonymous"></script>`;

const SOURCE_CSS = {
  './src/styles.css': { out: bundle.studioCss, hash: integrity.studioCss, merge: true },
  './src/ui.css': null,
  './src/modeler.css': { out: bundle.modelerCss, hash: integrity.modelerCss },
  './src/studio/aetherfall-game.css': { out: bundle.worldCss, hash: integrity.worldCss },
};
const SOURCE_JS = {
  './src/main.js': { out: bundle.studio, hash: integrity.studio },
  './src/play.js': { out: bundle.player, hash: integrity.player },
  './src/modeler.js': { out: bundle.modeler, hash: integrity.modeler },
};

/** Sum the gzipped weight of everything an entry imports statically. */
function initialPayload(entryRel) {
  const index = new Map();
  for (const [abs, meta] of Object.entries(result.metafile.outputs)) {
    index.set(path.relative(dist, path.resolve(root, abs)).split(path.sep).join('/'), meta);
  }
  const seen = new Set();
  const stack = [entryRel];
  while (stack.length) {
    const rel = stack.pop();
    if (!rel || seen.has(rel) || !index.has(rel)) continue;
    seen.add(rel);
    for (const dep of index.get(rel).imports || []) {
      if (dep.kind !== 'import-statement') continue;
      stack.push(path.relative(dist, path.resolve(root, dep.path)).split(path.sep).join('/'));
    }
  }
  let bytes = 0;
  let gzip = 0;
  for (const rel of seen) {
    if (!rel.endsWith('.js') && !rel.endsWith('.css')) continue;
    const buffer = requireBuffer(path.join(dist, rel));
    bytes += buffer.length;
    gzip += gzipSync(buffer, { level: 9 }).length;
  }
  return { files: [...seen], bytes, gzip };
}
function requireBuffer(file) {
  const cached = buffered.get(file);
  if (cached) return cached;
  const buffer = readFileSync(file);
  buffered.set(file, buffer);
  return buffer;
}

const buildHash = shortHash(Buffer.concat(Object.values(bundle).map((rel) => Buffer.from(rel))));
const pages = ['index.html', 'play.html', 'modeler.html'];
for (const page of pages) {
  let html = await readFile(path.join(root, page), 'utf8');

  html = html.replace(/[ \t]*<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*\/?>\s*\n?/g, (match, href) => {
    if (!(href in SOURCE_CSS)) return match;
    const target = SOURCE_CSS[href];
    if (target === null) return '';
    return `${cssTag(target.out, target.hash)}\n`;
  });

  html = html.replace(/[ \t]*<script([^>]*?)src="([^"]+)"([^>]*?)><\/script>\s*\n?/g, (match, pre, src, post) => {
    if (!(src in SOURCE_JS)) return match;
    return `${scriptTag(SOURCE_JS[src].out, SOURCE_JS[src].hash)}\n`;
  });

  html = html.replace('</head>', `    <meta name="orvexa-build" content="${buildHash}" />\n  </head>`);
  await writeFile(path.join(dist, page), html);
  const left = [...html.matchAll(/(?:src|href)="\.\/(src|public)\//g)].map((match) => match[0]);
  if (left.length) { fail(`${page} still references source files: ${left.join(', ')}`); process.exit(1); }
}
ok('HTML references hashed assets with SRI');

step('Copying static assets');
const publicDir = path.join(root, 'public');
for (const file of await walk(publicDir)) {
  const rel = path.relative(publicDir, file);
  const target = path.join(dist, rel);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(file, target);
}
ok('public/ copied (icons, manifest, source service worker)');

step('Generating the build-specific service worker');
const builtAssets = (await walk(assetsDir))
  .map((file) => `./${path.relative(dist, file).split(path.sep).join('/')}`)
  .filter((rel) => !rel.endsWith('.map'));
const swSource = await readFile(path.join(publicDir, 'sw.js'), 'utf8');
const precache = ['./', './index.html', './play.html', './modeler.html', './manifest.webmanifest', './orvexa-mark.svg', './icons/orvexa-192.png', './icons/orvexa-512.png', ...builtAssets];
const sw = swSource
  .replace(/const ORVEXA_SW_VERSION = '[^']*';/, `const ORVEXA_SW_VERSION = '${pkg.version}-${buildHash}';`)
  .replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = ${JSON.stringify(precache, null, 2)};`);
await writeFile(path.join(dist, 'sw.js'), sw);
ok(`sw.js precaches ${precache.length} URLs`);

step('Writing deployment metadata');
const headers = `# Orvexa Studio — Netlify / compatible static host headers
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  X-Frame-Options: SAMEORIGIN
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; media-src 'self' data: blob:; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/sw.js
  Cache-Control: no-cache

/*.html
  Cache-Control: no-cache
`;
await writeFile(path.join(dist, '_headers'), headers);

const redirects = `/play            /play.html            200
/modeler         /modeler.html         200
/studio          /index.html           200
`;
await writeFile(path.join(dist, '_redirects'), redirects);

await writeFile(path.join(dist, 'README-DEPLOY.txt'), `Orvexa Studio ${pkg.version} — production build
${'='.repeat(40)}

Deploy the contents of this directory to any static host (Netlify, Cloudflare
Pages, GitHub Pages, S3, nginx). No backend, database or API keys are required.

- index.html    Studio (editor, scene engine, AI agent, templates)
- play.html     Aetherfall standalone player
- modeler.html  Mesh modeler
- sw.js         Offline cache (update-safe: waits for the user to accept)
- _headers      Security + cache headers for Netlify-compatible hosts
- _redirects    Clean URL aliases for /play, /modeler and /studio

Build ${buildHash} · ${new Date().toISOString()}
`);

step('Measuring output');
const files = await walk(dist);
const rows = [];
for (const file of files) {
  if (file.endsWith('.map')) continue;
  const buffer = await readFile(file);
  const gzip = /\.(?:js|css|html|json|webmanifest|svg|txt)$/i.test(file) ? gzipSync(buffer, { level: 9 }).length : buffer.length;
  rows.push({ rel: path.relative(dist, file).split(path.sep).join('/'), bytes: buffer.length, gzip });
}
rows.sort((a, b) => b.gzip - a.gzip);
const total = rows.reduce((sum, row) => sum + row.bytes, 0);
const totalGzip = rows.reduce((sum, row) => sum + row.gzip, 0);
for (const row of rows.slice(0, 8)) console.log(`${c.dim}   ${row.rel.padEnd(42)}${kb(row.bytes).padStart(11)} ${c.dim}${kb(row.gzip).padStart(10)} gz${c.reset}`);

await writeFile(path.join(dist, 'build-meta.json'), JSON.stringify({
  name: pkg.name,
  version: pkg.version,
  buildHash,
  builtAt: new Date().toISOString(),
  entries: {
    studio: bundle.studio,
    modeler: bundle.modeler,
    player: bundle.player,
    studioCss: bundle.studioCss,
  },
  totalBytes: total,
  totalGzipBytes: totalGzip,
  initial: {
    studio: { files: initial.studio.files, bytes: initial.studio.bytes, gzip: initial.studio.gzip },
    modeler: { files: initial.modeler.files, bytes: initial.modeler.bytes, gzip: initial.modeler.gzip },
    player: { files: initial.player.files, bytes: initial.player.bytes, gzip: initial.player.gzip },
  },
  files: rows.map((row) => ({ path: row.rel, bytes: row.bytes, gzip: row.gzip })),
}, null, 2));

const budgets = { total: 4 * 1024 * 1024, studioInitial: 320 * 1024 };
if (totalGzip > budgets.total) {
  fail(`Production payload is ${kb(totalGzip)} gzipped, above the ${kb(budgets.total)} budget.`);
  process.exit(1);
}
if (initial.studio.gzip > budgets.studioInitial) {
  fail(`Studio initial payload is ${kb(initial.studio.gzip)} gzipped, above the ${kb(budgets.studioInitial)} budget. Lazy-load or trim a heavy module.`);
  process.exit(1);
}

console.log(`\n${c.green}${c.bold}Orvexa Studio ${pkg.version} built${c.reset} ${c.dim}·${c.reset} ${rows.length} files ${c.dim}·${c.reset} ${kb(total)} (${kb(totalGzip)} gzipped) ${c.dim}in ${Date.now() - startedAt} ms${c.reset}`);
console.log(`${c.dim}Studio initial: ${kb(initial.studio.gzip)} gz · Preview with: npm run preview${c.reset}`);
