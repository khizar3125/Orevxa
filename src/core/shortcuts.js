/**
 * Keyboard shortcut registry.
 *
 * Shortcuts are normalised to a canonical lowercase form so that
 * `Ctrl+Shift+P`, `shift+ctrl+p` and `MOD+SHIFT+P` match the same action.
 * `MOD` means Cmd on macOS and Ctrl elsewhere.
 */
const MODIFIER_ORDER = ['ctrl', 'alt', 'shift', 'meta'];
const KEY_ALIASES = {
  esc: 'escape',
  return: 'enter',
  space: ' ',
  spacebar: ' ',
  del: 'delete',
  ins: 'insert',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  plus: '+',
  minus: '-',
};

export function isMacPlatform(platform = globalThis.navigator?.platform || '') {
  return /mac|iphone|ipad|ipod/i.test(String(platform));
}

export function normalizeKey(key) {
  const value = String(key ?? '').toLowerCase().trim();
  if (!value) return '';
  if (KEY_ALIASES[value]) return KEY_ALIASES[value];
  if (value === 'control') return 'ctrl';
  if (value === 'cmd' || value === 'command' || value === 'super' || value === 'win') return 'meta';
  return value;
}

export function normalizeCombo(input) {
  const pieces = String(input ?? '')
    .split('+')
    .map((piece) => piece.trim())
    .filter(Boolean);
  if (!pieces.length) return '';
  const modifiers = new Set();
  let key = '';
  for (const piece of pieces) {
    const normalized = normalizeKey(piece);
    if (normalized === 'mod') { modifiers.add('mod'); continue; }
    if (MODIFIER_ORDER.includes(normalized)) { modifiers.add(normalized); continue; }
    key = normalized;
  }
  if (!key) return '';
  const ordered = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier));
  if (modifiers.has('mod')) ordered.unshift('mod');
  return [...ordered, key].join('+');
}

export function comboFromEvent(event, { isMac = false } = {}) {
  if (!event) return '';
  const key = normalizeKey(event.key);
  if (!key) return '';
  if (['shift', 'control', 'alt', 'meta'].includes(key)) return '';
  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push('mod');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  parts.push(key);
  // Canonicalise Ctrl/Cmd to `mod` so one registry works on every platform.
  return normalizeCombo(parts.join('+'));
}

export function formatCombo(combo, { isMac = false } = {}) {
  const normalized = normalizeCombo(combo);
  if (!normalized) return '';
  return normalized
    .split('+')
    .map((part) => {
      if (part === 'mod') return isMac ? '⌘' : 'Ctrl';
      if (part === 'ctrl') return isMac ? '⌃' : 'Ctrl';
      if (part === 'alt') return isMac ? '⌥' : 'Alt';
      if (part === 'shift') return isMac ? '⇧' : 'Shift';
      if (part === 'meta') return isMac ? '⌘' : 'Meta';
      if (part === 'enter') return '↵';
      if (part === 'escape') return 'Esc';
      if (part === 'arrowup') return '↑';
      if (part === 'arrowdown') return '↓';
      if (part === 'arrowleft') return '←';
      if (part === 'arrowright') return '→';
      if (part === ' ') return 'Space';
      return part.length === 1 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1);
    })
    .join(' + ');
}

export function createShortcutRegistry(initial = []) {
  const entries = new Map();
  const issues = [];

  function register(entry) {
    if (!entry || typeof entry !== 'object') throw new TypeError('Shortcut entry must be an object.');
    const id = String(entry.id || '').trim();
    if (!id) throw new Error('Shortcut needs a stable id.');
    if (entries.has(id)) throw new Error(`Duplicate shortcut id "${id}".`);
    if (typeof entry.handler !== 'function') throw new Error(`Shortcut "${id}" needs a handler.`);
    const combo = normalizeCombo(entry.combo);
    if (!combo) throw new Error(`Shortcut "${id}" needs a combo.`);
    const normalized = Object.freeze({
      id,
      combo,
      label: String(entry.label || id),
      description: String(entry.description || ''),
      category: String(entry.category || 'General'),
      allowInEditable: Boolean(entry.allowInEditable),
      preventDefault: entry.preventDefault !== false,
      when: typeof entry.when === 'function' ? entry.when : null,
      handler: entry.handler,
    });
    entries.set(id, normalized);
    return normalized;
  }

  initial.forEach(register);

  function unregister(id) { return entries.delete(id); }

  function list() { return [...entries.values()]; }

  function findConflicts() {
    const groups = new Map();
    for (const entry of entries.values()) {
      const key = `${entry.combo}|${entry.category}|${entry.allowInEditable ? 'editable' : 'global'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    const conflicts = [];
    for (const group of groups.values()) {
      if (group.length > 1) conflicts.push({ combo: group[0].combo, category: group[0].category, ids: group.map((entry) => entry.id) });
    }
    return conflicts;
  }

  function match(event, context = {}) {
    const combo = comboFromEvent(event, { isMac: Boolean(context.isMac) });
    if (!combo) return null;
    const editable = Boolean(context.editable);
    for (const entry of entries.values()) {
      if (entry.combo !== combo) continue;
      if (editable && !entry.allowInEditable) continue;
      if (entry.when && !safeWhen(entry.when, context)) continue;
      return entry;
    }
    return null;
  }

  function dispatch(event, context = {}) {
    const entry = match(event, context);
    if (!entry) return null;
    if (entry.preventDefault) event.preventDefault?.();
    entry.handler(event, context);
    return entry;
  }

  function helpGroups() {
    const groups = new Map();
    for (const entry of entries.values()) {
      if (!groups.has(entry.category)) groups.set(entry.category, []);
      groups.get(entry.category).push(entry);
    }
    return [...groups.entries()].map(([category, items]) => ({
      category,
      items: items
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((entry) => ({ id: entry.id, combo: entry.combo, label: entry.label, description: entry.description })),
    }));
  }

  function reportIssues() { return [...issues]; }

  return Object.freeze({ register, unregister, list, findConflicts, match, dispatch, helpGroups, reportIssues, issues });
}

function safeWhen(when, context) {
  try { return Boolean(when(context)); } catch { return false; }
}

/** Convert a KeyboardEvent to a stable grouping key (used by legacy handlers). */
export function eventGroup(event) {
  const key = normalizeKey(event?.key);
  if (!key || ['shift', 'control', 'alt', 'meta'].includes(key)) return '';
  return key;
}
