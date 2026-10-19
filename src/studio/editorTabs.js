/**
 * Pure multi-file tab model for the Studio editor.
 * Keeps at least one tab open, caps memory use, and never mutates its input.
 */
export const MAX_OPEN_TABS = 12;

export function createTabState(activeFile = null, files = []) {
  const initial = [];
  for (const path of files) {
    if (typeof path === 'string' && path && !initial.includes(path)) initial.push(path);
  }
  if (activeFile && !initial.includes(activeFile)) initial.unshift(activeFile);
  const tabs = initial.slice(0, MAX_OPEN_TABS);
  return Object.freeze({
    tabs: Object.freeze(tabs),
    active: tabs.includes(activeFile) ? activeFile : tabs[0] || null,
    dirty: Object.freeze([]),
  });
}

export function openTab(state, path) {
  const safe = normalizeState(state);
  if (typeof path !== 'string' || !path) return safe;
  if (safe.tabs.includes(path)) return { ...safe, active: path };
  let tabs = [...safe.tabs, path];
  if (tabs.length > MAX_OPEN_TABS) {
    const removable = tabs.findIndex((tab) => tab !== safe.active && !safe.dirty.includes(tab));
    tabs.splice(removable === -1 ? 0 : removable, 1);
  }
  return { ...safe, tabs, active: path };
}

export function closeTab(state, path) {
  const safe = normalizeState(state);
  if (!safe.tabs.includes(path)) return safe;
  if (safe.tabs.length === 1) return { ...safe, active: safe.tabs[0], tabs: safe.tabs };
  const index = safe.tabs.indexOf(path);
  const tabs = safe.tabs.filter((tab) => tab !== path);
  let active = safe.active;
  if (safe.active === path) active = tabs[Math.min(index, tabs.length - 1)] || tabs[0];
  return { tabs, active, dirty: safe.dirty.filter((tab) => tab !== path) };
}

export function closeOtherTabs(state, path) {
  const safe = normalizeState(state);
  if (!safe.tabs.includes(path)) return safe;
  return { tabs: [path], active: path, dirty: safe.dirty.filter((tab) => tab === path) };
}

export function activateTab(state, path) {
  const safe = normalizeState(state);
  if (!safe.tabs.includes(path)) return openTab(safe, path);
  return { ...safe, active: path };
}

export function markTabDirty(state, path, dirty = true) {
  const safe = normalizeState(state);
  const set = new Set(safe.dirty);
  if (dirty) set.add(path); else set.delete(path);
  return { ...safe, dirty: [...set].filter((tab) => safe.tabs.includes(tab)) };
}

export function renameTab(state, from, to) {
  const safe = normalizeState(state);
  if (!from || !to || from === to || !safe.tabs.includes(from)) return safe;
  return {
    tabs: safe.tabs.map((tab) => tab === from ? to : tab),
    active: safe.active === from ? to : safe.active,
    dirty: safe.dirty.map((tab) => tab === from ? to : tab),
  };
}

export function syncTabs(state, availableFiles) {
  const safe = normalizeState(state);
  const available = new Set(Array.isArray(availableFiles) ? availableFiles : []);
  const tabs = safe.tabs.filter((tab) => available.has(tab));
  if (!tabs.length) {
    const [first] = [...available];
    return { tabs: first ? [first] : [], active: first || null, dirty: [] };
  }
  return {
    tabs,
    active: tabs.includes(safe.active) ? safe.active : tabs[0],
    dirty: safe.dirty.filter((tab) => available.has(tab)),
  };
}

export function cycleTab(state, direction = 1) {
  const safe = normalizeState(state);
  if (safe.tabs.length < 2) return safe;
  const index = safe.tabs.indexOf(safe.active);
  const next = ((index + (direction >= 0 ? 1 : -1)) % safe.tabs.length + safe.tabs.length) % safe.tabs.length;
  return { ...safe, active: safe.tabs[next] };
}

export function tabDisplayName(path) {
  const value = String(path || '');
  const parts = value.split('/');
  return parts[parts.length - 1] || value;
}

export function tabTooltip(path, dirty = false) {
  return `${path}${dirty ? ' · unsaved changes' : ''}`;
}

function normalizeState(state) {
  const tabs = Array.isArray(state?.tabs) ? [...new Set(state.tabs.filter((tab) => typeof tab === 'string' && tab))] : [];
  const active = tabs.includes(state?.active) ? state.active : tabs[0] || null;
  const dirty = Array.isArray(state?.dirty) ? [...new Set(state.dirty.filter((tab) => tabs.includes(tab)))] : [];
  return { tabs, active, dirty };
}
