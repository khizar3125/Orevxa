import test from 'node:test';
import assert from 'node:assert/strict';
import { exportGLB, importGLTF, exportFBX, importFBX } from '../src/studio/assetFormats.js';

const mesh = { type: 'mesh', name: 'Triangle Hero', position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0.3, z: 0 }, scale: { x: 1, y: 2, z: 1 }, size: 1, color: '#f06a9b', material: { metallic: 0.4, roughness: 0.2 }, geometry: [0,0,0,1,0,0,0,1,0] };

test('GLB export produces a version-2 binary and import reconstructs positions, UVs and material', () => {
  const bytes = exportGLB(mesh);
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(data.getUint32(0, true), 0x46546c67);
  assert.equal(data.getUint32(4, true), 2);
  assert.equal(data.getUint32(8, true), bytes.length);
  const result = importGLTF(bytes, 'hero.glb');
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Triangle Hero');
  assert.equal(result[0].geometry.length, 9);
  assert.equal(result[0].uvs.length, 6);
  assert.equal(result[0].position.x, 1);
  assert.equal(result[0].material.metallic, 0.4);
});

test('GLB import rejects wrong magic and truncated chunks', () => {
  assert.throws(() => importGLTF(new Uint8Array(32)), /wrong magic/);
  const bytes = exportGLB(mesh).slice(0, 30);
  assert.throws(() => importGLTF(bytes), /declared length/);
});

test('ASCII FBX export and import round-trip a triangle mesh', () => {
  const text = exportFBX(mesh);
  assert.match(text, /FBXVersion: 7400/);
  assert.match(text, /PolygonVertexIndex/);
  const result = importFBX(text, 'roundtrip.fbx');
  assert.equal(result.length, 1);
  assert.equal(result[0].geometry.length, 9);
  assert.equal(result[0].name, 'roundtrip');
});

test('FBX rejects binary and malformed arrays clearly', () => {
  assert.throws(() => importFBX('Kaydara FBX Binary  \0'), /Binary FBX/);
  assert.throws(() => importFBX('not an FBX'), /Vertices array/);
});


test('GLB PBR texture channels round-trip through standard glTF material slots', () => {
  const pixel = 'data:image/png;base64,iVBORw0KGgo=';
  const asset = { ...mesh, material: { metallic: 0.6, roughness: 0.35, emissive: 0.8, emissiveTint: [1, 0.5, 0.25], aoStrength: 0.35, normalScale: 0.65, baseColorImage: pixel, metallicRoughnessImage: pixel, aoImage: pixel, emissiveImage: pixel, normalImage: pixel } };
  const bytes = exportGLB(asset);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)).trim());
  const material = gltf.materials[0];
  assert.ok(material.pbrMetallicRoughness.baseColorTexture);
  assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture);
  assert.ok(material.occlusionTexture);
  assert.ok(material.emissiveTexture);
  assert.ok(material.normalTexture);
  assert.equal(material.occlusionTexture.strength, 0.35);
  assert.equal(material.normalTexture.scale, 0.65);
  assert.deepEqual(material.emissiveFactor, [0.8, 0.4, 0.2]);
  assert.equal(gltf.images.length, 5);
  const [roundTrip] = importGLTF(bytes, 'channels.glb');
  for (const field of ['baseColorImage', 'metallicRoughnessImage', 'aoImage', 'emissiveImage', 'normalImage']) assert.equal(roundTrip.material[field], pixel, `${field} survives round trip`);
  assert.equal(roundTrip.material.aoStrength, 0.35);
  assert.equal(roundTrip.material.normalScale, 0.65);
  assert.deepEqual(roundTrip.material.emissiveTint, [1, 0.5, 0.25]);
});

test('GLB export/import preserves emission intensity above one with the glTF emissive-strength extension', () => {
  const asset = { ...mesh, material: { emissive: 1.6, emissiveTint: [1, 0.5, 0.25] } };
  const bytes = exportGLB(asset);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)).trim());
  assert.ok(gltf.extensionsUsed.includes('KHR_materials_emissive_strength'));
  assert.equal(gltf.materials[0].extensions.KHR_materials_emissive_strength.emissiveStrength, 1.6);
  assert.deepEqual(gltf.materials[0].emissiveFactor, [1, 0.5, 0.25]);
  const [roundTrip] = importGLTF(bytes, 'emissive-strength.glb');
  assert.equal(roundTrip.material.emissive, 1.6);
  assert.deepEqual(roundTrip.material.emissiveTint, [1, 0.5, 0.25]);
});

test('GLB export/import round-trips Material Lab graphs, clearcoat, collisionMode, gameplayRole, and loreText via extras and validates mesh integrity', async () => {
  const { validateMeshAsset } = await import('../src/studio/assetFormats.js');
  const richAsset = {
    ...mesh,
    collisionMode: 'platform',
    gameplayRole: 'lore-shrine',
    loreText: 'Inscribed by the First Keepers of Windmere.',
    material: {
      metallic: 0.75,
      roughness: 0.2,
      clearcoat: 0.85,
      materialGraph: { name: 'Relic Shader', nodes: [{ id: 'out', type: 'pbr-output', params: {} }], connections: [] },
    },
  };
  const check = validateMeshAsset(richAsset);
  assert.equal(check.ok, true);
  assert.equal(check.triangleCount, 1);

  const bytes = exportGLB(richAsset);
  const [roundTrip] = importGLTF(bytes, 'relic-shrine.glb');
  assert.equal(roundTrip.collisionMode, 'platform');
  assert.equal(roundTrip.gameplayRole, 'lore-shrine');
  assert.equal(roundTrip.loreText, 'Inscribed by the First Keepers of Windmere.');
  assert.equal(roundTrip.material.clearcoat, 0.85);
  assert.equal(roundTrip.material.materialGraph.name, 'Relic Shader');
});

