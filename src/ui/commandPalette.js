/**
 * Command Palette 2.0 — fuzzy commands, file quick-open, recents and a full
 * keyboard model. `Ctrl/Cmd+K` or `Ctrl/Cmd+Shift+P` opens it.
 */
import { createFocusTrap } from '../core/a11y.js';
import { formatCombo } from '../core/shortcuts.js';
import { highlightHtml, normalizeSearchText, rankItems } from '../core/search.js';
import { escapeAttr, escapeHtml } from './dialog.js';

const MAX_RESULTS = 14;

export function buildPaletteEntries({ commands = [], files = [], recentCommandIds = [], recentFiles = [], query = '' } = {}) {
  const raw = String(query ?? '');
  const trimmed = raw.trim();
  const commandsOnly = trimmed.startsWith('>');
  const filesOnly = trimmed.startsWith('@');
  const needle = commandsOnly || filesOnly ? trimmed.slice(1).trim() : trimmed;

  const commandCandidates = commands
    .filter((command) => command && command.id && command.label)
    .map((command) => ({
      type: 'command',
      id: command.id,
      label: command.label,
      description: command.description || command.category || 'Command',
      category: command.category || 'Commands',
      combo: command.combo || '',
      keywords: command.keywords || [],
      disabled: Boolean(command.disabled),
      run: command.run,
      recent: recentCommandIds.includes(command.id),
    }));
  const fileCandidates = (files || []).map((file) => typeof file === 'string' ? { path: file } : file)
    .filter((file) => file?.path)
    .map((file) => ({
      type: 'file',
      id: `file:${file.path}`,
      label: file.path.split('/').at(-1),
      description: file.path,
      category: 'Files',
      combo: '',
      keywords: [file.path],
      path: file.path,
      recent: recentFiles.includes(file.path),
    }));

  let results = [];
  if (commandsOnly) {
    results = rankItems(commandCandidates, needle, { getText: (item) => `${item.label} ${item.keywords.join(' ')}`, limit: MAX_RESULTS });
  } else if (filesOnly) {
    results = rankItems(fileCandidates, needle, { getText: (item) => item.description, limit: MAX_RESULTS });
  } else {
    const recentResults = [];
    if (!needle) {
      for (const id of recentCommandIds.slice(0, 3)) {
        const found = commandCandidates.find((item) => item.id === id);
        if (found) recentResults.push({ item: found, score: 10000, positions: [], text: found.label, recent: true });
      }
      for (const path of recentFiles.slice(0, 2)) {
        const found = fileCandidates.find((item) => item.path === path);
        if (found) recentResults.push({ item: found, score: 9000, positions: [], text: found.label, recent: true });
      }
    }
    const commandResults = rankItems(commandCandidates, needle, { getText: (item) => `${item.label} ${item.keywords.join(' ')}`, limit: Math.max(4, MAX_RESULTS - 5) });
    const fileResults = rankItems(fileCandidates, needle, { getText: (item) => item.description, limit: 6 });
    const seen = new Set(recentResults.map((entry) => entry.item.id));
    results = [
      ...recentResults,
      ...commandResults.filter((entry) => !seen.has(entry.item.id)),
      ...fileResults.filter((entry) => !seen.has(entry.item.id)).map((entry) => ({ ...entry, score: entry.score - 1 })),
    ].slice(0, MAX_RESULTS);
  }

  return results.map((entry, index) => ({
    ...entry.item,
    index,
    score: entry.score,
    positions: entry.positions || [],
    keyword: entry.keyword || null,
    isRecent: Boolean(entry.recent),
  }));
}

export function openCommandPalette({
  commands = [],
  files = [],
  recentCommandIds = [],
  recentFiles = [],
  onRun = null,
  onOpenFile = null,
  onRecent = null,
  isMac = false,
  documentRef = null,
} = {}) {
  const doc = documentRef || globalThis.document;
  if (!doc?.body) return null;
  doc.querySelector('[data-command-palette="true"]')?.remove();

  const previouslyFocused = doc.activeElement;
  const backdrop = doc.createElement('div');
  backdrop.className = 'orvexa-modal-backdrop orvexa-palette-backdrop';
  backdrop.dataset.orvexaModal = 'true';
  backdrop.dataset.commandPalette = 'true';
  backdrop.innerHTML = `
    <section class="orvexa-palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="orvexa-palette-search">
        <span class="orvexa-palette-icon" aria-hidden="true">⌘</span>
        <input id="orvexaPaletteInput" type="text" role="combobox" aria-expanded="true" aria-controls="orvexaPaletteList" aria-autocomplete="list" aria-activedescendant="" autocomplete="off" spellcheck="false" placeholder="Search commands or files…  (type > for commands, @ for files)" />
        <kbd>Esc</kbd>
      </div>
      <div class="orvexa-palette-results" id="orvexaPaletteList" role="listbox" aria-label="Palette results"></div>
      <footer class="orvexa-palette-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> run</span>
        <span><kbd>&gt;</kbd> commands</span>
        <span><kbd>@</kbd> files</span>
        <span class="orvexa-palette-count" data-palette-count></span>
      </footer>
    </section>`;
  doc.body.append(backdrop);
  doc.body.classList.add('orvexa-modal-open');
  const palette = backdrop.querySelector('.orvexa-palette');
  const input = backdrop.querySelector('#orvexaPaletteInput');
  const list = backdrop.querySelector('#orvexaPaletteList');
  const count = backdrop.querySelector('[data-palette-count]');
  let entries = [];
  let activeIndex = 0;
  let closed = false;
  let releaseTrap = null;

  const close = () => {
    if (closed) return;
    closed = true;
    releaseTrap?.();
    backdrop.remove();
    doc.body.classList.remove('orvexa-modal-open');
    if (previouslyFocused?.focus) setTimeout(() => { try { previouslyFocused.focus(); } catch { /* ignore */ } }, 0);
  };

  const render = () => {
    entries = buildPaletteEntries({ commands, files, recentCommandIds, recentFiles, query: input.value });
    if (!entries.length) {
      list.innerHTML = `<div class="orvexa-palette-empty"><strong>No matches</strong><p>Try a shorter query, or type <kbd>&gt;</kbd> for commands and <kbd>@</kbd> for files.</p></div>`;
      input.setAttribute('aria-activedescendant', '');
      if (count) count.textContent = '0 results';
      return;
    }
    activeIndex = Math.min(Math.max(0, activeIndex), entries.length - 1);
    let previousCategory = '';
    let previousRecent = false;
    list.innerHTML = entries.map((entry, index) => {
      const showCategory = entry.category !== previousCategory || entry.isRecent !== previousRecent;
      previousCategory = entry.category;
      previousRecent = entry.isRecent;
      const active = index === activeIndex;
      const combo = entry.combo ? formatCombo(entry.combo, { isMac }) : '';
      const description = entry.type === 'file'
        ? entry.description
        : highlightHtml(entry.description, []);
      const label = highlightHtml(entry.label, entry.positions);
      return `${showCategory ? `<div class="orvexa-palette-group" role="presentation">${escapeHtml(entry.isRecent ? 'Recent' : entry.category)}</div>` : ''}
        <button type="button" role="option" id="orvexaPaletteOption${index}" data-palette-index="${index}" class="orvexa-palette-item${active ? ' active' : ''}${entry.disabled ? ' disabled' : ''}" aria-selected="${active}" ${entry.disabled ? 'aria-disabled="true"' : ''}>
          <span class="orvexa-palette-item-icon" aria-hidden="true">${entry.type === 'file' ? '◈' : iconForCategory(entry.category)}</span>
          <span class="orvexa-palette-item-text"><strong>${label}</strong><small>${description}</small></span>
          ${combo ? `<kbd>${escapeHtml(combo)}</kbd>` : ''}
        </button>`;
    }).join('');
    input.setAttribute('aria-activedescendant', `orvexaPaletteOption${activeIndex}`);
    if (count) count.textContent = `${entries.length} result${entries.length === 1 ? '' : 's'}`;
    list.querySelectorAll('[data-palette-index]').forEach((button) => {
      button.addEventListener('mouseenter', () => setActive(Number(button.dataset.paletteIndex), false));
      button.addEventListener('click', () => execute(Number(button.dataset.paletteIndex)));
    });
  };

  const setActive = (index, scroll = true) => {
    if (!entries.length) return;
    activeIndex = (index + entries.length) % entries.length;
    list.querySelectorAll('[data-palette-index]').forEach((button) => {
      const active = Number(button.dataset.paletteIndex) === activeIndex;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    input.setAttribute('aria-activedescendant', `orvexaPaletteOption${activeIndex}`);
    const active = scroll ? list.querySelector(`[data-palette-index="${activeIndex}"]`) : null;
    if (typeof active?.scrollIntoView === 'function') active.scrollIntoView({ block: 'nearest' });
  };

  const execute = (index) => {
    const entry = entries[index];
    if (!entry || entry.disabled) return;
    close();
    setTimeout(() => {
      try {
        if (entry.type === 'file') onOpenFile?.(entry.path);
        else {
          onRecent?.(entry.id);
          onRun?.(entry, commands.find((command) => command.id === entry.id));
        }
      } catch (error) { console.error('Orvexa palette action failed:', error); }
    }, 0);
  };

  input.addEventListener('input', () => { activeIndex = 0; render(); });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(activeIndex + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(activeIndex - 1); }
    else if (event.key === 'Home' && !input.value) { event.preventDefault(); setActive(0); }
    else if (event.key === 'End' && !input.value) { event.preventDefault(); setActive(entries.length - 1); }
    else if (event.key === 'Enter') { event.preventDefault(); execute(activeIndex); }
    else if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Tab') { event.preventDefault(); setActive(activeIndex + (event.shiftKey ? -1 : 1)); }
  });
  backdrop.addEventListener('mousedown', (event) => { if (event.target === backdrop) close(); });
  releaseTrap = createFocusTrap(palette, { onEscape: close, initialFocus: input, documentRef: doc });
  render();
  input.focus();
  return { close, element: backdrop, input };
}

function iconForCategory(category = '') {
  const value = String(category).toLowerCase();
  if (value.includes('file')) return '◈';
  if (value.includes('view')) return '◉';
  if (value.includes('project')) return '▤';
  if (value.includes('help')) return '?';
  if (value.includes('setting')) return '⚙';
  return '⌘';
}

export function paletteAriaState(open) {
  return { 'aria-expanded': String(Boolean(open)), 'aria-hidden': String(!Boolean(open)) };
}

export function normalizePaletteQuery(query) { return normalizeSearchText(query); }

export function palettePlaceholder() { return 'Search commands or files…'; }

export function paletteShortcutHint(isMac) { return formatCombo('mod+k', { isMac }); }

export function paletteEscape(value) { return escapeAttr(value); }
