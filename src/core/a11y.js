/**
 * Accessibility helpers: focus discovery, focus trapping, live announcements
 * and reduced-motion queries. DOM helpers accept injected roots so they remain
 * straightforward to test and reuse in the Modeler route.
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export function nextFocusIndex(current, count, { shift = false, wrap = true } = {}) {
  const total = Math.max(0, Number(count) || 0);
  if (!total) return -1;
  const index = Number.isInteger(current) ? current : -1;
  if (index < 0) return shift ? total - 1 : 0;
  if (shift) return index <= 0 ? (wrap ? total - 1 : 0) : index - 1;
  return index >= total - 1 ? (wrap ? 0 : total - 1) : index + 1;
}

export function isVisible(element) {
  if (!element) return false;
  if (element.hidden) return false;
  if (element.getAttribute?.('aria-hidden') === 'true') return false;
  if (element.closest?.('[hidden], [inert]')) return false;
  return true;
}

export function getFocusable(root) {
  if (!root?.querySelectorAll) return [];
  return [...root.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isVisible);
}

export function focusFirst(root) {
  const [first] = getFocusable(root);
  first?.focus?.();
  return first || null;
}

/**
 * Trap Tab focus inside `root` while a modal is open. Returns a release
 * function that removes listeners and restores the previously focused element.
 */
export function createFocusTrap(root, { onEscape = null, initialFocus = null, returnFocus = true, documentRef = null } = {}) {
  if (!root?.addEventListener) throw new TypeError('Focus trap needs a DOM root.');
  const doc = documentRef || root.ownerDocument || globalThis.document;
  const previous = doc?.activeElement || null;
  const handler = (event) => {
    if (event.key === 'Escape') {
      if (onEscape) { event.preventDefault(); event.stopPropagation(); onEscape(event); }
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = getFocusable(root);
    if (!focusable.length) { event.preventDefault(); root.focus?.(); return; }
    const active = doc?.activeElement;
    const current = focusable.indexOf(active);
    if (current === -1) {
      event.preventDefault();
      focusable[event.shiftKey ? focusable.length - 1 : 0].focus();
      return;
    }
    const next = nextFocusIndex(current, focusable.length, { shift: event.shiftKey });
    if (next !== current) {
      event.preventDefault();
      focusable[next].focus();
    }
  };
  root.addEventListener('keydown', handler);
  const target = initialFocus || getFocusable(root)[0] || root;
  setTimeout(() => target?.focus?.(), 0);
  if (root.setAttribute && !root.hasAttribute?.('tabindex')) root.setAttribute('tabindex', '-1');
  return function release() {
    root.removeEventListener('keydown', handler);
    if (returnFocus && previous?.focus) setTimeout(() => previous.focus(), 0);
  };
}

export function prefersReducedMotion(matchMedia = globalThis.matchMedia) {
  try { return Boolean(matchMedia?.('(prefers-reduced-motion: reduce)')?.matches); } catch { return false; }
}

export function prefersHighContrast(matchMedia = globalThis.matchMedia) {
  try { return Boolean(matchMedia?.('(prefers-contrast: more)')?.matches); } catch { return false; }
}

export function announce(message, { politeness = 'polite', id = 'orvexa-announcer', documentRef = null } = {}) {
  const doc = documentRef || globalThis.document;
  if (!doc?.body || !message) return null;
  let region = doc.getElementById(id);
  if (!region) {
    region = doc.createElement('div');
    region.id = id;
    region.className = 'sr-only';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', politeness);
    region.setAttribute('aria-atomic', 'true');
    doc.body.append(region);
  }
  region.setAttribute('aria-live', politeness);
  region.textContent = '';
  setTimeout(() => { region.textContent = String(message); }, 30);
  return region;
}

export function buildSkipLink(documentRef = null) {
  const doc = documentRef || globalThis.document;
  if (!doc?.body || doc.getElementById('orvexaSkipLink')) return null;
  const link = doc.createElement('a');
  link.id = 'orvexaSkipLink';
  link.className = 'skip-link';
  link.href = '#fileTree';
  link.textContent = 'Skip to workspace';
  link.addEventListener('click', (event) => {
    const target = doc.getElementById('fileTree');
    if (!target) return;
    event.preventDefault();
    target.setAttribute('tabindex', '-1');
    target.focus();
  });
  doc.body.prepend(link);
  return link;
}

/** Convert a tab list into the correct ARIA tab pattern. */
export function applyTabSemantics(container, { activeId = null } = {}) {
  if (!container?.querySelectorAll) return;
  const tabs = [...container.querySelectorAll('[role="tab"]')];
  tabs.forEach((tab, index) => {
    const active = activeId ? tab.id === activeId || tab.dataset.tabId === activeId : tab.classList.contains('active');
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    tab.setAttribute('role', 'tab');
    if (!tab.id) tab.id = `${container.id || 'tabs'}-tab-${index}`;
  });
}

export function describeShortcut(combo) {
  return String(combo || '').toUpperCase();
}
