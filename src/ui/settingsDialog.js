/**
 * Studio Settings (Ctrl/Cmd+,) — appearance, editor, accessibility, data and
 * privacy. Every control applies immediately and persists through the
 * preferences layer.
 */
import {
  ACCENTS, AUTOSAVE_DELAYS, CONTRAST_MODES, DENSITIES, EDITOR_FONT_SIZES,
  MOTION_MODES, TAB_SIZES, THEMES, normalizePreferences, setPreference,
} from '../core/preferences.js';
import { formatBytes } from '../core/storage.js';
import { askConfirm, escapeAttr, escapeHtml, openDialog } from './dialog.js';

const SECTION_IDS = ['appearance', 'editor', 'accessibility', 'data', 'about'];

export function openSettingsDialog({
  preferences,
  onChange = null,
  onExportData = null,
  onImportData = null,
  onClearSnapshots = null,
  onClearErrors = null,
  onResetData = null,
  onInstall = null,
  onShowTour = null,
  onForgetAiKey = null,
  onCopyDiagnostics = null,
  appVersion = '10.0.0',
  canInstall = false,
  installUnavailableReason = 'Install is offered by your browser when the app is served over HTTPS.',
  isStandalone = false,
  storage = { localBytes: 0, quota: 0, percent: 0 },
  errorCount = 0,
  aiKeyStored = false,
  documentRef = null,
} = {}) {
  let current = normalizePreferences(preferences);
  const dialog = openDialog({
    title: 'Settings',
    subtitle: 'Tune the Studio to your device, eyes and workflow. Everything is stored locally.',
    size: 'large',
    className: 'orvexa-settings',
    documentRef,
    onClose: () => { try { onClose?.(current); } catch { /* ignore */ } },
    body: `
      <div class="settings-layout">
        <nav class="settings-nav" role="tablist" aria-label="Settings sections" aria-orientation="vertical">
          ${SECTION_IDS.map((id, index) => `<button type="button" role="tab" id="settings-tab-${id}" data-settings-tab="${id}" aria-controls="settings-panel-${id}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" class="settings-nav-button${index === 0 ? ' active' : ''}">${sectionIcon(id)}<span>${sectionLabel(id)}</span></button>`).join('')}
        </nav>
        <div class="settings-panels">
          ${renderAppearance(current)}
          ${renderEditor(current)}
          ${renderAccessibility(current)}
          ${renderData({ storage, errorCount, aiKeyStored })}
          ${renderAbout({ appVersion, canInstall, installUnavailableReason, isStandalone, storage })}
        </div>
      </div>`,
    footer: `<span class="settings-footer-note">Changes save instantly.</span><button type="button" class="button secondary" data-settings-reset>Reset preferences</button><button type="button" class="button primary" data-dialog-close-ok>Done</button>`,
  });

  const panels = [...dialog.body.querySelectorAll('[data-settings-panel]')];
  const tabs = [...dialog.body.querySelectorAll('[data-settings-tab]')];
  const activateSection = (id) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.settingsTab === id;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.settingsPanel !== id; });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateSection(tab.dataset.settingsTab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + direction + tabs.length) % tabs.length;
      activateSection(tabs[next].dataset.settingsTab);
      tabs[next].focus();
    });
  });

  const commit = (key, value) => {
    try {
      current = setPreference(current, key, value);
      onChange?.(current);
      updateDerivedUi();
    } catch (error) {
      console.error('Orvexa preference failed:', error);
    }
  };

  dialog.body.addEventListener('change', (event) => {
    const control = event.target.closest('[data-pref]');
    if (!control) return;
    const key = control.dataset.pref;
    const value = control.type === 'checkbox' ? control.checked : control.tagName === 'SELECT' && /^-?\d+$/.test(control.value) ? Number(control.value) : control.value;
    commit(key, value);
  });
  dialog.body.querySelectorAll('[data-accent]').forEach((button) => {
    button.addEventListener('click', () => {
      dialog.body.querySelectorAll('[data-accent]').forEach((item) => item.setAttribute('aria-checked', String(item === button)));
      commit('accent', button.dataset.accent);
    });
  });

  dialog.body.querySelector('[data-settings-reset]')?.addEventListener('click', async () => {
    if (!await askConfirm({ title: 'Reset preferences?', message: 'Theme, accent, editor and accessibility settings return to their defaults. Project files are not touched.', confirmLabel: 'Reset settings', danger: true, documentRef })) return;
    const defaults = normalizePreferences({});
    current = defaults;
    onChange?.(defaults, { reset: true });
    dialog.close();
  });

  dialog.body.querySelector('[data-export-data]')?.addEventListener('click', () => onExportData?.());
  dialog.body.querySelector('[data-import-data]')?.addEventListener('click', () => dialog.body.querySelector('#settingsImportFile')?.click());
  dialog.body.querySelector('#settingsImportFile')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) onImportData?.(file);
    event.target.value = '';
  });
  dialog.body.querySelector('[data-clear-snapshots]')?.addEventListener('click', () => onClearSnapshots?.());
  dialog.body.querySelector('[data-clear-errors]')?.addEventListener('click', () => { onClearErrors?.(); dialog.close(); });
  dialog.body.querySelector('[data-forget-key]')?.addEventListener('click', () => { onForgetAiKey?.(); dialog.close(); });
  dialog.body.querySelector('[data-reset-data]')?.addEventListener('click', async () => {
    if (!await askConfirm({ title: 'Clear all Orvexa data?', message: 'This removes the saved project, snapshots, preferences and logs from this browser. Download a project ZIP first — this cannot be undone.', confirmLabel: 'Clear everything', danger: true, documentRef })) return;
    onResetData?.();
  });
  dialog.body.querySelector('[data-show-tour]')?.addEventListener('click', () => { dialog.close(); setTimeout(() => onShowTour?.(), 80); });
  dialog.body.querySelector('[data-install-app]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Opening install prompt…';
    try {
      const result = await onInstall?.();
      button.textContent = result?.outcome === 'accepted' ? 'Installing…' : 'Install not completed';
    } catch { button.textContent = 'Install unavailable'; }
    setTimeout(() => { button.disabled = false; button.textContent = 'Install Orvexa Studio'; }, 2500);
  });
  dialog.body.querySelector('[data-copy-diagnostics]')?.addEventListener('click', async () => {
    try {
      const text = await onCopyDiagnostics?.();
      const button = dialog.body.querySelector('[data-copy-diagnostics]');
      if (button) button.textContent = text ? 'Copied ✓' : 'Nothing to copy';
    } catch { /* ignore */ }
  });
  dialog.body.querySelector('[data-dialog-close-ok]')?.addEventListener('click', () => dialog.close());
  activateSection('appearance');
  updateDerivedUi();

  function updateDerivedUi() {
    const summary = dialog.body.querySelector('[data-settings-summary]');
    if (summary) summary.textContent = summaryLine(current);
    const autosave = dialog.body.querySelector('[data-autosave-note]');
    if (autosave) autosave.textContent = current.autosaveDelay === 0 ? 'Manual save only — use Ctrl/Cmd+S.' : `Autosaves ${current.autosaveDelay} ms after you stop typing.`;
  }

  return dialog;
}

function renderAppearance(prefs) {
  return `<section class="settings-panel" id="settings-panel-appearance" data-settings-panel="appearance" role="tabpanel" aria-labelledby="settings-tab-appearance">
    <header class="settings-section-head"><h3>Appearance</h3><p>Theme, accent and information density.</p><span class="settings-summary" data-settings-summary>${escapeHtml(summaryLine(prefs))}</span></header>
    <div class="settings-grid">
      ${selectField('Theme', 'theme', prefs.theme, THEMES)}
      ${selectField('Density', 'density', prefs.density, DENSITIES, 'Comfortable is recommended for touch and laptops.')}
    </div>
    <fieldset class="settings-fieldset"><legend>Accent colour</legend><div class="accent-swatches" role="radiogroup" aria-label="Accent colour">
      ${ACCENTS.map((accent) => `<button type="button" class="accent-swatch" data-accent="${escapeAttr(accent.id)}" role="radio" aria-checked="${prefs.accent === accent.id}" aria-label="${escapeAttr(accent.name)}" title="${escapeAttr(accent.name)}" style="--swatch:${escapeAttr(accent.color)}"><span></span><small>${escapeHtml(accent.name)}</small></button>`).join('')}
    </div></fieldset>
    <p class="settings-help">System theme follows your device’s light/dark preference and updates automatically.</p>
  </section>`;
}

function renderEditor(prefs) {
  return `<section class="settings-panel" id="settings-panel-editor" data-settings-panel="editor" role="tabpanel" aria-labelledby="settings-tab-editor" hidden>
    <header class="settings-section-head"><h3>Editor</h3><p>Make the code canvas comfortable for your eyes.</p></header>
    <div class="settings-grid">
      ${numberSelect('Editor font size', 'editorFontSize', prefs.editorFontSize, EDITOR_FONT_SIZES, (value) => `${value} px`)}
      ${numberSelect('Indent size', 'tabSize', prefs.tabSize, TAB_SIZES, (value) => `${value} spaces`)}
      ${numberSelect('Autosave delay', 'autosaveDelay', prefs.autosaveDelay, AUTOSAVE_DELAYS, (value) => value === 0 ? 'Manual save only' : `${value} ms`)}
    </div>
    ${toggleField('Word wrap', 'wordWrap', prefs.wordWrap, 'Wrap long lines instead of scrolling horizontally.')}
    ${toggleField('Line numbers', 'showLineNumbers', prefs.showLineNumbers, 'Show the gutter line numbers.')}
    <p class="settings-help" data-autosave-note></p>
  </section>`;
}

function renderAccessibility(prefs) {
  return `<section class="settings-panel" id="settings-panel-accessibility" data-settings-panel="accessibility" role="tabpanel" aria-labelledby="settings-tab-accessibility" hidden>
    <header class="settings-section-head"><h3>Accessibility</h3><p>Reduce motion, increase contrast and keep destructive actions safe.</p></header>
    <div class="settings-grid">
      ${selectField('Motion', 'motion', prefs.motion, MOTION_MODES, 'Reduced motion disables confetti, card entrances and smooth scrolling.')}
      ${selectField('Contrast', 'contrast', prefs.contrast, CONTRAST_MODES, 'High contrast strengthens borders, text and focus rings.')}
    </div>
    ${toggleField('Confirm destructive actions', 'confirmDestructive', prefs.confirmDestructive, 'Ask before deleting files, folders, or project data. Recommended.')}
    <p class="settings-help">Keyboard users: press <kbd>F1</kbd> anywhere to see every shortcut. Dialogs trap focus and restore it when closed.</p>
  </section>`;
}

function renderData({ storage, errorCount, aiKeyStored }) {
  const percent = Math.min(100, Math.max(0, Number(storage?.percent) || 0));
  const used = Number(storage?.localBytes) || 0;
  const quota = Number(storage?.quota) || 0;
  return `<section class="settings-panel" id="settings-panel-data" data-settings-panel="data" role="tabpanel" aria-labelledby="settings-tab-data" hidden>
    <header class="settings-section-head"><h3>Data &amp; privacy</h3><p>Everything lives in your browser. Orvexa has no account, analytics or telemetry.</p></header>
    <div class="settings-storage">
      <div class="settings-storage-head"><strong>Local Studio data</strong><span>${formatBytes(used)}${quota ? ` of ${formatBytes(quota)}` : ''}</span></div>
      <div class="settings-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}" aria-label="Browser storage used"><i style="width:${percent.toFixed(1)}%"></i></div>
      <small>${quota ? `${percent.toFixed(1)}% of the browser quota used.` : 'Quota estimate is unavailable in this browser.'} Projects, snapshots, preferences and logs count towards this.</small>
    </div>
    <div class="settings-button-row">
      <button type="button" class="button primary" data-export-data>Export all data (JSON)</button>
      <button type="button" class="button secondary" data-import-data>Import data backup</button>
      <input type="file" id="settingsImportFile" accept=".json,application/json" hidden />
    </div>
    <div class="settings-button-row">
      <button type="button" class="button secondary" data-clear-snapshots>Clear snapshots</button>
      <button type="button" class="button secondary" data-clear-errors ${errorCount ? '' : 'disabled'}>Clear error log (${Number(errorCount) || 0})</button>
      <button type="button" class="button danger subtle-danger" data-reset-data>Clear all data…</button>
    </div>
    <div class="settings-card">
      <h4>Hosted AI keys</h4>
      <p>${aiKeyStored ? 'A hosted-provider key is currently available to this browser.' : 'No hosted-provider key is stored. Free Built-In AI and Free Cloud AI need no key.'} Keys are kept in session storage unless you explicitly remember them; a key in a browser can never be fully secret. For production, use a server proxy.</p>
      <div class="settings-button-row">${toggleField('Remember key on this device', 'rememberAiKey', false, 'Opt-in only. Off means the key disappears when the tab closes.')}<button type="button" class="button secondary" data-forget-key ${aiKeyStored ? '' : 'disabled'}>Forget stored key</button></div>
    </div>
  </section>`;
}

function renderAbout({ appVersion, canInstall, installUnavailableReason, isStandalone, storage }) {
  return `<section class="settings-panel" id="settings-panel-about" data-settings-panel="about" role="tabpanel" aria-labelledby="settings-tab-about" hidden>
    <header class="settings-section-head"><h3>About Orvexa Studio</h3><p>Version ${escapeHtml(appVersion)} · local-first · built for the browser.</p></header>
    <div class="settings-about-grid">
      <div class="settings-about-card"><span class="settings-about-icon">◈</span><strong>Version</strong><span>${escapeHtml(appVersion)}</span></div>
      <div class="settings-about-card"><span class="settings-about-icon">✦</span><strong>Install</strong><span>${isStandalone ? 'Installed app' : canInstall ? 'Ready to install' : 'Browser-managed'}</span></div>
      <div class="settings-about-card"><span class="settings-about-icon">⛁</span><strong>Storage</strong><span>${formatBytes(storage?.localBytes || 0)} local</span></div>
      <div class="settings-about-card"><span class="settings-about-icon">⚡</span><strong>Engine</strong><span>WebGL 1 · CPU path tracer</span></div>
    </div>
    <div class="settings-button-row">
      <button type="button" class="button primary" data-install-app ${canInstall ? '' : 'disabled'}>Install Orvexa Studio</button>
      <button type="button" class="button secondary" data-show-tour>Replay welcome tour</button>
      <button type="button" class="button secondary" data-copy-diagnostics>Copy diagnostics</button>
    </div>
    ${!canInstall && !isStandalone ? `<p class="settings-help">${escapeHtml(installUnavailableReason)}</p>` : ''}
    <p class="settings-help">Orvexa never uploads project files. The optional hosted AI providers receive only the prompt you explicitly send while a hosted provider is selected.</p>
    <p class="settings-help">Open-source style licensing is defined by the repository owner. No third-party runtime dependencies are loaded by the Studio.</p>
  </section>`;
}

function selectField(label, pref, value, options, help = '') {
  return `<label class="orvexa-field"><span>${escapeHtml(label)}</span><select data-pref="${escapeAttr(pref)}">${options.map((option) => `<option value="${escapeAttr(option.id)}"${option.id === value ? ' selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}</select>${help ? `<small>${escapeHtml(help)}</small>` : ''}</label>`;
}

function numberSelect(label, pref, value, values, formatter) {
  return `<label class="orvexa-field"><span>${escapeHtml(label)}</span><select data-pref="${escapeAttr(pref)}">${values.map((option) => `<option value="${option}"${Number(option) === Number(value) ? ' selected' : ''}>${escapeHtml(formatter(option))}</option>`).join('')}</select></label>`;
}

function toggleField(label, pref, checked, help = '') {
  return `<label class="settings-toggle"><input type="checkbox" data-pref="${escapeAttr(pref)}" ${checked ? 'checked' : ''} /><span class="settings-toggle-track" aria-hidden="true"><i></i></span><span class="settings-toggle-text"><strong>${escapeHtml(label)}</strong>${help ? `<small>${escapeHtml(help)}</small>` : ''}</span></label>`;
}

function summaryLine(prefs) {
  const theme = THEMES.find((item) => item.id === prefs.theme)?.name || prefs.theme;
  const density = DENSITIES.find((item) => item.id === prefs.density)?.name || prefs.density;
  return `${theme} · ${density}`;
}

function sectionLabel(id) {
  return { appearance: 'Appearance', editor: 'Editor', accessibility: 'Accessibility', data: 'Data & privacy', about: 'About' }[id] || id;
}

function sectionIcon(id) {
  return { appearance: '◐', editor: '⌨', accessibility: '♿', data: '⛁', about: 'ℹ' }[id] || '•';
}
