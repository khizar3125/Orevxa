/**
 * Keyboard shortcuts reference generated from the live registry, so the help
 * sheet can never drift from the actual bindings.
 */
import { formatCombo } from '../core/shortcuts.js';
import { escapeAttr, escapeHtml, openDialog } from './dialog.js';

export function openShortcutsDialog({ groups = [], isMac = false, documentRef = null } = {}) {
  const total = groups.reduce((count, group) => count + group.items.length, 0);
  const body = groups.length
    ? `<div class="shortcut-groups">${groups.map((group) => `
        <section class="shortcut-group">
          <h3>${escapeHtml(group.category)}</h3>
          <div class="shortcut-list">
            ${group.items.map((item) => `<div class="shortcut-row"><span><strong>${escapeHtml(item.label)}</strong>${item.description ? `<small>${escapeHtml(item.description)}</small>` : ''}</span><kbd>${escapeHtml(formatCombo(item.combo, { isMac }))}</kbd></div>`).join('')}
          </div>
        </section>`).join('')}</div>`
    : `<div class="health-empty"><span>⌨</span><div><strong>No shortcuts registered</strong><p>Reload the Studio to restore keyboard commands.</p></div></div>`;
  return openDialog({
    title: 'Keyboard shortcuts',
    subtitle: `${total} shortcuts available. Press Escape to close, or F1 to reopen this sheet.`,
    size: 'large',
    className: 'orvexa-shortcuts',
    documentRef,
    body,
    footer: `<span class="settings-footer-note">Tip: use Tab / Shift+Tab inside dialogs — focus never escapes unexpectedly.</span><button type="button" class="button primary" data-dialog-close-ok>Got it</button>`,
    onMount: ({ card, close }) => {
      card.querySelector('[data-dialog-close-ok]')?.addEventListener('click', close);
    },
  });
}

export function shortcutRowsMarkup(groups, { isMac = false } = {}) {
  return groups.map((group) => `<div class="shortcut-group"><h3>${escapeHtml(group.category)}</h3>${group.items.map((item) => `<div class="shortcut-row" data-shortcut-id="${escapeAttr(item.id)}"><span>${escapeHtml(item.label)}</span><kbd>${escapeHtml(formatCombo(item.combo, { isMac }))}</kbd></div>`).join('')}</div>`).join('');
}
