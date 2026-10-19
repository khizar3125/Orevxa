import test from 'node:test';
import assert from 'node:assert/strict';
import { directLighting, normalizePathTracerLights, renderPathTracedImage } from '../src/studio/pathTracer.js';

test('CPU path tracer returns display pixels, traces triangles, and enables indirect lighting', async () => {
  const scene = { name: 'tiny', objects: [
    { type: 'camera', position: { x: 0, y: 1.6, z: 5 }, target: { x: 0, y: 0, z: 0 } },
    { type: 'light', position: { x: 2, y: 4, z: 3 }, color: '#fff2dc', intensity: 55 },
    { type: 'plane', name: 'floor', position: { x: 0, y: -1, z: 0 }, size: 6, color: '#777777' },
    { type: 'sphere', name: 'ball', position: { x: 0, y: 0, z: 0 }, size: 1, color: '#d05030', material: { roughness: 0.4, metallic: 0.1 } },
  ] };
  let lastProgress = 0;
  const rendered = await renderPathTracedImage(scene, { width: 20, height: 16, samples: 1, bounces: 2, seed: 5, onProgress: p => { lastProgress = p.percent; } });
  assert.equal(rendered.width, 20);
  assert.equal(rendered.height, 16);
  assert.equal(rendered.pixels.length, 20 * 16 * 4);
  assert.ok(rendered.stats.triangleCount > 0);
  assert.ok(rendered.stats.rays > 0);
  assert.equal(rendered.stats.indirectGlobalIllumination, true);
  assert.equal(lastProgress, 100);
  assert.ok(rendered.pixels.some((value, index) => index % 4 === 0 && value > 20));
});

test('CPU path tracer rejects empty scenes and can be cancelled safely', async () => {
  await assert.rejects(renderPathTracedImage({ objects: [] }, { width: 16, height: 16 }), /visible geometry/i);
  const controller = new AbortController(); controller.abort();
  const scene = { objects: [{ type: 'cube', name: 'box', position: {x:0,y:0,z:0} }] };
  await assert.rejects(renderPathTracedImage(scene, { width: 16, height: 16, signal: controller.signal }), /cancelled/i);
});


test('path tracer normalizes directional, point and spot light properties with safe bounds', () => {
  const lights = normalizePathTracerLights({ objects: [
    { type: 'light', lightType: 'directional', direction: { x: 0, y: -5, z: 0 }, intensity: 6, radius: 99 },
    { type: 'light', lightType: 'point', position: { x: 1, y: 2, z: 3 }, intensity: 3, range: 7, radius: 0.35 },
    { type: 'light', lightType: 'spot', position: { x: 0, y: 3, z: 0 }, direction: { x: 0, y: -1, z: 0 }, innerCone: 20, outerCone: 35, range: 8 },
  ] });
  assert.equal(lights.length, 3);
  assert.equal(lights[0].type, 'directional');
  assert.deepEqual(lights[0].direction, [0, -1, 0]);
  assert.equal(lights[0].radius, 10);
  assert.equal(lights[1].range, 7);
  assert.equal(lights[1].radius, 0.35);
  assert.equal(lights[2].type, 'spot');
  assert.ok(lights[2].innerCone < lights[2].outerCone);
  assert.ok(lights.every(light => Number.isFinite(light.intensity) && Number.isFinite(light.range)));
});

test('path tracer applies directional and spot lighting and respects range and spot cones', () => {
  const hit = { point: [0, 0, 0], normal: [0, 1, 0], albedo: [0.8, 0.8, 0.8], tri: { metallic: 0, roughness: 0.55, albedo: [0.8, 0.8, 0.8] } };
  const directional = normalizePathTracerLights({ objects: [{ type: 'light', lightType: 'directional', direction: { x: 0, y: -1, z: 0 }, intensity: 30 }] });
  const directionalResult = directLighting(hit, null, directional, [0, 1, 4], () => 0.5);
  assert.ok(directionalResult.some(value => value > 0));
  const spot = normalizePathTracerLights({ objects: [{ type: 'light', lightType: 'spot', position: { x: 0, y: 3, z: 0 }, direction: { x: 0, y: -1, z: 0 }, intensity: 50, range: 10, innerCone: 15, outerCone: 30 }] });
  assert.ok(directLighting(hit, null, spot, [0, 1, 4], () => 0.5).some(value => value > 0));
  assert.deepEqual(directLighting(hit, null, normalizePathTracerLights({ objects: [{ type: 'light', lightType: 'spot', position: { x: 0, y: 3, z: 0 }, direction: { x: 0, y: 1, z: 0 }, intensity: 50, range: 10, innerCone: 15, outerCone: 30 }] }), [0, 1, 4], () => 0.5), [0, 0, 0]);
  const outOfRange = normalizePathTracerLights({ objects: [{ type: 'light', lightType: 'point', position: { x: 0, y: 8, z: 0 }, intensity: 50, range: 2 }] });
  assert.deepEqual(directLighting(hit, null, outOfRange, [0, 1, 4], () => 0.5), [0, 0, 0]);
});

test('path tracer source radius samples bounded area-light positions without non-finite values', () => {
  const hit = { point: [0, 0, 0], normal: [0, 1, 0], albedo: [0.75, 0.75, 0.75], tri: { metallic: 0, roughness: 0.6, albedo: [0.75, 0.75, 0.75] } };
  const lights = normalizePathTracerLights({ objects: [{ type: 'light', lightType: 'point', position: { x: 0, y: 4, z: 0 }, intensity: 80, range: 15, radius: 0.5 }] });
  const result = directLighting(hit, null, lights, [0, 1, 3], (() => { let i = 0; const values = [0.2, 0.4, 0.7, 0.1, 0.9, 0.6]; return () => values[(i++) % values.length]; })());
  assert.ok(result.some(value => value > 0));
  assert.ok(result.every(Number.isFinite));
});
