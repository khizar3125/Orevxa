/**
 * Accessible anchored menu (replaces blocking `prompt()` menus).
 * Supports keyboard navigation, separators, shortcuts, danger items and
 * automatic viewport clamping.
 */
import { escapeAttr, escapeHtml } from './dialog.js';

let activeMenu = null;

export function openMenu({ anchor = null, x = null, y = null, items = [], title = '', onClose = null, documentRef = null } = {}) {
  const doc = documentRef || globalThis.document;
  closeMenu();
  if (!doc?.body || !Array.isArray(items) || !items.length) return { close: closeMenu, element: null };
  const menu = doc.createElement('div');
  menu.className = 'orvexa-menu';
  menu.setAttribute('role', 'menu');
  menu.tabIndex = -1;
  if (title) menu.setAttribute('aria-label', title);
  const entries = items.filter((item) => item && (item.separator || item.label));
  menu.innerHTML = entries.map((item, index) => {
    if (item.separator) return '<div class="orvexa-menu-separator" role="separator"></div>';
    const disabled = Boolean(item.disabled);
    return `<button type="button" role="menuitem" tabindex="-1" class="orvexa-menu-item${item.danger ? ' danger' : ''}${disabled ? ' disabled' : ''}" data-menu-index="${index}" ${disabled ? 'aria-disabled="true" disabled' : ''}>
      <span class="orvexa-menu-icon" aria-hidden="true">${escapeHtml(item.icon || '')}</span>
      <span class="orvexa-menu-label">${escapeHtml(item.label)}</span>
      ${item.shortcut ? `<kbd>${escapeHtml(item.shortcut)}</kbd>` : ''}
      ${item.badge ? `<span class="orvexa-menu-badge">${escapeHtml(item.badge)}</span>` : ''}
    </button>`;
  }).join('');
  doc.body.append(menu);
  positionMenu(menu, anchor, x, y);

  const buttons = [...menu.querySelectorAll('[data-menu-index]:not([disabled])')];
  let activeIndex = -1;
  const setActive = (index) => {
    if (!buttons.length) return;
    activeIndex = (index + buttons.length) % buttons.length;
    buttons.forEach((button, buttonIndex) => button.classList.toggle('active', buttonIndex === activeIndex));
    buttons[activeIndex]?.focus();
  };
  const run = (button) => {
    const item = entries[Number(button.dataset.menuIndex)];
    if (!item || item.disabled) return;
    closeMenu();
    try { item.onSelect?.(); }
    catch (error) { console.error('Orvexa menu action failed:', error); }
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(activeIndex + 1); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive(activeIndex - 1); return; }
    if (event.key === 'Home') { event.preventDefault(); setActive(0); return; }
    if (event.key === 'End') { event.preventDefault(); setActive(buttons.length - 1); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      const target = event.target.closest?.('[data-menu-index]');
      if (target) { event.preventDefault(); run(target); }
    }
  };
  const onPointerDown = (event) => {
    if (!menu.contains(event.target) && !anchor?.contains?.(event.target)) closeMenu();
  };
  const onWindowChange = () => closeMenu();

  menu.addEventListener('keydown', onKeyDown);
  menu.querySelectorAll('[data-menu-index]').forEach((button, index) => {
    button.addEventListener('click', () => run(button));
    button.addEventListener('mouseenter', () => { activeIndex = index; buttons.forEach((b, i) => b.classList.toggle('active', i === index)); });
  });
  setTimeout(() => {
    doc.addEventListener('pointerdown', onPointerDown, true);
    doc.addEventListener('scroll', onWindowChange, true);
    globalThis.addEventListener?.('resize', onWindowChange);
  }, 0);
  setActive(0);

  activeMenu = {
    element: menu,
    close: () => closeMenu(),
    destroy: () => {
      doc.removeEventListener('pointerdown', onPointerDown, true);
      doc.removeEventListener('scroll', onWindowChange, true);
      globalThis.removeEventListener?.('resize', onWindowChange);
      menu.remove();
      if (activeMenu?.element === menu) activeMenu = null;
      try { onClose?.(); } catch { /* ignore */ }
    },
  };
  return activeMenu;
}

export function closeMenu() {
  if (activeMenu) {
    activeMenu.destroy();
    activeMenu = null;
  }
}

export function menuItemsFromDefinitions(definitions = {}) {
  const groups = [];
  for (const [groupName, items] of Object.entries(definitions)) {
    if (groups.length) groups.push({ separator: true });
    items.forEach((item) => groups.push({ ...item }));
  }
  return groups;
}

function positionMenu(menu, anchor, x, y) {
  const rect = anchor?.getBoundingClientRect?.();
  const width = 260;
  const viewportWidth = globalThis.innerWidth || 1280;
  const viewportHeight = globalThis.innerHeight || 720;
  const left = Math.min(Math.max(8, x ?? (rect ? rect.left : 8)), Math.max(8, viewportWidth - width - 8));
  const topCandidate = y ?? (rect ? rect.bottom + 6 : 8);
  menu.style.left = `${left}px`;
  menu.style.top = `${Math.min(topCandidate, viewportHeight - 80)}px`;
  menu.style.maxHeight = `${Math.max(160, viewportHeight - topCandidate - 16)}px`;
}

export function menuButtonAttributes(label) {
  return `aria-haspopup="menu" aria-label="${escapeAttr(label)}"`;
}

export function menuLabel(text) { return escapeHtml(text); }
