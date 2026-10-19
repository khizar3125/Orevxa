/**
 * Orvexa Project Snapshots (v8) — version safety for beginners.
 * Save named copies of every project file and roll back in one click.
 * Storage is injectable so it works with localStorage or in-memory tests.
 */

export const SNAPSHOT_KEY = 'orvexa-project-snapshots-v1';
const MAX_SNAPSHOTS = 12;

function readAll(storage) {
  try {
    const store = storage || globalThis.localStorage;
    const parsed = JSON.parse(store?.getItem(SNAPSHOT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeAll(storage, list) {
  try {
    const store = storage || globalThis.localStorage;
    store?.setItem(SNAPSHOT_KEY, JSON.stringify(list));
  } catch { /* storage full/blocked: snapshot list still returned */ }
  return list;
}

export function createProjectSnapshot(files, label = '', storage) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('Snapshot needs a files object.');
  const list = readAll(storage);
  const snapshot = {
    id: `snap-${Date.now().toString(36)}-${list.length}`,
    label: String(label || `Snapshot ${list.length + 1}`).slice(0, 80),
    at: new Date().toISOString(),
    files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, String(v)])),
    fileCount: Object.keys(files).length,
    totalBytes: Object.values(files).reduce((n, v) => n + String(v).length, 0),
  };
  list.unshift(snapshot);
  writeAll(storage, list.slice(0, MAX_SNAPSHOTS));
  return snapshot;
}

export function listProjectSnapshots(storage) {
  return readAll(storage).map(({ id, label, at, fileCount, totalBytes }) => ({ id, label, at, fileCount, totalBytes }));
}

export function restoreProjectSnapshot(snapshotId, storage) {
  const found = readAll(storage).find(s => s.id === snapshotId);
  if (!found) throw new Error(`Snapshot "${snapshotId}" not found.`);
  return { files: { ...found.files }, label: found.label, at: found.at };
}

export function deleteProjectSnapshot(snapshotId, storage) {
  const list = readAll(storage).filter(s => s.id !== snapshotId);
  writeAll(storage, list);
  return listProjectSnapshots(storage);
}

export function clearProjectSnapshots(storage) {
  writeAll(storage, []);
  return [];
}

/** Generate a pretty share-card SVG for a project (downloadable in Studio). */
export function buildShareCardSvg({ title = 'My Orvexa Creation', kind = 'game', lines = 0, accent = '#7c5cff' } = {}) {
  const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="#48e5e5"/></linearGradient></defs>
  <rect width="1200" height="630" fill="#10142a"/>
  <rect x="48" y="48" width="1104" height="534" rx="36" fill="none" stroke="url(#g)" stroke-width="3"/>
  <text x="96" y="180" fill="#8fd0ff" font-size="34" font-family="sans-serif" letter-spacing="6">MADE WITH ORVEXA STUDIO</text>
  <text x="96" y="300" fill="#ffffff" font-size="84" font-weight="700" font-family="sans-serif">${esc(String(title).slice(0, 34))}</text>
  <text x="96" y="380" fill="#c8d2ff" font-size="36" font-family="sans-serif">${kind === 'game' ? '🎮 A playable 3D game' : '🌐 An interactive web app'} · ${lines} lines of Orvexa code</text>
  <text x="96" y="500" fill="#7ce8a8" font-size="30" font-family="sans-serif">Bina code seekhe banaya — 1-click templates + AI Agent 🚀</text>
</svg>`;
}
