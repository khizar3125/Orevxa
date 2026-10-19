/**
 * Versioned, validated Studio preferences (v10).
 * Pure helpers are DOM-free so they can be tested under Node; `applyPreferences`
 * is the only DOM-facing function and accepts an injected root for tests.
 */
export const PREFERENCES_KEY = 'orvexa-preferences-v1';
export const PREFERENCES_VERSION = 1;
export const LEGACY_THEME_KEY = 'orvexa-studio-theme';

export const THEMES = Object.freeze([
  { id: 'system', name: 'System', description: 'Follow the operating system.' },
  { id: 'dark', name: 'Dark', description: 'Deep-space glass (default).' },
  { id: 'light', name: 'Light', description: 'Bright paper with soft violet edges.' },
]);

export const ACCENTS = Object.freeze([
  { id: 'violet', name: 'Violet Nebula', color: '#927cff', strong: '#7b61f6' },
  { id: 'cyan', name: 'Cyan Pulse', color: '#2fd4e6', strong: '#0facc0' },
  { id: 'emerald', name: 'Emerald Forge', color: '#38d39f', strong: '#17b283' },
  { id: 'amber', name: 'Solar Amber', color: '#ffb454', strong: '#e28c22' },
  { id: 'rose', name: 'Neon Rose', color: '#ff6f9c', strong: '#e14b7d' },
  { id: 'azure', name: 'Azure Beam', color: '#5b9dff', strong: '#3579e0' },
]);

export const DENSITIES = Object.freeze([
  { id: 'compact', name: 'Compact', description: 'More rows on screen.' },
  { id: 'comfortable', name: 'Comfortable', description: 'Balanced default.' },
  { id: 'spacious', name: 'Spacious', description: 'Larger touch targets.' },
]);

export const MOTION_MODES = Object.freeze([
  { id: 'system', name: 'Follow system' },
  { id: 'full', name: 'Full motion' },
  { id: 'reduced', name: 'Reduced motion' },
]);

export const CONTRAST_MODES = Object.freeze([
  { id: 'normal', name: 'Normal' },
  { id: 'high', name: 'High contrast' },
]);

export const AUTOSAVE_DELAYS = Object.freeze([0, 200, 400, 800, 1200]);
export const TAB_SIZES = Object.freeze([2, 4, 8]);
export const EDITOR_FONT_SIZES = Object.freeze([12, 13, 14, 15, 16, 18, 20]);

const DEFAULT_PREFERENCES = Object.freeze({
  version: PREFERENCES_VERSION,
  theme: 'dark',
  accent: 'violet',
  density: 'comfortable',
  motion: 'system',
  contrast: 'normal',
  editorFontSize: 14,
  wordWrap: false,
  tabSize: 4,
  autosaveDelay: 400,
  rememberAiKey: false,
  showWelcomeTour: true,
  showLineNumbers: true,
  confirmDestructive: true,
});

export function defaultPreferences() { return { ...DEFAULT_PREFERENCES }; }

const oneOf = (list, value, fallback) => list.some((entry) => entry.id === value) ? value : fallback;
const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

export function normalizePreferences(raw = {}) {
  const input = raw && typeof raw === 'object' ? raw : {};
  return {
    version: PREFERENCES_VERSION,
    theme: oneOf(THEMES, input.theme, DEFAULT_PREFERENCES.theme),
    accent: oneOf(ACCENTS, input.accent, DEFAULT_PREFERENCES.accent),
    density: oneOf(DENSITIES, input.density, DEFAULT_PREFERENCES.density),
    motion: oneOf(MOTION_MODES, input.motion, DEFAULT_PREFERENCES.motion),
    contrast: oneOf(CONTRAST_MODES, input.contrast, DEFAULT_PREFERENCES.contrast),
    editorFontSize: EDITOR_FONT_SIZES.includes(Number(input.editorFontSize)) ? Number(input.editorFontSize) : DEFAULT_PREFERENCES.editorFontSize,
    wordWrap: typeof input.wordWrap === 'boolean' ? input.wordWrap : DEFAULT_PREFERENCES.wordWrap,
    tabSize: TAB_SIZES.includes(Number(input.tabSize)) ? Number(input.tabSize) : DEFAULT_PREFERENCES.tabSize,
    autosaveDelay: AUTOSAVE_DELAYS.includes(Number(input.autosaveDelay)) ? Number(input.autosaveDelay) : DEFAULT_PREFERENCES.autosaveDelay,
    rememberAiKey: typeof input.rememberAiKey === 'boolean' ? input.rememberAiKey : DEFAULT_PREFERENCES.rememberAiKey,
    showWelcomeTour: typeof input.showWelcomeTour === 'boolean' ? input.showWelcomeTour : DEFAULT_PREFERENCES.showWelcomeTour,
    showLineNumbers: typeof input.showLineNumbers === 'boolean' ? input.showLineNumbers : DEFAULT_PREFERENCES.showLineNumbers,
    confirmDestructive: typeof input.confirmDestructive === 'boolean' ? input.confirmDestructive : DEFAULT_PREFERENCES.confirmDestructive,
  };
}

export function setPreference(preferences, key, value) {
  if (!(key in DEFAULT_PREFERENCES) || key === 'version') throw new Error(`Unknown preference "${key}".`);
  return normalizePreferences({ ...preferences, [key]: value });
}

export function resolveTheme(preferences, prefersDark = true) {
  const theme = normalizePreferences(preferences).theme;
  if (theme === 'system') return prefersDark ? 'dark' : 'light';
  return theme;
}

export function getAccent(accentId) {
  return ACCENTS.find((accent) => accent.id === accentId) || ACCENTS[0];
}

/** Hex blend used for generated tint/edge tokens (keeps both themes coherent). */
export function blendHex(foreground, background, weight = 0.22) {
  const parse = (hex) => {
    const clean = String(hex || '').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    if (!/^[\da-f]{6}$/i.test(full)) return null;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  };
  const fg = parse(foreground);
  const bg = parse(background);
  if (!fg || !bg) return background;
  const ratio = Math.min(1, Math.max(0, Number(weight) || 0));
  const hex = fg.map((channel, index) => Math.round(channel * ratio + bg[index] * (1 - ratio)).toString(16).padStart(2, '0'));
  return `#${hex.join('')}`;
}

export function preferencesToCss(preferences, { resolvedTheme = 'dark' } = {}) {
  const prefs = normalizePreferences(preferences);
  const accent = getAccent(prefs.accent);
  const panel = resolvedTheme === 'light' ? '#fcfbff' : '#17161f';
  const edge = resolvedTheme === 'light' ? '#e1ddec' : '#2b2937';
  return {
    '--accent': accent.color,
    '--accent-strong': accent.strong,
    '--purple': accent.color,
    '--purple-strong': accent.strong,
    '--purple-tint': blendHex(accent.color, panel, resolvedTheme === 'light' ? 0.14 : 0.2),
    '--purple-edge': blendHex(accent.color, edge, 0.45),
    '--editor-font-size': `${prefs.editorFontSize}px`,
    '--editor-tab-size': String(prefs.tabSize),
  };
}

export function applyPreferences(preferences, { root = null, matchMedia = null } = {}) {
  const prefs = normalizePreferences(preferences);
  const target = root || (typeof document !== 'undefined' ? document.documentElement : null);
  if (!target) return { preferences: prefs, resolvedTheme: resolveTheme(prefs, true) };
  let prefersDark = true;
  try {
    prefersDark = matchMedia ? matchMedia('(prefers-color-scheme: dark)').matches : globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true;
  } catch { prefersDark = true; }
  const resolvedTheme = resolveTheme(prefs, prefersDark);
  target.dataset.theme = resolvedTheme;
  target.dataset.themePreference = prefs.theme;
  target.dataset.accent = prefs.accent;
  target.dataset.density = prefs.density;
  target.dataset.motion = prefs.motion;
  target.dataset.contrast = prefs.contrast;
  target.dataset.wordWrap = prefs.wordWrap ? 'on' : 'off';
  target.dataset.lineNumbers = prefs.showLineNumbers ? 'on' : 'off';
  const css = preferencesToCss(prefs, { resolvedTheme });
  if (target.style?.setProperty) {
    for (const [property, value] of Object.entries(css)) target.style.setProperty(property, value);
    target.style.setProperty('color-scheme', resolvedTheme === 'light' ? 'light' : 'dark');
  }
  return { preferences: prefs, resolvedTheme };
}

export function loadPreferences(storage = null) {
  const store = storage || safeLocalStorage();
  if (!store) return defaultPreferences();
  try {
    const raw = store.getItem(PREFERENCES_KEY);
    if (!raw) {
      const legacyTheme = store.getItem(LEGACY_THEME_KEY);
      return normalizePreferences(legacyTheme ? { theme: legacyTheme === 'light' ? 'light' : 'dark' } : {});
    }
    const parsed = JSON.parse(raw);
    return normalizePreferences(parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed);
  } catch { return defaultPreferences(); }
}

export function savePreferences(preferences, storage = null) {
  const prefs = normalizePreferences(preferences);
  const store = storage || safeLocalStorage();
  if (!store) return { ok: false, preferences: prefs };
  try {
    store.setItem(PREFERENCES_KEY, JSON.stringify({ version: PREFERENCES_VERSION, savedAt: new Date().toISOString(), data: prefs }));
    return { ok: true, preferences: prefs };
  } catch { return { ok: false, preferences: prefs }; }
}

export function resetPreferences(storage = null) {
  const store = storage || safeLocalStorage();
  try { store?.removeItem(PREFERENCES_KEY); } catch { /* ignore */ }
  return defaultPreferences();
}

function safeLocalStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
