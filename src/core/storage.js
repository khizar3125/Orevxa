/**
 * Safe, quota-aware storage helpers.
 *
 * All Studio persistence in v10 goes through this module so that:
 *  - private-mode / disabled-storage browsers degrade to memory instead of
 *    throwing;
 *  - JSON reads are schema-validated and never trust stored data;
 *  - data export/import is explicit, size-capped and namespaced;
 *  - quota failures are surfaced with actionable metadata.
 */
export const STORAGE_PREFIX = 'orvexa-';

export function createMemoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed).map(([key, value]) => [String(key), String(value)]));
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    clear() { data.clear(); },
    __data: data,
  };
}

export function resolveStorage(kind = 'local', override = null) {
  if (override && typeof override.getItem === 'function') return override;
  try {
    const store = kind === 'session' ? globalThis.sessionStorage : globalThis.localStorage;
    if (store && typeof store.getItem === 'function') return store;
  } catch { /* storage can be disabled by privacy settings */ }
  return createMemoryStorage();
}

export function isStorageAvailable(kind = 'local') {
  try {
    const store = kind === 'session' ? globalThis.sessionStorage : globalThis.localStorage;
    if (!store) return false;
    const probe = `__orvexa_probe_${Date.now()}`;
    store.setItem(probe, '1');
    store.removeItem(probe);
    return true;
  } catch { return false; }
}

export function createSafeStorage({ kind = 'local', storage = null, prefix = STORAGE_PREFIX } = {}) {
  const store = resolveStorage(kind, storage);
  const failures = [];

  function keyOf(key) {
    const clean = String(key ?? '');
    if (!clean) throw new TypeError('Storage key must be a non-empty string.');
    return clean.startsWith(prefix) ? clean : `${prefix}${clean}`;
  }

  function recordFailure(operation, key, error) {
    const entry = {
      operation,
      key,
      name: error?.name || 'Error',
      message: error?.message || String(error),
      quota: isQuotaError(error),
      at: new Date().toISOString(),
    };
    failures.push(entry);
    if (failures.length > 20) failures.shift();
    return entry;
  }

  function getItem(key) {
    try { return store.getItem(keyOf(key)); }
    catch (error) { recordFailure('read', key, error); return null; }
  }

  function setItem(key, value) {
    try {
      store.setItem(keyOf(key), String(value));
      return { ok: true, key: keyOf(key) };
    } catch (error) {
      return { ok: false, key: keyOf(key), error: recordFailure('write', key, error) };
    }
  }

  function removeItem(key) {
    try { store.removeItem(keyOf(key)); return true; }
    catch (error) { recordFailure('remove', key, error); return false; }
  }

  function getJSON(key, fallback = null, { validate = null, migrate = null } = {}) {
    const raw = getItem(key);
    if (raw === null || raw === undefined || raw === '') return fallback;
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return fallback; }
    let value = parsed;
    if (migrate) {
      try { value = migrate(parsed); } catch { value = parsed; }
    }
    if (validate) {
      try { return validate(value) ? value : fallback; }
      catch { return fallback; }
    }
    return value ?? fallback;
  }

  function setJSON(key, value) {
    let payload;
    try { payload = JSON.stringify(value); }
    catch (error) { return { ok: false, error: recordFailure('serialize', key, error) }; }
    if (payload === undefined) return { ok: false, error: recordFailure('serialize', key, new TypeError('Value is not JSON serialisable.')) };
    return setItem(key, payload);
  }

  function keys() {
    try {
      const result = [];
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index);
        if (key?.startsWith(prefix)) result.push(key);
      }
      return result.sort();
    } catch (error) { recordFailure('keys', prefix, error); return []; }
  }

  function entries() {
    return keys().map((key) => [key, getItem(key)]);
  }

  function usage() {
    let bytes = 0;
    const perKey = [];
    for (const [key, value] of entries()) {
      const size = byteLength(value || '');
      bytes += size;
      perKey.push({ key: key.slice(prefix.length), bytes: size });
    }
    perKey.sort((a, b) => b.bytes - a.bytes);
    return { bytes, keys: perKey.length, perKey };
  }

  function clearNamespace() {
    let removed = 0;
    for (const key of keys()) {
      if (removeItem(key.slice(prefix.length))) removed += 1;
    }
    return removed;
  }

  return Object.freeze({
    getItem, setItem, removeItem, getJSON, setJSON, keys, entries, usage, clearNamespace,
    failures: () => [...failures],
    kind,
    prefix,
  });
}

export function byteLength(value) {
  const text = String(value ?? '');
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return unescape(encodeURIComponent(text)).length;
}

export function isQuotaError(error) {
  if (!error) return false;
  return error.name === 'QuotaExceededError'
    || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || error.code === 22
    || error.code === 1014
    || /quota|storage full/i.test(String(error.message || ''));
}

/** Build a portable JSON snapshot of every Orvexa key in the given storages. */
export function createDataExport({ local = null, session = null, appVersion = '10.0.0' } = {}) {
  const isSafe = (store) => store && typeof store.entries === 'function' && typeof store.setItem === 'function';
  const localSafe = isSafe(local) ? local : createSafeStorage({ kind: 'local', storage: local });
  const sessionSafe = isSafe(session) ? session : createSafeStorage({ kind: 'session', storage: session });
  const entries = {
    ...Object.fromEntries(localSafe.entries()),
    ...Object.fromEntries(sessionSafe.entries().filter(([key]) => !key.startsWith('orvexa-session-recovery'))),
  };
  return {
    format: 'orvexa-data-export',
    version: 1,
    appVersion,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

/** Validate + import a data snapshot created by createDataExport. */
export function importDataExport(payload, { local = null, session = null } = {}) {
  if (!payload || typeof payload !== 'object') throw new Error('Backup must be a JSON object.');
  if (payload.format !== 'orvexa-data-export') throw new Error('This file is not an Orvexa data export.');
  if (!payload.entries || typeof payload.entries !== 'object' || Array.isArray(payload.entries)) throw new Error('Backup entries are missing.');
  const entries = Object.entries(payload.entries);
  if (entries.length > 200) throw new Error('Backup contains too many keys (limit 200).');
  let total = 0;
  for (const [key, value] of entries) {
    if (!key.startsWith(STORAGE_PREFIX)) throw new Error(`Refusing to import unrelated key "${key}".`);
    if (typeof value !== 'string') throw new Error(`Backup value for "${key}" must be text.`);
    total += byteLength(value);
  }
  if (total > 25 * 1024 * 1024) throw new Error('Backup is larger than the 25 MB import safety limit.');
  const isSafe = (store) => store && typeof store.entries === 'function' && typeof store.setItem === 'function';
  const localSafe = isSafe(local) ? local : createSafeStorage({ kind: 'local', storage: local });
  const sessionSafe = isSafe(session) ? session : createSafeStorage({ kind: 'session', storage: session });
  let imported = 0;
  const failures = [];
  for (const [key, value] of entries) {
    const result = localSafe.setItem(key, value);
    if (result.ok) imported += 1;
    else { failures.push({ key, error: result.error }); sessionSafe.setItem(key, value); }
  }
  return { imported, failed: failures.length, keys: entries.length, failures };
}

/** Best-effort browser storage estimate (not available in every browser). */
export async function estimateStorage(navigatorRef = globalThis.navigator) {
  try {
    if (navigatorRef?.storage?.estimate) {
      const estimate = await navigatorRef.storage.estimate();
      return {
        supported: true,
        usage: Number(estimate.usage) || 0,
        quota: Number(estimate.quota) || 0,
        percent: estimate.quota ? Math.min(100, (Number(estimate.usage) || 0) / Number(estimate.quota) * 100) : 0,
      };
    }
  } catch { /* estimate is optional */ }
  return { supported: false, usage: 0, quota: 0, percent: 0 };
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
