/**
 * DOM tests for the three data-heavy dialogs: Settings, Project Health and
 * project-wide Search. These exercise the footer/body wiring that regressed
 * silently in earlier builds.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { openSettingsDialog } from '../src/ui/settingsDialog.js';
import { healthBadge, openHealthDialog, scoreRing } from '../src/ui/healthDialog.js';
import { openProjectSearchDialog } from '../src/ui/projectSearchDialog.js';
import { defaultPreferences, normalizePreferences } from '../src/core/preferences.js';
import { healthGrade } from '../src/studio/health.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeDom(html = '<button id="opener">Open</button>') {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { url: 'http://localhost/', pretendToBeVisual: true });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  return { dom, window: dom.window, document: dom.window.document };
}

const click = (element) => element.dispatchEvent(new element.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));

test('settings dialog exposes every section and applies preferences live', async () => {
  const { document } = makeDom();
  const changes = [];
  const dialog = openSettingsDialog({ preferences: defaultPreferences(), onChange: (next) => changes.push(next), documentRef: document, appVersion: '10.0.0' });

  const tabs = [...document.querySelectorAll('[data-settings-tab]')];
  const panels = [...document.querySelectorAll('[data-settings-panel]')];
  assert.deepEqual(tabs.map((tab) => tab.dataset.settingsTab), ['appearance', 'editor', 'accessibility', 'data', 'about']);
  assert.equal(panels.length, tabs.length);
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  assert.equal(panels.filter((panel) => !panel.hidden).length, 1, 'only the active panel is visible');

  click(tabs[1]);
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  assert.equal(tabs[0].getAttribute('tabindex'), '-1');
  assert.equal(document.querySelector('[data-settings-panel="editor"]').hidden, false);

  const tabSize = document.querySelector('[data-settings-panel="editor"] [data-pref="tabSize"]');
  assert.ok(tabSize, 'editor panel exposes tab size');
  tabSize.value = '2';
  tabSize.dispatchEvent(new document.defaultView.Event('change', { bubbles: true }));
  assert.equal(changes.at(-1).tabSize, 2);

  const wrap = document.querySelector('[data-pref="wordWrap"]');
  const before = wrap.checked;
  wrap.checked = !before;
  wrap.dispatchEvent(new document.defaultView.Event('change', { bubbles: true }));
  assert.equal(changes.at(-1).wordWrap, !before);

  click(tabs[0]);
  const cyan = document.querySelector('[data-accent="cyan"]');
  click(cyan);
  assert.equal(changes.at(-1).accent, 'cyan');
  assert.equal(cyan.getAttribute('aria-checked'), 'true');

  changeTabWithKeyboard(document, tabs, 'ArrowRight');
  assert.equal(document.querySelector('[data-settings-tab="editor"]').getAttribute('aria-selected'), 'true', 'arrow keys move between settings sections');

  click(document.querySelector('[data-dialog-close-ok]'));
  assert.equal(document.querySelector('.orvexa-modal'), null, 'footer Done closes the dialog');
  assert.ok(dialog);
});

function changeTabWithKeyboard(document, tabs, key) {
  const active = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
  active.dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

test('settings reset uses the confirm dialog and emits defaults', async () => {
  const { document } = makeDom();
  const changes = [];
  openSettingsDialog({
    preferences: normalizePreferences({ theme: 'light', accent: 'rose', editorFontSize: 18 }),
    onChange: (next) => changes.push(next),
    documentRef: document,
  });
  click(document.querySelector('[data-settings-reset]'));
  await sleep(20);
  const modals = [...document.querySelectorAll('.orvexa-modal')];
  const confirm = modals.at(-1);
  assert.equal(modals.length, 2, 'reset opens an in-app confirm above settings');
  assert.match(confirm.textContent, /Reset preferences/);
  click(confirm.querySelector('[data-form-submit]'));
  await sleep(20);
  const last = changes.at(-1);
  assert.equal(last.theme, 'dark');
  assert.equal(last.accent, 'violet');
  assert.equal(last.editorFontSize, 14);
  assert.equal(document.querySelectorAll('.orvexa-modal').length, 0, 'settings closes after a confirmed reset');
});

test('settings data and about actions call their injected handlers', async () => {
  const { document } = makeDom();
  const fired = [];
  openSettingsDialog({
    preferences: defaultPreferences(),
    documentRef: document,
    canInstall: true,
    isStandalone: false,
    storage: { localBytes: 4096, quota: 8192, percent: 50 },
    errorCount: 3,
    aiKeyStored: true,
    onExportData: () => fired.push('export'),
    onImportData: () => fired.push('import'),
    onClearSnapshots: () => fired.push('snapshots'),
    onClearErrors: () => fired.push('errors'),
    onForgetAiKey: () => fired.push('forget'),
    onCopyDiagnostics: () => fired.push('diagnostics'),
    onShowTour: () => fired.push('tour'),
    onInstall: () => fired.push('install'),
  });
  const dataTab = document.querySelector('[data-settings-tab="data"]');
  click(dataTab);
  click(document.querySelector('[data-export-data]'));
  click(document.querySelector('[data-clear-snapshots]'));
  click(document.querySelector('[data-forget-key]'));
  assert.deepEqual(fired, ['export', 'snapshots', 'forget']);
  assert.equal(document.querySelector('.orvexa-modal'), null, 'forget key closes settings after acting');

  const reopened = openSettingsDialog({
    preferences: defaultPreferences(), documentRef: document, canInstall: true,
    onExportData: () => fired.push('export2'),
    onInstall: () => fired.push('install'),
    onCopyDiagnostics: () => fired.push('diagnostics'),
    onShowTour: () => fired.push('tour'),
  });
  click(document.querySelector('[data-settings-tab="about"]'));
  click(document.querySelector('[data-install-app]'));
  await sleep(20);
  click(document.querySelector('[data-copy-diagnostics]'));
  await sleep(10);
  click(document.querySelector('[data-show-tour]'));
  await sleep(100);
  assert.ok(fired.includes('install'));
  assert.ok(fired.includes('diagnostics'));
  assert.ok(fired.includes('tour'));
  assert.ok(reopened);
});

test('health dialog renders a score ring, filters and actionable issues', async () => {
  const { document } = makeDom();
  document.body.innerHTML = '';
  const project = {
    name: 'Health Demo',
    files: {
      'main.orv': 'app "Demo" {\n  text(“curly”)\n}\n',
      'empty.orv': '',
    },
  };
  const opened = [];
  const copied = [];
  const dialog = openHealthDialog({ project, documentRef: document, onOpenIssue: (issue) => opened.push(issue.id), onCopy: (text) => copied.push(text) });
  assert.ok(dialog);
  assert.match(document.querySelector('.health-ring').getAttribute('aria-label'), /Health score \d+ out of 100, grade [A-F]/);
  assert.match(document.querySelector('.health-hero').textContent, /Health Demo/);
  const filters = [...document.querySelectorAll('[data-health-filter]')];
  assert.deepEqual(filters.map((button) => button.dataset.healthFilter), ['all', 'error', 'warning', 'info']);
  const allCount = Number(filters[0].textContent.match(/(\d+)/)[1]);
  assert.ok(allCount >= 2);

  click(filters.find((button) => button.dataset.healthFilter === 'warning'));
  const warningFilter = document.querySelector('[data-health-filter="warning"]');
  assert.equal(warningFilter.getAttribute('aria-pressed'), 'true');
  assert.ok(document.querySelectorAll('.health-issue').length >= 1);
  assert.ok([...document.querySelectorAll('.health-issue')].every((issue) => issue.classList.contains('severity-warning')));

  click(document.querySelector('[data-health-filter="error"]'));
  const openButton = document.querySelector('[data-health-open]');
  if (openButton) {
    click(openButton);
    assert.equal(opened.length, 1);
  }

  click(document.querySelector('[data-health-refresh]'));
  assert.match(document.querySelector('[data-health-footnote]').textContent, /errors · \d+ warnings/);

  click(document.querySelector('[data-health-copy]'));
  await sleep(20);
  assert.equal(copied.length, 1);
  assert.match(copied[0], /Health \d+\/100/);
  assert.equal(document.querySelector('[data-health-copy]').textContent, 'Copied ✓');

  click(document.querySelector('[data-dialog-close-ok]'));
  assert.equal(document.querySelector('.orvexa-modal'), null);
});

test('health dialog shows a clean empty state for healthy projects', () => {
  const { document } = makeDom();
  document.body.innerHTML = '';
  openHealthDialog({
    project: { name: 'Clean', files: { 'main.orv': 'app "Clean" {\n page "Home" {\n title("Hi")\n }\n}\n' } },
    documentRef: document,
  });
  assert.match(document.querySelector('.health-empty').textContent, /No issues/);
  assert.match(document.querySelector('.health-hero').textContent, /Ship-ready/);
});

test('scoreRing and healthBadge are safe for hostile values', () => {
  const ring = scoreRing(87, healthGrade(87));
  assert.match(ring, /aria-label="Health score 87 out of 100, grade B"/);
  assert.match(ring, /stroke-dasharray:/);
  assert.match(scoreRing(500, healthGrade(500)), /Health score 100/);
  assert.match(scoreRing(-20, healthGrade(-20)), /Health score 0/);
  assert.match(scoreRing('x', healthGrade('x')), /Health score 0/);
  const badge = healthBadge(95);
  assert.match(badge, /tone-excellent/);
  assert.match(badge, /<strong>95<\/strong>/);
  assert.match(badge, /<small>A<\/small>/);
});

test('project search renders grouped results and opens the exact match', async () => {
  const { window, document } = makeDom();
  document.body.innerHTML = '';
  const files = {
    'main.orv': 'app "Demo" {\n  text("Hello world")\n}\n',
    'lib/util.orv': 'function greet() {\n  return "hello there"\n}\n',
  };
  const opened = [];
  const dialog = openProjectSearchDialog({ files, documentRef: document, onOpen: (path, line, column) => opened.push({ path, line, column }) });
  assert.ok(dialog);
  const input = document.querySelector('#projectSearchInput');
  await sleep(40);
  assert.equal(document.activeElement, input, 'search input receives focus');

  input.value = 'hello';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  const results = [...document.querySelectorAll('[data-search-result]')];
  assert.equal(results.length, 2);
  assert.match(document.querySelector('[data-project-search-meta]').textContent, /2 matches in 2 files/);
  assert.match(results[0].textContent, /L2:11/, 'groups are ordered by path (lib before main)');
  assert.ok(results[0].querySelector('mark'), 'matches are highlighted');

  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  assert.equal(document.querySelectorAll('[data-search-result="1"]')[0].getAttribute('aria-selected'), 'true');
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await sleep(20);
  assert.deepEqual(opened, [{ path: 'main.orv', line: 2, column: 9 }]);
  assert.equal(document.querySelector('.orvexa-modal'), null, 'opening a result closes the dialog');
});

test('project search honours case and whole-word toggles', async () => {
  const { window, document } = makeDom();
  document.body.innerHTML = '';
  openProjectSearchDialog({
    files: { 'a.orv': 'Hello hello HELLO help' },
    initialQuery: 'hello',
    documentRef: document,
  });
  const results = () => document.querySelectorAll('[data-search-result]').length;
  assert.equal(results(), 3, 'initial query renders immediately');
  const caseToggle = document.querySelector('#projectSearchCase');
  caseToggle.checked = true;
  caseToggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(results(), 1, 'case-sensitive search finds the lowercase match only');
  caseToggle.checked = false;
  caseToggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  const word = document.querySelector('#projectSearchWord');
  word.checked = true;
  word.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(results(), 3, 'whole word still matches all three standalone words');

  const form = document.querySelector('[data-project-search-form]');
  document.querySelector('#projectSearchInput').value = 'zzz';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  assert.match(document.querySelector('[data-project-search-results]').textContent, /No matches/);
});

test('project search footer actions work and CSV copy degrades gracefully', async () => {
  const { window, document } = makeDom();
  document.body.innerHTML = '';
  openProjectSearchDialog({ files: { 'a.orv': 'needle here' }, initialQuery: 'needle', documentRef: document });
  const csvButton = document.querySelector('[data-project-search-csv]');
  assert.ok(csvButton);
  click(csvButton);
  await sleep(20);
  assert.match(csvButton.textContent, /Copied|blocked/, 'clipboard failure is reported, not thrown');
  click(document.querySelector('[data-dialog-close-ok]'));
  assert.equal(document.querySelector('.orvexa-modal'), null, 'footer Close works');
});
