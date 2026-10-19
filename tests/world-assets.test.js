import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldAssetPackage, normalizeWorldAssetPackage, transformWorldAssetVertex, WORLD_ASSET_SCHEMA } from '../src/studio/worldAssets.js';

const cube = {
  engineId: 'cube-test', name: 'Test Cube', type: 'mesh', visible: true,
  geometry: [-.5,-.5,-.5,.5,-.5,-.5,0,.5,0],
  position: { x: 10, y: 2, z: -3 }, rotation: { x: 0, y: Math.PI / 2, z: 0 },
  scale: { x: 2, y: 1, z: 1 }, size: 1,
  color: '#80aa70', material: { metallic: .4, roughness: .3, emissive: .2 },
};

test('Modeler exports selected visible meshes as a bounded Aetherfall world package', () => {
  const pack = createWorldAssetPackage([cube, { ...cube, engineId: 'hidden', visible: false }], new Set(['cube-test', 'hidden']));
  assert.equal(pack.schema, WORLD_ASSET_SCHEMA);
  assert.equal(pack.assets.length, 1);
  assert.equal(pack.assets[0].name, 'Test Cube');
  assert.equal(pack.assets[0].material.metallic, .4);
  assert.equal(pack.assets[0].geometry.length, 9);
});

test('world asset package rejects malformed/oversized geometry before the renderer sees it', () => {
  assert.throws(() => createWorldAssetPackage([cube], []), /Select one or more/);
  assert.throws(() => normalizeWorldAssetPackage({ schema: WORLD_ASSET_SCHEMA, version: 1, assets: [{ geometry: [0, 0, NaN, 1, 1, 1, 0, 0, 0] }] }), /invalid geometry/);
  assert.throws(() => normalizeWorldAssetPackage({ schema: WORLD_ASSET_SCHEMA, version: 1, assets: Array(25).fill({ geometry: [0,0,0,1,0,0,0,1,0] }) }), /too many/);
});

test('world asset transforms preserve renderer rotation order and non-uniform scale', () => {
  const p = transformWorldAssetVertex([1, 0, 0], cube);
  assert.ok(Math.abs(p[0] - 10) < 1e-9);
  assert.ok(Math.abs(p[1] - 2) < 1e-9);
  assert.ok(Math.abs(p[2] + 5) < 1e-9);
});

test('world asset package preserves collisionMode, gameplayRole, loreText and extended PBR material metadata', async () => {
  const { createWorldAssetPackage } = await import('../src/studio/worldAssets.js');
  const { createMeshGeometry } = await import('../src/studio/scene3d.js');
  const cube = createMeshGeometry('cube');
  const pkg = createWorldAssetPackage([
    {
      engineId: 'shrine_1',
      name: 'Sunstone Shrine',
      type: 'mesh',
      visible: true,
      geometry: cube.slice(0, 36),
      collisionMode: 'none',
      gameplayRole: 'lore-shrine',
      loreText: 'When the three rivers meet, the Spire shall answer.',
      material: { metallic: 0.7, roughness: 0.2, clearcoat: 0.9, materialGraph: { name: 'Shrine Graph' } },
    },
  ], ['shrine_1']);
  assert.equal(pkg.assets.length, 1);
  assert.equal(pkg.assets[0].collisionMode, 'none');
  assert.equal(pkg.assets[0].gameplayRole, 'lore-shrine');
  assert.equal(pkg.assets[0].loreText, 'When the three rivers meet, the Spire shall answer.');
  assert.equal(pkg.assets[0].material.clearcoat, 0.9);
  assert.equal(pkg.assets[0].material.materialGraph.name, 'Shrine Graph');
});

