import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceControllers, advancePhysics, countSceneStats, createEngineObject, createRigidBody, mirrorTriangleMesh, mirrorDuplicateTriangleMesh, normalizeEngineObject, subdivideTriangleMesh, createProceduralTerrainGeometry, optimizeTriangleMesh } from '../src/studio/engine.js';

test('engine object factory supplies bounded transform and material defaults', () => {
  const object = createEngineObject('sphere', 2);
  assert.equal(object.type, 'sphere');
  assert.equal(object.material.roughness, 0.68);
  assert.equal(object.material.clearcoat, 0);
  assert.equal(object.rigidBody.enabled, false);
  assert.deepEqual(normalizeEngineObject({ ...object, scale: { x: 0, y: 300, z: 1 } }).scale, { x: 0.01, y: 100, z: 1 });
});

test('rigid body clamps dangerous physical values', () => {
  const body = createRigidBody({ mass: -12, restitution: 3, friction: -1, velocity: { x: 1e9 } });
  assert.equal(body.mass, 0.01);
  assert.equal(body.restitution, 1);
  assert.equal(body.friction, 0);
  assert.equal(body.velocity.x, 1e9);
});

test('physics integrates gravity and resolves a falling body on a plane', () => {
  const floor = createEngineObject('plane', 1); floor.position.y = 0; floor.size = 10; floor.rigidBody = createRigidBody({ enabled: false });
  const ball = createEngineObject('sphere', 2); ball.position.y = 0.75; ball.size = 0.5; ball.rigidBody = createRigidBody({ enabled: true, restitution: 0 });
  const scene = { objects: [floor, ball] };
  const initial = ball.position.y;
  const step = advancePhysics(scene, 0.05, { gravity: 9.81, collisions: true });
  assert.ok(ball.position.y < initial);
  assert.equal(step.moved, 1);
  for (let i = 0; i < 100; i++) advancePhysics(scene, 0.05, { gravity: 9.81, collisions: true });
  assert.ok(ball.position.y >= 0.25);
  assert.ok(ball.position.y < 0.4);
});

test('physics clamps delta and can run with collisions disabled', () => {
  const box = createEngineObject('cube', 1); box.rigidBody = createRigidBody({ enabled: true });
  const scene = { objects: [box] };
  const out = advancePhysics(scene, 3, { gravity: 9.81, collisions: false });
  assert.equal(out.moved, 1);
  assert.ok(box.position.y >= -0.2 && box.position.y <= 0);
});

test('dynamic bodies collide with each other and integrate angular velocity with damping', () => {
  const a = createEngineObject('sphere', 1); a.size = 0.5; a.position = { x: -0.15, y: 0, z: 0 };
  a.rigidBody = createRigidBody({ enabled: true, useGravity: false, velocity: { x: 1, y: 0, z: 0 }, angularVelocity: { z: 2 }, linearDamping: 0.1 });
  const b = createEngineObject('sphere', 2); b.size = 0.5; b.position = { x: 0.15, y: 0, z: 0 };
  b.rigidBody = createRigidBody({ enabled: true, useGravity: false, velocity: { x: -1, y: 0, z: 0 } });
  const out = advancePhysics({ objects: [a, b] }, 1 / 60, { gravity: 0, collisions: true });
  assert.ok(out.collisions > 0);
  assert.notEqual(a.rotation.z, 0);
  assert.ok(a.rigidBody.velocity.x < 1);
});

test('scene stats include primitives, meshes, and rigid bodies', () => {
  const mesh = createEngineObject('mesh', 1); mesh.geometry = Array(27).fill(0);
  const box = createEngineObject('cube', 2); box.rigidBody = createRigidBody({ enabled: true });
  assert.deepEqual(countSceneStats({ objects: [mesh, box] }), { objects: 2, vertices: 45, triangles: 15, dynamicBodies: 1 });
});


test('mesh subdivision quadruples triangle count and mirror flips local coordinates', () => {
  const triangle = [0,0,0, 1,0,0, 0,1,0];
  assert.equal(subdivideTriangleMesh(triangle).length, 36);
  assert.throws(() => subdivideTriangleMesh(triangle, 8), /safe editable-mesh limit/i);
  const mirrored = mirrorTriangleMesh(triangle, 'x');
  assert.equal(Math.abs(mirrored[0]), 0);
  assert.deepEqual(mirrored.slice(1, 3), [0,0]);
  assert.equal(Math.abs(mirrored[3]), 0);
  assert.equal(mirrored[6], -1);
  assert.throws(() => mirrorTriangleMesh(triangle, 'q'), /axis/i);
  const doubled = mirrorDuplicateTriangleMesh(triangle, 'x');
  assert.equal(doubled.length, 18);
  assert.equal(doubled[15], -1);
  assert.throws(() => mirrorDuplicateTriangleMesh(triangle, 'q'), /axis/i);
});

test('controller advances a player in the requested direction and handles jumps on grounded bodies', () => {
  const floor = createEngineObject('plane', 1); floor.position.y = 0; floor.size = 10; floor.rigidBody = createRigidBody({ enabled: false });
  const player = createEngineObject('sphere', 2); player.position.y = 0.25; player.size = 0.5; player.rigidBody = createRigidBody({ enabled: true }); player.controller = { speed: 4, jumpSpeed: 6 };
  const scene = { objects: [floor, player] };
  advanceControllers(scene, 0.1, new Set(['d']));
  assert.ok(player.position.x > 0);
  advanceControllers(scene, 0.1, new Set([' ']));
  assert.equal(player.rigidBody.velocity.y, 6);
  advanceControllers(scene, 0.1, new Set([' ']));
  assert.equal(player.rigidBody.velocity.y, 6);
});


test('camera and light scene metadata do not act as invisible physics colliders', () => {
  const camera = { type: 'camera', position: { x: 0.4, y: 0, z: 0 }, size: 1 };
  const body = createEngineObject('sphere', 2); body.position = { x: 0, y: 0, z: 0 }; body.rigidBody = createRigidBody({ enabled: true, useGravity: false });
  advancePhysics({ objects: [camera, body] }, 1 / 60, { gravity: 0, collisions: true });
  assert.equal(body.position.x, 0);
  assert.equal(body.position.y, 0);
});


test('sweep-and-prune keeps valid contacts when collider radii vary widely', () => {
  const small = createEngineObject('sphere', 1); small.size = 0.5; small.position = { x: 0, y: 0, z: 0 };
  small.rigidBody = createRigidBody({ enabled: true, useGravity: false });
  const middle = createEngineObject('sphere', 2); middle.size = 0.5; middle.position = { x: 12, y: 0, z: 0 };
  middle.rigidBody = createRigidBody({ enabled: true, useGravity: false });
  const large = createEngineObject('sphere', 3); large.size = 100; large.position = { x: 40, y: 0, z: 0 };
  large.rigidBody = createRigidBody({ enabled: true, useGravity: false });
  const result = advancePhysics({ objects: [small, middle, large] }, 1 / 60, { gravity: 0, collisions: true });
  assert.ok(result.collisions > 0, 'large object still overlaps the small object despite intervening X-axis candidates');
});


test('procedural terrain is deterministic, bounded, and produces upward-facing height variation', () => {
  const options = { width: 12, depth: 8, segments: 16, amplitude: 2, seed: 42 };
  const first = createProceduralTerrainGeometry(options);
  const second = createProceduralTerrainGeometry(options);
  assert.equal(first.length, 16 * 16 * 18);
  assert.deepEqual(first, second);
  assert.ok(first.every(Number.isFinite));
  const heights = [];
  for (let i = 1; i < first.length; i += 3) heights.push(first[i]);
  assert.ok(Math.max(...heights) > Math.min(...heights));
  assert.equal(createProceduralTerrainGeometry({ segments: 1000 }).length, 128 * 128 * 18, 'segment count is clamped to the safe maximum');
});

test('mesh optimizer removes degenerate and duplicate triangles while preserving valid geometry', () => {
  const triangle = [0,0,0, 1,0,0, 0,1,0];
  const reversedDuplicate = [0,1,0, 1,0,0, 0,0,0];
  const degenerate = [0,0,0, 1,0,0, 2,0,0];
  const result = optimizeTriangleMesh([...triangle, ...reversedDuplicate, ...degenerate]);
  assert.equal(result.beforeTriangles, 3);
  assert.equal(result.afterTriangles, 1);
  assert.equal(result.removedDuplicate, 1);
  assert.equal(result.removedDegenerate, 1);
  assert.deepEqual(Array.from(result.geometry), triangle);
  assert.throws(() => optimizeTriangleMesh([0, 1, 2]), /triangle-soup/i);
});
