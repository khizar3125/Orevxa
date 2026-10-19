/**
 * Unit tests for src/studio/projectSearch.js — literal project search,
 * line/column reporting, limits, replace and CSV export.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEARCH_LIMITS, countProjectMatches, lineColumnAt, normalizeSearchQuery,
  replaceInProject, searchProject, toSearchCsv,
} from '../src/studio/projectSearch.js';

const files = {
  'main.orv': 'app "Demo" {\n  page "Home" {\n    text("Hello world")\n  }\n}\n',
  'lib/util.orv': 'function helper() {\n  return "hello"\n}\n',
  'notes.txt': 'Hello again\nnothing here\n',
};

test('queries shorter than the minimum return an empty result', () => {
  for (const query of ['', 'h', null, undefined, 5]) {
    const result = searchProject(files, query);
    assert.equal(result.total, 0);
    assert.deepEqual(result.groups, []);
    assert.equal(result.scannedFiles, 0);
  }
  assert.equal(searchProject(null, 'hello').total, 0);
});

test('normalizeSearchQuery trims to the documented cap', () => {
  assert.equal(normalizeSearchQuery('  hello  ').length, 9);
  assert.equal(normalizeSearchQuery('x'.repeat(500)).length, SEARCH_LIMITS.maxQuery);
  assert.equal(SEARCH_LIMITS.minQuery, 2);
});

test('search is case-insensitive by default and reports every match', () => {
  const result = searchProject(files, 'hello');
  assert.equal(result.query, 'hello');
  assert.equal(result.filesWithMatches, 3);
  assert.equal(result.total, 3);
  const main = result.groups.find((group) => group.path === 'main.orv');
  assert.equal(main.matches.length, 1);
  const match = main.matches[0];
  assert.equal(match.line, 3);
  assert.equal(match.column, 11);
  assert.equal(match.text, 'Hello');
  assert.match(match.preview, /Hello world/);
  assert.match(match.lineText, /text\("Hello world"\)/);
  assert.ok(match.previewOffset >= 0);
});

test('case sensitivity and whole-word matching are opt-in', () => {
  assert.equal(searchProject(files, 'hello', { caseSensitive: true }).total, 1);
  assert.equal(searchProject(files, 'Hello', { caseSensitive: true }).total, 2);
  assert.equal(searchProject(files, 'hell', { wholeWord: true }).total, 0);
  assert.equal(searchProject(files, 'hello', { wholeWord: true }).total, 3);
  assert.equal(searchProject({ 'a.orv': 'helper helper helper' }, 'helper', { wholeWord: true }).total, 3);
});

test('regex-special characters are treated literally', () => {
  const special = { 'a.orv': 'a.b (c) [d] {e} * + ? ^ $ | \\' };
  const result = searchProject(special, '(c)');
  assert.equal(result.total, 1);
  assert.equal(result.groups[0].matches[0].text, '(c)');
  assert.equal(searchProject(special, 'c)').total, 1, 'partial special sequences also match literally');
});

test('per-file and global result limits truncate safely', () => {
  const many = { 'a.orv': Array.from({ length: 80 }, () => 'needle').join('\n') };
  const limitedFile = searchProject(many, 'needle', { maxPerFile: 10 });
  assert.equal(limitedFile.groups[0].matches.length, 10);
  assert.equal(limitedFile.truncated, true);

  const manyFiles = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`f${index}.orv`, 'needle']));
  const limitedGlobal = searchProject(manyFiles, 'needle', { maxResults: 5, maxPerFile: 5 });
  assert.equal(limitedGlobal.total, 5);
  assert.equal(limitedGlobal.truncated, true);
  assert.equal(countProjectMatches(manyFiles, 'needle', { maxResults: 5 }), 5);
});

test('oversized and non-text files are skipped, not scanned', () => {
  const result = searchProject({ 'big.orv': 'needle'.repeat(10), 'bin.png': 42, 'ok.orv': 'needle' }, 'needle', { maxFileBytes: 8 });
  assert.equal(result.skippedFiles, 2);
  assert.equal(result.scannedFiles, 1);
  assert.equal(result.total, 1);
});

test('lineColumnAt counts lines and 1-based columns', () => {
  const text = 'first\nsecond\nthird';
  assert.deepEqual(lineColumnAt(text, 0), { line: 1, column: 1 });
  assert.deepEqual(lineColumnAt(text, 6), { line: 2, column: 1 });
  assert.deepEqual(lineColumnAt(text, 14), { line: 3, column: 2 });
  assert.deepEqual(lineColumnAt(text, 9999), { line: 3, column: 6 });
  assert.deepEqual(lineColumnAt(text, -5), { line: 1, column: 1 });
});

test('replaceInProject is scoped, counted and non-mutating', () => {
  const result = replaceInProject(files, 'hello', 'hi');
  assert.equal(result.replacements, 3);
  assert.equal(result.affectedFiles, 3);
  assert.match(result.files['main.orv'], /text\("hi world"\)/);
  assert.equal(files['main.orv'].includes('Hello'), true, 'input files are untouched');

  const scoped = replaceInProject(files, 'hello', 'hi', { path: 'lib/util.orv' });
  assert.equal(scoped.replacements, 1);
  assert.equal(scoped.affectedFiles, 1);
  assert.equal(scoped.files['main.orv'], files['main.orv']);

  const cased = replaceInProject(files, 'Hello', 'Bye', { caseSensitive: true });
  assert.equal(cased.replacements, 2);
  assert.equal(cased.affectedFiles, 2);

  const word = replaceInProject(files, 'hell', 'x', { wholeWord: true });
  assert.equal(word.replacements, 0);

  assert.throws(() => replaceInProject(files, 'h', 'x'), /at least 2 characters/);
  assert.throws(() => replaceInProject(null, 'hello', 'x'), /unavailable/);
});

test('toSearchCsv quotes every cell and escapes quotes', () => {
  const result = searchProject({ 'a.orv': 'say "hello"' }, 'hello');
  const csv = toSearchCsv(result);
  const [header, row] = csv.split('\n');
  assert.equal(header, '"file","line","column","match"');
  assert.equal(row, '"a.orv","1","6","hello"');
  assert.equal(toSearchCsv(null), '"file","line","column","match"');
});
