import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeshGeometry } from '../src/studio/scene3d.js';
import { applyModifier, displaceTriangleMesh, evaluateModifierStack, normalizeModifier, smoothTriangleMesh } from '../src/studio/modifiers.js';

const cube = createMeshGeometry('cube');
const finite = mesh => Array.from(mesh).every(Number.isFinite);

test('modifier normalization clamps unsafe values and retains user toggle', () => {
  assert.deepEqual({ ...normalizeModifier({ type: 'subdivision', levels: 90, enabled: false }), id: 'modifier-undefined-1' }, { id: 'modifier-undefined-1', name: 'Subdivision', type: 'subdivision', enabled: false, levels: 3 });
  assert.equal(normalizeModifier({ type: 'smooth', factor: 7 }).factor, 0.9);
  assert.equal(normalizeModifier({ type: 'displace', amount: 99 }).amount, 5);
});

test('modifier stack is ordered, deterministic, and does not mutate its base mesh', () => {
  const original = Array.from(cube);
  const stack = [{ type: 'mirror', axis: 'x' }, { type: 'subdivision', levels: 1 }, { type: 'displace', amount: 0.12, seed: 9 }];
  const a = evaluateModifierStack(cube, stack), b = evaluateModifierStack(cube, stack);
  assert.equal(a.baseTriangles, cube.length / 9);
  assert.equal(a.finalTriangles, cube.length / 9 * 2 * 4);
  assert.deepEqual(Array.from(a.geometry), Array.from(b.geometry));
  assert.deepEqual(Array.from(cube), original);
  assert.equal(a.results.length, 3);
  assert.ok(finite(a.geometry));
});

test('disabled modifiers preserve topology while leaving the input unchanged', () => {
  const output = applyModifier(cube, { type: 'mirror', enabled: false });
  assert.equal(output.length, cube.length);
  assert.deepEqual(Array.from(output), Array.from(cube));
  assert.notEqual(output, cube);
});

test('smooth preserves triangle count, welded seams and finite coordinates', () => {
  const mesh = new Float32Array([...cube, ...cube]);
  const output = smoothTriangleMesh(mesh, { iterations: 2, factor: 0.3 });
  assert.equal(output.length, mesh.length);
  assert.ok(finite(output));
  assert.notDeepEqual(Array.from(output), Array.from(mesh));
});

test('displacement is seeded and repeatable with bounded output', () => {
  const a = displaceTriangleMesh(cube, { amount: 0.2, seed: 33, frequency: 4 });
  const b = displaceTriangleMesh(cube, { amount: 0.2, seed: 33, frequency: 4 });
  assert.deepEqual(Array.from(a), Array.from(b));
  assert.notDeepEqual(Array.from(a), Array.from(cube));
  assert.ok(finite(a));
});

test('unsafe meshes and runaway stacks are rejected with actionable errors', () => {
  assert.throws(() => evaluateModifierStack([1, 2, 3], []), /triangle-soup/i);
  assert.throws(() => evaluateModifierStack(cube, Array.from({ length: 33 }, () => ({ type: 'smooth' }))), /32 entries/i);
  assert.equal(normalizeModifier({ type: 'mirror', axis: 'q' }).axis, 'x');
});

test('Array modifier creates translated copies and rejects runaway geometry', async () => {
  const { arrayTriangleMesh } = await import('../src/studio/modifiers.js');
  const result = arrayTriangleMesh(cube, { count: 3, offsetX: 2.5, offsetY: -1, offsetZ: 0.25 });
  assert.equal(result.length, cube.length * 3);
  assert.equal(result[0], cube[0]);
  assert.equal(result[cube.length], cube[0] + 2.5);
  assert.equal(result[cube.length + 1], cube[1] - 1);
  assert.equal(result[cube.length * 2 + 2], cube[2] + 0.5);
  const large = new Array(72_000).fill(0);
  assert.throws(() => arrayTriangleMesh(large, { count: 32 }), /safety budget/i);
});

test('Solidify generates inner and outer surfaces plus boundary walls', async () => {
  const { solidifyTriangleMesh } = await import('../src/studio/modifiers.js');
  const plane = createMeshGeometry('plane');
  const thick = solidifyTriangleMesh(plane, { thickness: 0.2, offset: 0 });
  assert.ok(thick.length > plane.length * 2);
  assert.equal(thick.length % 9, 0);
  assert.ok(finite(thick));
  assert.notDeepEqual(Array.from(thick.slice(0, plane.length)), Array.from(plane));
  const shell = applyModifier(cube, { type: 'solidify', thickness: 0.1 });
  assert.ok(shell.length >= cube.length * 2);
  assert.ok(finite(shell));
  assert.throws(() => solidifyTriangleMesh([0, 0, 0], {}), /triangle-soup/i);
});

test('new constructive modifiers normalize and evaluate through the ordered stack', () => {
  assert.deepEqual({ count: normalizeModifier({ type: 'array', count: 99 }).count, offsetX: normalizeModifier({ type: 'array' }).offsetX }, { count: 32, offsetX: 2 });
  assert.deepEqual({ thickness: normalizeModifier({ type: 'solidify', thickness: 99 }).thickness, offset: normalizeModifier({ type: 'solidify', offset: -9 }).offset }, { thickness: 10, offset: -1 });
  const output = evaluateModifierStack(cube, [{ type: 'array', count: 3, offsetX: 2 }, { type: 'solidify', thickness: 0.1 }]);
  assert.ok(output.finalTriangles > cube.length / 9 * 3);
  assert.equal(output.results.length, 2);
  assert.ok(finite(output.geometry));
});


test('Bevel modifier creates chamfer strips and corner caps without mutating the source mesh', async () => {
  const { bevelTriangleMesh } = await import('../src/studio/meshEdit.js');
  const original = Array.from(cube);
  const result = bevelTriangleMesh(cube, { width: 0.08 });
  assert.equal(result.bevelledFaces, 6);
  assert.equal(result.bevelledEdges, 12);
  assert.equal(result.vertexCaps, 8);
  assert.equal(result.triangleCount, 44);
  assert.equal(result.geometry.length / 9, 44);
  assert.ok(finite(result.geometry));
  const unique = new Set(); for (let i = 0; i < result.geometry.length; i += 3) unique.add(`${Math.round(result.geometry[i] * 1e5)},${Math.round(result.geometry[i + 1] * 1e5)},${Math.round(result.geometry[i + 2] * 1e5)}`);
  assert.equal(unique.has('-50000,-50000,-50000'), false, 'the original sharp corner should be replaced by bevel corner geometry');
  assert.deepEqual(Array.from(cube), original);
  assert.equal(normalizeModifier({ type: 'bevel', width: 8 }).width, 0.35);
  const stack = evaluateModifierStack(cube, [{ type: 'bevel', width: 0.08 }]);
  assert.equal(stack.results[0].type, 'bevel');
  assert.equal(stack.finalTriangles, 44);
});

test('Bevel modifier respects disable state and reports unsafe topology clearly', async () => {
  const { bevelTriangleMesh } = await import('../src/studio/meshEdit.js');
  const disabled = applyModifier(cube, { type: 'bevel', enabled: false, width: 0.1 });
  assert.deepEqual(Array.from(disabled), Array.from(cube));
  assert.throws(() => bevelTriangleMesh([0, 1, 2], { width: 0.1 }), /triangle geometry/i);
});
