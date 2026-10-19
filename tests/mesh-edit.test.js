import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeshGeometry } from '../src/studio/scene3d.js';
import {
  coplanarTriangleRegion,
  extrudeTriangleFaces,
  insetTriangleFaces,
  meshEdgeKey,
  meshVertexKey,
  translateMeshElements,
  inspectMeshTopology,
  deleteSelectedFaces,
  weldMeshVertices,
  splitSelectedEdges,
  flipMeshNormals,
  recalculateMeshNormals,
} from '../src/studio/meshEdit.js';

const cube = createMeshGeometry('cube');
const finite = geometry => Array.from(geometry).every(Number.isFinite);

test('mesh vertex and edge keys weld triangle-soup corners deterministically', () => {
  assert.equal(meshVertexKey([1, 2, 3]), meshVertexKey([1.000001, 2, 3]));
  assert.equal(meshEdgeKey([1, 2, 3], [4, 5, 6]), meshEdgeKey([4, 5, 6], [1, 2, 3]));
});

test('component translation moves welded vertices throughout adjacent triangles', () => {
  const key = meshVertexKey([-0.5, -0.5, -0.5]);
  const result = translateMeshElements(cube, { mode: 'vertex', vertices: [key] }, { x: 0, y: 0.5, z: 0 });
  assert.equal(result.geometry.length, cube.length);
  assert.ok(result.affectedCorners >= 3, 'all triangle-soup duplicates of the corner should move');
  assert.ok(finite(result.geometry));
  assert.notDeepEqual(Array.from(result.geometry), Array.from(cube));
  assert.throws(() => translateMeshElements(cube, { mode: 'vertex', vertices: [] }, { x: 1 }), /select at least one/i);
  assert.throws(() => translateMeshElements(cube, { mode: 'face', faces: [0] }, { x: 0, y: 0, z: 0 }), /non-zero/i);
});

test('face extrusion creates a translated cap and side-wall topology while preserving unselected faces', () => {
  const result = extrudeTriangleFaces(cube, [0], 0.3);
  assert.equal(result.extrudedFaces, 1);
  assert.equal(result.sideTriangles, 6);
  assert.equal(result.triangleCount, cube.length / 9 + 6);
  assert.equal(result.geometry.length / 9, cube.length / 9 + 6);
  assert.ok(finite(result.geometry));
  assert.throws(() => extrudeTriangleFaces(cube, [], 0.3), /select one or more/i);
  assert.throws(() => extrudeTriangleFaces(cube, [0], 0), /non-zero/i);
});

test('inset builds an inner face and six ring triangles per selected triangle', () => {
  const result = insetTriangleFaces(cube, [1], 0.2);
  assert.equal(result.insetFaces, 1);
  assert.equal(result.triangleCount, cube.length / 9 + 6);
  assert.equal(result.geometry.length / 9, cube.length / 9 + 6);
  assert.ok(finite(result.geometry));
  assert.throws(() => insetTriangleFaces(cube, [], 0.2), /select one or more/i);
});

test('mesh-edit operations reject invalid and non-finite geometry', () => {
  assert.throws(() => extrudeTriangleFaces([0, 1, 2], [0], 0.2), /triangle geometry/i);
  const invalid = [...cube]; invalid[0] = Number.NaN;
  assert.throws(() => insetTriangleFaces(invalid, [0], 0.2), /non-finite/i);
});


test('coplanar face selection groups both triangles of a square primitive face', () => {
  const region = coplanarTriangleRegion(cube, 0);
  assert.equal(region.length, 2, 'a triangulated square surface should select as one face region');
  assert.ok(region.includes(0));
  assert.ok(region.includes(1));
  assert.throws(() => coplanarTriangleRegion(cube, -1), /outside this mesh/i);
});

test('extruding a selected quad region creates side walls only around its four-edge boundary', () => {
  const region = coplanarTriangleRegion(cube, 0);
  const result = extrudeTriangleFaces(cube, region, 0.25);
  assert.equal(result.extrudedFaces, 2);
  assert.equal(result.sideTriangles, 8);
  assert.equal(result.triangleCount, cube.length / 9 + 8);
  assert.ok(finite(result.geometry));
});

test('insetting a coplanar quad region creates a two-triangle inner quad and four border strips', () => {
  const region = coplanarTriangleRegion(cube, 0);
  const result = insetTriangleFaces(cube, region, 0.15);
  assert.equal(result.insetFaces, 2);
  assert.equal(result.insetRegions, 1);
  assert.equal(result.triangleCount, cube.length / 9 + 8);
  assert.ok(finite(result.geometry));
  assert.notDeepEqual(Array.from(result.geometry), Array.from(cube));
});

test('topology inspection, welding, edge splitting, face deletion and normal tools operate on triangle meshes', () => {
  const report = inspectMeshTopology(cube);
  assert.equal(report.triangleCount, 12);
  assert.equal(report.weldedVertexCount, 8);
  assert.equal(report.boundaryEdges, 0);
  assert.equal(report.isWatertight, true);

  const deleted = deleteSelectedFaces(cube, [0, 1]);
  assert.equal(deleted.deletedFaces, 2);
  assert.equal(deleted.triangleCount, 10);
  assert.equal(inspectMeshTopology(deleted.geometry).isWatertight, false);

  const noisy = [...cube];
  noisy[0] += 0.0004;
  const welded = weldMeshVertices(noisy, 0.005);
  assert.ok(welded.weldedCount >= 1);
  assert.equal(welded.triangleCount, 12);

  const edgeKey = meshEdgeKey(cube.slice(0, 3), cube.slice(3, 6));
  const split = splitSelectedEdges(cube, [edgeKey]);
  assert.ok(split.splitFaces >= 1);
  assert.ok(split.triangleCount > 12);

  const flipped = flipMeshNormals(cube, [0]);
  assert.equal(flipped.flippedFaces, 1);
  const recalc = recalculateMeshNormals(flipped.geometry);
  assert.ok(recalc.correctedFaces >= 1);
});

