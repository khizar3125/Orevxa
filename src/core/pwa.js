/**
 * Progressive Web App support: install prompt capture, service-worker
 * registration/update flow and online status. All browser APIs are injected so
 * this module is testable and safe to import in Node.
 */
export const SW_PATH = './sw.js';

export function isStandalone({ matchMedia = globalThis.matchMedia, navigatorRef = globalThis.navigator } = {}) {
  try {
    if (matchMedia?.('(display-mode: standalone)')?.matches) return true;
    return Boolean(navigatorRef?.standalone);
  } catch { return false; }
}

export function createInstallManager({ windowRef = globalThis.window, onChange = null } = {}) {
  let deferredPrompt = null;
  let installed = isStandalone({ matchMedia: windowRef?.matchMedia, navigatorRef: windowRef?.navigator });
  const listeners = new Set();

  const snapshot = () => ({
    canInstall: Boolean(deferredPrompt) && !installed,
    installed,
    reason: installed ? 'installed' : deferredPrompt ? 'available' : 'browser-controlled',
  });

  function emit() {
    const state = snapshot();
    try { onChange?.(state); } catch { /* ignore */ }
    for (const listener of listeners) {
      try { listener(state); } catch { /* ignore */ }
    }
  }

  const onBeforeInstall = (event) => {
    event.preventDefault?.();
    deferredPrompt = event;
    emit();
  };
  const onInstalled = () => {
    installed = true;
    deferredPrompt = null;
    emit();
  };
  windowRef?.addEventListener?.('beforeinstallprompt', onBeforeInstall);
  windowRef?.addEventListener?.('appinstalled', onInstalled);

  async function promptInstall() {
    if (!deferredPrompt) return { outcome: 'unavailable' };
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      const outcome = choice?.outcome || 'dismissed';
      if (outcome === 'accepted') installed = true;
      deferredPrompt = null;
      emit();
      return { outcome };
    } catch (error) {
      deferredPrompt = null;
      emit();
      return { outcome: 'error', error: String(error?.message || error) };
    }
  }

  return Object.freeze({
    getState: snapshot,
    promptInstall,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    dispose() {
      listeners.clear();
      windowRef?.removeEventListener?.('beforeinstallprompt', onBeforeInstall);
      windowRef?.removeEventListener?.('appinstalled', onInstalled);
    },
  });
}

export function getNetworkStatus(navigatorRef = globalThis.navigator) {
  const online = navigatorRef?.onLine !== false;
  return { online, label: online ? 'Online' : 'Offline', detail: online ? 'Network available' : 'Offline — local features keep working' };
}

export function onNetworkChange(handler, { windowRef = globalThis.window } = {}) {
  if (!windowRef?.addEventListener || typeof handler !== 'function') return () => {};
  const update = () => handler(getNetworkStatus(windowRef.navigator));
  windowRef.addEventListener('online', update);
  windowRef.addEventListener('offline', update);
  update();
  return () => {
    windowRef.removeEventListener('online', update);
    windowRef.removeEventListener('offline', update);
  };
}

/**
 * Register the service worker after first paint.
 * - only http/https (file:// is not a secure context for SW);
 * - `?nosw=1` disables registration for debugging;
 * - reports waiting updates and can activate them immediately.
 */
export function registerServiceWorker({
  navigatorRef = globalThis.navigator,
  locationRef = globalThis.location,
  onUpdate = null,
  onReady = null,
  onError = null,
  reload = null,
} = {}) {
  const url = String(locationRef?.href || '');
  if (!navigatorRef?.serviceWorker || !/^https?:/i.test(url)) return { supported: false, reason: 'unsupported-context' };
  if (/[?&]nosw=1\b/.test(url)) return { supported: false, reason: 'disabled-by-query' };

  let registration = null;
  const reportError = (error) => { try { onError?.(error); } catch { /* ignore */ } };

  const watchWaiting = (worker) => {
    if (!worker) return;
    try { onUpdate?.(worker); } catch { /* ignore */ }
  };

  const ready = navigatorRef.serviceWorker.register(SW_PATH, { scope: './' })
    .then((registered) => {
      registration = registered;
      if (registered.waiting) watchWaiting(registered.waiting);
      registered.addEventListener?.('updatefound', () => {
        const installing = registered.installing;
        installing?.addEventListener?.('statechange', () => {
          if (installing.state === 'installed' && navigatorRef.serviceWorker.controller) watchWaiting(registered.waiting || installing);
        });
      });
      try { onReady?.(registered); } catch { /* ignore */ }
      return registered;
    })
    .catch((error) => { reportError(error); return null; });

  function applyUpdate(worker = registration?.waiting) {
    if (!worker) return false;
    try {
      worker.postMessage({ type: 'SKIP_WAITING' });
      if (reload) setTimeout(() => reload(), 80);
      return true;
    } catch (error) { reportError(error); return false; }
  }

  const hadController = Boolean(navigatorRef.serviceWorker.controller);
  if (navigatorRef.serviceWorker.addEventListener) {
    navigatorRef.serviceWorker.addEventListener('controllerchange', () => {
      // First install claims the page without a reload; real updates reload once.
      if (!hadController || globalThis.__orvexaSWReloaded) return;
      globalThis.__orvexaSWReloaded = true;
      if (reload) setTimeout(() => reload(), 80);
    });
  }

  return { supported: true, ready, applyUpdate, get registration() { return registration; } };
}

export function serviceWorkerSupported(navigatorRef = globalThis.navigator) {
  return Boolean(navigatorRef?.serviceWorker);
}
