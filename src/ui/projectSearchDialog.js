/**
 * Project-wide search UI (Ctrl/Cmd+Shift+F) built on the pure search module.
 * Results are grouped per file, keyboard navigable and open at the exact line.
 */
import { highlightHtml } from '../core/search.js';
import { searchProject, toSearchCsv } from '../studio/projectSearch.js';
import { escapeAttr, escapeHtml, openDialog } from './dialog.js';

export function openProjectSearchDialog({ files = {}, onOpen = null, initialQuery = '', documentRef = null } = {}) {
  let result = { groups: [], total: 0, truncated: false, scannedFiles: 0, skippedFiles: 0 };
  let flat = [];
  let activeIndex = 0;
  let caseSensitive = false;
  let wholeWord = false;
  const dialog = openDialog({
    title: 'Search project',
    subtitle: 'Find text across every source file, then jump straight to the match.',
    size: 'large',
    className: 'orvexa-project-search',
    documentRef,
    body: `
      <form class="project-search-form" data-project-search-form role="search">
        <label class="project-search-input-wrap"><span class="sr-only">Search text</span><input type="search" id="projectSearchInput" value="${escapeAttr(initialQuery)}" placeholder="Search all project files…" autocomplete="off" spellcheck="false" aria-controls="projectSearchResults" /></label>
        <label class="project-search-option"><input type="checkbox" id="projectSearchCase" /> Aa</label>
        <label class="project-search-option"><input type="checkbox" id="projectSearchWord" /> Whole word</label>
        <button type="submit" class="button primary">Search</button>
      </form>
      <div class="project-search-meta" data-project-search-meta aria-live="polite">Type at least 2 characters to search ${Object.keys(files).length} files.</div>
      <div class="project-search-results" id="projectSearchResults" role="listbox" aria-label="Project search results" data-project-search-results></div>`,
    footer: `<span class="settings-footer-note">Enter opens the first match · Esc closes</span><button type="button" class="button secondary" data-project-search-csv>Copy results as CSV</button><button type="button" class="button primary" data-dialog-close-ok>Close</button>`,
  });

  const input = dialog.body.querySelector('#projectSearchInput');
  const meta = dialog.body.querySelector('[data-project-search-meta]');
  const resultsRoot = dialog.body.querySelector('[data-project-search-results]');

  const render = () => {
    const query = input.value;
    result = searchProject(files, query, { caseSensitive, wholeWord });
    flat = result.groups.flatMap((group) => group.matches.map((match) => ({ path: group.path, match })));
    activeIndex = Math.min(activeIndex, Math.max(0, flat.length - 1));
    if (!query.trim()) {
      resultsRoot.innerHTML = `<div class="project-search-empty"><span>⌕</span><div><strong>Search everything</strong><p>Source files, examples and notes. Results include line and column.</p></div></div>`;
    } else if (query.trim().length < 2) {
      resultsRoot.innerHTML = `<div class="project-search-empty"><span>…</span><div><strong>Keep typing</strong><p>Two characters are enough to search.</p></div></div>`;
    } else if (!result.total) {
      resultsRoot.innerHTML = `<div class="project-search-empty"><span>∅</span><div><strong>No matches</strong><p>Try a different word${wholeWord ? ', or turn off whole-word matching' : ''}${caseSensitive ? ', or match case-insensitively' : ''}.</p></div></div>`;
    } else {
      let runningIndex = 0;
      resultsRoot.innerHTML = result.groups.map((group) => `
        <section class="project-search-file">
          <header><span class="project-search-file-icon">◈</span><strong>${escapeHtml(group.path)}</strong><small>${group.matches.length} match${group.matches.length === 1 ? '' : 'es'}</small></header>
          ${group.matches.map((match) => {
            const index = runningIndex++;
            const before = match.preview.slice(0, match.previewOffset);
            const middle = match.preview.slice(match.previewOffset, match.previewOffset + match.previewLength);
            const after = match.preview.slice(match.previewOffset + match.previewLength);
            return `<button type="button" role="option" aria-selected="${index === activeIndex}" data-search-result="${index}" class="project-search-result${index === activeIndex ? ' active' : ''}">
              <span class="project-search-line">L${match.line}:${match.column}</span>
              <code>${escapeHtml(before)}${highlightHtml(middle, Array.from({ length: middle.length }, (_, i) => i))}${escapeHtml(after)}</code>
            </button>`;
          }).join('')}
        </section>`).join('');
      resultsRoot.querySelectorAll('[data-search-result]').forEach((button) => {
        button.addEventListener('mouseenter', () => setActive(Number(button.dataset.searchResult), false));
        button.addEventListener('click', () => openResult(Number(button.dataset.searchResult)));
      });
    }
    meta.textContent = `${result.total} match${result.total === 1 ? '' : 'es'} in ${result.filesWithMatches} file${result.filesWithMatches === 1 ? '' : 's'}${result.truncated ? ` · showing the first ${result.total}` : ''}${result.skippedFiles ? ` · ${result.skippedFiles} large/non-text file(s) skipped` : ''}`;
  };

  const setActive = (index, scroll = true) => {
    if (!flat.length) return;
    activeIndex = (index + flat.length) % flat.length;
    resultsRoot.querySelectorAll('[data-search-result]').forEach((button) => {
      const active = Number(button.dataset.searchResult) === activeIndex;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    if (scroll) resultsRoot.querySelector(`[data-search-result="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  const openResult = (index) => {
    const found = flat[index];
    if (!found) return;
    dialog.close();
    setTimeout(() => onOpen?.(found.path, found.match.line, found.match.column), 0);
  };

  input.addEventListener('input', () => { activeIndex = 0; render(); });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(activeIndex + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(activeIndex - 1); }
    else if (event.key === 'Enter') { event.preventDefault(); openResult(activeIndex); }
  });
  dialog.body.querySelector('[data-project-search-form]')?.addEventListener('submit', (event) => { event.preventDefault(); activeIndex = 0; render(); });
  dialog.body.querySelector('#projectSearchCase')?.addEventListener('change', (event) => { caseSensitive = event.target.checked; render(); });
  dialog.body.querySelector('#projectSearchWord')?.addEventListener('change', (event) => { wholeWord = event.target.checked; render(); });
  dialog.card.querySelector('[data-project-search-csv]')?.addEventListener('click', async () => {
    const button = dialog.card.querySelector('[data-project-search-csv]');
    try { await navigator.clipboard?.writeText(toSearchCsv(result)); if (button) button.textContent = 'Copied ✓'; }
    catch { if (button) button.textContent = 'Copy blocked'; }
    setTimeout(() => { if (button) button.textContent = 'Copy results as CSV'; }, 1600);
  });
  dialog.card.querySelector('[data-dialog-close-ok]')?.addEventListener('click', () => dialog.close());
  render();
  setTimeout(() => { input.focus(); input.select(); }, 30);
  return dialog;
}
