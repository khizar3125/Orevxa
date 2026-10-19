/**
 * Unit tests for src/core/pwa.js — install prompts, network status and the
 * service-worker registration/update flow.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SW_PATH, createInstallManager, getNetworkStatus, isStandalone, onNetworkChange,
  registerServiceWorker, serviceWorkerSupported,
} from '../src/core/pwa.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class FakeWindow {
  constructor(navigatorRef = { onLine: true }) {
    this.navigator = navigatorRef;
    this.listeners = new Map();
  }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }
  dispatch(type, event = {}) {
    for (const handler of [...(this.listeners.get(type) || [])]) handler(event);
  }
  listenerCount(type) { return this.listeners.get(type)?.size || 0; }
}

test('isStandalone understands display-mode and iOS', () => {
  assert.equal(isStandalone({ matchMedia: () => ({ matches: true }), navigatorRef: {} }), true);
  assert.equal(isStandalone({ matchMedia: () => ({ matches: false }), navigatorRef: {} }), false);
  assert.equal(isStandalone({ matchMedia: () => ({ matches: false }), navigatorRef: { standalone: true } }), true);
  assert.equal(isStandalone({ matchMedia: () => { throw new Error('denied'); }, navigatorRef: {} }), false);
});

test('install manager captures beforeinstallprompt and resolves the user choice', async () => {
  const windowRef = new FakeWindow();
  const states = [];
  const manager = createInstallManager({ windowRef });
  const unsubscribe = manager.subscribe((state) => states.push(state));
  assert.equal(states.length, 1, 'subscribers receive the current state immediately');
  assert.equal(states[0].canInstall, false);
  assert.equal(states[0].reason, 'browser-controlled');

  let prompted = 0;
  const installEvent = {
    preventDefault() {},
    prompt() { prompted += 1; },
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  };
  windowRef.dispatch('beforeinstallprompt', installEvent);
  assert.equal(prompted, 0, 'the platform prompt is deferred, not shown');
  assert.equal(manager.getState().canInstall, true);
  assert.equal(manager.getState().reason, 'available');

  const result = await manager.promptInstall();
  assert.equal(prompted, 1);
  assert.deepEqual(result, { outcome: 'accepted' });
  assert.equal(manager.getState().installed, true);
  assert.equal(manager.getState().canInstall, false);

  unsubscribe();
  const before = states.length;
  windowRef.dispatch('beforeinstallprompt', installEvent);
  assert.equal(states.length, before, 'unsubscribed listeners are removed');
  manager.dispose();
  assert.equal(windowRef.listenerCount('beforeinstallprompt'), 0);
});

test('install manager handles dismissed prompts and appinstalled', async () => {
  const windowRef = new FakeWindow();
  const manager = createInstallManager({ windowRef });
  const installEvent = { preventDefault() {}, prompt() {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) };
  windowRef.dispatch('beforeinstallprompt', installEvent);
  const result = await manager.promptInstall();
  assert.equal(result.outcome, 'dismissed');
  assert.equal(manager.getState().installed, false);
  assert.equal(manager.getState().canInstall, false, 'the deferred prompt is consumed');

  windowRef.dispatch('beforeinstallprompt', installEvent);
  windowRef.dispatch('appinstalled');
  assert.equal(manager.getState().installed, true);

  const unavailable = await manager.promptInstall();
  assert.equal(unavailable.outcome, 'unavailable');
});

test('install manager reports prompt failures without throwing', async () => {
  const windowRef = new FakeWindow();
  const manager = createInstallManager({ windowRef });
  windowRef.dispatch('beforeinstallprompt', { preventDefault() {}, prompt() { throw new Error('blocked'); } });
  const result = await manager.promptInstall();
  assert.equal(result.outcome, 'error');
  assert.match(result.error, /blocked/);
  assert.equal(manager.getState().canInstall, false);
});

test('network status and change subscription', () => {
  assert.deepEqual(getNetworkStatus({ onLine: true }), { online: true, label: 'Online', detail: 'Network available' });
  assert.deepEqual(getNetworkStatus({ onLine: false }), { online: false, label: 'Offline', detail: 'Offline — local features keep working' });
  assert.equal(getNetworkStatus({}).online, true);

  const navigatorRef = { onLine: false };
  const windowRef = new FakeWindow(navigatorRef);
  const seen = [];
  const unsubscribe = onNetworkChange((status) => seen.push(status.label), { windowRef });
  assert.deepEqual(seen, ['Offline'], 'subscription calls back immediately');
  navigatorRef.onLine = true;
  windowRef.dispatch('online');
  assert.deepEqual(seen, ['Offline', 'Online']);
  unsubscribe();
  assert.equal(windowRef.listenerCount('online'), 0);
  assert.equal(windowRef.listenerCount('offline'), 0);
  assert.equal(typeof onNetworkChange(null), 'function');
});

test('service worker registration guards insecure contexts and ?nosw=1', () => {
  assert.deepEqual(registerServiceWorker({ navigatorRef: {}, locationRef: { href: 'https://example.com/' } }), { supported: false, reason: 'unsupported-context' });
  assert.deepEqual(registerServiceWorker({ navigatorRef: { serviceWorker: {} }, locationRef: { href: 'file:///studio/index.html' } }), { supported: false, reason: 'unsupported-context' });
  assert.deepEqual(registerServiceWorker({ navigatorRef: { serviceWorker: {} }, locationRef: { href: 'https://example.com/?nosw=1' } }), { supported: false, reason: 'disabled-by-query' });
  assert.equal(serviceWorkerSupported({ serviceWorker: {} }), true);
  assert.equal(serviceWorkerSupported({}), false);
});

test('service worker registration reports waiting updates and applies them', async () => {
  globalThis.__orvexaSWReloaded = false;
  let posted = null;
  const waitingWorker = { postMessage: (message) => { posted = message; } };
  const registration = {
    waiting: waitingWorker,
    installing: null,
    listeners: new Map(),
    addEventListener(type, handler) { this.listeners.set(type, handler); },
  };
  let registeredWith = null;
  const swListeners = new Map();
  const navigatorRef = {
    serviceWorker: {
      register: async (path, options) => { registeredWith = { path, options }; return registration; },
      controller: null,
      addEventListener(type, handler) { swListeners.set(type, handler); },
    },
  };
  let reloads = 0;
  const updates = [];
  const handle = registerServiceWorker({
    navigatorRef,
    locationRef: { href: 'https://example.com/studio/' },
    onUpdate: (worker) => updates.push(worker),
    reload: () => { reloads += 1; },
  });
  assert.equal(handle.supported, true);
  const ready = await handle.ready;
  assert.equal(ready, registration);
  assert.equal(registeredWith.path, SW_PATH);
  assert.deepEqual(registeredWith.options, { scope: './' });
  assert.equal(updates.length, 1, 'an existing waiting worker is reported');

  assert.equal(handle.applyUpdate(), true);
  assert.deepEqual(posted, { type: 'SKIP_WAITING' });
  await sleep(110);
  assert.equal(reloads, 1);
  assert.equal(handle.registration, registration);

  // First install: no previous controller → controllerchange must not reload.
  swListeners.get('controllerchange')?.();
  await sleep(100);
  assert.equal(reloads, 1, 'first install claims without reloading');
  assert.equal(handle.applyUpdate(null), false);
});

test('service worker update reloads once when replacing an existing controller', async () => {
  globalThis.__orvexaSWReloaded = false;
  const registration = { waiting: null, installing: null, addEventListener() {} };
  const swListeners = new Map();
  const navigatorRef = {
    serviceWorker: {
      register: async () => registration,
      controller: { state: 'activated' },
      addEventListener(type, handler) { swListeners.set(type, handler); },
    },
  };
  let reloads = 0;
  const handle = registerServiceWorker({
    navigatorRef,
    locationRef: { href: 'https://example.com/' },
    reload: () => { reloads += 1; },
  });
  await handle.ready;
  swListeners.get('controllerchange')?.();
  swListeners.get('controllerchange')?.();
  await sleep(100);
  assert.equal(reloads, 1, 'the reload guard fires at most once');
});

test('service worker registration failures reach onError and resolve to null', async () => {
  const nav = { serviceWorker: { register: async () => { throw new Error('registration blocked'); }, controller: null, addEventListener() {} } };
  let reported = null;
  const handle = registerServiceWorker({ navigatorRef: nav, locationRef: { href: 'https://example.com/' }, onError: (error) => { reported = error; } });
  const ready = await handle.ready;
  assert.equal(ready, null);
  assert.match(reported.message, /registration blocked/);
});
