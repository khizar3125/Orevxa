/**
 * Accessible modal primitives used by every v10 dialog.
 * Focus is trapped, Escape closes, focus is restored, and the rest of the
 * document is marked inert for assistive technology.
 */
import { createFocusTrap } from '../core/a11y.js';

let openCount = 0;

export function openDialog({
  title = '',
  subtitle = '',
  body = '',
  footer = '',
  size = 'medium',
  className = '',
  labelledBy = '',
  onMount = null,
  onClose = null,
  closeLabel = 'Close dialog',
  documentRef = null,
} = {}) {
  const doc = documentRef || globalThis.document;
  if (!doc?.body) throw new Error('Dialogs need a document body.');
  const headingId = labelledBy || `orvexa-dialog-title-${Date.now().toString(36)}`;
  const backdrop = doc.createElement('div');
  backdrop.className = 'orvexa-modal-backdrop';
  backdrop.dataset.orvexaModal = 'true';
  backdrop.innerHTML = `
    <section class="orvexa-modal orvexa-modal-${escapeAttr(size)} ${escapeAttr(className)}" role="dialog" aria-modal="true" aria-labelledby="${escapeAttr(headingId)}" tabindex="-1">
      <header class="orvexa-modal-head">
        <div class="orvexa-modal-titles">
          <span class="orvexa-modal-kicker">ORVEXA STUDIO</span>
          <h2 id="${escapeAttr(headingId)}">${escapeHtml(title)}</h2>
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button type="button" class="orvexa-modal-close icon-button" data-dialog-close aria-label="${escapeAttr(closeLabel)}" title="${escapeAttr(closeLabel)}">✕</button>
      </header>
      <div class="orvexa-modal-body"></div>
      ${footer ? `<footer class="orvexa-modal-foot">${footer}</footer>` : ''}
    </section>`;
  const card = backdrop.querySelector('.orvexa-modal');
  const bodyRoot = backdrop.querySelector('.orvexa-modal-body');
  if (typeof body === 'string') bodyRoot.innerHTML = body;
  else if (body && typeof body === 'object' && (body.nodeType === 1 || body.nodeType === 11)) bodyRoot.append(body);
  else if (body) throw new TypeError('Dialog body must be an HTML string or a Node.');

  const previouslyFocused = doc.activeElement;
  const background = [...doc.body.children].filter((element) => element !== backdrop && element.tagName !== 'SCRIPT');
  for (const element of background) element.setAttribute('inert', '');
  doc.body.append(backdrop);
  doc.body.classList.add('orvexa-modal-open');
  openCount += 1;

  let closed = false;
  let releaseTrap = null;
  const close = (result) => {
    if (closed) return;
    closed = true;
    try { releaseTrap?.(); } catch { /* ignore */ }
    for (const element of background) element.removeAttribute('inert');
    backdrop.remove();
    openCount = Math.max(0, openCount - 1);
    if (!openCount) doc.body.classList.remove('orvexa-modal-open');
    if (previouslyFocused?.focus) setTimeout(() => { try { previouslyFocused.focus(); } catch { /* ignore */ } }, 0);
    try { onClose?.(result); } catch (error) { console.error('Orvexa dialog close handler failed:', error); }
  };

  backdrop.querySelector('[data-dialog-close]')?.addEventListener('click', () => close(null));
  backdrop.addEventListener('mousedown', (event) => { if (event.target === backdrop) close(null); });
  const firstBodyControl = bodyRoot.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
  releaseTrap = createFocusTrap(card, { onEscape: () => close(null), initialFocus: firstBodyControl || undefined, documentRef: doc });

  try {
    onMount?.({ root: bodyRoot, card, close, doc });
  } catch (error) {
    console.error('Orvexa dialog mount failed:', error);
    close(null);
    throw error;
  }
  return { element: backdrop, card, body: bodyRoot, close };
}

export function closeAllDialogs(documentRef = null) {
  const doc = documentRef || globalThis.document;
  doc?.querySelectorAll?.('[data-orvexa-modal="true"]').forEach((element) => element.remove());
  doc?.body?.classList?.remove('orvexa-modal-open');
  openCount = 0;
}

export function askText({
  title = 'Enter a value',
  label = 'Value',
  value = '',
  placeholder = '',
  help = '',
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  maxLength = 200,
  required = true,
  validate = null,
  documentRef = null,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
    const dialog = openDialog({
      title,
      size: 'small',
      documentRef,
      body: `
        <form class="orvexa-form" data-text-form novalidate>
          <label class="orvexa-field"><span>${escapeHtml(label)}</span>
            <input name="value" type="text" maxlength="${Number(maxLength) || 200}" value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}" autocomplete="off" required="${required ? 'true' : 'false'}" />
          </label>
          ${help ? `<p class="orvexa-field-help">${escapeHtml(help)}</p>` : ''}
          <p class="orvexa-form-error" data-form-error role="alert" hidden></p>
        </form>`,
      footer: `<button type="button" class="button secondary" data-form-cancel>${escapeHtml(cancelLabel)}</button><button type="button" class="button primary" data-form-submit>${escapeHtml(confirmLabel)}</button>`,
      onClose: () => finish(null),
    });
    const input = dialog.body.querySelector('input[name="value"]');
    const error = dialog.body.querySelector('[data-form-error]');
    const submit = () => {
      const raw = input.value.trim();
      if (required && !raw) { showError(error, 'Please enter a value.'); input.focus(); return; }
      if (validate) {
        const message = validate(raw);
        if (message) { showError(error, message); input.focus(); return; }
      }
      settled = true;
      dialog.close();
      resolve(raw);
    };
    dialog.body.querySelector('[data-text-form]')?.addEventListener('submit', (event) => { event.preventDefault(); submit(); });
    dialog.card.querySelector('[data-form-submit]')?.addEventListener('click', submit);
    dialog.card.querySelector('[data-form-cancel]')?.addEventListener('click', () => dialog.close());
    input?.addEventListener('input', () => { if (error) error.hidden = true; });
    setTimeout(() => { input?.focus(); input?.select(); }, 30);
  });
}

export function askConfirm({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  details = '',
  documentRef = null,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
    const dialog = openDialog({
      title,
      size: 'small',
      documentRef,
      body: `<p class="orvexa-confirm-message">${escapeHtml(message)}</p>${details ? `<pre class="orvexa-confirm-details">${escapeHtml(details)}</pre>` : ''}`,
      footer: `<button type="button" class="button secondary" data-form-cancel>${escapeHtml(cancelLabel)}</button><button type="button" class="button ${danger ? 'danger' : 'primary'}" data-form-submit>${escapeHtml(confirmLabel)}</button>`,
      onClose: () => finish(false),
    });
    dialog.card.querySelector('[data-form-submit]')?.addEventListener('click', () => { settled = true; dialog.close(); resolve(true); });
    dialog.card.querySelector('[data-form-cancel]')?.addEventListener('click', () => { finish(false); dialog.close(); });
  });
}

export function toastHtml(message, kind = 'info') {
  return `<div class="orvexa-toast-content ${escapeAttr(kind)}"><span class="orvexa-toast-dot"></span><span>${escapeHtml(message)}</span></div>`;
}

function showError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function escapeAttr(value) { return escapeHtml(value).replaceAll('`', '&#96;'); }
