/**
 * Orvexa VFX Studio — Budgeted particle emitters, environmental forces,
 * deterministic stepping, and triangle-mesh generation for WebGL scenes and Aetherfall.
 */
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;

export const VFX_MAX_PARTICLES = 512;

export const VFX_PRESETS = Object.freeze({
  'campfire-sparks': {
    label: 'Campfire Sparks',
    rate: 28,
    maxParticles: 96,
    lifetime: 1.8,
    speed: 2.2,
    spread: 0.55,
    gravity: -0.65, // buoyant updraft
    drag: 0.45,
    turbulence: 1.1,
    sizeStart: 0.085,
    sizeEnd: 0.02,
    colorStart: '#ffbe55',
    colorEnd: '#ff4b2b',
    emissive: 1.45,
  },
  'arcane-wisps': {
    label: 'Arcane Sunshard Wisps',
    rate: 20,
    maxParticles: 80,
    lifetime: 2.6,
    speed: 1.15,
    spread: 1.2,
    gravity: -0.25,
    drag: 0.6,
    turbulence: 1.5,
    sizeStart: 0.11,
    sizeEnd: 0.035,
    colorStart: '#56f0e8',
    colorEnd: '#8b79ff',
    emissive: 1.65,
  },
  'forge-embers': {
    label: 'Forge Embers & Ash',
    rate: 36,
    maxParticles: 120,
    lifetime: 2.1,
    speed: 3.1,
    spread: 0.85,
    gravity: 2.4,
    drag: 0.35,
    turbulence: 0.9,
    sizeStart: 0.075,
    sizeEnd: 0.018,
    colorStart: '#ffd470',
    colorEnd: '#b83227',
    emissive: 1.35,
    bounceGround: true,
  },
  'snow-swirl': {
    label: 'Alpine Snow Swirl',
    rate: 42,
    maxParticles: 140,
    lifetime: 3.2,
    speed: 1.4,
    spread: 2.4,
    gravity: 0.85,
    drag: 0.8,
    turbulence: 1.8,
    sizeStart: 0.07,
    sizeEnd: 0.045,
    colorStart: '#e8f4ff',
    colorEnd: '#9ec0e6',
    emissive: 0.35,
  },
  'rain-mist': {
    label: 'Storm Rain Mist',
    rate: 55,
    maxParticles: 160,
    lifetime: 1.1,
    speed: 5.5,
    spread: 2.2,
    gravity: 7.5,
    drag: 0.15,
    turbulence: 0.4,
    sizeStart: 0.06,
    sizeEnd: 0.025,
    colorStart: '#8cb8de',
    colorEnd: '#4f769c',
    emissive: 0.2,
    bounceGround: true,
  },
  'portal-vortex': {
    label: 'Portal Vortex',
    rate: 44,
    maxParticles: 150,
    lifetime: 2.2,
    speed: 2.6,
    spread: 1.6,
    gravity: -0.4,
    drag: 0.35,
    turbulence: 2.6,
    sizeStart: 0.12,
    sizeEnd: 0.03,
    colorStart: '#8b79ff',
    colorEnd: '#56f0e8',
    emissive: 1.9,
  },
  'snowfall': {
    label: 'Snowfall',
    rate: 48,
    maxParticles: 160,
    lifetime: 3.6,
    speed: 1.2,
    spread: 2.8,
    gravity: 0.95,
    drag: 0.85,
    turbulence: 1.4,
    sizeStart: 0.075,
    sizeEnd: 0.05,
    colorStart: '#ffffff',
    colorEnd: '#bcd8f2',
    emissive: 0.3,
  },
  'beacon-column': {
    label: 'Firstlight Beacon Pulse',
    rate: 32,
    maxParticles: 110,
    lifetime: 2.4,
    speed: 2.8,
    spread: 0.45,
    gravity: -1.1,
    drag: 0.3,
    turbulence: 0.75,
    sizeStart: 0.13,
    sizeEnd: 0.04,
    colorStart: '#70f8ff',
    colorEnd: '#eab96d',
    emissive: 1.8,
  },
  'meteor-shower': {
    label: 'Meteor Shower',
    rate: 22, maxParticles: 130, lifetime: 1.5, speed: 8.5, spread: 3.2,
    gravity: 3.2, drag: 0.06, turbulence: 0.3,
    sizeStart: 0.16, sizeEnd: 0.03, colorStart: '#cfe8ff', colorEnd: '#ff9a5c', emissive: 1.6,
    forceFields: [{ type: 'turbulence', strength: 0.4 }],
  },
  'healing-aura': {
    label: 'Healing Aura',
    rate: 26, maxParticles: 90, lifetime: 2.8, speed: 0.85, spread: 1.1,
    gravity: -0.55, drag: 0.7, turbulence: 0.9,
    sizeStart: 0.1, sizeEnd: 0.05, colorStart: '#7dff9a', colorEnd: '#d8ffd0', emissive: 1.1,
    forceFields: [{ type: 'vortex', strength: 0.7, axis: 'y' }],
  },
  'electric-lightning-arcs': {
    label: 'Electric Lightning Arcs',
    rate: 60, maxParticles: 170, lifetime: 0.55, speed: 4.5, spread: 1.8,
    gravity: 0.4, drag: 0.12, turbulence: 4.2,
    sizeStart: 0.09, sizeEnd: 0.02, colorStart: '#dff4ff', colorEnd: '#4aa8ff', emissive: 2.2,
    forceFields: [{ type: 'turbulence', strength: 2.4 }],
  },
  'thruster-afterburner': {
    label: 'Thruster Afterburner',
    rate: 70, maxParticles: 190, lifetime: 0.9, speed: 6.5, spread: 0.5,
    gravity: 0.2, drag: 0.5, turbulence: 0.7,
    sizeStart: 0.17, sizeEnd: 0.02, colorStart: '#bfe8ff', colorEnd: '#ff7a3c', emissive: 1.9,
    bounceGround: false,
    forceFields: [{ type: 'attractor', strength: -1.2, position: { x: 0, y: -0.4, z: 0 } }],
  },
  'confetti-burst': {
    label: 'Confetti Burst',
    rate: 90, maxParticles: 220, lifetime: 2.6, speed: 3.6, spread: 2.6,
    gravity: 2.1, drag: 1.1, turbulence: 1.7,
    sizeStart: 0.09, sizeEnd: 0.07, colorStart: '#ff6b9d', colorEnd: '#ffd94a', emissive: 0.55,
    bounceGround: true,
    forceFields: [{ type: 'turbulence', strength: 1.1 }],
  },
});


function nextRandom(emitter) {
  let s = (emitter.rngState = ((emitter.rngState || 1) + 0x6D2B79F5) >>> 0);
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}


export const VFX_FORCE_FIELD_TYPES = Object.freeze(['vortex', 'turbulence', 'attractor', 'repulsor', 'wind', 'gravity-well']);

export function normalizeForceFields(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).map((field, i) => ({
    id: String(field?.id || `force-${i + 1}`),
    type: VFX_FORCE_FIELD_TYPES.includes(field?.type) ? field.type : 'turbulence',
    strength: clamp(finite(field?.strength, 1), -30, 30),
    radius: clamp(finite(field?.radius, 6), 0.1, 500),
    axis: ['x', 'y', 'z'].includes(field?.axis) ? field.axis : 'y',
    position: {
      x: clamp(finite(field?.position?.x, 0), -2000, 2000),
      y: clamp(finite(field?.position?.y, 0), -2000, 2000),
      z: clamp(finite(field?.position?.z, 0), -2000, 2000),
    },
  }));
}

export function forceFieldAcceleration(field, particle, elapsed = 0) {
  const dx = particle.x - field.position.x;
  const dy = particle.y - field.position.y;
  const dz = particle.z - field.position.z;
  const distance = Math.hypot(dx, dy, dz) || 1e-6;
  const falloff = clamp(1 - distance / Math.max(0.1, field.radius), 0, 1);
  if (falloff <= 0 && field.type !== 'turbulence' && field.type !== 'wind') return [0, 0, 0];
  const s = field.strength * falloff;
  switch (field.type) {
    case 'vortex': {
      // Tangential swirl around the chosen axis through the field centre.
      if (field.axis === 'x') return [0, -dz * s, dy * s];
      if (field.axis === 'z') return [-dy * s, dx * s, 0];
      return [-dz * s, 0, dx * s];
    }
    case 'attractor':
      return [(-dx / distance) * s * 4, (-dy / distance) * s * 4, (-dz / distance) * s * 4];
    case 'repulsor':
      return [(dx / distance) * Math.abs(s) * 4, (dy / distance) * Math.abs(s) * 4, (dz / distance) * Math.abs(s) * 4];
    case 'gravity-well':
      return [0, -Math.abs(s) * 4 * falloff, 0];
    case 'wind':
      return [s * 2, 0, s * 0.6];
    case 'turbulence':
    default:
      return [
        Math.sin(elapsed * 3.3 + particle.phase + particle.y * 2.1) * s,
        Math.cos(elapsed * 2.9 + particle.phase * 1.7) * s * 0.6,
        Math.sin(elapsed * 3.7 + particle.phase + particle.x * 1.9) * s,
      ];
  }
}


export function normalizeEmissionVolume(raw) {
  const shape = ['point', 'sphere', 'box', 'disc', 'cone'].includes(raw?.shape) ? raw.shape : 'point';
  return {
    shape,
    radius: clamp(finite(raw?.radius, 0.5), 0, 100),
    halfExtents: {
      x: clamp(finite(raw?.halfExtents?.x, 0.5), 0, 100),
      y: clamp(finite(raw?.halfExtents?.y, 0.5), 0, 100),
      z: clamp(finite(raw?.halfExtents?.z, 0.5), 0, 100),
    },
  };
}

export function emissionOffset(volume, random) {
  if (!volume || volume.shape === 'point') return [0, 0, 0];
  if (volume.shape === 'sphere') {
    const u = random() * 2 - 1; const theta = random() * Math.PI * 2;
    const r = volume.radius * Math.cbrt(random()) * Math.sqrt(Math.max(0, 1 - u * u));
    return [Math.cos(theta) * r, u * volume.radius, Math.sin(theta) * r];
  }
  if (volume.shape === 'disc') {
    const theta = random() * Math.PI * 2; const r = volume.radius * Math.sqrt(random());
    return [Math.cos(theta) * r, 0, Math.sin(theta) * r];
  }
  if (volume.shape === 'cone') {
    const h = random(); const r = volume.radius * h * Math.sqrt(random()); const theta = random() * Math.PI * 2;
    return [Math.cos(theta) * r, h * Math.max(0.1, volume.halfExtents.y), Math.sin(theta) * r];
  }
  return [
    (random() * 2 - 1) * volume.halfExtents.x,
    (random() * 2 - 1) * volume.halfExtents.y,
    (random() * 2 - 1) * volume.halfExtents.z,
  ];
}

export const VFX_COLOR_RAMPS = Object.freeze({
  ember: Object.freeze(['#fff3c4', '#ffb86b', '#ff6b4a', '#8a2432']),
  frost: Object.freeze(['#ffffff', '#cfe8ff', '#6eb6ff', '#1c4d8a']),
  arcane: Object.freeze(['#ffe8ff', '#c88aff', '#7c4dff', '#241158']),
  toxic: Object.freeze(['#eaffc4', '#8aff5e', '#2ea84a', '#0d3d1e']),
  solar: Object.freeze(['#fff8d8', '#ffd94a', '#ff9a3c', '#a83232']),
  confetti: Object.freeze(['#ff6b9d', '#ffd94a', '#56f0e8', '#8a7cff']),
});

export function sampleColorRamp(stops, t) {
  const list = Array.isArray(stops) && stops.length ? stops : ['#ffffff', '#000000'];
  const pos = clamp(finite(t, 0), 0, 1) * (list.length - 1);
  const i = Math.min(list.length - 2, Math.floor(pos));
  const f = pos - i;
  const parse = (hex) => { const n = parseInt(String(hex).slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const a = parse(list[i]); const b = parse(list[Math.min(list.length - 1, i + 1)]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function buildHeightfieldResolver(heightmap) {
  const resolution = Math.max(2, Math.round(finite(heightmap?.resolution, 2)));
  const data = heightmap?.data;
  const size = Math.max(0.01, finite(heightmap?.size, 40));
  return (x, z) => {
    if (!data || !data.length) return 0;
    const u = clamp((x / size) + 0.5, 0, 1) * (resolution - 1);
    const v = clamp((z / size) + 0.5, 0, 1) * (resolution - 1);
    const x0 = Math.floor(u); const z0 = Math.floor(v);
    const x1 = Math.min(resolution - 1, x0 + 1); const z1 = Math.min(resolution - 1, z0 + 1);
    const fx = u - x0; const fz = v - z0;
    const s = (xx, zz) => finite(data[zz * resolution + xx], 0);
    return (s(x0, z0) * (1 - fx) + s(x1, z0) * fx) * (1 - fz) + (s(x0, z1) * (1 - fx) + s(x1, z1) * fx) * fz;
  };
}

export function createVfxEmitter(options = {}) {
  const presetKey = VFX_PRESETS[options.preset] ? options.preset : 'campfire-sparks';
  const preset = VFX_PRESETS[presetKey];
  const merged = { ...preset, ...options, preset: presetKey };
  return {
    id: String(merged.id || `vfx-${presetKey}`),
    name: String(merged.name || preset.label).slice(0, 80),
    preset: presetKey,
    enabled: merged.enabled !== false,
    position: {
      x: clamp(finite(merged.position?.x, 0), -2000, 2000),
      y: clamp(finite(merged.position?.y, 0), -2000, 2000),
      z: clamp(finite(merged.position?.z, 0), -2000, 2000),
    },
    wind: {
      x: clamp(finite(merged.wind?.x, 0.25), -20, 20),
      y: clamp(finite(merged.wind?.y, 0), -20, 20),
      z: clamp(finite(merged.wind?.z, 0.1), -20, 20),
    },
    rate: clamp(finite(merged.rate, preset.rate), 1, 200),
    maxParticles: Math.round(clamp(finite(merged.maxParticles, preset.maxParticles), 4, VFX_MAX_PARTICLES)),
    lifetime: clamp(finite(merged.lifetime, preset.lifetime), 0.15, 12),
    speed: clamp(finite(merged.speed, preset.speed), 0.05, 25),
    spread: clamp(finite(merged.spread, preset.spread), 0.02, 10),
    gravity: clamp(finite(merged.gravity, preset.gravity), -15, 25),
    drag: clamp(finite(merged.drag, preset.drag), 0, 5),
    turbulence: clamp(finite(merged.turbulence, preset.turbulence), 0, 6),
    sizeStart: clamp(finite(merged.sizeStart, preset.sizeStart), 0.01, 2),
    sizeEnd: clamp(finite(merged.sizeEnd, preset.sizeEnd), 0.005, 2),
    colorStart: /^#[0-9a-f]{6}$/i.test(String(merged.colorStart || '')) ? String(merged.colorStart) : preset.colorStart,
    colorEnd: /^#[0-9a-f]{6}$/i.test(String(merged.colorEnd || '')) ? String(merged.colorEnd) : preset.colorEnd,
    emissive: clamp(finite(merged.emissive, preset.emissive), 0, 3),
    bounceGround: Boolean(merged.bounceGround ?? preset.bounceGround),
    forceFields: normalizeForceFields(merged.forceFields ?? preset.forceFields),
    groundHeightAt: typeof merged.groundHeightAt === 'function' ? merged.groundHeightAt : null,
    emissionVolume: normalizeEmissionVolume(merged.emissionVolume ?? preset.emissionVolume),
    groundY: clamp(finite(merged.groundY, -1), -500, 500),
    seed: Math.trunc(finite(merged.seed, 1337)),
    rngState: (Math.trunc(finite(merged.seed, 1337)) || 1337) >>> 0,
    spawnAccumulator: 0,
    elapsed: 0,
    particles: Array.isArray(merged.particles) ? [...merged.particles] : [],
  };
}

function spawnParticle(emitter) {
  const angle = nextRandom(emitter) * Math.PI * 2;
  const radius = Math.sqrt(nextRandom(emitter)) * emitter.spread * 0.35;
  const speedVar = emitter.speed * (0.65 + nextRandom(emitter) * 0.7);
  const spreadAngle = (nextRandom(emitter) - 0.5) * emitter.spread;
  const vx = Math.cos(angle) * Math.sin(spreadAngle) * speedVar;
  const vz = Math.sin(angle) * Math.sin(spreadAngle) * speedVar;
  const vy = emitter.gravity <= 0
    ? Math.abs(Math.cos(spreadAngle)) * speedVar
    : (nextRandom(emitter) - 0.25) * speedVar;
  return {
    x: emitter.position.x + Math.cos(angle) * radius + (emissionOffset(emitter.emissionVolume, () => nextRandom(emitter))[0] || 0),
    y: emitter.position.y + (nextRandom(emitter) - 0.5) * 0.12,
    z: emitter.position.z + Math.sin(angle) * radius,
    vx,
    vy,
    vz,
    age: 0,
    trail: [],
    lifetime: emitter.lifetime * (0.75 + nextRandom(emitter) * 0.5),
    phase: nextRandom(emitter) * Math.PI * 2,
  };
}

export function stepVfxEmitter(emitter, dtSeconds = 1 / 60) {
  if (!emitter || typeof emitter !== 'object') throw new TypeError('Valid VFX emitter is required.');
  const dt = clamp(finite(dtSeconds, 1 / 60), 0, 0.25);
  if (!emitter.enabled || dt <= 0) return emitter;
  emitter.elapsed = (emitter.elapsed || 0) + dt;
  const damping = Math.exp(-emitter.drag * dt);
  const surviving = [];

  for (const p of emitter.particles) {
    const nextAge = p.age + dt;
    if (nextAge >= p.lifetime) continue;
    const swirlX = Math.sin(emitter.elapsed * 3.1 + p.phase + p.y * 1.7) * emitter.turbulence;
    const swirlZ = Math.cos(emitter.elapsed * 2.7 + p.phase + p.x * 1.5) * emitter.turbulence;
    let vx = (p.vx + (emitter.wind.x + swirlX) * dt) * damping;
    let vy = (p.vy - emitter.gravity * dt + emitter.wind.y * dt) * damping;
    let vz = (p.vz + (emitter.wind.z + swirlZ) * dt) * damping;
    for (const field of emitter.forceFields || []) {
      const [fx, fy, fz] = forceFieldAcceleration(field, p, emitter.elapsed);
      vx += fx * dt; vy += fy * dt; vz += fz * dt;
    }
    let x = p.x + vx * dt;
    let y = p.y + vy * dt;
    let z = p.z + vz * dt;
    const floorY = typeof emitter.groundHeightAt === 'function'
      ? clamp(finite(emitter.groundHeightAt(x, z), emitter.groundY), -500, 500)
      : emitter.groundY;
    if ((emitter.bounceGround || typeof emitter.groundHeightAt === 'function') && y < floorY) {
      y = floorY + 0.01;
      vy = Math.abs(vy) * clamp(finite(emitter.bounceRestitution, 0.42), 0, 0.95);
      const friction = clamp(finite(emitter.bounceFriction, 0.7), 0, 1);
      vx *= friction;
      vz *= friction;
    }
    surviving.push({ ...p, x, y, z, vx, vy, vz, age: nextAge, trail: [...(Array.isArray(p.trail) ? p.trail : []), [x, y, z]].slice(-10) });
  }

  emitter.spawnAccumulator = (emitter.spawnAccumulator || 0) + emitter.rate * dt;
  const toSpawn = Math.min(
    Math.floor(emitter.spawnAccumulator),
    Math.max(0, emitter.maxParticles - surviving.length),
  );
  emitter.spawnAccumulator -= toSpawn;
  for (let i = 0; i < toSpawn; i++) {
    surviving.push(spawnParticle(emitter));
  }
  emitter.particles = surviving.slice(0, emitter.maxParticles);
  return emitter;
}

/**
 * Build a lightweight cross-billboard triangle mesh (two crossed triangles per particle, 18 floats per particle)
 * suitable for immediate rendering in Orvexa's WebGL scene renderer or Aetherfall.
 */
export function buildVfxTriangleMesh(emitter) {
  if (!emitter || !Array.isArray(emitter.particles) || emitter.particles.length === 0) {
    return new Float32Array([
      -0.01, -0.01, 0,
      0.01, -0.01, 0,
      0, 0.01, 0,
    ]);
  }
  const count = Math.min(emitter.particles.length, VFX_MAX_PARTICLES);
  const out = new Float32Array(count * 18);
  let offset = 0;
  for (let i = 0; i < count; i++) {
    const p = emitter.particles[i];
    const t = clamp(p.age / Math.max(0.01, p.lifetime), 0, 1);
    const sz = emitter.sizeStart + (emitter.sizeEnd - emitter.sizeStart) * t;
    // Triangle 1 (XY plane diamond)
    out[offset++] = p.x - sz; out[offset++] = p.y - sz * 0.6; out[offset++] = p.z;
    out[offset++] = p.x + sz; out[offset++] = p.y - sz * 0.6; out[offset++] = p.z;
    out[offset++] = p.x;      out[offset++] = p.y + sz * 1.2; out[offset++] = p.z;
    // Triangle 2 (ZY plane diamond)
    out[offset++] = p.x; out[offset++] = p.y - sz * 0.6; out[offset++] = p.z - sz;
    out[offset++] = p.x; out[offset++] = p.y - sz * 0.6; out[offset++] = p.z + sz;
    out[offset++] = p.x; out[offset++] = p.y + sz * 1.2; out[offset++] = p.z;
  }
  return out;
}

export function createForceFieldEmitter(preset, forceFields, options = {}) {
  return createVfxEmitter({ ...options, preset, forceFields });
}

export function listVfxPresets() {
  return Object.entries(VFX_PRESETS).map(([id, preset]) => ({
    id, label: preset.label, rate: preset.rate, maxParticles: preset.maxParticles,
    lifetime: preset.lifetime, emissive: preset.emissive,
    forceFields: normalizeForceFields(preset.forceFields).map(f => f.type),
  }));
}

export function estimateVfxBudget(emitter) {
  const particles = Math.min(emitter?.particles?.length || emitter?.maxParticles || 0, VFX_MAX_PARTICLES);
  return {
    particles,
    triangles: particles * 2,
    floatsPerFrame: particles * 18,
    withinBudget: particles <= VFX_MAX_PARTICLES,
    tier: particles <= 80 ? 'mobile' : particles <= 180 ? 'balanced' : 'performance',
  };
}

export function burstVfx(emitter, count = 24) {
  const toAdd = Math.max(0, Math.min(Math.round(count), emitter.maxParticles - emitter.particles.length));
  for (let i = 0; i < toAdd; i++) emitter.particles.push(spawnParticle(emitter));
  return emitter.particles.length;
}

export function stepVfxEmitterTimes(emitter, totalSeconds, stepSeconds = 1 / 60) {
  const steps = Math.max(1, Math.round(clamp(finite(totalSeconds, 1), 0.01, 60) / clamp(stepSeconds, 1 / 240, 0.25)));
  for (let i = 0; i < steps; i++) stepVfxEmitter(emitter, stepSeconds);
  return emitter;
}

export function vfxParticleColorAt(emitter, particle) {
  const t = clamp(particle.age / Math.max(0.01, particle.lifetime), 0, 1);
  const parse = (hex) => {
    const n = parseInt(String(hex).slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const a = parse(emitter.colorStart); const b = parse(emitter.colorEnd);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function buildVfxTrailRibbon(emitter, options = {}) {
  const widthScale = clamp(finite(options.width, 0.06), 0.001, 4);
  const out = [];
  for (const particle of emitter.particles || []) {
    const trail = Array.isArray(particle.trail) ? particle.trail : [];
    if (trail.length < 2) continue;
    const width = widthScale * (0.4 + particle.size);
    for (let i = 0; i < trail.length - 1; i++) {
      const [ax, ay, az] = trail[i];
      const [bx, by, bz] = trail[i + 1];
      const lifeFade = 1 - clamp(particle.age / Math.max(0.01, particle.lifetime), 0, 1);
      const w = width * (0.35 + 0.65 * (i / Math.max(1, trail.length - 1))) * (0.4 + lifeFade);
      out.push(
        ax - w, ay, az, ax + w, ay, az, bx - w, by, bz,
        ax + w, ay, az, bx + w, by, bz, bx - w, by, bz,
      );
    }
  }
  return new Float32Array(out);
}

export function createVfxSystem(definitions = []) {
  const emitters = (Array.isArray(definitions) ? definitions : []).slice(0, 16).map(def => createVfxEmitter(def));
  return { emitters, elapsed: 0, active: true };
}

export function stepVfxSystem(system, dt) {
  if (!system || !Array.isArray(system.emitters)) throw new Error('Invalid VFX system.');
  system.elapsed += clamp(finite(dt, 1 / 60), 0, 0.25);
  if (system.active === false) return system;
  for (const emitter of system.emitters) stepVfxEmitter(emitter, dt);
  return system;
}

export function buildCombinedVfxMesh(system) {
  const chunks = (system?.emitters || []).map(e => buildVfxTriangleMesh(e));
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}

export function computeVfxStatistics(emitter) {
  const particles = emitter?.particles || [];
  if (!particles.length) return { count: 0, averageAge: 0, averageSpeed: 0, bounds: null, kineticEnergy: 0 };
  let age = 0; let speed = 0; let energy = 0;
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (const particle of particles) {
    age += particle.age;
    const s = Math.hypot(particle.vx, particle.vy, particle.vz);
    speed += s; energy += 0.5 * s * s;
    min[0] = Math.min(min[0], particle.x); min[1] = Math.min(min[1], particle.y); min[2] = Math.min(min[2], particle.z);
    max[0] = Math.max(max[0], particle.x); max[1] = Math.max(max[1], particle.y); max[2] = Math.max(max[2], particle.z);
  }
  return {
    count: particles.length,
    averageAge: age / particles.length,
    averageSpeed: speed / particles.length,
    kineticEnergy: energy,
    bounds: { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] },
  };
}

export function serializeVfxEmitter(emitter) {
  return JSON.stringify({
    preset: emitter.preset, position: emitter.position, rate: emitter.rate,
    maxParticles: emitter.maxParticles, lifetime: emitter.lifetime, speed: emitter.speed,
    gravity: emitter.gravity, colorStart: emitter.colorStart, colorEnd: emitter.colorEnd,
    forceFields: emitter.forceFields, emissionVolume: emitter.emissionVolume,
  });
}

export function deserializeVfxEmitter(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || typeof data !== 'object') throw new Error('Invalid serialized VFX emitter.');
  return createVfxEmitter(data);
}

export function applyVfxColorRamp(emitter, rampId) {
  const stops = VFX_COLOR_RAMPS[rampId];
  if (!stops) throw new Error(`Unknown VFX color ramp "${rampId}".`);
  emitter.colorStart = stops[0];
  emitter.colorEnd = stops[stops.length - 1];
  emitter.colorRamp = [...stops];
  return emitter;
}

export function applyWindGust(emitter, gust = {}) {
  const strength = clamp(finite(gust.strength, 2), -20, 20);
  const direction = gust.direction || {};
  const dx = clamp(finite(direction.x, 1), -1, 1);
  const dy = clamp(finite(direction.y, 0), -1, 1);
  const dz = clamp(finite(direction.z, 0), -1, 1);
  const len = Math.hypot(dx, dy, dz) || 1;
  for (const particle of emitter.particles || []) {
    particle.vx += (dx / len) * strength;
    particle.vy += (dy / len) * strength;
    particle.vz += (dz / len) * strength;
  }
  return emitter;
}

export function countActiveForceFields(emitter) {
  return (emitter?.forceFields || []).length;
}
