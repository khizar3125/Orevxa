import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneHistory, applyAxisTransform } from '../src/studio/sceneHistory.js';

test('scene history traverses undo/redo snapshots in order', () => {
  const history = new SceneHistory();
  assert.equal(history.record({ x: 0 }, 'Initial'), true);
  assert.equal(history.record({ x: 1 }, 'Move'), true);
  assert.equal(history.record({ x: 2 }, 'Move again'), true);
  assert.equal(history.canUndo, true);
  assert.deepEqual(history.undo().snapshot, { x: 1 });
  assert.deepEqual(history.undo().snapshot, { x: 0 });
  assert.equal(history.canUndo, false);
  assert.deepEqual(history.redo().snapshot, { x: 1 });
  assert.deepEqual(history.redo().snapshot, { x: 2 });
  assert.equal(history.canRedo, false);
});

test('recording after undo discards the redo branch and deduplicates identical states', () => {
  const history = new SceneHistory();
  history.record({ value: 'a' }, 'Initial');
  assert.equal(history.record({ value: 'a' }, 'No-op'), false);
  history.record({ value: 'b' }, 'Change B');
  history.undo();
  history.record({ value: 'c' }, 'Change C');
  assert.equal(history.canRedo, false);
  assert.deepEqual(history.undo().snapshot, { value: 'a' });
  assert.deepEqual(history.redo().snapshot, { value: 'c' });
});

test('history respects entry, count, and memory budgets', () => {
  const history = new SceneHistory({ maxEntries: 3, maxBytes: 2048, maxEntryBytes: 1024 });
  history.record({ i: 0 }, '0');
  history.record({ i: 1 }, '1');
  history.record({ i: 2 }, '2');
  history.record({ i: 3 }, '3');
  assert.equal(history.status.entries, 3);
  assert.equal(history.canUndo, true);
  assert.equal(history.record({ data: 'x'.repeat(900) }, 'Oversized'), false);
  assert.match(history.lastError, /too large/i);
});

test('history safely rejects cyclic snapshots', () => {
  const history = new SceneHistory();
  const cyclic = {}; cyclic.self = cyclic;
  assert.equal(history.record(cyclic), false);
  assert.match(history.lastError, /not serializable/i);
});

test('axis transforms implement bounded move, degree rotation and multiplicative scale', () => {
  const object = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
  applyAxisTransform(object, 'move', 'x', 2.5);
  applyAxisTransform(object, 'rotate', 'y', 90);
  applyAxisTransform(object, 'scale', 'z', 1.5);
  assert.equal(object.position.x, 2.5);
  assert.ok(Math.abs(object.rotation.y - Math.PI / 2) < 1e-12);
  assert.equal(object.scale.z, 1.5);
  applyAxisTransform(object, 'move', 'x', 100000);
  assert.equal(object.position.x, 10000);
  assert.throws(() => applyAxisTransform(object, 'scale', 'x', 0), /greater than zero/i);
  assert.throws(() => applyAxisTransform(object, 'move', 'w', 1), /X.*Y.*Z/i);
});
