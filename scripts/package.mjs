#!/usr/bin/env node
/**
 * Build the single release archive for Orvexa Studio.
 *
 *   release/orvexa-studio-<version>.zip          complete project + dist/
 *   release/orvexa-studio-<version>.zip.sha256   checksum
 *
 * The archive is produced with the project's own zero-dependency ZIP writer
 * (src/studio/zip.js) and then re-read to prove it is valid.
 */
import { readFile, readdir, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, unzip, unzipText } from '../src/studio/zip.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = path.join(root, 'release');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const c = { dim: '\x1b[2m', green: '\x1b[32m', red: '\x1b[31m', cyan: '\x1b[36m', reset: '\x1b[0m' };

const EXCLUDED_TOP_LEVEL = new Set(['.git', 'node_modules', 'release', '.cache', '.arena', 'coverage']);
const EXCLUDED_NAMES = new Set(['.DS_Store', 'Thumbs.db']);
const EXCLUDED_EXTENSIONS = new Set(['.log', '.zip', '.tmp']);

async function walk(dir, base = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (!base && EXCLUDED_TOP_LEVEL.has(entry.name)) continue;
    if (EXCLUDED_NAMES.has(entry.name)) continue;
    if (EXCLUDED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full, rel));
    else out.push({ rel, full });
  }
  return out;
}

const distIndex = await stat(path.join(root, 'dist', 'index.html')).catch(() => null);
if (!distIndex) {
  console.error(`${c.red}No production build found.${c.reset} Run "npm run build" first (or "npm run check").`);
  process.exit(1);
}

console.log(`${c.cyan}▸${c.reset} Collecting project files`);
const files = await walk(root);
const prefix = `orvexa-studio-${pkg.version}`;
const entries = {};
let sourceBytes = 0;
for (const file of files.sort((a, b) => a.rel.localeCompare(b.rel))) {
  const buffer = await readFile(file.full);
  entries[`${prefix}/${file.rel}`] = buffer;
  sourceBytes += buffer.length;
}

const notes = `Orvexa Studio ${pkg.version}
${'='.repeat(40)}

Complete project archive — source, tests, examples and the production build.

Quick start
  1. Unzip and open the folder.
  2. npm install          (esbuild + jsdom for tests/build only)
  3. npm run dev          http://localhost:5173
  4. npm test             full suite
  5. npm run check        tests + production build + release verification

Production
  dist/ is the deployable static site. Upload it to Netlify or any static host.
  No backend, database or API keys are required.

Contents
  src/          Studio, Modeler, language engine, UI kit, core modules
  tests/        Node test suite (unit, integration, boot smoke, build integrity)
  scripts/      build, serve, verify, package
  dist/         Hashed, minified, SRI-pinned production build
  public/       Manifest, service worker source, icons, robots.txt
  examples/     Aetherfall realm source
  PLAN.md       Architecture, roadmap and shipping checklist
  PROGRESS.txt  Continuation notes for the next session

Built ${new Date().toISOString()} · ${Object.keys(entries).length} files · ${(sourceBytes / 1024 / 1024).toFixed(2)} MB uncompressed
`;
entries[`${prefix}/RELEASE-NOTES.txt`] = new TextEncoder().encode(notes);

console.log(`${c.cyan}▸${c.reset} Writing archive (${Object.keys(entries).length} files)`);
const zip = zipSync(entries);
await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });
const zipName = `orvexa-studio-${pkg.version}.zip`;
const zipPath = path.join(releaseDir, zipName);
await writeFile(zipPath, zip);

console.log(`${c.cyan}▸${c.reset} Re-reading archive to verify it`);
const verified = await unzip(zip, { maxUncompressed: 64_000_000, maxEntryBytes: 32_000_000 });
const verifiedNames = Object.keys(verified);
const problems = [];
for (const name of Object.keys(entries)) {
  const content = verified[name];
  if (!content) { problems.push(`missing entry ${name}`); continue; }
  if (content.length !== entries[name].length) problems.push(`size mismatch ${name}`);
}
for (const required of ['index.html', 'package.json', 'PLAN.md', 'src/main.js', 'dist/index.html', 'dist/sw.js', 'tests/boot.test.js']) {
  if (!verified[`${prefix}/${required}`]) problems.push(`archive is missing ${required}`);
}
if (!unzipText(verified[`${prefix}/index.html`] || new Uint8Array()).includes('Orvexa Studio')) problems.push('index.html content did not round-trip');
if (problems.length) {
  console.error(`${c.red}Archive verification failed:${c.reset}\n${problems.slice(0, 10).join('\n')}`);
  process.exit(1);
}

const checksum = createHash('sha256').update(zip).digest('hex');
await writeFile(`${zipPath}.sha256`, `${checksum}  ${zipName}\n`);

console.log(`${c.green}✓${c.reset} ${path.relative(root, zipPath)} ${c.dim}${(zip.length / 1024 / 1024).toFixed(2)} MB · ${verifiedNames.length} entries${c.reset}`);
console.log(`${c.green}✓${c.reset} sha256 ${checksum}`);
console.log(`\n${c.dim}Deployable site: dist/ · Shareable archive: release/${zipName}${c.reset}`);
