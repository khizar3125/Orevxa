import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GEOMETRY_NODE_TYPES,
  GEOMETRY_NODE_PRESETS,
  validateGeometryNodeGraph,
  evaluateGeometryNodeGraph,
  buildPresetGeometryNodeGraph,
} from '../src/studio/geometryNodes.js';

test('Geometry Nodes validates all presets and rejects cyclic graphs', () => {
  assert.ok(Object.keys(GEOMETRY_NODE_TYPES).length >= 7);
  for (const presetId of Object.keys(GEOMETRY_NODE_PRESETS)) {
    const graph = buildPresetGeometryNodeGraph(presetId);
    const check = validateGeometryNodeGraph(graph);
    assert.equal(check.ok, true, `Preset ${presetId} failed validation: ${check.diagnostics.map(d => d.message).join(', ')}`);
  }

  const cyclic = {
    nodes: [
      { id: 't1', type: 'transformGeometry', params: {} },
      { id: 't2', type: 'transformGeometry', params: {} },
      { id: 'out', type: 'geometryOutput', params: {} },
    ],
    connections: [
      { from: 't1', fromPort: 'geometry', to: 't2', toPort: 'geometry' },
      { from: 't2', fromPort: 'geometry', to: 't1', toPort: 'geometry' },
      { from: 't2', fromPort: 'geometry', to: 'out', toPort: 'geometry' },
    ],
  };
  const bad = validateGeometryNodeGraph(cyclic);
  assert.equal(bad.ok, false);
  assert.ok(bad.diagnostics.some(d => d.code === 'CYCLE_DETECTED'));
});

test('Geometry Nodes deterministically evaluates surface scattering and instancing into triangle meshes', () => {
  for (const presetId of Object.keys(GEOMETRY_NODE_PRESETS)) {
    const graph = buildPresetGeometryNodeGraph(presetId);
    const resultA = evaluateGeometryNodeGraph(graph);
    const resultB = evaluateGeometryNodeGraph(graph);
    assert.ok(resultA.geometry.length >= 36, `Expected non-empty mesh for ${presetId}`);
    assert.equal(resultA.triangleCount, resultA.geometry.length / 9);
    assert.equal(resultA.vertexCount, resultA.geometry.length / 3);
    assert.deepEqual(Array.from(resultA.geometry), Array.from(resultB.geometry), 'Geometry node evaluation must be deterministic');
  }
});
