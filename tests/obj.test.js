import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOBJ, exportOBJ, createMeshGeometry, scene3dCapabilities } from '../src/studio/scene3d.js';

const TRIANGLE = `# triangle\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n`;

test('OBJ importer triangulates a basic face and normalizes its mesh', () => {
  const mesh = parseOBJ(TRIANGLE, 'triangle.obj');
  assert.equal(mesh.type, 'mesh');
  assert.equal(mesh.name, 'triangle');
  assert.equal(mesh.sourceVertexCount, 3);
  assert.equal(mesh.triangleCount, 1);
  assert.equal(mesh.geometry.length, 9);
  assert.ok(mesh.geometry.every(Number.isFinite));
});

test('OBJ importer supports negative indices and triangulates quads', () => {
  const mesh = parseOBJ('v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf -4 -3 -2 -1');
  assert.equal(mesh.triangleCount, 2);
  assert.equal(mesh.geometry.length, 18);
});

test('OBJ importer rejects invalid indices, malformed vertices and oversized source', () => {
  assert.throws(() => parseOBJ('v 0 0 0\nf 1 2 3'), /missing vertex/);
  assert.throws(() => parseOBJ('v a 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3'), /finite numbers/);
  assert.throws(() => parseOBJ('x'.repeat(5_000_001)), /5 MB/);
});

test('OBJ exporter produces faces for imported and procedural mesh data', () => {
  const mesh = parseOBJ(TRIANGLE, 'triangle.obj');
  const exported = exportOBJ(mesh);
  assert.match(exported, /^# Exported by Orvexa Forge/m);
  assert.match(exported, /^f 1 2 3$/m);
  const cube = { type: 'mesh', name: 'cube', geometry: Array.from(createMeshGeometry('cube')) };
  assert.match(exportOBJ(cube), /^f 1 2 3$/m);
  assert.equal(scene3dCapabilities.formatsImported.includes('OBJ'), true);
  const transformed = exportOBJ({ ...cube, position: {x:2,y:3,z:4}, rotation: {x:0,y:0,z:Math.PI/2}, scale: {x:2,y:1,z:1} });
  assert.match(transformed, /v 2\.500000 2\.000000 3\.500000/);
});

test('OBJ exporter rejects malformed geometry', () => {
  assert.throws(() => exportOBJ({ type: 'mesh', geometry: [1, 2, NaN] }), /valid imported mesh/);
});
