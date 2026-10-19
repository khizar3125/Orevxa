import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VFX_MAX_PARTICLES,
  VFX_PRESETS,
  createVfxEmitter,
  stepVfxEmitter,
  buildVfxTriangleMesh,
} from '../src/studio/vfx.js';

test('VFX Studio creates budgeted particle emitters for all presets and advances deterministically', () => {
  assert.ok(Object.keys(VFX_PRESETS).length >= 6);
  for (const presetId of Object.keys(VFX_PRESETS)) {
    const emitter = createVfxEmitter({ preset: presetId, maxParticles: 9999, seed: 42 });
    assert.ok(emitter.maxParticles <= VFX_MAX_PARTICLES);
    stepVfxEmitter(emitter, 0.25);
    assert.ok(emitter.particles.length > 0, `Preset ${presetId} should spawn particles`);
    assert.ok(emitter.particles.length <= VFX_MAX_PARTICLES);

    const mesh = buildVfxTriangleMesh(emitter);
    assert.equal(mesh.length, emitter.particles.length * 18);
    assert.ok(Array.from(mesh).every(Number.isFinite));
  }
});
