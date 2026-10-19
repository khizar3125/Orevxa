/** Bounded, in-memory undo/redo history for editor state snapshots. */
export class SceneHistory {
  constructor({ maxEntries = 60, maxBytes = 24 * 1024 * 1024, maxEntryBytes = 10 * 1024 * 1024 } = {}) {
    this.maxEntries = Math.max(2, Math.floor(Number(maxEntries) || 60));
    this.maxBytes = Math.max(1024, Math.floor(Number(maxBytes) || 24 * 1024 * 1024));
    this.maxEntryBytes = Math.max(1024, Math.min(this.maxBytes, Math.floor(Number(maxEntryBytes) || 10 * 1024 * 1024)));
    this.entries = [];
    this.cursor = -1;
    this.bytes = 0;
    this.lastError = '';
  }

  record(snapshot, label = 'Edit') {
    let serialized;
    try { serialized = JSON.stringify(snapshot); }
    catch { this.lastError = 'The current scene cannot be recorded because its state is not serializable.'; return false; }
    if (typeof serialized !== 'string') return false;
    const size = serialized.length * 2;
    if (size > this.maxEntryBytes) {
      this.lastError = `This scene state is too large for a safe undo snapshot (${Math.ceil(size / 1024 / 1024)} MiB).`;
      return false;
    }
    if (this.cursor >= 0 && this.entries[this.cursor]?.serialized === serialized) return false;
    for (const entry of this.entries.splice(this.cursor + 1)) this.bytes -= entry.size;
    this.entries.push({ serialized, size, label: String(label || 'Edit').slice(0, 120) });
    this.bytes += size;
    this.cursor = this.entries.length - 1;
    while (this.entries.length > this.maxEntries || (this.bytes > this.maxBytes && this.entries.length > 1)) {
      const removed = this.entries.shift();
      this.bytes -= removed.size;
      this.cursor -= 1;
    }
    this.cursor = Math.max(0, this.cursor);
    this.lastError = '';
    return true;
  }

  undo() {
    if (!this.canUndo) return null;
    this.cursor -= 1;
    return this.#readCurrent();
  }

  redo() {
    if (!this.canRedo) return null;
    this.cursor += 1;
    return this.#readCurrent();
  }

  #readCurrent() {
    try {
      const entry = this.entries[this.cursor];
      return entry ? { snapshot: JSON.parse(entry.serialized), label: entry.label } : null;
    } catch {
      this.lastError = 'A saved undo snapshot could not be decoded.';
      return null;
    }
  }

  get canUndo() { return this.cursor > 0; }
  get canRedo() { return this.cursor >= 0 && this.cursor < this.entries.length - 1; }
  get status() {
    return { canUndo: this.canUndo, canRedo: this.canRedo, undoLabel: this.canUndo ? this.entries[this.cursor]?.label || '' : '', redoLabel: this.canRedo ? this.entries[this.cursor + 1]?.label || '' : '', entries: this.entries.length, bytes: this.bytes, cursor: this.cursor, lastError: this.lastError };
  }
}

/** Apply one bounded, world-axis transform like a simplified DCC G/R/S operation. */
export function applyAxisTransform(object, mode, axis, value) {
  if (!object || !['x', 'y', 'z'].includes(axis)) throw new TypeError('Choose an object and an X, Y or Z axis.');
  const n = Number(value);
  if (!Number.isFinite(n)) throw new TypeError('Transform value must be a finite number.');
  if (mode === 'move') {
    object.position ||= { x: 0, y: 0, z: 0 };
    object.position[axis] = Math.max(-10000, Math.min(10000, (Number(object.position[axis]) || 0) + n));
  } else if (mode === 'rotate') {
    object.rotation ||= { x: 0, y: 0, z: 0 };
    object.rotation[axis] = Math.max(-Math.PI * 20, Math.min(Math.PI * 20, (Number(object.rotation[axis]) || 0) + n * Math.PI / 180));
  } else if (mode === 'scale') {
    if (n <= 0) throw new RangeError('Scale factor must be greater than zero.');
    object.scale ||= { x: 1, y: 1, z: 1 };
    object.scale[axis] = Math.max(0.01, Math.min(100, (Number(object.scale[axis]) || 1) * n));
  } else throw new TypeError(`Unknown transform mode: ${mode}`);
  return object;
}
