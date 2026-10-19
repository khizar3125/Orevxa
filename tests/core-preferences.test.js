/**
 * Unit tests for src/core/preferences.js — validation, persistence,
 * theme resolution, accent blending and CSS/root projection.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCENTS, AUTOSAVE_DELAYS, CONTRAST_MODES, DENSITIES, EDITOR_FONT_SIZES, LEGACY_THEME_KEY,
  MOTION_MODES, PREFERENCES_KEY, PREFERENCES_VERSION, TAB_SIZES, THEMES, applyPreferences,
  blendHex, defaultPreferences, getAccent, loadPreferences, normalizePreferences, preferencesToCss,
  resetPreferences, resolveTheme, savePreferences, setPreference,
} from '../src/core/preferences.js';
import { createMemoryStorage } from '../src/core/storage.js';

function fakeRoot() {
  const properties = {};
  return {
    dataset: {},
    style: { setProperty: (name, value) => { properties[name] = value; }, getPropertyValue: (name) => properties[name] || '' },
    properties,
  };
}

test('defaults are complete and immutable', () => {
  const defaults = defaultPreferences();
  assert.equal(defaults.theme, 'dark');
  assert.equal(defaults.accent, 'violet');
  assert.equal(defaults.density, 'comfortable');
  assert.equal(defaults.motion, 'system');
  assert.equal(defaults.contrast, 'normal');
  assert.equal(defaults.editorFontSize, 14);
  assert.equal(defaults.wordWrap, false);
  assert.equal(defaults.tabSize, 4);
  assert.equal(defaults.autosaveDelay, 400);
  assert.equal(defaults.rememberAiKey, false);
  assert.equal(defaults.showWelcomeTour, true);
  assert.equal(defaults.showLineNumbers, true);
  assert.equal(defaults.confirmDestructive, true);
  assert.equal(defaults.version, PREFERENCES_VERSION);
  assert.notEqual(defaultPreferences(), defaults, 'defaults are copied, not shared');
  assert.deepEqual(THEMES.map((entry) => entry.id), ['system', 'dark', 'light']);
  assert.deepEqual(DENSITIES.map((entry) => entry.id), ['compact', 'comfortable', 'spacious']);
  assert.deepEqual(MOTION_MODES.map((entry) => entry.id), ['system', 'full', 'reduced']);
  assert.deepEqual(CONTRAST_MODES.map((entry) => entry.id), ['normal', 'high']);
  assert.deepEqual(AUTOSAVE_DELAYS, [0, 200, 400, 800, 1200]);
  assert.deepEqual(TAB_SIZES, [2, 4, 8]);
  assert.deepEqual(EDITOR_FONT_SIZES, [12, 13, 14, 15, 16, 18, 20]);
});

test('normalizePreferences repairs every invalid field', () => {
  const repaired = normalizePreferences({
    theme: 'neon', accent: 'laser', density: 'tiny', motion: 'warp', contrast: 'extreme',
    editorFontSize: 99, wordWrap: 'yes', tabSize: 3, autosaveDelay: 60000,
    rememberAiKey: 'true', showWelcomeTour: 0, showLineNumbers: null, confirmDestructive: 'no',
  });
  assert.deepEqual(repaired, defaultPreferences());
  assert.deepEqual(normalizePreferences(null), defaultPreferences());
  assert.deepEqual(normalizePreferences('nope'), defaultPreferences());
  assert.equal(normalizePreferences({ editorFontSize: '16' }).editorFontSize, 16, 'numeric strings are accepted');
  assert.equal(normalizePreferences({ tabSize: 2 }).tabSize, 2);
  assert.equal(normalizePreferences({ autosaveDelay: 0 }).autosaveDelay, 0);
  assert.equal(normalizePreferences({ theme: 'light' }).theme, 'light');
});

test('setPreference validates the key and value', () => {
  const next = setPreference(defaultPreferences(), 'accent', 'cyan');
  assert.equal(next.accent, 'cyan');
  assert.throws(() => setPreference(defaultPreferences(), 'version', 2), /Unknown preference/);
  assert.throws(() => setPreference(defaultPreferences(), 'nope', true), /Unknown preference/);
  const repaired = setPreference(defaultPreferences(), 'density', 'gigantic');
  assert.equal(repaired.density, 'comfortable');
});

test('resolveTheme follows the system only for the system preference', () => {
  assert.equal(resolveTheme({ theme: 'dark' }, false), 'dark');
  assert.equal(resolveTheme({ theme: 'light' }, true), 'light');
  assert.equal(resolveTheme({ theme: 'system' }, true), 'dark');
  assert.equal(resolveTheme({ theme: 'system' }, false), 'light');
  assert.equal(resolveTheme({}, false), 'dark', 'default is an explicit dark theme, not system');
});

test('getAccent always returns a usable accent', () => {
  assert.equal(getAccent('rose').color, ACCENTS.find((accent) => accent.id === 'rose').color);
  assert.equal(getAccent('missing').id, 'violet');
  assert.equal(getAccent(undefined).id, 'violet');
});

test('blendHex mixes channels and tolerates bad input', () => {
  assert.equal(blendHex('#ffffff', '#000000', 0.5), '#808080');
  assert.equal(blendHex('#fff', '#000', 1), '#ffffff');
  assert.equal(blendHex('#fff', '#000', 0), '#000000');
  assert.equal(blendHex('#abcdef', '#123456', 0.22).length, 7);
  assert.equal(blendHex('not-a-colour', '#123456'), '#123456');
  assert.equal(blendHex('#123456', 'nope'), 'nope');
  assert.equal(blendHex('#ffffff', '#000000', 4), '#ffffff', 'weights are clamped');
});

test('preferencesToCss projects accent and editor tokens', () => {
  const dark = preferencesToCss({ accent: 'cyan', editorFontSize: 18, tabSize: 8 }, { resolvedTheme: 'dark' });
  const accent = ACCENTS.find((entry) => entry.id === 'cyan');
  assert.equal(dark['--accent'], accent.color);
  assert.equal(dark['--accent-strong'], accent.strong);
  assert.equal(dark['--purple'], accent.color);
  assert.equal(dark['--editor-font-size'], '18px');
  assert.equal(dark['--editor-tab-size'], '8');
  assert.match(dark['--purple-tint'], /^#[0-9a-f]{6}$/);
  const light = preferencesToCss({ accent: 'cyan' }, { resolvedTheme: 'light' });
  assert.notEqual(light['--purple-tint'], dark['--purple-tint'], 'theme changes generated tints');
});

test('applyPreferences writes theme attributes and CSS variables to a root', () => {
  const root = fakeRoot();
  const result = applyPreferences({ theme: 'light', accent: 'emerald', density: 'compact', motion: 'reduced', contrast: 'high', wordWrap: true, showLineNumbers: false }, { root, matchMedia: () => ({ matches: false }) });
  assert.equal(result.resolvedTheme, 'light');
  assert.equal(root.dataset.theme, 'light');
  assert.equal(root.dataset.themePreference, 'light');
  assert.equal(root.dataset.accent, 'emerald');
  assert.equal(root.dataset.density, 'compact');
  assert.equal(root.dataset.motion, 'reduced');
  assert.equal(root.dataset.contrast, 'high');
  assert.equal(root.dataset.wordWrap, 'on');
  assert.equal(root.dataset.lineNumbers, 'off');
  assert.equal(root.properties['--accent'], ACCENTS.find((entry) => entry.id === 'emerald').color);
  assert.equal(root.properties['color-scheme'], 'light');

  const systemRoot = fakeRoot();
  const system = applyPreferences({ theme: 'system' }, { root: systemRoot, matchMedia: () => ({ matches: false }) });
  assert.equal(system.resolvedTheme, 'light', 'system + light OS resolves light');

  const broken = applyPreferences({ theme: 'dark' }, { root: fakeRoot(), matchMedia: () => { throw new Error('no mql'); } });
  assert.equal(broken.resolvedTheme, 'dark', 'matchMedia failures fall back to dark');
});

test('applyPreferences is safe without a document', () => {
  const result = applyPreferences({ theme: 'dark' }, { root: null });
  assert.equal(result.preferences.theme, 'dark');
  assert.equal(typeof result.resolvedTheme, 'string');
});

test('preferences persist with a versioned envelope', () => {
  const storage = createMemoryStorage();
  const saved = savePreferences({ theme: 'light', accent: 'amber', editorFontSize: 18 }, storage);
  assert.equal(saved.ok, true);
  assert.equal(saved.preferences.theme, 'light');
  const raw = JSON.parse(storage.getItem(PREFERENCES_KEY));
  assert.equal(raw.version, PREFERENCES_VERSION);
  assert.ok(raw.savedAt);
  assert.equal(raw.data.accent, 'amber');
  assert.equal(loadPreferences(storage).accent, 'amber');
});

test('loading tolerates corrupt data and migrates the legacy theme key', () => {
  const corrupt = createMemoryStorage({ [PREFERENCES_KEY]: '{broken' });
  assert.deepEqual(loadPreferences(corrupt), defaultPreferences());

  const legacyLight = createMemoryStorage({ [LEGACY_THEME_KEY]: 'light' });
  assert.equal(loadPreferences(legacyLight).theme, 'light');
  const legacyDark = createMemoryStorage({ [LEGACY_THEME_KEY]: 'dark' });
  assert.equal(loadPreferences(legacyDark).theme, 'dark');

  const flat = createMemoryStorage({ [PREFERENCES_KEY]: JSON.stringify({ theme: 'light', accent: 'rose' }) });
  assert.equal(loadPreferences(flat).accent, 'rose');

  const wrapped = createMemoryStorage({ [PREFERENCES_KEY]: JSON.stringify({ version: 1, data: { theme: 'light', density: 'spacious' } }) });
  assert.equal(loadPreferences(wrapped).density, 'spacious');
});

test('save failures are reported without throwing', () => {
  const broken = { getItem: () => null, setItem: () => { throw new Error('denied'); }, removeItem: () => {} };
  const result = savePreferences({ theme: 'dark' }, broken);
  assert.equal(result.ok, false);
  assert.equal(result.preferences.theme, 'dark');
});

test('resetPreferences restores defaults and clears the key', () => {
  const storage = createMemoryStorage({ [PREFERENCES_KEY]: JSON.stringify({ data: { theme: 'light' } }) });
  const reset = resetPreferences(storage);
  assert.deepEqual(reset, defaultPreferences());
  assert.equal(storage.getItem(PREFERENCES_KEY), null);
  assert.deepEqual(resetPreferences(null), defaultPreferences());
});
