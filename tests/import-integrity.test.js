/**
 * Module-graph integrity: every relative import must resolve, every named
 * import must exist in its target, and every source file must be reachable
 * from a real entry point.
 *
 * This is the check that catches "page silently died on a bad import" bugs
 * (e.g. importing `parseOBJ` from the wrong module) without a browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY_POINTS = ['src/main.js', 'src/modeler.js', 'src/play.js'];

async function walk(dir, extension = '.js') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full, extension));
    else if (entry.name.endsWith(extension)) out.push(full);
  }
  return out;
}

const sources = new Map();
for (const file of await walk(path.join(root, 'src'))) {
  sources.set(path.relative(root, file).split(path.sep).join('/'), await readFile(file, 'utf8'));
}

/** Collect exported names, following `export * from` chains. */
function exportsOf(relPath, seen = new Set()) {
  if (seen.has(relPath)) return new Map();
  seen.add(relPath);
  const source = sources.get(relPath);
  if (source === undefined) return new Map();
  const names = new Map();
  for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) names.set(match[1], 'function');
  for (const match of source.matchAll(/export\s+(?:const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) names.set(match[1], 'value');
  if (/export\s+default\b/.test(source)) names.set('default', 'default');
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of match[1].split(',')) {
      const cleaned = part.trim();
      if (!cleaned) continue;
      const [local, exported] = cleaned.split(/\s+as\s+/).map((item) => item.trim());
      names.set(exported || local, 'value');
    }
  }
  // export * from './x.js' — union of the target's names (ambiguous names are rare here).
  for (const match of source.matchAll(/export\s+\*\s+from\s+['"](\.[^'"]+)['"]/g)) {
    const target = resolve(relPath, match[1]);
    for (const [name, kind] of exportsOf(target, seen)) if (!names.has(name)) names.set(name, kind);
  }
  return names;
}

function resolve(fromRel, specifier) {
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), specifier));
}

const staticImports = [];
const dynamicImports = [];
for (const [rel, source] of sources) {
  for (const match of source.matchAll(/import\s+([\s\S]*?)\s+from\s+['"](\.[^'"]+)['"]/g)) {
    staticImports.push({ from: rel, clause: match[1].trim(), specifier: match[2] });
  }
  for (const match of source.matchAll(/import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    dynamicImports.push({ from: rel, specifier: match[1] });
  }
  for (const match of source.matchAll(/export\s+(?:\*|\{([^}]*)\})\s+from\s+['"](\.[^'"]+)['"]/g)) {
    staticImports.push({ from: rel, clause: match[1] ? `{${match[1]}}` : '*', specifier: match[2], reexport: true });
  }
}

test('every relative import resolves to a real source file', async () => {
  const missing = [];
  for (const item of [...staticImports, ...dynamicImports]) {
    const target = resolve(item.from, item.specifier);
    const exists = await stat(path.join(root, target)).then((info) => info.isFile()).catch(() => false);
    if (!exists) missing.push(`${item.from} → ${item.specifier}`);
  }
  assert.deepEqual(missing, []);
});

test('every named import exists in its target module', () => {
  const problems = [];
  for (const item of staticImports) {
    if (item.clause === '*') continue;
    const target = resolve(item.from, item.specifier);
    const exported = exportsOf(target);
    const clause = item.clause;
    // Default import: `thing from` or `thing, { … } from`
    if (!clause.startsWith('{')) {
      const defaultName = clause.split(',')[0].trim();
      if (defaultName && !defaultName.startsWith('*') && !exported.has('default') && !exported.has(defaultName)) {
        problems.push(`${item.from}: default import "${defaultName}" missing in ${target}`);
      }
    }
    const braces = clause.match(/\{([\s\S]*)\}/);
    if (!braces) continue;
    for (const raw of braces[1].split(',')) {
      const part = raw.trim();
      if (!part) continue;
      const [imported, local] = part.split(/\s+as\s+/).map((value) => value.trim());
      if (!exported.has(imported)) problems.push(`${item.from}: "${imported}"${local && local !== imported ? ` (as ${local})` : ''} is not exported by ${target}`);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('every source module is reachable from an entry point', () => {
  const resolved = new Map();
  for (const [rel, source] of sources) {
    const deps = new Set();
    for (const match of source.matchAll(/import\s+[\s\S]*?from\s+['"](\.[^'"]+)['"]/g)) deps.add(resolve(rel, match[1]));
    for (const match of source.matchAll(/import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)) deps.add(resolve(rel, match[1]));
    for (const match of source.matchAll(/export\s+(?:\*|\{[^}]*\})\s+from\s+['"](\.[^'"]+)['"]/g)) deps.add(resolve(rel, match[1]));
    resolved.set(rel, deps);
  }
  const reachable = new Set();
  const queue = [...ENTRY_POINTS];
  while (queue.length) {
    const rel = queue.pop();
    if (reachable.has(rel)) continue;
    reachable.add(rel);
    for (const dep of resolved.get(rel) || []) if (sources.has(dep)) queue.push(dep);
  }
  const orphans = [...sources.keys()].filter((rel) => !reachable.has(rel)).sort();
  assert.deepEqual(orphans, [], `Unreachable modules: ${orphans.join(', ')}`);
});

test('dynamic imports are used only for intentional lazy chunks', () => {
  const specifiers = dynamicImports.map((item) => item.specifier).sort();
  assert.deepEqual(specifiers, [
    './studio/aetherfall-game.js',
    './studio/gameExport.js',
    './studio/gameExport.js',
    './studio/pathTracer.js',
  ]);
});
