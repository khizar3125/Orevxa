/**
 * Error classification, global handling and a recovery-friendly boot fallback.
 * Beginner-facing copy is intentionally short and action-oriented.
 */
export const ERROR_LOG_KEY = 'orvexa-error-log-v1';
const MAX_LOG = 25;

export function classifyError(error) {
  const name = String(error?.name || '');
  const message = String(error?.message || error || '');
  if (/quota|storage full/i.test(name) || /quota|storage full/i.test(message)) return 'storage';
  if (name === 'SyntaxError' || /unexpected token|unexpected end|parse/i.test(message)) return 'syntax';
  if (/network|fetch|failed to fetch|load failed|offline/i.test(message) || name === 'TypeError' && /fetch/i.test(message)) return 'network';
  if (name === 'SecurityError' || /permission denied|not allowed|blocked/i.test(message)) return 'security';
  if (/abort|cancel/i.test(message)) return 'cancelled';
  return 'runtime';
}

export function describeError(error, { context = '' } = {}) {
  const category = classifyError(error);
  const raw = String(error?.message || error || 'Unknown error');
  const line = Number(error?.line) || null;
  const column = Number(error?.column) || null;
  const templates = {
    storage: {
      title: 'Browser storage is full or blocked',
      hint: 'Export a project ZIP, delete old snapshots, or allow site data in your browser settings.',
      recoverable: true,
    },
    syntax: {
      title: 'Code needs a small fix',
      hint: 'Run Auto-Fix, or check the first red line in the Problems panel.',
      recoverable: true,
    },
    network: {
      title: 'Network request failed',
      hint: 'Check your connection, or switch the AI provider to Free Built-In AI (fully offline).',
      recoverable: true,
    },
    security: {
      title: 'The browser blocked an action',
      hint: 'Open the page in a normal tab (not a restricted embed) and try again.',
      recoverable: false,
    },
    cancelled: {
      title: 'Action cancelled',
      hint: 'Nothing was changed. You can start the action again whenever you are ready.',
      recoverable: true,
    },
    runtime: {
      title: 'Something unexpected happened',
      hint: 'Your project is autosaved locally. Reload the page; if it repeats, download a ZIP backup.',
      recoverable: true,
    },
  };
  const template = templates[category];
  return {
    category,
    title: template.title,
    message: line ? `Line ${line}${column ? `, column ${column}` : ''}: ${raw}` : raw,
    hint: template.hint,
    technical: `${error?.name || 'Error'}: ${raw}${line ? ` (line ${line})` : ''}`,
    line,
    column,
    recoverable: template.recoverable,
    context: String(context || ''),
  };
}

export function safeCall(fn, fallback = null, { onError = null } = {}) {
  if (typeof fn !== 'function') return fallback;
  try { return fn(); }
  catch (error) { onError?.(error); return fallback; }
}

export async function safeAsync(fn, fallback = null, { onError = null } = {}) {
  if (typeof fn !== 'function') return fallback;
  try { return await fn(); }
  catch (error) { onError?.(error); return fallback; }
}

export function createErrorLog({ limit = MAX_LOG } = {}) {
  const entries = [];
  function add(error, meta = {}) {
    const described = describeError(error, meta);
    const entry = {
      id: `err-${Date.now().toString(36)}-${entries.length}`,
      at: new Date().toISOString(),
      ...described,
      meta: { ...meta, stack: typeof error?.stack === 'string' ? error.stack.slice(0, 4000) : '' },
    };
    entries.unshift(entry);
    while (entries.length > limit) entries.pop();
    return entry;
  }
  return Object.freeze({ add, list: () => [...entries], clear: () => { entries.length = 0; }, limit });
}

export function recordError(error, { storage = null, meta = {} } = {}) {
  const entry = createErrorLog().add(error, meta);
  try {
    const store = storage || globalThis.sessionStorage;
    const raw = store?.getItem(ERROR_LOG_KEY);
    const list = raw ? JSON.parse(raw) : [];
    store?.setItem(ERROR_LOG_KEY, JSON.stringify([entry, ...(Array.isArray(list) ? list : [])].slice(0, MAX_LOG)));
  } catch { /* logging must never throw */ }
  return entry;
}

export function readErrorLog(storage = null) {
  try {
    const store = storage || globalThis.sessionStorage;
    const list = JSON.parse(store?.getItem(ERROR_LOG_KEY) || '[]');
    return Array.isArray(list) ? list.slice(0, MAX_LOG) : [];
  } catch { return []; }
}

export function clearErrorLog(storage = null) {
  try { (storage || globalThis.sessionStorage)?.removeItem(ERROR_LOG_KEY); } catch { /* ignore */ }
}

export function installGlobalErrorHandlers({ windowRef = globalThis.window, onError = null, storage = null, log = null } = {}) {
  if (!windowRef?.addEventListener) return () => {};
  const handle = (error, meta) => {
    const entry = (log || createErrorLog()).add(error, meta);
    recordError(error, { storage, meta });
    try { onError?.(entry, error, meta); } catch { /* never recurse */ }
    return entry;
  };
  const onWindowError = (event) => {
    if (event?.defaultPrevented) return;
    const target = String(event?.target?.tagName || '');
    if (target && target !== 'SCRIPT') return; // resource load errors have no actionable error
    handle(event?.error || new Error(event?.message || 'Unknown script error'), { source: 'window.error' });
  };
  const onRejection = (event) => {
    handle(event?.reason instanceof Error ? event.reason : new Error(String(event?.reason || 'Unhandled rejection')), { source: 'unhandledrejection' });
  };
  windowRef.addEventListener('error', onWindowError);
  windowRef.addEventListener('unhandledrejection', onRejection);
  return function dispose() {
    windowRef.removeEventListener('error', onWindowError);
    windowRef.removeEventListener('unhandledrejection', onRejection);
  };
}

/** Static recovery screen used if the Studio shell itself fails to boot. */
export function buildBootFallbackHtml(error, { version = '10.0.0' } = {}) {
  const described = describeError(error, { context: 'boot' });
  const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  return `<div class="boot-failure" role="alert">
    <div class="boot-failure-card">
      <span class="boot-failure-mark">O</span>
      <span class="docs-kicker">ORVEXA STUDIO v${esc(version)} · RECOVERY MODE</span>
      <h1>${esc(described.title)}</h1>
      <p>${esc(described.message)}</p>
      <p class="boot-failure-hint">${esc(described.hint)}</p>
      <div class="boot-failure-actions">
        <button type="button" class="button primary" data-boot-action="reload">Reload Studio</button>
        <button type="button" class="button secondary" data-boot-action="safe-mode">Start in safe mode</button>
        <button type="button" class="button secondary" data-boot-action="download">Download project backup</button>
        <button type="button" class="button secondary" data-boot-action="copy">Copy error details</button>
      </div>
      <details><summary>Technical details</summary><pre>${esc(described.technical)}</pre></details>
      <p class="boot-failure-note">Your last autosave is kept in this browser. Safe mode ignores experimental scene/audio state but keeps every source file.</p>
    </div>
  </div>`;
}

/**
 * Bind the recovery screen actions without depending on the Studio module graph.
 * Returns a cleanup function.
 */
export function bindBootFallback(root, { windowRef = globalThis.window, project = null, storage = null } = {}) {
  if (!root?.querySelectorAll) return () => {};
  const listeners = [];
  const on = (element, event, handler) => {
    if (!element) return;
    element.addEventListener(event, handler);
    listeners.push(() => element.removeEventListener(event, handler));
  };
  for (const button of root.querySelectorAll('[data-boot-action]')) {
    on(button, 'click', async () => {
      const action = button.dataset.bootAction;
      if (action === 'reload') windowRef.location?.reload?.();
      else if (action === 'safe-mode') {
        try { storage?.setItem?.('orvexa-safe-mode', '1'); } catch { /* ignore */ }
        windowRef.location?.reload?.();
      } else if (action === 'download') {
        const payload = JSON.stringify(project || { note: 'No in-memory project was available.' }, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = root.ownerDocument.createElement('a');
        anchor.href = url;
        anchor.download = 'orvexa-recovery-project.json';
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (action === 'copy') {
        try { await windowRef.navigator?.clipboard?.writeText(root.querySelector('pre')?.textContent || ''); button.textContent = 'Copied ✓'; }
        catch { button.textContent = 'Copy unavailable'; }
      }
    });
  }
  return () => { while (listeners.length) listeners.pop()(); };
}
