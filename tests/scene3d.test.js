import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLodSegments, computeRenderProfile, createLookAtMatrix, createMeshGeometry, normalizeLightSettings, normalizeShadowResolution, projectScenePoint, scene3dCapabilities, sceneObjectIdentity, selectRenderLights, sphereInCameraFrustum } from '../src/studio/scene3d.js';

test('WebGL primitive meshes contain finite triangle coordinates', () => {
  for (const type of ['cube', 'sphere', 'plane', 'cylinder', 'torus', 'cone', 'pyramid', 'capsule']) {
    const mesh = createMeshGeometry(type);
    assert.ok(mesh instanceof Float32Array, `${type} returns Float32Array`);
    assert.ok(mesh.length >= 18, `${type} has enough vertices`);
    assert.equal(mesh.length % 9, 0, `${type} is complete triangles`);
    assert.ok([...mesh].every(Number.isFinite), `${type} coordinates are finite`);
  }
});

test('WebGL geometry size remains bounded for supported segment counts', () => {
  const mesh = createMeshGeometry('sphere', 99999);
  assert.ok(mesh.length < 100_000);
  assert.equal(scene3dCapabilities.renderer, 'WebGL 1');
  assert.equal(scene3dCapabilities.orbitControls, true);
  assert.equal(scene3dCapabilities.maxLights, 4);
  assert.equal(scene3dCapabilities.shadows.includes('selectable single-light'), true);
  assert.deepEqual(scene3dCapabilities.formatsImported, ['OBJ','GLB','glTF embedded','ASCII FBX']);
});


test('mobile performance profiles bound render scale and select cheaper geometry', () => {
  const low = computeRenderProfile({ performanceMode: 'low' }, 3);
  const ultra = computeRenderProfile({ performanceMode: 'ultra' }, 3);
  assert.equal(low.segments, 8);
  assert.equal(low.shadows, false);
  assert.ok(Math.abs(low.pixelRatio - 0.58) < 1e-9);
  assert.equal(ultra.segments, 24);
  assert.equal(ultra.pixelRatio, 2);
  assert.equal(computeRenderProfile({ performanceMode: 'balanced', renderScale: 8 }, 1).scale, 1.25);
  assert.equal(computeRenderProfile({ performanceMode: 'unknown' }, 1).mode, 'balanced');
  assert.equal(scene3dCapabilities.adaptiveResolution, true);
});


test('distance LOD lowers mesh segment budgets for small/far screen contribution', () => {
  assert.equal(computeLodSegments(24, 2), 24);
  assert.ok(computeLodSegments(24, 12) < 24);
  assert.ok(computeLodSegments(24, 20) < computeLodSegments(24, 12));
  assert.equal(computeLodSegments(24, 100), 8);
});

test('camera frustum culling keeps in-view spheres and rejects far off-axis spheres', () => {
  const eye = [0, 0, 7];
  assert.equal(sphereInCameraFrustum({ x: 0, y: 0, z: 0 }, 1, eye, 1), true);
  assert.equal(sphereInCameraFrustum({ x: 100, y: 0, z: 0 }, 0.5, eye, 1), false);
  assert.equal(sphereInCameraFrustum({ x: 0, y: 0, z: 1000 }, 0.5, eye, 1), false);
});

test('camera frustum supports an off-origin focus target', () => {
  const target = [20, 5, -10];
  const eye = [20, 5, -3];
  assert.equal(sphereInCameraFrustum({ x: 20, y: 5, z: -10 }, 1, eye, 1, Math.PI / 4, 0.1, 500, target), true);
  assert.equal(sphereInCameraFrustum({ x: -80, y: 5, z: -10 }, 1, eye, 1, Math.PI / 4, 0.1, 500, target), false);
});

test('scene renderer advertises physically based shading and frame optimizations', () => {
  assert.match(scene3dCapabilities.pipeline, /GGX/);
  assert.equal(scene3dCapabilities.frustumCulling, true);
  assert.equal(scene3dCapabilities.distanceLOD, true);
  assert.equal(scene3dCapabilities.staticShadowCaching, true);
  assert.equal(scene3dCapabilities.demandRenderingWhenIdle, true);
  assert.equal(scene3dCapabilities.gpuMeshCacheLimit, 96);
  assert.equal(scene3dCapabilities.smoothImportedMeshNormals, true);
  assert.equal(scene3dCapabilities.focusSelectedAndFrameAll, true);
  assert.equal(scene3dCapabilities.persistentEditorCamera, true);
});

test('viewport projection centers the camera target and rejects points behind the camera', () => {
  const camera = { target: { x: 20, y: 5, z: -10 }, angle: 0.7, pitch: 0.25, zoom: 12 };
  const center = projectScenePoint(camera.target, camera, 800, 400);
  assert.ok(Math.abs(center.x - 400) < 1e-8);
  assert.ok(Math.abs(center.y - 200) < 1e-8);
  assert.equal(center.visible, true);
  assert.equal(projectScenePoint({ x: 20, y: 5, z: 100 }, camera, 800, 400), null);
  assert.equal(projectScenePoint({ x: 0, y: 0, z: 0 }, camera, 0, 400), null);
});

test('renderer exposes the real viewport translate gizmo capability', () => {
  assert.equal(scene3dCapabilities.viewportTranslateGizmo, true);
});


test('renderer declares all three viewport transform gizmo modes', () => {
  assert.deepEqual(scene3dCapabilities.viewportTransformGizmoModes, ['move', 'rotate', 'scale']);
  assert.equal(scene3dCapabilities.viewportRotationGizmo, true);
  assert.equal(scene3dCapabilities.viewportScaleGizmo, true);
});


test('real-time renderer normalizes point, directional and spot lights safely', () => {
  const point = normalizeLightSettings({ position: { x: 3, y: 4, z: 0 }, intensity: 99 });
  assert.equal(point.type, 'point');
  assert.equal(point.typeCode, 0);
  assert.equal(point.intensity, 12);
  assert.equal(point.range, 20);
  assert.equal(point.innerCone, 15);
  assert.equal(point.outerCone, 28);
  assert.ok(Math.abs(Math.hypot(...point.direction) - 1) < 1e-9);

  const clamped = normalizeLightSettings({ range: -50, innerCone: 88, outerCone: 3 });
  assert.equal(clamped.range, 0.1);
  assert.equal(clamped.innerCone, 88);
  assert.equal(clamped.outerCone, 89);
  const wide = normalizeLightSettings({ range: 900, innerCone: -10, outerCone: 90 });
  assert.equal(wide.range, 500);
  assert.equal(wide.innerCone, 0);
  assert.equal(wide.outerCone, 89);

  const directional = normalizeLightSettings({ lightType: 'directional', direction: { x: 0, y: -8, z: 0 } });
  assert.equal(directional.typeCode, 1);
  assert.deepEqual(directional.direction, [0, -1, 0]);

  const spot = normalizeLightSettings({ lightType: 'spot', position: { x: 0, y: 4, z: 0 } }, { x: 0, y: 0, z: 0 });
  assert.equal(spot.typeCode, 2);
  assert.deepEqual(spot.direction, [0, -1, 0]);
  assert.deepEqual(normalizeLightSettings({ direction: { x: 0, y: 0, z: 0 } }).direction, [0, -1, 0]);
  assert.deepEqual(scene3dCapabilities.lightTypes, ['point', 'directional', 'spot']);
});

test('shadow-map resolution is validated and capped to GPU texture limits', () => {
  assert.equal(normalizeShadowResolution(512, 4096), 512);
  assert.equal(normalizeShadowResolution(2048, 4096), 2048);
  assert.equal(normalizeShadowResolution(2048, 1024), 1024);
  assert.equal(normalizeShadowResolution(8192, 4096), 1024);
  assert.equal(normalizeShadowResolution('bad', 4096), 1024);
  assert.equal(normalizeShadowResolution(512, 128), 256);
  assert.match(scene3dCapabilities.shadows, /2048px/);
});


test('look-at view matrices stay finite and orthonormal when a light points vertically', () => {
  for (const [eye, target, up] of [
    [[0, 35, 0], [0, 0, 0], [0, 1, 0]],
    [[0, -35, 0], [0, 0, 0], [0, 1, 0]],
    [[0, 0, 0], [0, 0, 0], [0, 1, 0]],
  ]) {
    const matrix = createLookAtMatrix(eye, target, up);
    assert.equal(matrix.length, 16);
    assert.ok([...matrix].every(Number.isFinite));
    const axes = [[matrix[0], matrix[4], matrix[8]], [matrix[1], matrix[5], matrix[9]], [matrix[2], matrix[6], matrix[10]]];
    for (const axis of axes) assert.ok(Math.abs(Math.hypot(...axis) - 1) < 1e-5);
    const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
    assert.ok(Math.abs(dot(axes[0], axes[1])) < 1e-5);
    assert.ok(Math.abs(dot(axes[1], axes[2])) < 1e-5);
    assert.ok(Math.abs(dot(axes[0], axes[2])) < 1e-5);
  }
});


test('render-light selection can promote a chosen shadow source without exceeding four lights', () => {
  const lights = [
    { type: 'light', name: 'Key', engineId: 'key' },
    { type: 'cube', name: 'Not a light', engineId: 'cube' },
    { type: 'light', name: 'Fill', engineId: 'fill' },
    { type: 'light', name: 'Rim', engineId: 'rim' },
    { type: 'light', name: 'Practical', engineId: 'practical' },
    { type: 'light', name: 'Far', engineId: 'far' },
    { type: 'light', name: 'Hidden', engineId: 'hidden', visible: false },
  ];
  assert.deepEqual(selectRenderLights(lights, 'auto').map(light => light.engineId), ['key', 'fill', 'rim', 'practical']);
  assert.deepEqual(selectRenderLights(lights, 'far').map(light => light.engineId), ['far', 'key', 'fill', 'rim']);
  assert.deepEqual(selectRenderLights(lights, 'fill', 1).map(light => light.engineId), ['fill']);
  assert.equal(sceneObjectIdentity({ name: 'unnamed fallback' }, 8), 'unnamed fallback');
  assert.equal(scene3dCapabilities.selectableShadowSource, true);
});

test('renderer resolves environment IBL probes and groups repeated meshes into instanced batches', async () => {
  const { resolveEnvironmentProbe, groupInstancedDrawables, ENVIRONMENT_IBL_PRESETS } = await import('../src/studio/scene3d.js');
  assert.ok(Object.keys(ENVIRONMENT_IBL_PRESETS).length >= 5);
  const sunset = resolveEnvironmentProbe('sunset');
  assert.equal(sunset.preset, 'sunset');
  assert.equal(sunset.zenith.length, 3);
  assert.equal(sunset.horizon.length, 3);

  const grouped = groupInstancedDrawables([
    { type: 'cube', color: '#45d483', material: { metallic: 0.2, roughness: 0.5 } },
    { type: 'cube', color: '#45d483', material: { metallic: 0.2, roughness: 0.5 } },
    { type: 'sphere', color: '#f06a9b', material: { metallic: 0.8, roughness: 0.1 } },
  ]);
  assert.equal(grouped.batchCount, 2);
  assert.equal(grouped.instancedObjectCount, 2);
  assert.equal(grouped.savedDrawCalls, 1);
});

