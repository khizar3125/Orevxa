#!/usr/bin/env node
/**
 * Zero-dependency project linter.
 *
 * The repository intentionally has no ESLint dependency; this script enforces
 * the invariants that actually matter for this product: syntax, security
 * anti-patterns, HTML/CSS structural health, stale version strings, duplicate
 * DOM ids and dead local links. Warnings inform, errors fail CI.
 */
import { readFile, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const c = { dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', reset: '\x1b[0m' };
const errors = [];
const warnings = [];
const error = (file, line, message) => errors.push({ file, line, message });
const warn = (file, line, message) => warnings.push({ file, line, message });

async function walk(dir, { skip = new Set() } = {}) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full, { skip }));
    else out.push(full);
  }
  return out;
}

const rel = (file) => path.relative(root, file).split(path.sep).join('/');
const sourceFiles = (await walk(path.join(root, 'src'))).filter((file) => file.endsWith('.js') || file.endsWith('.css'));
const scriptFiles = (await walk(path.join(root, 'scripts'))).filter((file) => file.endsWith('.mjs'));
const htmlFiles = (await readdir(root)).filter((file) => file.endsWith('.html')).map((file) => path.join(root, file));

console.log(`${c.cyan}▸${c.reset} Syntax ${c.dim}(${sourceFiles.length + scriptFiles.length} scripts, ${htmlFiles.length} pages)${c.reset}`);
for (const file of [...sourceFiles, ...scriptFiles].filter((item) => /\.(?:js|mjs)$/.test(item))) {
  try { await execFileAsync(process.execPath, ['--check', file], { timeout: 20_000 }); }
  catch (failure) {
    const message = String(failure.stderr || failure.message).split('\n').find((line) => line.includes('Error')) || 'syntax error';
    error(rel(file), null, message.replaceAll(root + '/', ''));
  }
}

console.log(`${c.cyan}▸${c.reset} Security patterns`);
for (const file of sourceFiles.filter((item) => item.endsWith('.js'))) {
  const text = await readFile(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (/\beval\s*\(/.test(line) && !/no-eval|eval is|avoid eval/i.test(line)) error(rel(file), index + 1, 'eval() is forbidden (CSP + code-injection risk)');
    if (/new\s+Function\s*\(/.test(line)) error(rel(file), index + 1, 'new Function() is forbidden');
    if (/document\.write\s*\(/.test(line)) error(rel(file), index + 1, 'document.write() is forbidden');
    if (/dangerouslySetInnerHTML/.test(line)) error(rel(file), index + 1, 'unexpected React escape hatch in a vanilla project');
    if (/\bconsole\.(log|debug)\s*\(/.test(line)) warn(rel(file), index + 1, 'debug console output in shipped source');
    if (/(?:\/\/|\/\*|^\s*\*)\s*(TODO|FIXME|XXX)\b/.test(line)) warn(rel(file), index + 1, 'unresolved TODO/FIXME comment');
  });
  if (lines.length > 3200) warn(rel(file), null, `${lines.length} lines — consider extracting modules`);
  if (/innerHTML\s*=\s*`[^`]*\$\{\s*(?!escape|format|icon|build|render|svg|JSON\.stringify)[a-zA-Z_$][\w$]*\s*\}/.test(text)) {
    warn(rel(file), null, 'innerHTML interpolation without an obvious escape helper — verify the value is trusted');
  }
}

console.log(`${c.cyan}▸${c.reset} Stylesheets`);
for (const file of sourceFiles.filter((item) => item.endsWith('.css'))) {
  const css = await readFile(file, 'utf8');
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  if (open !== close) error(rel(file), null, `unbalanced braces (${open} open, ${close} close)`);
  if (/@import\s+url/.test(css)) warn(rel(file), null, 'blocking @import url() — prefer a <link>');
}

console.log(`${c.cyan}▸${c.reset} HTML structure, ids and local links`);
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  for (const id of new Set(duplicates)) error(rel(file), null, `duplicate id "${id}"`);
  const refs = [...html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)].map((match) => match[1]);
  for (const ref of new Set(refs)) {
    if (ref.startsWith('src/')) continue; // verified by the build/import tests
    const inRoot = await readFile(path.join(root, ref), 'utf8').then(() => true).catch(() => false);
    const inPublic = await readFile(path.join(root, 'public', ref), 'utf8').then(() => true).catch(() => false);
    if (!inRoot && !inPublic) error(rel(file), null, `local reference does not exist: ./${ref}`);
  }
  if (!/<html lang="[a-z-]+"/.test(html)) error(rel(file), null, 'missing <html lang>');
  if (!/http-equiv="Content-Security-Policy"/.test(html)) error(rel(file), null, 'missing CSP meta tag');
  if (/\.(?:js|css)"\s*\/?>/.test(html) && !/src\/|assets\//.test(html)) warn(rel(file), null, 'unexpected asset reference');
}

console.log(`${c.cyan}▸${c.reset} Version and documentation truth`);
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const stale = [];
for (const file of [...sourceFiles, ...htmlFiles, path.join(root, 'modeler.html')]) {
  const text = await readFile(file, 'utf8');
  text.split('\n').forEach((line, index) => {
    const label = new RegExp(`(?:ORVEXA\\s+STUDIO|Orvexa\\s+Studio|Orvexa\\s+Modeler|OMEGA\\s+MODELER)\\s+v([0-9]+)\\.([0-9]+)`, 'i').exec(line);
    if (label && `${label[1]}.${label[2]}` !== version.split('.').slice(0, 2).join('.')) {
      stale.push(`${rel(file)}:${index + 1}`);
    }
  });
}
for (const entry of new Set(stale)) error(entry.split(':')[0], entry.split(':')[1], 'stale pre-v10 version label');

const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
if (lock.version !== version || lock.packages?.['']?.version !== version) error('package-lock.json', null, `version ${lock.version} does not match package.json ${version}`);

const plan = await readFile(path.join(root, 'PLAN.md'), 'utf8');
if (!plan.includes(version)) warn('PLAN.md', null, `roadmap does not mention ${version}`);

console.log(`${c.cyan}▸${c.reset} Test coverage map`);
const testFiles = await walk(path.join(root, 'tests'));
const testText = (await Promise.all(testFiles.map((file) => readFile(file, 'utf8')))).join('\n');
const appText = (await Promise.all(sourceFiles.filter((item) => item.endsWith('.js')).map((file) => readFile(file, 'utf8')))).join('\n');
const coreModules = (await readdir(path.join(root, 'src/core'))).filter((file) => file.endsWith('.js'));
for (const module of coreModules) {
  const imported = appText.includes(`core/${module}`) || testText.includes(module);
  if (!imported) warn(`src/core/${module}`, null, 'module is neither imported by the app nor referenced in tests');
}

/* --------------------------------------------------------------- report -- */
const show = (items, color, label) => {
  if (!items.length) return;
  console.log(`\n${color}${label}${c.reset}`);
  for (const item of items) console.log(`  ${color}${item.file}${item.line ? `:${item.line}` : ''}${c.reset} ${item.message}`);
};
show(warnings, c.yellow, `${warnings.length} warning(s)`);
show(errors, c.red, `${errors.length} error(s)`);

if (errors.length) {
  console.error(`\n${c.red}Lint failed.${c.reset}`);
  process.exit(1);
}
console.log(`\n${c.green}Lint passed${c.reset} ${c.dim}· ${warnings.length} warning(s) · ${sourceFiles.length + scriptFiles.length + htmlFiles.length} files checked${c.reset}\n`);
