import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWorldEnvironment, normalizeWeather } from '../src/studio/environment.js';

test('world environment produces finite normalized sun vectors for a full day', () => {
  for (let h = 0; h <= 24; h += 0.25) {
    const env = calculateWorldEnvironment(h, 'clear');
    assert.ok(env.sunDirection.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...env.sunDirection) - 1) < 1e-9);
    assert.ok(env.daylight >= 0 && env.daylight <= 1);
    assert.ok(env.solarIntensity > 0 && env.solarIntensity <= 1.11);
  }
  assert.ok(calculateWorldEnvironment(12).daylight > calculateWorldEnvironment(0).daylight);
});

test('overcast, rain, and snow attenuate sun and increase atmospheric fog', () => {
  const clear = calculateWorldEnvironment(12, 'clear');
  for (const weather of ['overcast', 'rain', 'snow']) {
    const value = calculateWorldEnvironment(12, weather);
    assert.ok(value.solarIntensity < clear.solarIntensity);
    assert.ok(value.fogBoost > 1);
  }
  assert.equal(normalizeWeather('rain'), 'rain');
  assert.equal(normalizeWeather('monsoon'), 'clear');
});
