/**
 * Unit tests for src/core/errors.js — classification, beginner copy, bounded
 * logs, global handlers and the boot recovery screen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  ERROR_LOG_KEY, bindBootFallback, buildBootFallbackHtml, classifyError, clearErrorLog,
  createErrorLog, describeError, installGlobalErrorHandlers, readErrorLog, recordError,
  safeAsync, safeCall,
} from '../src/core/errors.js';
import { createMemoryStorage } from '../src/core/storage.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('classifyError maps browser failures to actionable categories', () => {
  const named = (name, message = '') => Object.assign(new Error(message), { name });
  assert.equal(classifyError(named('QuotaExceededError')), 'storage');
  assert.equal(classifyError(new Error('The storage quota has been exceeded')), 'storage');
  assert.equal(classifyError(named('SyntaxError', 'Unexpected token }')), 'syntax');
  assert.equal(classifyError(new Error('Unexpected end of input')), 'syntax');
  assert.equal(classifyError(named('TypeError', 'Failed to fetch')), 'network');
  assert.equal(classifyError(new Error('Load failed')), 'network');
  assert.equal(classifyError(named('SecurityError')), 'security');
  assert.equal(classifyError(new Error('Permission denied by policy')), 'security');
  assert.equal(classifyError(new Error('The operation was aborted')), 'cancelled');
  assert.equal(classifyError(new Error('Something else broke')), 'runtime');
  assert.equal(classifyError(null), 'runtime');
});

test('describeError returns friendly copy, location and technical detail', () => {
  const error = Object.assign(new Error('Unexpected token }'), { name: 'SyntaxError', line: 12, column: 4 });
  const described = describeError(error, { context: 'run' });
  assert.equal(described.category, 'syntax');
  assert.equal(described.title, 'Code needs a small fix');
  assert.equal(described.message, 'Line 12, column 4: Unexpected token }');
  assert.match(described.hint, /Auto-Fix/);
  assert.equal(described.line, 12);
  assert.equal(described.column, 4);
  assert.equal(described.recoverable, true);
  assert.equal(described.context, 'run');
  assert.equal(described.technical, 'SyntaxError: Unexpected token } (line 12)');

  assert.equal(describeError(new Error('nope')).message, 'nope');
  assert.equal(describeError(null).message, 'Unknown error');
  assert.equal(describeError(Object.assign(new Error('blocked'), { name: 'SecurityError' })).recoverable, false);
});

test('safeCall and safeAsync contain failures', async () => {
  assert.equal(safeCall(() => 5), 5);
  assert.equal(safeCall(() => { throw new Error('boom'); }), null);
  assert.equal(safeCall(() => { throw new Error('boom'); }, 'fallback'), 'fallback');
  assert.equal(safeCall('not a function'), null);
  const seen = [];
  assert.equal(safeCall(() => { throw new Error('captured'); }, 0, { onError: (error) => seen.push(error.message) }), 0);
  assert.deepEqual(seen, ['captured']);
  assert.equal(await safeAsync(async () => 7), 7);
  assert.equal(await safeAsync(async () => { throw new Error('async boom'); }, 'fallback'), 'fallback');
  assert.equal(await safeAsync(null), null);
});

test('createErrorLog keeps a bounded newest-first history', () => {
  const log = createErrorLog({ limit: 3 });
  log.add(new Error('first'), { source: 'test' });
  log.add(new Error('second'));
  log.add(new Error('third'));
  log.add(new Error('fourth'));
  const entries = log.list();
  assert.equal(entries.length, 3);
  assert.equal(entries[0].message, 'fourth');
  assert.equal(entries[2].message, 'second');
  assert.ok(entries[0].id.startsWith('err-'));
  assert.ok(entries[0].at);
  assert.equal('stack' in entries[0].meta, true);
  log.clear();
  assert.deepEqual(log.list(), []);
});

test('recordError / readErrorLog / clearErrorLog persist to injected storage', () => {
  const storage = createMemoryStorage();
  assert.deepEqual(readErrorLog(storage), []);
  const entry = recordError(new Error('stored failure'), { storage, meta: { source: 'unit' } });
  assert.equal(entry.message, 'stored failure');
  const stored = readErrorLog(storage);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].meta.source, 'unit');
  recordError(new Error('second failure'), { storage });
  const two = readErrorLog(storage);
  assert.equal(two.length, 2);
  assert.equal(two[0].message, 'second failure');
  clearErrorLog(storage);
  assert.deepEqual(readErrorLog(storage), []);
  assert.equal(storage.getItem(ERROR_LOG_KEY), null);

  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
  assert.doesNotThrow(() => recordError(new Error('safe'), { storage: broken }));
  assert.deepEqual(readErrorLog(broken), []);
  assert.doesNotThrow(() => clearErrorLog(broken));
});

test('installGlobalErrorHandlers reports errors and unhandled rejections, then disposes', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
  const { window } = dom;
  const reported = [];
  const log = createErrorLog();
  const storage = createMemoryStorage();
  const dispose = installGlobalErrorHandlers({ windowRef: window, storage, log, onError: (entry, error, meta) => reported.push({ entry, error, meta }) });

  const scriptError = new Error('synthetic window failure');
  window.dispatchEvent(new window.ErrorEvent('error', { error: scriptError, message: scriptError.message }));
  assert.equal(reported.length, 1);
  assert.equal(reported[0].error, scriptError);
  assert.equal(reported[0].meta.source, 'window.error');
  assert.equal(readErrorLog(storage).length, 1);

  window.dispatchEvent(new window.PromiseRejectionEvent('unhandledrejection', { reason: new Error('promise failed'), promise: Promise.resolve() }));
  assert.equal(reported.length, 2);
  assert.equal(reported[1].meta.source, 'unhandledrejection');

  dispose();
  window.dispatchEvent(new window.ErrorEvent('error', { error: new Error('ignored'), message: 'ignored' }));
  assert.equal(reported.length, 2, 'dispose removes listeners');
  dom.window.close();
});

test('installGlobalErrorHandlers tolerates handlers that throw and missing windows', () => {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
  const report = () => { throw new Error('sink failed'); };
  const dispose = installGlobalErrorHandlers({ windowRef: dom.window, log: createErrorLog(), onError: report });
  assert.doesNotThrow(() => dom.window.dispatchEvent(new dom.window.ErrorEvent('error', { error: new Error('x') })));
  dispose();
  assert.equal(typeof installGlobalErrorHandlers({ windowRef: null }), 'function');
  assert.doesNotThrow(() => installGlobalErrorHandlers({ windowRef: null })());
  dom.window.close();
});

test('boot fallback escapes hostile error text', () => {
  const html = buildBootFallbackHtml(new Error('<img src=x onerror=alert(1)>'), { version: '10.0.0' });
  assert.match(html, /boot-failure/);
  assert.match(html, /RECOVERY MODE/);
  assert.match(html, /v10\.0\.0/);
  assert.ok(!html.includes('<img src=x'), 'raw markup is escaped');
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /data-boot-action="reload"/);
  assert.match(html, /data-boot-action="safe-mode"/);
  assert.match(html, /data-boot-action="download"/);
  assert.match(html, /data-boot-action="copy"/);
});

test('bindBootFallback wires recovery actions and cleans up', async () => {
  const dom = new JSDOM('<!doctype html><body><pre>Technical details</pre></body>', { url: 'http://localhost/' });
  const { window } = dom;
  const document = window.document;
  document.body.innerHTML = buildBootFallbackHtml(new Error('boot exploded'), { version: '10.0.0' });
  let reloads = 0;
  // jsdom's location is non-configurable, so pass a lightweight window facade.
  const windowRef = {
    location: { reload: () => { reloads += 1; }, href: 'http://localhost/' },
    navigator: window.navigator,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
  };
  const clipboard = { copied: '', writeText: async (text) => { clipboard.copied = text; } };
  Object.defineProperty(window.navigator, 'clipboard', { value: clipboard, configurable: true });
  const storage = createMemoryStorage();
  window.URL.createObjectURL = () => 'blob:boot';
  window.URL.revokeObjectURL = () => {};
  const cleanup = bindBootFallback(document.body, { windowRef, project: { name: 'Recovered' }, storage });

  document.querySelector('[data-boot-action="reload"]').click();
  assert.equal(reloads, 1);
  document.querySelector('[data-boot-action="safe-mode"]').click();
  assert.equal(storage.getItem('orvexa-safe-mode'), '1');
  assert.equal(reloads, 2);
  document.querySelector('[data-boot-action="copy"]').click();
  await sleep(20);
  assert.match(clipboard.copied, /Error: boot exploded/);
  assert.equal(document.querySelector('[data-boot-action="copy"]').textContent, 'Copied ✓');

  cleanup();
  assert.equal(typeof cleanup, 'function');
  assert.doesNotThrow(() => bindBootFallback(null)());
  dom.window.close();
});
