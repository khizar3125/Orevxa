/**
 * Unit tests for src/studio/editorTabs.js — bounded tab model, dirty state,
 * closing semantics, syncing against deleted files and cycling.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_OPEN_TABS, activateTab, closeOtherTabs, closeTab, createTabState, cycleTab,
  markTabDirty, openTab, renameTab, syncTabs, tabDisplayName, tabTooltip,
} from '../src/studio/editorTabs.js';

const paths = (state) => [...state.tabs];

test('createTabState normalises duplicates and guarantees an active tab', () => {
  const state = createTabState('b.orv', ['a.orv', 'b.orv', 'a.orv', '', null]);
  assert.deepEqual(paths(state), ['a.orv', 'b.orv']);
  assert.equal(state.active, 'b.orv');
  assert.deepEqual([...state.dirty], []);

  const opened = createTabState('c.orv', ['a.orv']);
  assert.deepEqual(paths(opened), ['c.orv', 'a.orv'], 'the active file is prepended');

  const empty = createTabState(null, []);
  assert.deepEqual(paths(empty), []);
  assert.equal(empty.active, null);

  assert.throws(() => { state.tabs.push('mutate'); }, TypeError, 'state is immutable');
});

test('openTab activates existing tabs and appends new ones', () => {
  let state = createTabState('a.orv', ['a.orv']);
  state = openTab(state, 'b.orv');
  assert.deepEqual(paths(state), ['a.orv', 'b.orv']);
  assert.equal(state.active, 'b.orv');
  state = openTab(state, 'a.orv');
  assert.deepEqual(paths(state), ['a.orv', 'b.orv'], 're-opening never duplicates');
  assert.equal(state.active, 'a.orv');
  assert.deepEqual(paths(openTab(state, '')), ['a.orv', 'b.orv']);
  assert.deepEqual(paths(openTab(state, null)), ['a.orv', 'b.orv']);
});

test('openTab caps the number of tabs and prefers dropping an inactive clean tab', () => {
  let state = createTabState(null, []);
  for (let index = 0; index < MAX_OPEN_TABS; index += 1) state = openTab(state, `file-${index}.orv`);
  assert.equal(state.tabs.length, MAX_OPEN_TABS);
  state = markTabDirty(state, 'file-1.orv');
  const activeBefore = state.active;
  state = openTab(state, 'extra.orv');
  assert.equal(state.tabs.length, MAX_OPEN_TABS);
  assert.ok(state.tabs.includes('extra.orv'));
  assert.ok(state.tabs.includes(activeBefore), 'the active tab is preserved');
  assert.ok(state.tabs.includes('file-1.orv'), 'dirty tabs are not evicted');
  assert.ok(!state.tabs.includes('file-0.orv'), 'an inactive clean tab is evicted first');
});

test('closeTab keeps at least one tab and picks a neighbour', () => {
  let state = createTabState('b.orv', ['a.orv', 'b.orv', 'c.orv']);
  state = closeTab(state, 'b.orv');
  assert.deepEqual(paths(state), ['a.orv', 'c.orv']);
  assert.equal(state.active, 'c.orv', 'the tab at the same index becomes active');
  state = closeTab(state, 'c.orv');
  assert.deepEqual(paths(state), ['a.orv']);
  assert.equal(state.active, 'a.orv');
  const single = closeTab(state, 'a.orv');
  assert.deepEqual(paths(single), ['a.orv'], 'the last tab cannot be closed');
  assert.deepEqual(closeTab(state, 'missing.orv'), state);

  const dirtyState = markTabDirty(createTabState('a.orv', ['a.orv', 'b.orv']), 'b.orv');
  assert.deepEqual(closeTab(dirtyState, 'b.orv').dirty, [], 'dirty flags drop with the closed tab');
});

test('closeOtherTabs collapses to a single file', () => {
  let state = createTabState('a.orv', ['a.orv', 'b.orv', 'c.orv']);
  state = markTabDirty(markTabDirty(state, 'b.orv'), 'c.orv');
  const collapsed = closeOtherTabs(state, 'b.orv');
  assert.deepEqual(paths(collapsed), ['b.orv']);
  assert.equal(collapsed.active, 'b.orv');
  assert.deepEqual([...collapsed.dirty], ['b.orv']);
  assert.deepEqual(closeOtherTabs(state, 'missing.orv'), state);
});

test('activateTab opens unknown files and ignores missing ones gracefully', () => {
  const state = createTabState('a.orv', ['a.orv']);
  assert.equal(activateTab(state, 'a.orv').active, 'a.orv');
  const opened = activateTab(state, 'b.orv');
  assert.deepEqual(paths(opened), ['a.orv', 'b.orv']);
  assert.equal(opened.active, 'b.orv');
});

test('dirty tracking is bounded to open tabs', () => {
  let state = createTabState('a.orv', ['a.orv', 'b.orv']);
  state = markTabDirty(state, 'a.orv');
  assert.deepEqual([...state.dirty], ['a.orv']);
  state = markTabDirty(state, 'b.orv', true);
  assert.deepEqual([...state.dirty], ['a.orv', 'b.orv']);
  state = markTabDirty(state, 'a.orv', false);
  assert.deepEqual([...state.dirty], ['b.orv']);
  state = markTabDirty(state, 'deleted.orv');
  assert.deepEqual([...state.dirty], ['b.orv'], 'unknown files never become dirty');
});

test('renameTab moves tabs, active selection and dirty flags', () => {
  let state = createTabState('a.orv', ['a.orv', 'b.orv']);
  state = markTabDirty(state, 'a.orv');
  const renamed = renameTab(state, 'a.orv', 'main.orv');
  assert.deepEqual(paths(renamed), ['main.orv', 'b.orv']);
  assert.equal(renamed.active, 'main.orv');
  assert.deepEqual([...renamed.dirty], ['main.orv']);
  assert.deepEqual(renameTab(state, 'a.orv', 'a.orv'), state, 'no-op renames are ignored');
  assert.deepEqual(renameTab(state, 'missing.orv', 'x.orv'), state);
  assert.deepEqual(renameTab(state, 'a.orv', ''), state);
});

test('syncTabs removes deleted files and falls back to the first available file', () => {
  let state = createTabState('a.orv', ['a.orv', 'b.orv', 'c.orv']);
  state = markTabDirty(state, 'c.orv');
  const synced = syncTabs(state, ['b.orv', 'c.orv', 'd.orv']);
  assert.deepEqual(paths(synced), ['b.orv', 'c.orv']);
  assert.equal(synced.active, 'b.orv');
  assert.deepEqual([...synced.dirty], ['c.orv']);

  const allGone = syncTabs(state, ['d.orv', 'e.orv']);
  assert.deepEqual(paths(allGone), ['d.orv']);
  assert.equal(allGone.active, 'd.orv');
  assert.deepEqual([...allGone.dirty], []);

  const none = syncTabs(state, []);
  assert.deepEqual(paths(none), []);
  assert.equal(none.active, null);
  assert.deepEqual(paths(syncTabs(state, null)), []);
});

test('cycleTab wraps in both directions and is a no-op with one tab', () => {
  const state = createTabState('a.orv', ['a.orv', 'b.orv', 'c.orv']);
  assert.equal(cycleTab(state, 1).active, 'b.orv');
  assert.equal(cycleTab(state, -1).active, 'c.orv', 'backwards wraps to the last tab');
  assert.equal(cycleTab(createTabState('c.orv', ['a.orv', 'b.orv', 'c.orv']), 1).active, 'a.orv');
  const single = createTabState('a.orv', ['a.orv']);
  assert.deepEqual(cycleTab(single, 1), single);
});

test('display helpers are stable', () => {
  assert.equal(tabDisplayName('src/main.orv'), 'main.orv');
  assert.equal(tabDisplayName('main.orv'), 'main.orv');
  assert.equal(tabDisplayName(''), '');
  assert.equal(tabDisplayName(null), '');
  assert.equal(tabTooltip('a.orv'), 'a.orv');
  assert.equal(tabTooltip('a.orv', true), 'a.orv · unsaved changes');
});
