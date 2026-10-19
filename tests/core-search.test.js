/**
 * Unit tests for src/core/search.js — deterministic fuzzy ranking used by the
 * command palette, quick open and settings search.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHighlightHtml, fuzzyScore, highlightHtml, highlightSegments, normalizeSearchText, rankItems,
} from '../src/core/search.js';

test('normalizeSearchText trims and lowercases', () => {
  assert.equal(normalizeSearchText('  Hello World  '), 'hello world');
  assert.equal(normalizeSearchText(null), '');
  assert.equal(normalizeSearchText(42), '42');
});

test('fuzzyScore prefers exact, prefix and word-boundary matches', () => {
  const exact = fuzzyScore('save', 'save');
  const prefix = fuzzyScore('save', 'Save project');
  const boundary = fuzzyScore('proj', 'Save project');
  const scattered = fuzzyScore('sav', 'Select all visible');
  assert.equal(exact.score, prefix.score, 'a prefix match is a positional exact match');
  assert.ok(prefix.score > boundary.score, 'prefix/exact beats interior word-boundary');
  assert.ok(boundary && boundary.score > 0);
  assert.ok(scattered === null || scattered.score < boundary.score);
  assert.deepEqual(exact.positions, [0, 1, 2, 3]);
  assert.equal(fuzzyScore('', 'anything').score, 0);
  assert.equal(fuzzyScore('zzz', 'save'), null);
  assert.equal(fuzzyScore('abc', ''), null);
  assert.equal(fuzzyScore('save', 'Save').score, fuzzyScore('save', 'save').score, 'matching is case-insensitive');
});

test('subsequence matches record positions and reward adjacency', () => {
  const adjacent = fuzzyScore('cfg', 'cfgs');
  const spread = fuzzyScore('cfg', 'c-a-f-g');
  assert.deepEqual(adjacent.positions, [0, 1, 2]);
  assert.ok(adjacent.score > spread.score);
  const camel = fuzzyScore('fb', 'fooBar');
  assert.ok(camel, 'camelCase boundaries match');
});

test('rankItems sorts by score, keeps input order on ties and respects limit', () => {
  const items = [
    { title: 'Toggle theme', description: 'appearance' },
    { title: 'Open settings', description: 'configuration' },
    { title: 'Save project', description: 'persist' },
    { title: 'Theme: light', description: 'appearance' },
  ];
  const ranked = rankItems(items, 'theme', { getText: (item) => `${item.title} ${item.description}` });
  assert.equal(ranked[0].item.title, 'Theme: light', 'start-of-string match ranks first');
  assert.ok(ranked.every((entry) => entry.score > 0));
  assert.equal(ranked.length, 2);
  assert.ok(ranked[0].score >= ranked[1].score);

  const limited = rankItems(items, 'e', { getText: (item) => item.title, limit: 2 });
  assert.equal(limited.length, 2);

  const unlimited = rankItems(items, 'e', { getText: (item) => item.title, limit: 0 });
  assert.ok(unlimited.length >= 3);
  assert.deepEqual(rankItems([], 'x'), []);
  assert.deepEqual(rankItems(null, 'x'), []);
});

test('rankItems can score keywords and reports the matched keyword', () => {
  const commands = [
    { id: 'theme', label: 'Toggle theme', keywords: ['dark', 'light', 'appearance'] },
    { id: 'save', label: 'Save project', keywords: ['persist', 'disk'] },
  ];
  const ranked = rankItems(commands, 'dark', { getText: (item) => item.label, getKeywords: (item) => item.keywords });
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].item.id, 'theme');
  assert.equal(ranked[0].keyword, 'dark');
});

test('highlightSegments merges adjacent match positions', () => {
  assert.deepEqual(highlightSegments('save', [0, 1, 2, 3]), [{ text: 'save', match: true }]);
  assert.deepEqual(highlightSegments('save', [1]), [
    { text: 's', match: false },
    { text: 'a', match: true },
    { text: 've', match: false },
  ]);
  assert.deepEqual(highlightSegments('abc', []), [{ text: 'abc', match: false }]);
  assert.deepEqual(highlightSegments('', [0]), [{ text: '', match: false }]);
  assert.deepEqual(highlightSegments('abc', [99, -1, 1.5]), [{ text: 'abc', match: false }], 'invalid positions are ignored');
});

test('highlightHtml escapes user text and marks matches', () => {
  assert.equal(highlightHtml('save', [0]), '<mark>s</mark>ave');
  assert.equal(highlightHtml('<img src=x>', []), '&lt;img src=x&gt;');
  assert.equal(highlightHtml('a&b', [1]), 'a<mark>&amp;</mark>b');
  assert.equal(escapeHighlightHtml(`"'<>&`), '&quot;&#39;&lt;&gt;&amp;');
});
