import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIAL_NODE_TYPES,
  MATERIAL_GRAPH_PRESETS,
  createMaterialGraph,
  validateMaterialGraph,
  evaluateMaterialGraphAtUV,
  encodeRgbaToPngDataUrl,
  compileMaterialGraphToPBR,
  buildPresetMaterialGraph,
} from '../src/studio/materialGraph.js';

test('Material Lab validates default and preset material node graphs', () => {
  const base = createMaterialGraph({ name: 'Test Shader' });
  const check = validateMaterialGraph(base);
  assert.equal(check.ok, true);
  assert.equal(check.diagnostics.length, 0);
  assert.ok(Object.keys(MATERIAL_NODE_TYPES).length >= 10);

  for (const presetId of Object.keys(MATERIAL_GRAPH_PRESETS)) {
    const graph = buildPresetMaterialGraph(presetId);
    const validation = validateMaterialGraph(graph);
    assert.equal(validation.ok, true, `Preset ${presetId} failed validation: ${validation.diagnostics.map(d => d.message).join(', ')}`);
  }
});

test('Material Lab detects directed cycles and incompatible port types', () => {
  const cyclic = {
    nodes: [
      { id: 'a', type: 'math', params: { op: 'add', b: 0.5 } },
      { id: 'b', type: 'math', params: { op: 'multiply', b: 2.0 } },
      { id: 'out', type: 'materialOutput', params: {} },
    ],
    connections: [
      { from: 'a', fromPort: 'value', to: 'b', toPort: 'a' },
      { from: 'b', fromPort: 'value', to: 'a', toPort: 'a' },
      { from: 'b', fromPort: 'value', to: 'out', toPort: 'roughness' },
    ],
  };
  const cycleCheck = validateMaterialGraph(cyclic);
  assert.equal(cycleCheck.ok, false);
  assert.ok(cycleCheck.diagnostics.some(d => d.code === 'CYCLE_DETECTED'));

  const badPort = {
    nodes: [
      { id: 'uv', type: 'uv', params: {} },
      { id: 'out', type: 'materialOutput', params: {} },
    ],
    connections: [
      { from: 'uv', fromPort: 'nonExistentPort', to: 'out', toPort: 'baseColor' },
    ],
  };
  const portCheck = validateMaterialGraph(badPort);
  assert.equal(portCheck.ok, false);
  assert.ok(portCheck.diagnostics.some(d => d.code === 'INVALID_SOURCE_PORT'));
});

test('Material Lab compiles presets into PBR parameters and valid PNG data URLs', () => {
  const graph = buildPresetMaterialGraph('emerald-crystal');
  const sample = evaluateMaterialGraphAtUV(graph, 0.35, 0.65);
  assert.equal(sample.baseColor.length, 3);
  assert.ok(sample.roughness >= 0 && sample.roughness <= 1);
  assert.ok(sample.clearcoat >= 0 && sample.clearcoat <= 1);

  const compiled = compileMaterialGraphToPBR(graph, { resolution: 16 });
  assert.match(compiled.color, /^#[0-9a-f]{6}$/i);
  assert.match(compiled.material.baseColorImage, /^data:image\/png;base64,/);
  assert.match(compiled.material.metallicRoughnessImage, /^data:image\/png;base64,/);
  assert.match(compiled.material.normalImage, /^data:image\/png;base64,/);

  const pngUrl = encodeRgbaToPngDataUrl(8, 8, new Uint8Array(8 * 8 * 4).fill(200));
  const raw = Buffer.from(pngUrl.split(',')[1], 'base64');
  assert.deepEqual([...raw.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
