/**
 * DOM tests for the v10 UI primitives: modal dialog, prompt/confirm, menus and
 * the command palette. Every test runs in its own jsdom document so global
 * listeners cannot leak between cases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  askConfirm, askText, closeAllDialogs, escapeAttr, escapeHtml, openDialog, toastHtml,
} from '../src/ui/dialog.js';
import { closeMenu, menuButtonAttributes, menuItemsFromDefinitions, menuLabel, openMenu } from '../src/ui/menu.js';
import {
  buildPaletteEntries, openCommandPalette, paletteAriaState, paletteEscape,
  palettePlaceholder, paletteShortcutHint, normalizePaletteQuery,
} from '../src/ui/commandPalette.js';
import { shortcutRowsMarkup } from '../src/ui/shortcutsDialog.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeDom(html = '<button id="opener">Open</button>') {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  window.document.body.classList.remove('orvexa-modal-open');
  return { dom, window, document: window.document };
}

const keydown = (window, target, key, options = {}) => {
  const event = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  return event;
};

test('escape helpers neutralise HTML and attribute breakouts', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(escapeHtml(`'&<>"`), '&#39;&amp;&lt;&gt;&quot;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeAttr('`template`'), '&#96;template&#96;');
  assert.equal(toastHtml('Saved <ok>', 'success'), '<div class="orvexa-toast-content success"><span class="orvexa-toast-dot"></span><span>Saved &lt;ok&gt;</span></div>');
});

test('openDialog renders an accessible modal, traps focus and restores it', async () => {
  const { window, document } = makeDom('<button id="opener">Open</button><div id="background">Background</div>');
  const opener = document.getElementById('opener');
  opener.focus();
  let closed = 0;
  const dialog = openDialog({
    title: 'Rename <file>',
    subtitle: 'Choose a new name',
    body: '<input id="name" /><button id="save">Save</button>',
    footer: '<button class="button primary" data-dialog-close-ok>Done</button>',
    documentRef: document,
    onClose: () => { closed += 1; },
  });
  assert.equal(dialog.card.getAttribute('role'), 'dialog');
  assert.equal(dialog.card.getAttribute('aria-modal'), 'true');
  assert.match(dialog.card.textContent, /Rename <file>/);
  assert.ok(document.querySelector('.orvexa-modal-backdrop'));
  assert.equal(document.body.classList.contains('orvexa-modal-open'), true);
  assert.equal(document.getElementById('background').hasAttribute('inert'), true, 'background is inert');
  assert.equal(document.querySelector('[data-orvexa-modal="true"]') !== null, true);
  await sleep(10);
  assert.equal(document.activeElement.id, 'name', 'first focusable receives focus');

  keydown(window, dialog.card, 'Escape');
  await sleep(10);
  assert.equal(closed, 1);
  assert.equal(document.querySelector('.orvexa-modal-backdrop'), null);
  assert.equal(document.body.classList.contains('orvexa-modal-open'), false);
  assert.equal(document.getElementById('background').hasAttribute('inert'), false);
  assert.equal(document.activeElement.id, 'opener', 'focus returns to the opener');
});

test('dialog close button, backdrop and close() are idempotent', async () => {
  const { document } = makeDom();
  let closed = 0;
  const dialog = openDialog({ title: 'Test', body: '<button id="inner">Inner</button>', documentRef: document, onClose: () => { closed += 1; } });
  dialog.close();
  dialog.close();
  assert.equal(closed, 1, 'onClose fires exactly once');
  assert.equal(document.querySelector('.orvexa-modal-backdrop'), null);

  const second = openDialog({ title: 'Second', body: 'x', documentRef: document, onClose: () => { closed += 1; } });
  second.element.querySelector('[data-dialog-close]').click();
  assert.equal(closed, 2, 'close button closes');
  assert.equal(second.element.isConnected, false);

  const third = openDialog({ title: 'Third', body: 'x', documentRef: document });
  third.element.dispatchEvent(new document.defaultView.MouseEvent('mousedown', { bubbles: true }));
  assert.equal(third.element.isConnected, false, 'backdrop mousedown closes');
});

test('dialog accepts DOM nodes and rejects invalid bodies', () => {
  const { document } = makeDom();
  const node = document.createElement('p');
  node.textContent = 'Node body';
  const dialog = openDialog({ title: 'Node', body: node, documentRef: document });
  assert.equal(dialog.body.textContent, 'Node body');
  dialog.close();
  assert.throws(() => openDialog({ title: 'Bad', body: 42, documentRef: document }), /HTML string or a Node/);
  closeAllDialogs(document);
  assert.equal(document.querySelector('[data-orvexa-modal="true"]'), null);
  assert.throws(() => openDialog({ documentRef: null, title: 'x' }), /document body/);
});

test('askText resolves trimmed input and validates', async () => {
  const { window, document } = makeDom();
  const pending = askText({ title: 'File name', label: 'Name', value: ' draft.orv ', documentRef: document, validate: (value) => value.includes(' ') ? 'No spaces allowed.' : null });
  await sleep(40);
  const input = document.querySelector('.orvexa-modal input');
  const error = document.querySelector('.orvexa-modal [role="alert"], .orvexa-modal .orvexa-field-error');
  input.value = 'my draft';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  document.querySelector('[data-form-submit]').click();
  assert.match(error.textContent, /No spaces allowed/);
  assert.equal(document.querySelector('.orvexa-modal') !== null, true, 'dialog stays open while invalid');
  input.value = 'my-draft.orv';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  document.querySelector('[data-form-submit]').click();
  assert.equal(await pending, 'my-draft.orv');
  assert.equal(document.querySelector('.orvexa-modal'), null);
});

test('askText cancel and Escape resolve null', async () => {
  const { window, document } = makeDom();
  const cancelled = askText({ title: 'Cancel me', documentRef: document });
  document.querySelector('[data-form-cancel]').click();
  assert.equal(await cancelled, null);

  const escaped = askText({ title: 'Escape me', documentRef: document });
  keydown(window, document.querySelector('.orvexa-modal'), 'Escape');
  assert.equal(await escaped, null);
});

test('askConfirm resolves booleans and marks destructive actions', async () => {
  const { document } = makeDom();
  const yes = askConfirm({ title: 'Delete?', message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true, documentRef: document });
  const modal = document.querySelector('.orvexa-modal');
  assert.ok(modal.querySelector('.button.danger'));
  assert.match(modal.textContent, /cannot be undone/);
  modal.querySelector('[data-form-submit]').click();
  assert.equal(await yes, true);

  const no = askConfirm({ title: 'Keep?', documentRef: document });
  document.querySelector('[data-form-cancel]').click();
  assert.equal(await no, false);
});

test('menus expose ARIA roles and full keyboard navigation', async () => {
  const { window, document } = makeDom();
  const anchor = document.getElementById('opener');
  anchor.getBoundingClientRect = () => ({ left: 20, bottom: 40 });
  const calls = [];
  const menu = openMenu({
    anchor,
    title: 'Project actions',
    documentRef: document,
    items: [
      { icon: '＋', label: 'New file', shortcut: 'Ctrl N', onSelect: () => calls.push('new') },
      { label: 'Rename', onSelect: () => calls.push('rename') },
      { separator: true },
      { label: 'Delete', danger: true, onSelect: () => calls.push('delete') },
      { label: 'Disabled', disabled: true, onSelect: () => calls.push('disabled') },
    ],
  });
  await sleep(10);
  assert.equal(menu.element.getAttribute('role'), 'menu');
  assert.equal(menu.element.getAttribute('aria-label'), 'Project actions');
  const items = [...menu.element.querySelectorAll('[role="menuitem"]')];
  assert.equal(items.length, 4);
  assert.equal(menu.element.querySelectorAll('[role="separator"]').length, 1);
  assert.equal(items[3].getAttribute('aria-disabled'), 'true');
  assert.equal(document.activeElement, items[0], 'first item is focused');
  assert.equal(menu.element.style.left, '20px');

  const press = (key) => keydown(window, document.activeElement || menu.element, key);
  press('ArrowDown');
  assert.equal(document.activeElement, items[1]);
  press('End');
  assert.equal(document.activeElement, items[2], 'disabled items are skipped');
  press('Home');
  assert.equal(document.activeElement, items[0]);
  press('ArrowUp');
  assert.equal(document.activeElement, items[2], 'wraps past disabled entries');
  press('Enter');
  assert.deepEqual(calls, ['delete']);
  assert.equal(document.querySelector('.orvexa-menu'), null);

  const reopened = openMenu({ anchor, items: [{ label: 'One', onSelect: () => calls.push('one') }, { label: 'Two', onSelect: () => calls.push('two') }], documentRef: document });
  keydown(window, document.activeElement || reopened.element, 'ArrowDown');
  keydown(window, document.activeElement || reopened.element, ' ');
  assert.deepEqual(calls, ['delete', 'two']);
  keydown(window, document.activeElement || reopened.element, 'Escape');
  assert.equal(document.querySelector('.orvexa-menu'), null);

  const empty = openMenu({ items: [], documentRef: document });
  assert.equal(empty.element, null);
  closeMenu();
});

test('menus close on outside pointer-down and expose helper builders', async () => {
  const { window, document } = makeDom();
  const anchor = document.getElementById('opener');
  const menu = openMenu({ anchor, items: [{ label: 'Item' }], documentRef: document });
  await sleep(10);
  document.body.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  assert.equal(document.querySelector('.orvexa-menu'), null, 'outside click closes');
  assert.ok(menu.element.isConnected === false);

  const items = menuItemsFromDefinitions({
    File: [{ label: 'New' }],
    Edit: [{ label: 'Undo' }],
  });
  assert.deepEqual(items.map((item) => item.separator ? '---' : item.label), ['New', '---', 'Undo']);
  assert.equal(menuButtonAttributes('Actions'), 'aria-haspopup="menu" aria-label="Actions"');
  assert.equal(menuLabel('<b>'), '&lt;b&gt;');
});

test('buildPaletteEntries ranks commands and files with mode prefixes and recents', () => {
  const commands = [
    { id: 'save', label: 'Save project', category: 'Project', description: 'Persist everything', keywords: ['write'] },
    { id: 'theme', label: 'Toggle theme', category: 'Appearance', combo: 'mod+shift+l' },
    { id: 'disabled', label: 'Disabled command', disabled: true },
    { id: 'bad' },
  ];
  const files = ['src/main.orv', { path: 'src/lib/util.orv' }];
  const all = buildPaletteEntries({ commands, files, query: 'save' });
  assert.equal(all[0].id, 'save');
  assert.equal(all[0].type, 'command');

  const commandsOnly = buildPaletteEntries({ commands, files, query: '> save' });
  assert.ok(commandsOnly.every((entry) => entry.type === 'command'));
  assert.equal(commandsOnly[0].id, 'save');

  const filesOnly = buildPaletteEntries({ commands, files, query: '@ util' });
  assert.ok(filesOnly.every((entry) => entry.type === 'file'));
  assert.equal(filesOnly[0].path, 'src/lib/util.orv');

  const recents = buildPaletteEntries({ commands, files, recentCommandIds: ['theme', 'save'], recentFiles: ['src/main.orv'], query: '' });
  assert.equal(recents[0].id, 'theme', 'most recent command first');
  assert.equal(recents[0].isRecent, true);
  assert.equal(recents[1].id, 'save');
  assert.ok(recents.some((entry) => entry.type === 'file' && entry.isRecent));

  const disabled = buildPaletteEntries({ commands, files: [], query: 'disabled' });
  assert.equal(disabled[0].disabled, true);
  assert.equal(buildPaletteEntries({ commands: [], files: [] }).length, 0);
  assert.equal(buildPaletteEntries({ commands, files, query: '>zzzz' }).length, 0);
});

test('command palette filters, navigates with the keyboard and runs entries', async () => {
  const { window, document } = makeDom();
  const opener = document.getElementById('opener');
  opener.focus();
  const ran = [];
  const opened = [];
  openCommandPalette({
    documentRef: document,
    commands: [
      { id: 'save', label: 'Save project', category: 'Project', description: 'Persist', run: () => ran.push('save') },
      { id: 'theme', label: 'Toggle theme', category: 'Appearance', description: 'Dark or light', run: () => ran.push('theme') },
    ],
    files: ['src/main.orv', 'src/lib/util.orv'],
    recentCommandIds: ['theme'],
    recentFiles: ['src/main.orv'],
    onRun: (entry, command) => ran.push(`onRun:${command.id}`),
    onOpenFile: (path) => opened.push(path),
    isMac: false,
  });
  const palette = document.querySelector('.orvexa-palette');
  assert.ok(palette);
  assert.equal(document.body.classList.contains('orvexa-modal-open'), true);
  const input = palette.querySelector('#orvexaPaletteInput');
  await sleep(10);
  assert.equal(document.activeElement, input);

  const options = () => [...palette.querySelectorAll('[role="option"]')];
  assert.ok(options().length >= 4);
  assert.match(palette.querySelector('[data-palette-count]').textContent, /results/);
  assert.match(input.getAttribute('aria-activedescendant'), /orvexaPaletteOption0/);

  input.value = 'theme';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(options()[0].textContent.includes('Toggle theme'), true);
  keydown(window, input, 'Enter');
  await sleep(20);
  assert.deepEqual(ran, ['onRun:theme']);
  assert.equal(document.querySelector('.orvexa-palette'), null, 'palette closes after running');

  const second = openCommandPalette({ documentRef: document, commands: [{ id: 'save', label: 'Save', run: () => ran.push('save2') }], files: ['src/main.orv'], onOpenFile: (path) => opened.push(path) });
  const secondInput = document.querySelector('#orvexaPaletteInput');
  secondInput.value = '@ main';
  secondInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  const fileOption = document.querySelector('[role="option"]');
  assert.match(fileOption.textContent, /main\.orv/);
  fileOption.click();
  await sleep(20);
  assert.deepEqual(opened, ['src/main.orv']);
  assert.equal(document.querySelector('.orvexa-palette'), null);
  assert.ok(second);
});

test('command palette empty state, Escape and arrow wrapping', async () => {
  const { window, document } = makeDom();
  document.getElementById('opener').focus();
  openCommandPalette({ documentRef: document, commands: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }], files: [] });
  const palette = document.querySelector('.orvexa-palette');
  const input = palette.querySelector('#orvexaPaletteInput');
  input.value = 'zzzz';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.match(palette.textContent, /No matches/);
  assert.equal(palette.querySelector('[data-palette-count]').textContent, '0 results');

  input.value = 'a';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  keydown(window, input, 'ArrowDown');
  keydown(window, input, 'ArrowDown');
  const options = [...palette.querySelectorAll('[role="option"]')];
  assert.equal(options.length >= 1, true);
  const active = options.findIndex((option) => option.getAttribute('aria-selected') === 'true');
  assert.equal(active, 0, 'arrow navigation wraps past the last result');

  keydown(window, input, 'Escape');
  await sleep(10);
  assert.equal(document.querySelector('.orvexa-palette'), null);
  assert.equal(document.activeElement.id, 'opener', 'focus is restored');
});

test('palette helpers expose stable metadata', () => {
  assert.equal(palettePlaceholder().includes('Search commands'), true);
  assert.equal(paletteShortcutHint(true), '⌘ + K');
  assert.equal(paletteShortcutHint(false), 'Ctrl + K');
  assert.equal(paletteEscape('a"b'), 'a&quot;b');
  assert.equal(normalizePaletteQuery('  HELLO '), 'hello');
  assert.deepEqual(paletteAriaState(true), { 'aria-expanded': 'true', 'aria-hidden': 'false' });
  assert.deepEqual(paletteAriaState(false), { 'aria-expanded': 'false', 'aria-hidden': 'true' });
});

test('shortcut rows render grouped, escaped platform labels', () => {
  const html = shortcutRowsMarkup([
    { category: 'Editor', items: [{ id: 'save', label: 'Save <project>', combo: 'mod+s' }] },
    { category: 'Help', items: [{ id: 'help', label: 'Shortcuts', combo: 'f1' }] },
  ], { isMac: true });
  assert.match(html, /shortcut-group/);
  assert.match(html, /Save &lt;project&gt;/);
  assert.match(html, /⌘ \+ S/);
  assert.match(html, /F1/);
  assert.match(html, /data-shortcut-id="save"/);
  assert.equal(shortcutRowsMarkup([], {}), '');
});
