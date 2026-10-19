import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePlanarUVs, sculptTriangleMesh, createBasicRig, bakeRigPose, validateUVs, bakeTriangleMeshTransform, joinTriangleMeshes } from '../src/studio/modeling.js';

const triangle = [-1, 0, 0, 1, 0, 0, 0, 1, 0];

test('planar UV generation emits normalized UV coordinates for every vertex', () => {
  const uv = generatePlanarUVs(triangle);
  assert.equal(uv.length, 6);
  assert.ok(uv.every(v => v >= 0 && v <= 1));
  assert.equal(validateUVs(uv, 3), true);
  assert.throws(() => validateUVs([0, 1], 3), /two finite values/);
});

test('box-projected UV atlas separates cube faces into padded non-overlapping face tiles', async () => {
  const { createMeshGeometry } = await import('../src/studio/scene3d.js');
  const cube = createMeshGeometry('cube');
  const uv = generatePlanarUVs(cube);
  assert.equal(uv.length, cube.length / 3 * 2);
  assert.ok(uv.every(value => value >= 0 && value <= 1));
  const tiles = new Set();
  for (let i = 0; i < uv.length; i += 6) {
    const u = (uv[i] + uv[i + 2] + uv[i + 4]) / 3;
    const v = (uv[i + 1] + uv[i + 3] + uv[i + 5]) / 3;
    tiles.add(`${Math.floor(Math.min(0.999999, u) * 3)},${Math.floor(Math.min(0.999999, v) * 2)}`);
    const triU = [uv[i], uv[i + 2], uv[i + 4]], triV = [uv[i + 1], uv[i + 3], uv[i + 5]];
    assert.ok(Math.max(...triU) - Math.min(...triU) <= 1 / 3);
    assert.ok(Math.max(...triV) - Math.min(...triV) <= 1 / 2);
  }
  assert.equal(tiles.size, 6);
});

test('sculpt brush changes nearby vertices and leaves far vertices alone', () => {
  const source = [...triangle, 10, 10, 10, 11, 10, 10, 10, 11, 10];
  const result = sculptTriangleMesh(source, { mode: 'raise', center: { x: 0, y: 0, z: 0 }, radius: 2, strength: 0.2 });
  assert.ok(result.changedVertices >= 3);
  assert.ok(result.geometry[1] > source[1]);
  assert.deepEqual(result.geometry.slice(9), source.slice(9));
  assert.throws(() => sculptTriangleMesh(source, { radius: 0.01 }), /did not touch/);
});

test('basic biped rig has stable bone weights and pose baking changes weighted vertices', () => {
  const geometry = [];
  for (const y of [-1, -0.5, 0, 0.5, 1]) geometry.push(-0.4, y, 0, 0.4, y, 0, 0, y, 0.1);
  const rig = createBasicRig(geometry);
  assert.equal(rig.bones.length, 7);
  assert.equal(rig.weights.length, geometry.length / 3);
  const posed = bakeRigPose(geometry, rig, 'leftArm', { z: 0.6 });
  assert.ok(posed.affectedVertices > 0);
  assert.equal(posed.geometry.length, geometry.length);
  assert.notDeepEqual(posed.geometry, geometry);
  assert.throws(() => bakeRigPose(geometry, rig, 'unknown', {}), /Unknown rig bone/);
});

test('weight painting creates normalized multi-bone weights and affects only the brush region', async () => {
  const { paintRigWeights, evaluateRigSkin, createAnimationClip, sampleAnimationClip, applyAnimationClip } = await import('../src/studio/modeling.js');
  const geometry = [];
  for (const y of [-1, -0.5, 0, 0.5, 1]) geometry.push(-0.4, y, 0, 0.4, y, 0, 0, y, 0.1);
  const rig = createBasicRig(geometry);
  const painted = paintRigWeights(geometry, rig, 'leftArm', { center: { x: -0.4, y: 0.5, z: 0 }, radius: 0.8, strength: 0.5 });
  assert.ok(painted.changedVertices > 0);
  assert.ok(painted.rig.vertexWeights.some(entries => entries.length > 1));
  for (const entries of painted.rig.vertexWeights) assert.ok(Math.abs(entries.reduce((sum, entry) => sum + entry.weight, 0) - 1) < 1e-8);
  painted.rig.bones.find(b => b.name === 'leftArm').pose.z = 0.3;
  const skinned = evaluateRigSkin(geometry, painted.rig);
  assert.ok(skinned.affectedVertices > 0);
  assert.equal(skinned.geometry.length, geometry.length);
});

test('keyframed animation clips interpolate and can produce skinned geometry without losing the rest mesh', async () => {
  const { createAnimationClip, sampleAnimationClip, applyAnimationClip } = await import('../src/studio/modeling.js');
  const geometry = [-0.3, -1, 0, 0.3, -1, 0, 0, 1, 0, -0.3, 0, 0, 0.3, 0, 0, 0, 1, 0];
  const rig = createBasicRig(geometry);
  const clip = createAnimationClip(rig, 'Test Walk', { head: [{time:0,pose:{z:-0.5}},{time:1,pose:{z:0.5}}] }, 1);
  assert.ok(Math.abs(sampleAnimationClip(clip, 0.5).poses.head.z) < 1e-8);
  const result = applyAnimationClip(geometry, rig, clip, 0);
  assert.equal(result.geometry.length, geometry.length);
  assert.deepEqual(result.rig.restGeometry, geometry);
  assert.notDeepEqual(result.geometry, geometry);
});


test('applying a transform bakes rotation and scale but preserves position unless translation is requested', () => {
  const source = [-1, 0, 0, 1, 0, 0, 0, 1, 0];
  const object = { position: { x: 5, y: 2, z: -3 }, rotation: { x: 0, y: 0, z: Math.PI / 2 }, scale: { x: 2, y: 2, z: 1 }, size: 1 };
  const local = bakeTriangleMeshTransform(source, object);
  assert.ok(Math.abs(local[0]) < 1e-8 && Math.abs(local[1] + 2) < 1e-8);
  assert.ok(Math.abs(local[3]) < 1e-8 && Math.abs(local[4] - 2) < 1e-8);
  const world = bakeTriangleMeshTransform(source, object, { includeTranslation: true });
  assert.ok(Math.abs(world[0] - 5) < 1e-8 && Math.abs(world[1]) < 1e-8);
  assert.ok(Math.abs(world[3] - 5) < 1e-8 && Math.abs(world[4] - 4) < 1e-8);
});

test('joining meshes bakes world transforms and returns bounded combined triangle geometry', () => {
  const triangleA = { name: 'A', geometry: [...triangle], position: { x: 2, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, rotation: { x: 0, y: 0, z: 0 }, size: 1 };
  const triangleB = { name: 'B', geometry: [...triangle], position: { x: -2, y: 0, z: 0 }, scale: { x: 2, y: 1, z: 1 }, rotation: { x: 0, y: 0, z: 0 }, size: 1 };
  const merged = joinTriangleMeshes([triangleA, triangleB]);
  assert.equal(merged.objectCount, 2);
  assert.equal(merged.vertexCount, 6);
  assert.equal(merged.triangleCount, 2);
  assert.deepEqual(merged.geometry.slice(0, 3), [1, 0, 0]);
  assert.deepEqual(merged.geometry.slice(9, 12), [-4, 0, 0]);
  assert.throws(() => joinTriangleMeshes([triangleA]), /at least two/);
  assert.throws(() => joinTriangleMeshes([triangleA, triangleB], { maxFloats: 9 }), /editor limit/);
});

test('sculpting supports X-symmetry and grab brush, while UV island unwrapping and animation clip blending work', async () => {
  const { unwrapMeshUVIslands, inspectUVLayout, blendAnimationClips, sculptTriangleMesh, createBasicRig } = await import('../src/studio/modeling.js');
  const cube = [
    -1,0,0, -0.5,0.5,0, -0.5,0,0.5,
     1,0,0,  0.5,0.5,0,  0.5,0,0.5,
  ];
  const sym = sculptTriangleMesh(cube, { center: { x: 0.75, y: 0.2, z: 0.2 }, radius: 0.8, strength: 0.25, mode: 'grab', delta: { x: 0, y: 0.4, z: 0 }, symmetryX: true });
  assert.ok(sym.changedVertices >= 2);
  assert.ok(sym.geometry[1] > 0 && sym.geometry[10] > 0, 'both +X and mirrored -X sides should be displaced by symmetryX grab brush');

  const unwrapped = unwrapMeshUVIslands(cube, { margin: 0.04 });
  assert.equal(unwrapped.uvs.length, (cube.length / 3) * 2);
  assert.ok(unwrapped.islandCount >= 1);
  const uvStats = inspectUVLayout(unwrapped.uvs, cube);
  assert.equal(uvStats.outOfBoundsCount, 0);
  assert.ok(uvStats.coverage > 0);

  const rig = createBasicRig(cube);
  const clipA = { duration: 1, tracks: { head: [{ time: 0, pose: { x: 0, y: 0, z: 0 } }, { time: 1, pose: { x: 0.4, y: 0, z: 0 } }] } };
  const clipB = { duration: 1, tracks: { head: [{ time: 0, pose: { x: 0, y: 0, z: 0 } }, { time: 1, pose: { x: 0, y: 0.8, z: 0 } }] } };
  const blended = blendAnimationClips(cube, rig, clipA, clipB, 0.5, 0.5);
  assert.equal(blended.geometry.length, cube.length);
  assert.equal(blended.blendFactor, 0.5);
});

