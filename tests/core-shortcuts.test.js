/**
 * Unit tests for src/core/shortcuts.js — canonical combos, platform labels,
 * registry matching (editable contexts, conditional `when`) and conflict
 * detection.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  comboFromEvent, createShortcutRegistry, eventGroup, formatCombo, isMacPlatform,
  normalizeCombo, normalizeKey,
} from '../src/core/shortcuts.js';

const event = (key, modifiers = {}) => ({
  key,
  ctrlKey: Boolean(modifiers.ctrl),
  metaKey: Boolean(modifiers.meta),
  altKey: Boolean(modifiers.alt),
  shiftKey: Boolean(modifiers.shift),
  defaultPrevented: false,
  preventDefault() { this.defaultPrevented = true; },
});

test('key aliases and platform detection are stable', () => {
  assert.equal(normalizeKey('Esc'), 'escape');
  assert.equal(normalizeKey('Return'), 'enter');
  assert.equal(normalizeKey('Space'), ' ');
  assert.equal(normalizeKey('Del'), 'delete');
  assert.equal(normalizeKey('Up'), 'arrowup');
  assert.equal(normalizeKey('Control'), 'ctrl');
  assert.equal(normalizeKey('Cmd'), 'meta');
  assert.equal(normalizeKey('Command'), 'meta');
  assert.equal(normalizeKey('Win'), 'meta');
  assert.equal(normalizeKey('K'), 'k');
  assert.equal(normalizeKey(''), '');
  assert.equal(isMacPlatform('MacIntel'), true);
  assert.equal(isMacPlatform('iPhone'), true);
  assert.equal(isMacPlatform('Win32'), false);
  assert.equal(isMacPlatform('Linux x86_64'), false);
});

test('normalizeCombo produces one canonical ordering', () => {
  assert.equal(normalizeCombo('Shift+Ctrl+P'), 'ctrl+shift+p');
  assert.equal(normalizeCombo('MOD+SHIFT+P'), 'mod+shift+p');
  assert.equal(normalizeCombo('mod + shift + p'), 'mod+shift+p');
  assert.equal(normalizeCombo('Ctrl+Alt+Delete'), 'ctrl+alt+delete');
  assert.equal(normalizeCombo('meta+k'), 'meta+k');
  assert.equal(normalizeCombo('F1'), 'f1');
  assert.equal(normalizeCombo('ctrl'), '', 'modifier-only combos are rejected');
  assert.equal(normalizeCombo(''), '');
  assert.equal(normalizeCombo(null), '');
});

test('comboFromEvent always canonicalises Ctrl/Cmd to mod', () => {
  assert.equal(comboFromEvent(event('k', { ctrl: true })), 'mod+k');
  assert.equal(comboFromEvent(event('k', { meta: true })), 'mod+k');
  assert.equal(comboFromEvent(event('K', { ctrl: true, shift: true })), 'mod+shift+k');
  assert.equal(comboFromEvent(event('ArrowRight', { ctrl: true, alt: true })), 'mod+alt+arrowright');
  assert.equal(comboFromEvent(event('Enter')), 'enter');
  assert.equal(comboFromEvent(event('Control', { ctrl: true })), '');
  assert.equal(comboFromEvent(event('Shift', { shift: true })), '');
  assert.equal(comboFromEvent(null), '');
});

test('formatCombo renders readable platform labels', () => {
  assert.equal(formatCombo('mod+shift+p', { isMac: true }), '⌘ + ⇧ + P');
  assert.equal(formatCombo('mod+shift+p', { isMac: false }), 'Ctrl + Shift + P');
  assert.equal(formatCombo('mod+alt+arrowright', { isMac: true }), '⌘ + ⌥ + →');
  assert.equal(formatCombo('mod+alt+arrowright', { isMac: false }), 'Ctrl + Alt + →');
  assert.equal(formatCombo('f1'), 'F1');
  assert.equal(formatCombo('escape'), 'Esc');
  assert.equal(formatCombo('space'), 'Space');
  assert.equal(formatCombo(''), '');
});

test('registry rejects invalid shortcuts', () => {
  const registry = createShortcutRegistry();
  assert.throws(() => registry.register(null), /must be an object/);
  assert.throws(() => registry.register({ combo: 'mod+k', handler() {} }), /stable id/);
  assert.throws(() => registry.register({ id: 'x', combo: 'mod+k' }), /needs a handler/);
  assert.throws(() => registry.register({ id: 'x', combo: '', handler() {} }), /needs a combo/);
  registry.register({ id: 'x', combo: 'mod+k', handler() {} });
  assert.throws(() => registry.register({ id: 'x', combo: 'mod+j', handler() {} }), /Duplicate shortcut id/);
});

test('registry matches canonical combos and honours editable contexts', () => {
  let calls = 0;
  const registry = createShortcutRegistry([
    { id: 'save', combo: 'mod+s', label: 'Save', category: 'Project', handler: () => { calls += 1; } },
    { id: 'help', combo: 'f1', label: 'Help', category: 'Help', allowInEditable: true, handler: () => { calls += 1; } },
  ]);
  const editableContext = { editable: true, modalOpen: false };
  assert.equal(registry.match(event('s', { ctrl: true }), editableContext), null, 'mod+s is blocked while typing');
  assert.equal(registry.match(event('s', { ctrl: true }), { editable: false })?.id, 'save');
  assert.equal(registry.match(event('F1'), editableContext)?.id, 'help');
  assert.equal(registry.match(event('p'), { editable: false }), null);

  const saveEvent = event('s', { ctrl: true });
  const dispatched = registry.dispatch(saveEvent, { editable: false });
  assert.equal(dispatched.id, 'save');
  assert.equal(calls, 1);
  assert.equal(saveEvent.defaultPrevented, true);

  const missed = event('x');
  assert.equal(registry.dispatch(missed), null);
  assert.equal(missed.defaultPrevented, false);
});

test('conditional shortcuts respect `when` and swallow predicate errors', () => {
  let visible = false;
  let ran = 0;
  const registry = createShortcutRegistry([
    { id: 'hidden', combo: 'mod+h', when: () => visible, handler: () => { ran += 1; } },
    { id: 'broken', combo: 'mod+b', when: () => { throw new Error('bad predicate'); }, handler: () => { ran += 1; } },
  ]);
  assert.equal(registry.match(event('h', { ctrl: true }), {}), null);
  visible = true;
  assert.equal(registry.match(event('h', { ctrl: true }), {})?.id, 'hidden');
  assert.equal(registry.match(event('b', { ctrl: true }), {}), null, 'a throwing predicate never fires');
  assert.equal(ran, 0);
});

test('dispatch can opt out of preventDefault', () => {
  const registry = createShortcutRegistry([{ id: 'passthrough', combo: 'mod+y', preventDefault: false, handler: () => {} }]);
  const keyEvent = event('y', { ctrl: true });
  registry.dispatch(keyEvent, {});
  assert.equal(keyEvent.defaultPrevented, false);
});

test('findConflicts reports identical bindings in the same context', () => {
  const registry = createShortcutRegistry([
    { id: 'a', combo: 'mod+k', category: 'Nav', handler: () => {} },
    { id: 'b', combo: 'mod+k', category: 'Nav', handler: () => {} },
    { id: 'c', combo: 'mod+k', category: 'Other', handler: () => {} },
    { id: 'd', combo: 'mod+k', category: 'Nav', allowInEditable: true, handler: () => {} },
  ]);
  const conflicts = registry.findConflicts();
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0].ids, ['a', 'b']);
  assert.equal(conflicts[0].combo, 'mod+k');
  assert.equal(conflicts[0].category, 'Nav');
});

test('helpGroups are grouped and alphabetised; list/unregister stay in sync', () => {
  const registry = createShortcutRegistry([
    { id: 'z', combo: 'mod+z', label: 'Undo', category: 'Editor', handler: () => {} },
    { id: 'a', combo: 'mod+a', label: 'Select all', category: 'Editor', handler: () => {} },
    { id: 'p', combo: 'mod+k', label: 'Palette', category: 'Navigation', handler: () => {} },
  ]);
  const groups = registry.helpGroups();
  assert.deepEqual(groups.map((group) => group.category), ['Editor', 'Navigation']);
  assert.deepEqual(groups[0].items.map((item) => item.label), ['Select all', 'Undo']);
  assert.equal(registry.list().length, 3);
  assert.equal(registry.unregister('p'), true);
  assert.equal(registry.unregister('p'), false);
  assert.equal(registry.list().length, 2);
  assert.deepEqual(registry.reportIssues(), []);
});

test('eventGroup returns a stable key for legacy handlers', () => {
  assert.equal(eventGroup({ key: 'K' }), 'k');
  assert.equal(eventGroup({ key: 'Shift' }), '');
  assert.equal(eventGroup({ key: 'ArrowUp' }), 'arrowup');
  assert.equal(eventGroup(null), '');
});
