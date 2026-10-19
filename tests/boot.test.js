/**
 * Boot + interaction smoke test for the real Studio shell.
 *
 * This loads src/main.js exactly as the browser does (module graph, bootStudio,
 * renderShell, bindEvents) inside jsdom with minimal browser stubs. WebGL is not
 * available, so scene rendering is not exercised here — the production verify
 * script covers the shipped bundle and the HTTP layer.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const noop = () => {};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let dom;
let window;
let document;
const errors = [];

before(async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  dom = new JSDOM(html, { url: 'http://localhost:5173/', pretendToBeVisual: true, runScripts: 'outside-only' });
  window = dom.window;
  document = window.document;

  window.matchMedia = (query) => ({ matches: false, media: query, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop, onchange: null, dispatchEvent: () => false });
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 16);
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  window.URL.createObjectURL = () => 'blob:orvexa-test';
  window.URL.revokeObjectURL = noop;
  window.CSS = window.CSS || {};
  window.CSS.escape = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  window.HTMLCanvasElement.prototype.getContext = function getContext(kind) {
    if (kind !== '2d') return null;
    return {
      canvas: this, save: noop, restore: noop, scale: noop, translate: noop, clearRect: noop, fillRect: noop, strokeRect: noop,
      beginPath: noop, moveTo: noop, lineTo: noop, arc: noop, closePath: noop, fill: noop, stroke: noop, drawImage: noop,
      putImageData: noop, setTransform: noop, fillText: noop, strokeText: noop, roundRect: noop,
      createImageData: () => ({ data: new Uint8ClampedArray(4) }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      measureText: () => ({ width: 10 }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
    };
  };
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
  window.AudioContext = class {
    constructor() { this.currentTime = 0; this.destination = {}; }
    createOscillator() { return { connect: noop, start: noop, stop: noop, type: 'sine', frequency: { value: 0, setValueAtTime: noop } }; }
    createGain() { return { connect: noop, gain: { value: 0, setValueAtTime: noop, exponentialRampToValueAtTime: noop, linearRampToValueAtTime: noop } }; }
    close() { return Promise.resolve(); }
  };
  window.scrollTo = noop;
  window.print = noop;
  window.Element.prototype.scrollIntoView = noop;
  window.Element.prototype.scrollTo = noop;
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
  Object.defineProperty(window.navigator, 'storage', { value: { estimate: async () => ({ usage: 4096, quota: 16 * 1024 * 1024 }) }, configurable: true });

  for (const key of ['window', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage', 'HTMLElement', 'HTMLCanvasElement', 'Element', 'Node', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'DragEvent', 'getComputedStyle', 'matchMedia', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'CSS', 'Image', 'Blob', 'File', 'FileReader', 'URL', 'AudioContext']) {
    try { globalThis[key] = window[key]; } catch { /* read-only globals */ }
  }
  for (const type of ['error', 'unhandledrejection']) {
    window.addEventListener(type, (event) => errors.push(event?.error || event?.reason || event?.message || type));
  }

  await import(new URL('../src/main.js', import.meta.url).href);
  await sleep(250);
});

after(async () => {
  try { window.close(); } catch { /* ignore */ }
  await sleep(80);
});

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const key = (target, options) => target.dispatchEvent(new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...options }));

test('Studio boots the full shell without falling back to recovery mode', () => {
  assert.ok($('#appShell'), 'app shell rendered');
  assert.equal($('.boot-failure'), null, 'no recovery screen');
  assert.match($('.version-pill').textContent, /v10\.0/);
  assert.ok($('#editorTabs'), 'editor tab list exists');
  assert.ok($$('[data-editor-tab]').length >= 1, 'at least one editor tab');
  assert.ok($('#codeEditor').value.length > 0, 'active file content loaded');
  assert.ok($('#appErrorBanner').hidden, 'error banner hidden on boot');
  assert.deepEqual(errors, [], 'no uncaught errors during boot');
});

test('theme toggle resolves and persists a preference', () => {
  const themeButton = $('#themeButton');
  themeButton.click();
  assert.equal(document.documentElement.dataset.theme, 'light');
  themeButton.click();
  assert.equal(document.documentElement.dataset.theme, 'dark');
  const raw = window.localStorage.getItem('orvexa-preferences-v1');
  assert.ok(raw, 'preferences persisted to localStorage');
  const stored = JSON.parse(raw);
  assert.equal((stored.data || stored).theme, 'dark');
  assert.ok(stored.savedAt, 'preference snapshot is timestamped');
});

test('command palette opens, lists commands and closes with Escape', async () => {
  $('#commandButton').click();
  await sleep(30);
  const palette = $('.orvexa-palette');
  assert.ok(palette, 'palette opened');
  const options = palette.querySelectorAll('[data-command-id], [role="option"]');
  assert.ok(options.length > 10, `palette lists commands (${options.length})`);
  assert.match(palette.textContent, /Settings|Save|Export/);
  key(palette.querySelector('input') || palette, { key: 'Escape' });
  await sleep(30);
  assert.equal($('.orvexa-palette'), null, 'palette closed');
});

test('settings dialog renders every section and applies accessibility preferences', async () => {
  $('#settingsButton').click();
  await sleep(30);
  const modal = $('.orvexa-modal');
  assert.ok(modal, 'settings dialog opened');
  const tabs = modal.querySelectorAll('[data-settings-tab]');
  assert.ok(tabs.length >= 4, `settings tabs (${tabs.length})`);
  const wordWrap = modal.querySelector('[data-pref="wordWrap"]');
  if (wordWrap) {
    const before = document.documentElement.dataset.wordWrap;
    wordWrap.click();
    assert.notEqual(document.documentElement.dataset.wordWrap, before, 'word wrap preference applied to root');
    wordWrap.click();
  }
  key(modal, { key: 'Escape' });
  await sleep(30);
  assert.equal($('.orvexa-modal'), null, 'settings closed');
});

test('shortcut and health dialogs work from the toolbar', async () => {
  $('#helpButton').click();
  await sleep(30);
  assert.ok($('.orvexa-modal'), 'shortcuts dialog opened');
  assert.ok($$('.shortcut-row, [data-shortcut-row]').length >= 5, 'shortcut rows rendered');
  key($('.orvexa-modal'), { key: 'Escape' });
  await sleep(30);

  $('#projectHealthButton').click();
  await sleep(30);
  const modal = $('.orvexa-modal');
  assert.ok(modal, 'health dialog opened');
  assert.match(modal.textContent, /Health|score|Grade/i);
  key(modal, { key: 'Escape' });
  await sleep(30);
});

test('project search finds text and opens the matching file', async () => {
  $('#projectSearchButton').click();
  await sleep(30);
  const modal = $('.orvexa-modal');
  assert.ok(modal, 'project search opened');
  const input = modal.querySelector('#projectSearchInput');
  assert.ok(input, 'search input exists');
  input.value = 'function';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(320);
  const results = modal.querySelectorAll('[data-search-result]');
  assert.ok(results.length > 0, `search returned results (${results.length})`);
  results[0].click();
  await sleep(60);
  assert.ok($('#codeEditor').value.includes('function'), 'editor opened a file containing the match');
});

test('editor tabs switch the active file and keep the tree in sync', async () => {
  const tabs = $$('[data-editor-tab]');
  assert.ok(tabs.length >= 2, `two or more tabs (${tabs.length})`);
  const target = tabs.find((tab) => !tab.classList.contains('active')) || tabs[1];
  target.click();
  await sleep(30);
  assert.ok(target.classList.contains('active') || $(`[data-editor-tab="${target.dataset.editorTab}"]`).classList.contains('active'), 'clicked tab became active');
  assert.equal($('#fileCrumb').textContent, target.dataset.editorTab);
});

test('explorer menu opens as an accessible menu', async () => {
  $('#explorerMenuButton').click();
  await sleep(30);
  const menu = $('.orvexa-menu');
  assert.ok(menu, 'context menu opened');
  assert.equal(menu.getAttribute('role'), 'menu');
  assert.ok(menu.querySelectorAll('[role="menuitem"]').length >= 3, 'menu items are exposed');
  key(menu, { key: 'Escape' });
  await sleep(30);
  assert.equal($('.orvexa-menu'), null, 'menu closed');
});

test('running the default project renders output without an error banner', async () => {
  $('#runButton').click();
  await sleep(400);
  assert.ok($('#appErrorBanner').hidden, `no error banner: ${$('#appErrorText')?.textContent || ''}`);
  assert.ok($('#previewContent').textContent.trim().length > 0, 'preview content rendered');
  assert.notEqual($('#previewState').textContent, 'Waiting for program');
});

test('global errors surface in the banner and dismiss cleanly', async () => {
  const error = new window.Error('synthetic smoke-test failure');
  window.dispatchEvent(new window.ErrorEvent('error', { error, message: error.message }));
  await sleep(60);
  assert.equal($('#appErrorBanner').hidden, false, 'banner visible after an error');
  assert.match($('#appErrorBanner').textContent, /unexpected|autosaved|reload/i);
  $('#errorDismissButton').click();
  assert.equal($('#appErrorBanner').hidden, true, 'banner dismissed');
});
