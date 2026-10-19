import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorldPartition, queryWorldPartition, worldCellCoordinates, worldPartitionStats } from '../src/studio/worldPartition.js';

test('world partition assigns spatial objects to deterministic grid cells', () => {
  assert.deepEqual(worldCellCoordinates({ x: -1, y: 65, z: 129 }, 64), [-1, 1, 2]);
  const objects = [
    { type: 'mesh', name: 'near', position: { x: 2, y: 0, z: 1 } },
    { type: 'mesh', name: 'next-cell', position: { x: 65, y: 0, z: 0 } },
    { type: 'mesh', name: 'distant', position: { x: 300, y: 0, z: 0 } },
    { type: 'light', name: 'global-light', position: { x: 5000, y: 20, z: 0 } },
    { type: 'mesh', name: 'hidden', visible: false, position: { x: 0, y: 0, z: 0 } },
  ];
  const partition = buildWorldPartition(objects, { cellSize: 64 });
  assert.equal(partition.cellCount, 3);
  assert.equal(partition.spatialObjectCount, 3);
  assert.equal(partition.alwaysLoaded.length, 1);
  const query = queryWorldPartition(partition, { x: 0, y: 0, z: 0 }, { loadRadius: 1 });
  assert.deepEqual(query.objects.map(object => object.name).sort(), ['global-light', 'near', 'next-cell']);
  assert.equal(query.loadedCellCount, 2);
  assert.equal(query.unloadedCellCount, 1);
  assert.deepEqual(worldPartitionStats(partition, query), { cells: 3, loadedCells: 2, unloadedCells: 1, loadedObjects: 3, totalObjects: 5 });
});

test('world partition clamps cell size, radius and cell-count budget', () => {
  const partition = buildWorldPartition([{ type: 'mesh', position: { x: 0, y: 0, z: 0 } }], { cellSize: 0 });
  assert.equal(partition.cellSize, 8);
  const query = queryWorldPartition(partition, {}, { loadRadius: 50, maxLoadedCells: 0 });
  assert.equal(query.radius, 16);
  assert.equal(query.loadedCellCount, 1);
  assert.equal(query.loadedObjectCount, 1);
});

test('dynamic physics objects and authored always-loaded objects survive spatial streaming', () => {
  const dynamic = { type: 'mesh', name: 'moving', position: { x: 10000, y: 0, z: 0 }, rigidBody: { enabled: true, bodyType: 'dynamic' } };
  const authored = { type: 'mesh', name: 'persistent', position: { x: -10000, y: 0, z: 0 }, worldPartitionAlwaysLoaded: true };
  const partition = buildWorldPartition([dynamic, authored], { cellSize: 64 });
  const query = queryWorldPartition(partition, {}, { loadRadius: 0 });
  assert.deepEqual(query.objects.map(object => object.name).sort(), ['moving', 'persistent']);
  assert.equal(query.alwaysLoadedCount, 2);
});

test('shared renderer wires opt-in grid streaming and leaves default scenes unchanged', async () => {
  const { readFile } = await import('node:fs/promises');
  const renderer = await readFile(new URL('../src/studio/scene3d.js', import.meta.url), 'utf8');
  const modeler = await readFile(new URL('../modeler.html', import.meta.url), 'utf8');
  assert.match(renderer, /buildWorldPartition/);
  assert.match(renderer, /queryWorldPartition/);
  assert.match(renderer, /partitionOptions\.enabled === true/);
  assert.match(renderer, /worldPartitionMode:/);
  assert.match(modeler, /id="worldPartitionToggleButton"/);
  assert.match(modeler, /id="worldCellSizeSelect"/);
  assert.match(modeler, /id="worldLoadRadiusSelect"/);
});
