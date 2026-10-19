/**
 * Unit tests for src/core/storage.js — safe storage, quota handling,
 * namespace accounting and data export/import.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_PREFIX, byteLength, createDataExport, createMemoryStorage, createSafeStorage,
  estimateStorage, formatBytes, importDataExport, isQuotaError, isStorageAvailable, resolveStorage,
} from '../src/core/storage.js';

function quotaLimiter(limitBytes) {
  const memory = createMemoryStorage();
  return {
    get length() { return memory.length; },
    key: (index) => memory.key(index),
    getItem: (key) => memory.getItem(key),
    removeItem: (key) => memory.removeItem(key),
    clear: () => memory.clear(),
    setItem(key, value) {
      if (String(value).length > limitBytes) {
        const error = new Error('The quota has been exceeded.');
        error.name = 'QuotaExceededError';
        throw error;
      }
      memory.setItem(key, value);
    },
    __data: memory.__data,
  };
}

test('memory storage behaves like Web Storage', () => {
  const store = createMemoryStorage({ a: 1, b: 'two' });
  assert.equal(store.length, 2);
  assert.equal(store.getItem('a'), '1');
  assert.equal(store.getItem('missing'), null);
  store.setItem('c', 3);
  assert.deepEqual([store.key(0), store.key(1), store.key(2)].sort(), ['a', 'b', 'c']);
  assert.equal(store.key(9), null);
  store.removeItem('a');
  assert.equal(store.length, 2);
  store.clear();
  assert.equal(store.length, 0);
});

test('keys are namespaced once and reads never leak outside the prefix', () => {
  const store = createSafeStorage({ storage: createMemoryStorage() });
  store.setItem('theme', 'dark');
  store.setItem(`${STORAGE_PREFIX}already-prefixed`, 'yes');
  assert.deepEqual(store.keys(), ['orvexa-already-prefixed', 'orvexa-theme']);
  assert.equal(store.getItem('theme'), 'dark');
  assert.equal(store.getItem('absent'), null);
  assert.throws(() => store.setItem('', 'x'), /non-empty/i);
});

test('JSON reads validate, migrate and fall back safely', () => {
  const store = createSafeStorage({ storage: createMemoryStorage() });
  assert.equal(store.getJSON('missing', { fallback: true }).fallback, true);
  store.setItem('broken', '{not json');
  assert.equal(store.getJSON('broken', 'fallback'), 'fallback');
  store.setJSON('value', { n: 1 });
  assert.deepEqual(store.getJSON('value', null), { n: 1 });
  assert.equal(store.getJSON('value', null, { validate: (value) => value.n === 2 }), null);
  store.setItem('legacy', '{"old":true}');
  assert.deepEqual(store.getJSON('legacy', null, { migrate: (value) => ({ ...value, migrated: true }) }), { old: true, migrated: true });
  store.setItem('legacy2', '{"old":true}');
  assert.deepEqual(store.getJSON('legacy2', null, { migrate: () => { throw new Error('bad'); } }), { old: true });
});

test('quota failures are reported with actionable metadata and never throw', () => {
  const limited = quotaLimiter(16);
  const store = createSafeStorage({ storage: limited });
  const ok = store.setItem('small', 'ok');
  assert.equal(ok.ok, true);
  const failed = store.setItem('large', 'x'.repeat(64));
  assert.equal(failed.ok, false);
  assert.equal(failed.error.quota, true);
  assert.equal(failed.key, 'orvexa-large');
  assert.equal(store.getItem('large'), null);
  const failures = store.failures();
  assert.equal(failures.length, 1);
  assert.equal(failures[0].operation, 'write');
  assert.equal(failures[0].name, 'QuotaExceededError');
});

test('setJSON reports unserialisable values instead of writing garbage', () => {
  const store = createSafeStorage({ storage: createMemoryStorage() });
  const circular = {};
  circular.self = circular;
  const result = store.setJSON('circular', circular);
  assert.equal(result.ok, false);
  assert.equal(result.error.operation, 'serialize');
  assert.equal(store.getItem('circular'), null);
});

test('usage and clearNamespace account only Orvexa keys', () => {
  const raw = createMemoryStorage({ 'unrelated-key': 'x'.repeat(100) });
  const store = createSafeStorage({ storage: raw });
  store.setItem('a', '12345');
  store.setItem('b', '✓');
  const usage = store.usage();
  assert.equal(usage.keys, 2);
  assert.equal(usage.bytes, 8);
  assert.equal(usage.perKey[0].key, 'a');
  assert.equal(store.clearNamespace(), 2);
  assert.equal(store.keys().length, 0);
  assert.equal(raw.getItem('unrelated-key').length, 100);
});

test('byteLength counts UTF-8 bytes', () => {
  assert.equal(byteLength('abc'), 3);
  assert.equal(byteLength('✓'), 3);
  assert.equal(byteLength(''), 0);
  assert.equal(byteLength(null), 0);
});

test('isQuotaError recognises browser variants', () => {
  const make = (properties) => Object.assign(new Error(''), properties);
  assert.equal(isQuotaError(make({ name: 'QuotaExceededError' })), true);
  assert.equal(isQuotaError(make({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })), true);
  assert.equal(isQuotaError(make({ code: 22 })), true);
  assert.equal(isQuotaError(make({ code: 1014 })), true);
  assert.equal(isQuotaError(new Error('storage full')), true);
  assert.equal(isQuotaError(new Error('network down')), false);
  assert.equal(isQuotaError(null), false);
});

test('formatBytes uses compact human units', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(12 * 1024), '12 KB');
  assert.equal(formatBytes(1536 * 1024), '1.5 MB');
  assert.equal(formatBytes(12 * 1024 * 1024), '12 MB');
  assert.equal(formatBytes(Number.NaN), '0 B');
});

test('data export round-trips and skips ephemeral session recovery', () => {
  const local = createSafeStorage({ storage: createMemoryStorage() });
  const session = createSafeStorage({ kind: 'session', storage: createMemoryStorage() });
  local.setItem('theme', 'dark');
  session.setItem('recent-commands', '["save"]');
  session.setItem('session-recovery', '{"secret":true}');
  const exported = createDataExport({ local, session, appVersion: '10.0.0' });
  assert.equal(exported.format, 'orvexa-data-export');
  assert.equal(exported.appVersion, '10.0.0');
  assert.equal(exported.entries['orvexa-theme'], 'dark');
  assert.equal(exported.entries['orvexa-recent-commands'], '["save"]');
  assert.equal(exported.entries['orvexa-session-recovery'], undefined);

  const targetLocal = createSafeStorage({ storage: createMemoryStorage() });
  const result = importDataExport(exported, { local: targetLocal });
  assert.equal(result.imported, 2);
  assert.equal(result.failed, 0);
  assert.equal(targetLocal.getItem('theme'), 'dark');
});

test('data import rejects unsafe or malformed backups', () => {
  assert.throws(() => importDataExport(null), /JSON object/);
  assert.throws(() => importDataExport({ format: 'other' }), /not an Orvexa data export/);
  assert.throws(() => importDataExport({ format: 'orvexa-data-export' }), /entries are missing/);
  assert.throws(() => importDataExport({ format: 'orvexa-data-export', entries: [] }), /entries are missing/);
  assert.throws(() => importDataExport({ format: 'orvexa-data-export', entries: { 'evil-key': 'x' } }), /Refusing/);
  assert.throws(() => importDataExport({ format: 'orvexa-data-export', entries: { 'orvexa-a': 5 } }), /must be text/);
  const tooMany = Object.fromEntries(Array.from({ length: 201 }, (_, index) => [`orvexa-k${index}`, 'v']));
  assert.throws(() => importDataExport({ format: 'orvexa-data-export', entries: tooMany }), /too many keys/);
  const oversized = { 'orvexa-big': 'x'.repeat(25 * 1024 * 1024 + 1) };
  assert.throws(() => importDataExport({ format: 'orvexa-data-export', entries: oversized }), /25 MB/);
});

test('import falls back to session storage when local storage is full', () => {
  const local = createSafeStorage({ storage: quotaLimiter(4) });
  const session = createSafeStorage({ kind: 'session', storage: createMemoryStorage() });
  const payload = { format: 'orvexa-data-export', entries: { 'orvexa-long': 'x'.repeat(20) } };
  const result = importDataExport(payload, { local, session });
  assert.equal(result.imported, 0);
  assert.equal(result.failed, 1);
  assert.equal(session.getItem('long'), 'x'.repeat(20));
});

test('estimateStorage handles supported, unsupported and throwing navigators', async () => {
  const supported = await estimateStorage({ storage: { estimate: async () => ({ usage: 512, quota: 2048 }) } });
  assert.deepEqual(supported, { supported: true, usage: 512, quota: 2048, percent: 25 });
  const capped = await estimateStorage({ storage: { estimate: async () => ({ usage: 4096, quota: 2048 }) } });
  assert.equal(capped.percent, 100);
  const none = await estimateStorage({});
  assert.equal(none.supported, false);
  const broken = await estimateStorage({ storage: { estimate: async () => { throw new Error('denied'); } } });
  assert.equal(broken.supported, false);
});

test('resolveStorage prefers an explicit store and falls back to memory', () => {
  const override = createMemoryStorage({ x: '1' });
  assert.equal(resolveStorage('local', override), override);
  const fallback = resolveStorage('session', null);
  assert.equal(typeof fallback.getItem, 'function');
  assert.equal(typeof isStorageAvailable('local'), 'boolean');
});
