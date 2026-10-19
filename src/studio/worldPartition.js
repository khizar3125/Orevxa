/** Distance-based spatial partitioning for large editable/runtime scenes. */
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const globalTypes = new Set(['light', 'camera', 'animation']);

export function worldCellCoordinates(position = {}, cellSize = 128) {
  const size = clamp(finite(cellSize, 128), 8, 4096);
  return [Math.floor(finite(position.x, 0) / size), Math.floor(finite(position.y, 0) / size), Math.floor(finite(position.z, 0) / size)];
}
export function worldCellKey(x, y, z) { return `${Math.trunc(x)},${Math.trunc(y)},${Math.trunc(z)}`; }

/** Build an immutable spatial index. Rebuild after static object placement/transform edits. */
export function buildWorldPartition(objects = [], options = {}) {
  if (!Array.isArray(objects)) throw new TypeError('World partition expects an object array.');
  const cellSize = clamp(finite(options.cellSize, 128), 8, 4096);
  const cells = new Map(), alwaysLoaded = [], objectCells = new Map();
  let spatialObjectCount = 0;
  for (const object of objects) {
    if (!object || object.visible === false) continue;
    const position = object.position || {};
    const isDynamic = object.rigidBody?.enabled !== false && object.rigidBody?.bodyType === 'dynamic';
    if (globalTypes.has(object.type) || isDynamic || object.worldPartitionAlwaysLoaded === true) {
      alwaysLoaded.push(object);
      continue;
    }
    const [cx, cy, cz] = worldCellCoordinates(position, cellSize), key = worldCellKey(cx, cy, cz);
    if (!cells.has(key)) cells.set(key, { key, coordinates: [cx, cy, cz], objects: [] });
    cells.get(key).objects.push(object); objectCells.set(object, key); spatialObjectCount++;
  }
  return { cellSize, cells, alwaysLoaded, objectCells, objectCount: objects.length, spatialObjectCount, cellCount: cells.size };
}

/**
 * Select cells around a streaming source. Grid-cell loads are deterministic, with a hard
 * cell cap to stop extreme radius values from allocating unbounded result sets.
 */
export function queryWorldPartition(partition, position = {}, options = {}) {
  if (!partition || !(partition.cells instanceof Map)) throw new TypeError('A built world partition is required.');
  const radius = Math.round(clamp(finite(options.loadRadius, 3), 0, 16));
  const maxLoadedCells = Math.round(clamp(finite(options.maxLoadedCells, 4096), 1, 20000));
  const [cx, cy, cz] = worldCellCoordinates(position, partition.cellSize);
  const candidates = [];
  for (let z = cz - radius; z <= cz + radius; z++) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        const key = worldCellKey(x, y, z), cell = partition.cells.get(key);
        if (cell) candidates.push({ cell, distance: (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 });
      }
    }
  }
  candidates.sort((a, b) => a.distance - b.distance || a.cell.key.localeCompare(b.cell.key));
  const loaded = candidates.slice(0, maxLoadedCells), loadedCells = new Set(loaded.map(entry => entry.cell.key));
  const objects = [...partition.alwaysLoaded];
  for (const entry of loaded) objects.push(...entry.cell.objects);
  return {
    objects, loadedCellKeys: loadedCells, loadedCellCount: loaded.length,
    totalCellCount: partition.cellCount, alwaysLoadedCount: partition.alwaysLoaded.length,
    loadedObjectCount: objects.length, unloadedCellCount: Math.max(0, partition.cellCount - loaded.length),
    centerCell: [cx, cy, cz], radius, cellSize: partition.cellSize,
  };
}

/** Returns concise performance counters suitable for the engine HUD. */
export function worldPartitionStats(partition, query) {
  return {
    cells: partition?.cellCount || 0,
    loadedCells: query?.loadedCellCount || 0,
    unloadedCells: query?.unloadedCellCount || 0,
    loadedObjects: query?.loadedObjectCount || 0,
    totalObjects: partition?.objectCount || 0,
  };
}
