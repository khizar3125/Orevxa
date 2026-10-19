/**
 * Orvexa TerrainLab — Unreal Landscape / World Machine-class procedural
 * terrain: multi-noise heightfields (Ridged Multifractal, Billow, Domain-
 * Warped Simplex-style gradient noise, Voronoi Canyons, Craters), droplet
 * Hydraulic Erosion, Thermal Talus Erosion, slope/altitude/moisture biome
 * splat classification, baked splat textures, Poisson-disk biome foliage
 * scatter aligned to surface normals, and triangle-mesh generation.
 *
 * Everything is deterministic (seeded) and runs identically in Node tests
 * and the browser, so an eroded terrain in the editor is the terrain in
 * the exported game.
 */
import { encodeRgbaToPngDataUrl } from './materialGraph.js';

export const TERRAIN_LAB_VERSION = 1;
export const TERRAIN_MAX_RESOLUTION = 256;
export const TERRAIN_NOISE_TYPES = Object.freeze(['ridged-multifractal', 'billow', 'domain-warped', 'voronoi-canyon', 'crater-field', 'fbm']);
export const TERRAIN_BIOMES = Object.freeze(['snowy-peaks', 'exposed-cliff-rock', 'alpine-grass', 'wet-sand', 'lava-cracks', 'forest-floor', 'desert-dunes', 'tundra']);

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const lerp = (a, b, t) => a + (b - a) * t;

/** Deterministic integer hash -> [0,1). The foundation of all noise here. */
export function hash2i(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function seededRandom(seed = 1337) {
  let state = (Math.trunc(finite(seed, 1337)) || 1337) >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) >>> 0);
    state = (state ^ (state >>> 13)) >>> 0;
    return (state >>> 0) / 4294967296;
  };
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const grad2 = (h, x, y) => {
  switch (h & 7) {
    case 0: return x + y; case 1: return x - y; case 2: return -x + y; case 3: return -x - y;
    case 4: return x; case 5: return -x; case 6: return y; default: return -y;
  }
};

/** Perlin-style gradient noise in [-1, 1]. */
export function gradientNoise2(x, y, seed = 0) {
  const xi = Math.floor(x); const yi = Math.floor(y);
  const xf = x - xi; const yf = y - yi;
  const tl = grad2(Math.floor(hash2i(xi, yi, seed) * 8), xf, yf);
  const tr = grad2(Math.floor(hash2i(xi + 1, yi, seed) * 8), xf - 1, yf);
  const bl = grad2(Math.floor(hash2i(xi, yi + 1, seed) * 8), xf, yf - 1);
  const br = grad2(Math.floor(hash2i(xi + 1, yi + 1, seed) * 8), xf - 1, yf - 1);
  const u = fade(xf); const v = fade(yf);
  return clamp(lerp(lerp(tl, tr, u), lerp(bl, br, u), v) * 1.42, -1, 1);
}

/** Smooth value noise in [0, 1]. */
export function valueNoise2(x, y, seed = 0) {
  const xi = Math.floor(x); const yi = Math.floor(y);
  const xf = x - xi; const yf = y - yi;
  const tl = hash2i(xi, yi, seed); const tr = hash2i(xi + 1, yi, seed);
  const bl = hash2i(xi, yi + 1, seed); const br = hash2i(xi + 1, yi + 1, seed);
  const u = fade(xf); const v = fade(yf);
  return lerp(lerp(tl, tr, u), lerp(bl, br, u), v);
}

/** Fractal Brownian motion of gradient noise in [-1, 1]. */
export function fbmNoise(x, y, options = {}) {
  const octaves = Math.round(clamp(finite(options.octaves, 5), 1, 10));
  const lacunarity = clamp(finite(options.lacunarity, 2), 1.2, 4);
  const gain = clamp(finite(options.gain, 0.5), 0.05, 0.95);
  const seed = Math.trunc(finite(options.seed, 0));
  let amplitude = 1; let frequency = 1; let sum = 0; let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * gradientNoise2(x * frequency, y * frequency, seed + o * 17);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return norm ? sum / norm : 0;
}

/** Ridged multifractal: sharp crests, excellent for mountain ranges. */
export function ridgedMultifractal(x, y, options = {}) {
  const octaves = Math.round(clamp(finite(options.octaves, 6), 1, 10));
  const seed = Math.trunc(finite(options.seed, 0));
  const gain = clamp(finite(options.gain, 0.52), 0.05, 0.95);
  const lacunarity = clamp(finite(options.lacunarity, 2.1), 1.2, 4);
  let amplitude = 0.5; let frequency = 1; let sum = 0; let weight = 1; let norm = 0;
  for (let o = 0; o < octaves; o++) {
    let signal = 1 - Math.abs(gradientNoise2(x * frequency, y * frequency, seed + o * 23));
    signal = signal * signal;
    signal *= weight;
    weight = clamp(signal * clamp(finite(options.weightGain, 1.6), 0.2, 4), 0, 1);
    sum += signal * amplitude;
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return clamp(norm ? sum / norm : 0, 0, 1);
}

/** Billow noise: soft rounded hills via absolute-value fractal. */
export function billowNoise(x, y, options = {}) {
  const octaves = Math.round(clamp(finite(options.octaves, 5), 1, 10));
  const seed = Math.trunc(finite(options.seed, 0));
  let amplitude = 1; let frequency = 1; let sum = 0; let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * Math.abs(gradientNoise2(x * frequency, y * frequency, seed + o * 31));
    norm += amplitude;
    amplitude *= clamp(finite(options.gain, 0.5), 0.05, 0.95);
    frequency *= clamp(finite(options.lacunarity, 2), 1.2, 4);
  }
  return clamp(norm ? sum / norm : 0, 0, 1);
}

/** Domain-warped noise: fbm(p + fbm(p)) for swirling, natural continents. */
export function domainWarpedNoise(x, y, options = {}) {
  const seed = Math.trunc(finite(options.seed, 0));
  const warp = clamp(finite(options.warpStrength, 1.6), 0, 8);
  const qx = fbmNoise(x, y, { ...options, seed: seed + 101 });
  const qy = fbmNoise(x + 5.2, y + 1.3, { ...options, seed: seed + 211 });
  const rx = fbmNoise(x + warp * qx + 1.7, y + warp * qy + 9.2, { ...options, seed: seed + 307 });
  const ry = fbmNoise(x + warp * rx + 8.3, y + warp * qy + 2.8, { ...options, seed: seed + 401 });
  return clamp(fbmNoise(x + warp * rx, y + warp * ry, { ...options, seed }), -1, 1) * 0.5 + 0.5;
}

/** Voronoi F1/F2 distances for canyon cell structures. */
export function voronoiDistances(x, y, seed = 0) {
  const xi = Math.floor(x); const yi = Math.floor(y);
  let f1 = Infinity; let f2 = Infinity;
  for (let j = yi - 1; j <= yi + 1; j++) {
    for (let i = xi - 1; i <= xi + 1; i++) {
      const px = i + hash2i(i, j, seed);
      const py = j + hash2i(i, j, seed + 57);
      const d = Math.hypot(px - x, py - y);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
  }
  return { f1, f2, edge: f2 - f1 };
}

/** Voronoi canyon height: deep channels along cell borders. */
export function voronoiCanyonNoise(x, y, options = {}) {
  const { edge } = voronoiDistances(x, y, Math.trunc(finite(options.seed, 0)));
  const canyon = clamp(1 - edge * clamp(finite(options.canyonSharpness, 2.4), 0.2, 12), 0, 1);
  const base = fbmNoise(x * 0.5, y * 0.5, options) * 0.5 + 0.5;
  return clamp(base * 0.45 + Math.pow(canyon, 1.6) * 0.15 - Math.pow(1 - canyon, 2) * 0.1 + canyon * 0.25, 0, 1);
}

function craterProfile(distance, radius, rimHeight, depth) {
  const t = clamp(distance / Math.max(1e-6, radius), 0, 2);
  if (t >= 2) return 0;
  if (t < 1) return -depth * (Math.cos(t * Math.PI) * 0.5 + 0.5);
  return rimHeight * Math.exp(-Math.pow((t - 1) * 3.2, 2));
}

/** Height contribution of a deterministic crater field in [0,1] space. */
export function craterFieldNoise(x, y, options = {}) {
  const seed = Math.trunc(finite(options.seed, 0));
  const count = Math.round(clamp(finite(options.craterCount, 7), 0, 40));
  const random = seededRandom(seed + 9001);
  let height = fbmNoise(x * 1.4, y * 1.4, options) * 0.14;
  for (let i = 0; i < count; i++) {
    const cx = random(); const cy = random();
    const radius = 0.06 + random() * 0.16;
    const d = Math.hypot(x - cx, y - cy);
    height += craterProfile(d, radius, 0.05 + random() * 0.03, 0.09 + random() * 0.08);
  }
  return height;
}

export const NOISE_GENERATORS = Object.freeze({
  'fbm': (x, y, o) => fbmNoise(x, y, o) * 0.5 + 0.5,
  'ridged-multifractal': (x, y, o) => ridgedMultifractal(x, y, o),
  'billow': (x, y, o) => billowNoise(x, y, o),
  'domain-warped': (x, y, o) => domainWarpedNoise(x, y, o),
  'voronoi-canyon': (x, y, o) => voronoiCanyonNoise(x, y, o),
  'crater-field': (x, y, o) => clamp(0.5 + craterFieldNoise(x, y, o), 0, 1),
});

/** Create a heightmap object { width, height, data: Float32Array, ... }. */
export function createHeightmap(width, height, fill = 0) {
  const w = Math.round(clamp(finite(width, 64), 2, TERRAIN_MAX_RESOLUTION));
  const h = Math.round(clamp(finite(height, 64), 2, TERRAIN_MAX_RESOLUTION));
  return { width: w, height: h, data: new Float32Array(w * h).fill(finite(fill, 0)), min: 0, max: 1 };
}

export function cloneHeightmap(heightmap) {
  return { width: heightmap.width, height: heightmap.height, data: Float32Array.from(heightmap.data), min: heightmap.min ?? 0, max: heightmap.max ?? 1 };
}

export function heightmapStatistics(heightmap) {
  let min = Infinity; let max = -Infinity; let sum = 0;
  for (const v of heightmap.data) { min = Math.min(min, v); max = Math.max(max, v); sum += v; }
  const mean = heightmap.data.length ? sum / heightmap.data.length : 0;
  let variance = 0;
  for (const v of heightmap.data) variance += (v - mean) * (v - mean);
  return { min, max, mean, standardDeviation: heightmap.data.length ? Math.sqrt(variance / heightmap.data.length) : 0, width: heightmap.width, height: heightmap.height };
}

export function normaliseHeightmap(heightmap, targetMin = 0, targetMax = 1) {
  const stats = heightmapStatistics(heightmap);
  const out = cloneHeightmap(heightmap);
  const span = Math.max(1e-9, stats.max - stats.min);
  for (let i = 0; i < out.data.length; i++) out.data[i] = targetMin + ((out.data[i] - stats.min) / span) * (targetMax - targetMin);
  out.min = targetMin; out.max = targetMax;
  return out;
}

export function sampleHeightBilinear(heightmap, u, v) {
  const x = clamp(finite(u, 0), 0, 1) * (heightmap.width - 1);
  const y = clamp(finite(v, 0), 0, 1) * (heightmap.height - 1);
  const x0 = Math.floor(x); const y0 = Math.floor(y);
  const x1 = Math.min(heightmap.width - 1, x0 + 1);
  const y1 = Math.min(heightmap.height - 1, y0 + 1);
  const tx = x - x0; const ty = y - y0;
  const i = (xx, yy) => heightmap.data[yy * heightmap.width + xx];
  return lerp(lerp(i(x0, y0), i(x1, y0), tx), lerp(i(x0, y1), i(x1, y1), tx), ty);
}

export function heightmapNormal(heightmap, x, y, worldSpacing = 1, heightScale = 1) {
  const w = heightmap.width; const h = heightmap.height;
  const cx = clamp(Math.round(x), 1, w - 2); const cy = clamp(Math.round(y), 1, h - 2);
  const left = heightmap.data[cy * w + cx - 1]; const right = heightmap.data[cy * w + cx + 1];
  const down = heightmap.data[(cy - 1) * w + cx]; const up = heightmap.data[(cy + 1) * w + cx];
  const dx = (left - right) * heightScale / Math.max(1e-6, worldSpacing * 2);
  const dz = (down - up) * heightScale / Math.max(1e-6, worldSpacing * 2);
  const length = Math.hypot(dx, 1, dz) || 1;
  return [dx / length, 1 / length, dz / length];
}

export function slopeAt(heightmap, x, y, heightScale = 1) {
  const normal = heightmapNormal(heightmap, x, y, 1, heightScale);
  return Math.acos(clamp(normal[1], -1, 1));
}

/**
 * Generate a full heightmap from a noise pipeline. Options:
 * noise, seed, octaves, frequency, amplitude, persistence/lacunarity,
 * warpStrength, terraceSteps, islandFalloff, ridgeMix, seaLevel.
 */
export function generateHeightmap(options = {}) {
  const width = Math.round(clamp(finite(options.width ?? options.resolution, 96), 4, TERRAIN_MAX_RESOLUTION));
  const height = Math.round(clamp(finite(options.height ?? options.resolution, width), 4, TERRAIN_MAX_RESOLUTION));
  const noiseName = TERRAIN_NOISE_TYPES.includes(options.noise) ? options.noise : (TERRAIN_NOISE_TYPES.includes(options.type) ? options.type : 'ridged-multifractal');
  const generator = NOISE_GENERATORS[noiseName];
  const seed = Math.trunc(finite(options.seed, 7412));
  const frequency = clamp(finite(options.frequency, 3.2), 0.1, 32);
  const amplitude = clamp(finite(options.amplitude, 1), 0.05, 4);
  const heightmap = createHeightmap(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1); const v = y / (height - 1);
      let value = generator(u * frequency, v * frequency, { ...options, seed });
      if (options.ridgeMix) {
        value = lerp(value, ridgedMultifractal(u * frequency, v * frequency, { ...options, seed: seed + 5 }), clamp(finite(options.ridgeMix, 0), 0, 1));
      }
      if (options.terraceSteps && Number(options.terraceSteps) >= 2) {
        const steps = Math.round(options.terraceSteps);
        const stepped = Math.floor(value * steps) / steps;
        value = lerp(value, stepped + (value - stepped) * 0.25, clamp(finite(options.terraceAmount, 0.7), 0, 1));
      }
      if (options.islandFalloff) {
        const dx = u - 0.5; const dy = v - 0.5;
        const distance = Math.sqrt(dx * dx + dy * dy) * 2;
        const falloff = clamp(1 - Math.pow(Math.max(0, distance - 0.35) / 0.65, 2), 0, 1);
        value *= lerp(1, falloff, clamp(finite(options.islandFalloff, 1), 0, 1));
      }
      heightmap.data[y * width + x] = value * amplitude;
    }
  }
  const stats = heightmapStatistics(heightmap);
  heightmap.min = stats.min; heightmap.max = stats.max;
  heightmap.noise = noiseName;
  heightmap.seed = seed;
  return heightmap;
}

/**
 * Droplet hydraulic erosion (Beyer-style single-droplet sediment transport).
 * Returns a NEW heightmap plus erosion statistics; input is preserved.
 */
export function simulateHydraulicErosion(heightmap, options = {}) {
  const out = cloneHeightmap(heightmap);
  const width = out.width; const height = out.height;
  const iterations = Math.round(clamp(finite(options.iterations, 12000), 0, 400000));
  const inertia = clamp(finite(options.inertia, 0.06), 0, 1);
  const capacityFactor = clamp(finite(options.capacityFactor ?? options.rainRate, 3.2), 0.1, 24);
  const minCapacity = clamp(finite(options.minCapacity, 0.02), 0, 4);
  const erodeSpeed = clamp(finite(options.erodeSpeed ?? options.solubility, 0.28), 0, 1);
  const depositSpeed = clamp(finite(options.depositSpeed, 0.28), 0, 1);
  const evaporate = clamp(finite(options.evaporate ?? options.evaporation, 0.012), 0, 0.9);
  const gravity = clamp(finite(options.gravity, 4), 0.1, 40);
  const maxLifetime = Math.round(clamp(finite(options.maxDropletLifetime, 48), 4, 256));
  const initialWater = clamp(finite(options.initialWaterVolume, 1), 0.05, 8);
  const initialSpeed = clamp(finite(options.initialSpeed, 1), 0.01, 8);
  const random = seededRandom(options.seed ?? heightmap.seed ?? 99);
  const brushRadius = Math.round(clamp(finite(options.brushRadius, 3), 1, 8));
  const brushWeights = [];
  for (let y = -brushRadius; y <= brushRadius; y++) {
    for (let x = -brushRadius; x <= brushRadius; x++) {
      const d2 = x * x + y * y;
      if (d2 <= brushRadius * brushRadius) brushWeights.push({ dx: x, dy: y, weight: 1 - Math.sqrt(d2) / (brushRadius + 1) });
    }
  }
  const weightSum = brushWeights.reduce((s, b) => s + b.weight, 0) || 1;
  for (const b of brushWeights) b.weight /= weightSum;
  const index = (x, y) => y * width + x;
  let totalEroded = 0; let totalDeposited = 0; let dropletsCompleted = 0;

  for (let iteration = 0; iteration < iterations; iteration++) {
    let posX = random() * (width - 2) + 0.5;
    let posY = random() * (height - 2) + 0.5;
    let dirX = 0; let dirY = 0;
    let speed = initialSpeed;
    let water = initialWater;
    let sediment = 0;
    for (let lifetime = 0; lifetime < maxLifetime; lifetime++) {
      const cellX = Math.floor(posX); const cellY = Math.floor(posY);
      if (cellX < 1 || cellX >= width - 2 || cellY < 1 || cellY >= height - 2) break;
      const fracX = posX - cellX; const fracY = posY - cellY;
      const h00 = out.data[index(cellX, cellY)]; const h10 = out.data[index(cellX + 1, cellY)];
      const h01 = out.data[index(cellX, cellY + 1)]; const h11 = out.data[index(cellX + 1, cellY + 1)];
      const gradientX = (h10 - h00) * (1 - fracY) + (h11 - h01) * fracY;
      const gradientY = (h01 - h00) * (1 - fracX) + (h11 - h10) * fracX;
      const heightHere = h00 * (1 - fracX) * (1 - fracY) + h10 * fracX * (1 - fracY) + h01 * (1 - fracX) * fracY + h11 * fracX * fracY;
      dirX = dirX * inertia - gradientX * (1 - inertia);
      dirY = dirY * inertia - gradientY * (1 - inertia);
      const dirLength = Math.hypot(dirX, dirY);
      if (dirLength < 1e-9) {
        dirX = random() - 0.5; dirY = random() - 0.5;
      } else { dirX /= dirLength; dirY /= dirLength; }
      posX += dirX; posY += dirY;
      if (posX < 1 || posX >= width - 2 || posY < 1 || posY >= height - 2) break;
      const ncx = Math.floor(posX); const ncy = Math.floor(posY);
      const nfx = posX - ncx; const nfy = posY - ncy;
      const nh = out.data[index(ncx, ncy)] * (1 - nfx) * (1 - nfy) + out.data[index(ncx + 1, ncy)] * nfx * (1 - nfy)
        + out.data[index(ncx, ncy + 1)] * (1 - nfx) * nfy + out.data[index(ncx + 1, ncy + 1)] * nfx * nfy;
      const deltaHeight = nh - heightHere;
      const capacity = Math.max(-deltaHeight * speed * water * capacityFactor, minCapacity);
      if (sediment > capacity || deltaHeight > 0) {
        let amount = deltaHeight > 0 ? Math.min(deltaHeight, sediment) : (sediment - capacity) * depositSpeed;
        amount = Math.max(0, amount);
        sediment -= amount;
        totalDeposited += amount;
        const targets = [
          [cellX, cellY, (1 - fracX) * (1 - fracY)], [cellX + 1, cellY, fracX * (1 - fracY)],
          [cellX, cellY + 1, (1 - fracX) * fracY], [cellX + 1, cellY + 1, fracX * fracY],
        ];
        for (const [tx, ty, wgt] of targets) out.data[index(tx, ty)] += amount * wgt;
      } else {
        let amount = Math.min((capacity - sediment) * erodeSpeed, -deltaHeight - 0.0001 > 0 ? (capacity - sediment) * erodeSpeed : (capacity - sediment) * erodeSpeed);
        amount = Math.max(0, amount);
        for (const brush of brushWeights) {
          const bx = cellX + brush.dx; const by = cellY + brush.dy;
          if (bx < 0 || bx >= width || by < 0 || by >= height) continue;
          const weighed = amount * brush.weight;
          const actual = Math.min(out.data[index(bx, by)], weighed);
          out.data[index(bx, by)] -= actual;
          sediment += actual;
          totalEroded += actual;
        }
      }
      speed = Math.sqrt(Math.max(0, speed * speed + (-deltaHeight) * gravity));
      water *= (1 - evaporate);
      if (water < 0.001) break;
      if (lifetime === maxLifetime - 1) dropletsCompleted++;
    }
    dropletsCompleted++;
  }
  const stats = heightmapStatistics(out);
  out.min = stats.min; out.max = stats.max;
  return { heightmap: out, iterations, totalEroded, totalDeposited, dropletsCompleted, statistics: stats };
}

/**
 * Thermal talus erosion: material above the talus angle slides downhill
 * until slopes relax. Returns a NEW heightmap.
 */
export function simulateThermalErosion(heightmap, options = {}) {
  const out = cloneHeightmap(heightmap);
  const width = out.width; const height = out.height;
  const iterations = Math.round(clamp(finite(options.iterations, 24), 0, 500));
  const talus = clamp(finite(options.talusAngle, 0.045), 0.001, 1);
  const rate = clamp(finite(options.rate, 0.42), 0.01, 1);
  let movedTotal = 0;
  const deltas = new Float32Array(out.data.length);
  for (let iteration = 0; iteration < iterations; iteration++) {
    deltas.fill(0);
    let movedThisPass = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const here = out.data[i];
        let lowest = here; let lowestIndex = -1;
        const neighbours = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        for (const [nx, ny] of neighbours) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const ni = ny * width + nx;
          if (out.data[ni] < lowest) { lowest = out.data[ni]; lowestIndex = ni; }
        }
        if (lowestIndex >= 0 && here - lowest > talus) {
          const move = (here - lowest - talus) * 0.5 * rate;
          deltas[i] -= move;
          deltas[lowestIndex] += move;
          movedThisPass += move;
        }
      }
    }
    for (let i = 0; i < out.data.length; i++) out.data[i] += deltas[i];
    movedTotal += movedThisPass;
    if (movedThisPass < 1e-7) break;
  }
  return { heightmap: out, iterations, totalMoved: movedTotal };
}

/** Combined erosion pipeline: hydraulic passes + thermal relaxation. */
export function simulateTerrainErosion(heightmap, options = {}) {
  const hydraulic = simulateHydraulicErosion(heightmap, options);
  const thermal = simulateThermalErosion(hydraulic.heightmap, {
    iterations: options.thermalIterations ?? 18,
    talusAngle: options.talusAngle ?? 0.05,
    rate: options.thermalRate ?? 0.4,
  });
  const resultHeightmap = options.thermalIterations === 0 ? hydraulic.heightmap : thermal.heightmap;
  const stats = heightmapStatistics(resultHeightmap);
  return {
    heightmap: resultHeightmap,
    hydraulic: { iterations: hydraulic.iterations, totalEroded: hydraulic.totalEroded, totalDeposited: hydraulic.totalDeposited, dropletsCompleted: hydraulic.dropletsCompleted },
    thermal: { iterations: thermal.iterations, totalMoved: thermal.totalMoved },
    statistics: stats,
    iterations: hydraulic.iterations,
  };
}

export const BIOME_COLORS = Object.freeze({
  'snowy-peaks': [0.93, 0.96, 1.0],
  'exposed-cliff-rock': [0.45, 0.44, 0.46],
  'alpine-grass': [0.32, 0.55, 0.3],
  'wet-sand': [0.76, 0.68, 0.5],
  'lava-cracks': [0.16, 0.1, 0.1],
  'forest-floor': [0.24, 0.4, 0.24],
  'desert-dunes': [0.85, 0.7, 0.45],
  'tundra': [0.6, 0.62, 0.52],
});

/** Moisture model: altitude lapse + windward exposure + noise mottle. */
export function computeMoistureMap(heightmap, options = {}) {
  const out = new Float32Array(heightmap.data.length);
  const seed = Math.trunc(finite(options.seed, heightmap.seed ?? 7));
  const stats = heightmapStatistics(heightmap);
  for (let y = 0; y < heightmap.height; y++) {
    for (let x = 0; x < heightmap.width; x++) {
      const i = y * heightmap.width + x;
      const altitude = (heightmap.data[i] - stats.min) / Math.max(1e-9, stats.max - stats.min);
      const noise = valueNoise2(x * 0.05, y * 0.05, seed);
      const windward = clamp(0.5 + (heightmapNormal(heightmap, x, y)[0] * -1), 0, 1);
      out[i] = clamp(0.25 + noise * 0.45 + windward * 0.25 - altitude * 0.22 + finite(options.moistureBias, 0), 0, 1);
    }
  }
  return out;
}

/**
 * Slope/altitude/moisture splat classifier. Returns per-cell biome names,
 * a weight table for the top biomes and the derived vertex colours.
 */
export function computeTerrainBiomeWeights(heightmap, options = {}) {
  const stats = heightmapStatistics(heightmap);
  const moisture = options.moistureMap && options.moistureMap.length === heightmap.data.length
    ? options.moistureMap : computeMoistureMap(heightmap, options);
  const seaLevel = clamp(finite(options.seaLevel, 0.22), 0, 1);
  const snowLine = clamp(finite(options.snowLine, 0.78), 0, 1);
  const lavaLevel = clamp(finite(options.lavaLevel, 0.06), 0, 1);
  const heightScale = clamp(finite(options.heightScale, 14), 0.1, 400);
  const biomes = new Array(heightmap.data.length);
  const colors = new Float32Array(heightmap.data.length * 3);
  const weights = { 'snowy-peaks': 0, 'exposed-cliff-rock': 0, 'alpine-grass': 0, 'wet-sand': 0, 'lava-cracks': 0, 'forest-floor': 0, 'desert-dunes': 0, 'tundra': 0 };
  for (let y = 0; y < heightmap.height; y++) {
    for (let x = 0; x < heightmap.width; x++) {
      const i = y * heightmap.width + x;
      const altitude = (heightmap.data[i] - stats.min) / Math.max(1e-9, stats.max - stats.min);
      const slope = slopeAt(heightmap, x, y, heightScale);
      const wet = moisture[i];
      let biome;
      if (altitude <= lavaLevel && slope < 0.5) biome = 'lava-cracks';
      else if (altitude <= seaLevel + 0.03) biome = 'wet-sand';
      else if (slope > 0.85) biome = 'exposed-cliff-rock';
      else if (altitude >= snowLine && slope <= 1.05) biome = 'snowy-peaks';
      else if (altitude >= snowLine - 0.14) biome = wet > 0.45 ? 'alpine-grass' : 'tundra';
      else if (wet > 0.62) biome = 'forest-floor';
      else if (wet < 0.28) biome = 'desert-dunes';
      else biome = 'alpine-grass';
      biomes[i] = biome;
      weights[biome]++;
      const color = BIOME_COLORS[biome];
      colors[i * 3] = color[0]; colors[i * 3 + 1] = color[1]; colors[i * 3 + 2] = color[2];
    }
  }
  const total = Math.max(1, heightmap.data.length);
  for (const key of Object.keys(weights)) weights[key] = Number((weights[key] / total).toFixed(4));
  return { biomes, weights, colors, moisture, statistics: stats };
}

/** Bake the biome classification into an RGB PNG splat texture (data URL). */
export function bakeTerrainSplatTexture(heightmap, options = {}) {
  const { colors } = computeTerrainBiomeWeights(heightmap, options);
  const bytes = new Uint8Array(heightmap.width * heightmap.height * 4);
  for (let i = 0; i < heightmap.data.length; i++) {
    bytes[i * 4] = Math.round(clamp(colors[i * 3], 0, 1) * 255);
    bytes[i * 4 + 1] = Math.round(clamp(colors[i * 3 + 1], 0, 1) * 255);
    bytes[i * 4 + 2] = Math.round(clamp(colors[i * 3 + 2], 0, 1) * 255);
    bytes[i * 4 + 3] = 255;
  }
  return encodeRgbaToPngDataUrl(heightmap.width, heightmap.height, bytes);
}

/** Bake a grayscale heightmap PNG for external landscape tools. */
export function bakeHeightmapTexture(heightmap) {
  const stats = heightmapStatistics(heightmap);
  const bytes = new Uint8Array(heightmap.width * heightmap.height * 4);
  for (let i = 0; i < heightmap.data.length; i++) {
    const v = Math.round(clamp((heightmap.data[i] - stats.min) / Math.max(1e-9, stats.max - stats.min), 0, 1) * 255);
    bytes[i * 4] = v; bytes[i * 4 + 1] = v; bytes[i * 4 + 2] = v; bytes[i * 4 + 3] = 255;
  }
  return encodeRgbaToPngDataUrl(heightmap.width, heightmap.height, bytes);
}

/**
 * Convert a heightmap into an indexed-agnostic triangle soup (positions,
 * normals via central differences, biome vertex colours, uv grid).
 */
export function heightmapToTriangleMesh(heightmap, options = {}) {
  const size = clamp(finite(options.size, 32), 0.5, 4000);
  const heightScale = clamp(finite(options.heightScale, 6), 0.05, 1000);
  const skirt = clamp(finite(options.skirtDepth, 0), 0, 100);
  const biome = computeTerrainBiomeWeights(heightmap, { ...options, heightScale });
  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  const w = heightmap.width; const h = heightmap.height;
  const vertex = (x, y) => {
    const u = x / (w - 1); const v = y / (h - 1);
    const px = (u - 0.5) * size;
    const pz = (v - 0.5) * size;
    const py = heightmap.data[y * w + x] * heightScale;
    const normal = heightmapNormal(heightmap, x, y, size / Math.max(1, w - 1), heightScale);
    return { position: [px, py, pz], normal, uv: [u, v], index: y * w + x };
  };
  const pushVertex = (vertexData) => {
    positions.push(...vertexData.position);
    normals.push(...vertexData.normal);
    uvs.push(...vertexData.uv);
    colors.push(biome.colors[vertexData.index * 3], biome.colors[vertexData.index * 3 + 1], biome.colors[vertexData.index * 3 + 2]);
  };
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a = vertex(x, y); const b = vertex(x + 1, y); const c = vertex(x, y + 1); const d = vertex(x + 1, y + 1);
      pushVertex(a); pushVertex(c); pushVertex(b);
      pushVertex(b); pushVertex(c); pushVertex(d);
    }
  }
  if (skirt > 0) {
    const border = [];
    for (let x = 0; x < w; x++) border.push([x, 0]);
    for (let y = 1; y < h; y++) border.push([w - 1, y]);
    for (let x = w - 2; x >= 0; x--) border.push([x, h - 1]);
    for (let y = h - 2; y >= 1; y--) border.push([0, y]);
    for (let i = 0; i < border.length; i++) {
      const [x1, y1] = border[i];
      const [x2, y2] = border[(i + 1) % border.length];
      const top1 = vertex(x1, y1); const top2 = vertex(x2, y2);
      const low1 = { ...top1, position: [top1.position[0], top1.position[1] - skirt, top1.position[2]], normal: [0, -1, 0] };
      const low2 = { ...top2, position: [top2.position[0], top2.position[1] - skirt, top2.position[2]], normal: [0, -1, 0] };
      pushVertex(top1); pushVertex(low1); pushVertex(top2);
      pushVertex(top2); pushVertex(low1); pushVertex(low2);
    }
  }
  const geometry = new Float32Array(positions);
  return {
    geometry,
    positions: geometry,
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    vertexColors: new Float32Array(colors),
    uvs: new Float32Array(uvs),
    triangleCount: geometry.length / 9,
    vertexCount: geometry.length / 3,
    biomeWeights: biome.weights,
    size, heightScale,
  };
}

/** Simple Bridson Poisson-disk sampler in UV space. */
export function poissonDiskSample(count, options = {}) {
  const random = seededRandom(options.seed ?? 5150);
  const minDistance = clamp(finite(options.minDistance, 0.06), 0.005, 0.9);
  const maxAttempts = Math.round(clamp(finite(options.maxAttempts, 30), 1, 200));
  const points = [];
  const limit = Math.round(clamp(finite(count, 100), 1, 20000));
  let guard = limit * maxAttempts;
  while (points.length < limit && guard-- > 0) {
    const candidate = { u: random(), v: random() };
    let ok = true;
    for (const p of points) {
      if (Math.hypot(p.u - candidate.u, p.v - candidate.v) < minDistance) { ok = false; break; }
    }
    if (ok) points.push(candidate);
  }
  return points;
}

export const FOLIAGE_KINDS = Object.freeze({
  pine: { biomes: ['alpine-grass', 'forest-floor', 'tundra'], maxSlope: 0.75, color: '#2f7258', scale: [0.8, 1.6] },
  crystal: { biomes: ['exposed-cliff-rock', 'snowy-peaks', 'lava-cracks'], maxSlope: 1.15, color: '#56f0e8', scale: [0.4, 1.1] },
  boulder: { biomes: ['exposed-cliff-rock', 'alpine-grass', 'desert-dunes', 'tundra'], maxSlope: 1.25, color: '#7c8582', scale: [0.5, 1.8] },
  ruin: { biomes: ['alpine-grass', 'forest-floor', 'desert-dunes'], maxSlope: 0.55, color: '#a7adba', scale: [0.7, 1.4] },
  palm: { biomes: ['wet-sand'], maxSlope: 0.4, color: '#3e9c5f', scale: [0.9, 1.5] },
  cactus: { biomes: ['desert-dunes'], maxSlope: 0.5, color: '#3f7d4e', scale: [0.6, 1.3] },
});

/**
 * Scatter biome foliage over a heightmap. Poisson-disk spacing, biome and
 * slope filtering, surface-normal alignment and deterministic scaling.
 * Returns placements [{ kind, position, normal, scale, yaw, biome, color }].
 */
export function scatterBiomeFoliageOnTerrain(heightmap, options = {}) {
  const size = clamp(finite(options.size, 32), 0.5, 4000);
  const heightScale = clamp(finite(options.heightScale, 6), 0.05, 1000);
  const count = Math.round(clamp(finite(options.count, 160), 1, 8000));
  const random = seededRandom(options.seed ?? (heightmap.seed ?? 31) + 700);
  const biomeData = computeTerrainBiomeWeights(heightmap, { ...options, heightScale });
  const points = poissonDiskSample(count * 2, { seed: (options.seed ?? 31) + 701, minDistance: clamp(finite(options.minDistance, 0.035), 0.004, 0.5) });
  const requested = Array.isArray(options.kinds) && options.kinds.length ? options.kinds.filter((k) => FOLIAGE_KINDS[k]) : Object.keys(FOLIAGE_KINDS);
  const placements = [];
  for (const point of points) {
    if (placements.length >= count) break;
    const gx = clamp(Math.round(point.u * (heightmap.width - 1)), 1, heightmap.width - 2);
    const gy = clamp(Math.round(point.v * (heightmap.height - 1)), 1, heightmap.height - 2);
    const biome = biomeData.biomes[gy * heightmap.width + gx];
    const eligible = requested.filter((kind) => FOLIAGE_KINDS[kind].biomes.includes(biome));
    if (!eligible.length) continue;
    const slope = slopeAt(heightmap, gx, gy, heightScale);
    const kind = eligible[Math.floor(random() * eligible.length) % eligible.length];
    const rule = FOLIAGE_KINDS[kind];
    if (slope > rule.maxSlope) continue;
    if (random() < clamp(finite(options.densitySkip, 0.12), 0, 0.9)) continue;
    const worldX = (point.u - 0.5) * size;
    const worldZ = (point.v - 0.5) * size;
    const worldY = sampleHeightBilinear(heightmap, point.u, point.v) * heightScale;
    const normal = heightmapNormal(heightmap, gx, gy, size / Math.max(1, heightmap.width - 1), heightScale);
    const scale = rule.scale[0] + random() * (rule.scale[1] - rule.scale[0]);
    placements.push({
      kind,
      type: kind,
      position: { x: Number(worldX.toFixed(3)), y: Number(worldY.toFixed(3)), z: Number(worldZ.toFixed(3)) },
      normal: { x: Number(normal[0].toFixed(3)), y: Number(normal[1].toFixed(3)), z: Number(normal[2].toFixed(3)) },
      normalArray: normal,
      scale: Number(scale.toFixed(3)),
      yaw: Number((random() * Math.PI * 2).toFixed(3)),
      biome,
      color: rule.color,
      uv: { u: point.u, v: point.v },
    });
  }
  return placements;
}

export function summarizeFoliageScatter(placements) {
  const byKind = {}; const byBiome = {};
  for (const p of placements) {
    byKind[p.kind] = (byKind[p.kind] || 0) + 1;
    byBiome[p.biome] = (byBiome[p.biome] || 0) + 1;
  }
  return { total: placements.length, byKind, byBiome };
}

/**
 * One-call terrain production: generate -> erode -> classify -> mesh +
 * foliage + splat texture. This is what the Studio Terrain Lab button runs.
 */
export function buildErodedTerrainScene(options = {}) {
  const generated = generateHeightmap(options);
  const erosion = simulateTerrainErosion(generated, {
    iterations: options.erosionIterations ?? options.iterations ?? 9000,
    rainRate: options.rainRate ?? 3.2,
    solubility: options.solubility ?? 0.28,
    evaporation: options.evaporation ?? 0.012,
    talusAngle: options.talusAngle ?? 0.05,
    thermalIterations: options.thermalIterations ?? 14,
    seed: options.seed ?? generated.seed,
  });
  const heightScale = clamp(finite(options.heightScale, 6), 0.05, 1000);
  const size = clamp(finite(options.size, 32), 0.5, 4000);
  const mesh = heightmapToTriangleMesh(erosion.heightmap, { ...options, size, heightScale });
  const foliage = scatterBiomeFoliageOnTerrain(erosion.heightmap, { ...options, size, heightScale, count: options.foliageCount ?? options.count ?? 140 });
  return {
    heightmap: erosion.heightmap,
    sourceHeightmap: generated,
    erosion,
    mesh,
    geometry: mesh.geometry,
    foliage,
    placements: foliage,
    foliageSummary: summarizeFoliageScatter(foliage),
    biomeWeights: mesh.biomeWeights,
    splatTexture: options.bakeTextures === false ? null : bakeTerrainSplatTexture(erosion.heightmap, options),
    heightTexture: options.bakeTextures === false ? null : bakeHeightmapTexture(erosion.heightmap),
    statistics: erosion.statistics,
  };
}

export const TERRAIN_PRESETS = Object.freeze({
  'alpine-ridged': { label: 'Alpine Ridged Peaks', noise: 'ridged-multifractal', frequency: 3.4, octaves: 6, seed: 7412, heightScale: 9, snowLine: 0.72 },
  'canyon-voronoi': { label: 'Voronoi Canyonlands', noise: 'voronoi-canyon', frequency: 4.2, octaves: 4, seed: 311, heightScale: 5 },
  'island-domain-warped': { label: 'Domain-Warped Island', noise: 'domain-warped', frequency: 2.6, octaves: 5, seed: 902, islandFalloff: 1, heightScale: 5 },
  'moon-crater-field': { label: 'Moon Crater Field', noise: 'crater-field', frequency: 2, octaves: 4, seed: 55, craterCount: 12, heightScale: 3 },
  'rolling-billow-hills': { label: 'Rolling Billow Hills', noise: 'billow', frequency: 3, octaves: 5, seed: 1234, heightScale: 4 },
  'terraced-fbm-plateau': { label: 'Terraced FBM Plateau', noise: 'fbm', frequency: 3, octaves: 5, seed: 808, terraceSteps: 7, heightScale: 6 },
  'volcanic-isles': { label: 'Volcanic Isles', noise: 'ridged-multifractal', frequency: 2.8, octaves: 5, seed: 2024, heightScale: 7, islandFalloff: 1 },
  'desert-dunes-oasis': { label: 'Desert Dunes Oasis', noise: 'billow', frequency: 2.2, octaves: 4, seed: 415, heightScale: 3 },
});

export function getTerrainPreset(presetId) {
  const preset = TERRAIN_PRESETS[presetId];
  if (!preset) throw new Error(`Unknown terrain preset "${presetId}". Available: ${Object.keys(TERRAIN_PRESETS).join(', ')}.`);
  return { ...preset };
}

export function buildTerrainFromPreset(presetId, options = {}) {
  return buildErodedTerrainScene({ ...getTerrainPreset(presetId), ...options });
}

/** Downsample a heightmap by an integer factor (LOD helper). */
export function downsampleHeightmap(heightmap, factor = 2) {
  const step = Math.max(1, Math.round(factor));
  const width = Math.max(2, Math.floor((heightmap.width - 1) / step) + 1);
  const height = Math.max(2, Math.floor((heightmap.height - 1) / step) + 1);
  const out = createHeightmap(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out.data[y * width + x] = heightmap.data[Math.min(heightmap.height - 1, y * step) * heightmap.width + Math.min(heightmap.width - 1, x * step)];
    }
  }
  return out;
}

/** Upsample a heightmap with bilinear interpolation (detail injection base). */
export function upsampleHeightmap(heightmap, factor = 2) {
  const width = (heightmap.width - 1) * Math.max(1, Math.round(factor)) + 1;
  const height = (heightmap.height - 1) * Math.max(1, Math.round(factor)) + 1;
  const out = createHeightmap(Math.min(width, TERRAIN_MAX_RESOLUTION), Math.min(height, TERRAIN_MAX_RESOLUTION));
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      out.data[y * out.width + x] = sampleHeightBilinear(heightmap, x / (out.width - 1), y / (out.height - 1));
    }
  }
  return out;
}

/** Add a raised circular plateau / caldera at a UV position. */
export function stampTerrainFeature(heightmap, options = {}) {
  const out = cloneHeightmap(heightmap);
  const cx = clamp(finite(options.u, 0.5), 0, 1) * (out.width - 1);
  const cy = clamp(finite(options.v, 0.5), 0, 1) * (out.height - 1);
  const radius = clamp(finite(options.radius, 0.18), 0.01, 1) * Math.max(out.width, out.height);
  const amount = clamp(finite(options.amount, 0.25), -2, 2);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const d = Math.hypot(x - cx, y - cy) / radius;
      if (d < 1) out.data[y * out.width + x] += amount * (Math.cos(d * Math.PI) * 0.5 + 0.5);
    }
  }
  return out;
}

export function heightmapToWorldY(heightmap, worldX, worldZ, options = {}) {
  const size = clamp(finite(options.size, 32), 0.5, 4000);
  const u = clamp(worldX / size + 0.5, 0, 1);
  const v = clamp(worldZ / size + 0.5, 0, 1);
  return sampleHeightBilinear(heightmap, u, v) * clamp(finite(options.heightScale, 6), 0.05, 1000);
}

/* ------------------------------------------------------------------ */
/* Hydrology, rivers, coastlines and heightmap compositing            */
/* ------------------------------------------------------------------ */

/**
 * D8 flow-accumulation: every cell drains to its lowest neighbour; counts
 * how many upstream cells feed each cell. Rivers live in high cells.
 */
export function computeFlowAccumulation(heightmap) {
  const width = heightmap.width; const height = heightmap.height;
  const accumulation = new Float32Array(heightmap.data.length).fill(1);
  const order = Array.from(heightmap.data, (value, index) => [value, index]).sort((a, b) => b[0] - a[0]);
  const lowestNeighbour = (index) => {
    const x = index % width; const y = Math.floor(index / width);
    let best = index; let bestValue = heightmap.data[index];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = ny * width + nx;
        if (heightmap.data[ni] < bestValue) { bestValue = heightmap.data[ni]; best = ni; }
      }
    }
    return best;
  };
  for (const [, index] of order) {
    const target = lowestNeighbour(index);
    if (target !== index) accumulation[target] += accumulation[index];
  }
  let max = 0;
  for (const v of accumulation) max = Math.max(max, v);
  return { accumulation, max, normalised: Float32Array.from(accumulation, (v) => v / Math.max(1, max)) };
}

/** Carve river channels where flow accumulation exceeds a threshold. */
export function carveRiversFromFlow(heightmap, options = {}) {
  const { accumulation, max } = computeFlowAccumulation(heightmap);
  const out = cloneHeightmap(heightmap);
  const threshold = clamp(finite(options.threshold, 0.06), 0.001, 1) * Math.max(1, max);
  const depth = clamp(finite(options.depth, 0.08), 0, 2);
  let carvedCells = 0;
  for (let i = 0; i < out.data.length; i++) {
    if (accumulation[i] > threshold) {
      const strength = clamp((accumulation[i] - threshold) / Math.max(1, max - threshold), 0, 1);
      out.data[i] -= depth * Math.sqrt(strength);
      carvedCells++;
    }
  }
  return { heightmap: out, carvedCells, maxAccumulation: max };
}

/** Walk a greedy downhill river path from a UV source; returns waypoints. */
export function traceRiverPath(heightmap, options = {}) {
  const width = heightmap.width; const height = heightmap.height;
  let x = clamp(Math.round(clamp(finite(options.u, 0.3), 0, 1) * (width - 1)), 1, width - 2);
  let y = clamp(Math.round(clamp(finite(options.v, 0.3), 0, 1) * (height - 1)), 1, height - 2);
  const path = [{ x, y, height: heightmap.data[y * width + x] }];
  const visited = new Set([y * width + x]);
  const maxSteps = Math.round(clamp(finite(options.maxSteps, 400), 1, 10000));
  for (let step = 0; step < maxSteps; step++) {
    let best = null; let bestValue = heightmap.data[y * width + x];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = ny * width + nx;
        if (visited.has(ni)) continue;
        if (heightmap.data[ni] < bestValue) { bestValue = heightmap.data[ni]; best = { x: nx, y: ny }; }
      }
    }
    if (!best) break;
    x = best.x; y = best.y;
    visited.add(y * width + x);
    path.push({ x, y, height: bestValue });
    if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) break;
  }
  return path;
}

/** Flatten a coastal shelf around sea level for beaches and ports. */
export function applyCoastalTerrace(heightmap, options = {}) {
  const out = cloneHeightmap(heightmap);
  const stats = heightmapStatistics(out);
  const sea = stats.min + clamp(finite(options.seaLevel, 0.22), 0, 1) * (stats.max - stats.min);
  const band = Math.max(1e-6, clamp(finite(options.band, 0.05), 0.001, 1) * (stats.max - stats.min));
  const strength = clamp(finite(options.strength, 0.7), 0, 1);
  for (let i = 0; i < out.data.length; i++) {
    const distance = Math.abs(out.data[i] - sea);
    if (distance < band) {
      const target = sea + Math.sign(out.data[i] - sea) * band * 0.25;
      out.data[i] = lerp(out.data[i], target, strength * (1 - distance / band));
    }
  }
  return out;
}

/** Blend two heightmaps with a scalar, mask map, or smoothstep altitude mask. */
export function blendHeightmaps(a, b, options = {}) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('blendHeightmaps requires equal resolutions.');
  const out = createHeightmap(a.width, a.height);
  const mask = options.mask && options.mask.length === a.data.length ? options.mask : null;
  const factor = clamp(finite(options.factor, 0.5), 0, 1);
  const mode = String(options.mode || 'mix');
  for (let i = 0; i < out.data.length; i++) {
    const t = mask ? clamp(finite(mask[i], 0), 0, 1) : factor;
    if (mode === 'max') out.data[i] = lerp(a.data[i], Math.max(a.data[i], b.data[i]), t);
    else if (mode === 'min') out.data[i] = lerp(a.data[i], Math.min(a.data[i], b.data[i]), t);
    else if (mode === 'multiply') out.data[i] = lerp(a.data[i], a.data[i] * b.data[i], t);
    else if (mode === 'add') out.data[i] = a.data[i] + b.data[i] * t;
    else out.data[i] = lerp(a.data[i], b.data[i], t);
  }
  return out;
}

export function maskByAltitude(heightmap, options = {}) {
  const stats = heightmapStatistics(heightmap);
  const low = finite(options.low, stats.min); const high = finite(options.high, stats.max);
  const out = new Float32Array(heightmap.data.length);
  for (let i = 0; i < out.data.length; i++) {
    const t = clamp((heightmap.data[i] - low) / Math.max(1e-9, high - low), 0, 1);
    out[i] = options.invert ? 1 - t : t;
  }
  return out;
}

export function maskBySlope(heightmap, options = {}) {
  const out = new Float32Array(heightmap.data.length);
  const minSlope = finite(options.minSlope, 0.2); const maxSlope = finite(options.maxSlope, 0.9);
  for (let y = 0; y < heightmap.height; y++) {
    for (let x = 0; x < heightmap.width; x++) {
      const slope = slopeAt(heightmap, x, y, finite(options.heightScale, 6));
      const t = clamp((slope - minSlope) / Math.max(1e-9, maxSlope - minSlope), 0, 1);
      out[y * heightmap.width + x] = options.invert ? 1 - t : t;
    }
  }
  return out;
}

/** Accumulate wind-blown snow on lee slopes above the snow line. */
export function applySnowAccumulation(heightmap, options = {}) {
  const out = cloneHeightmap(heightmap);
  const stats = heightmapStatistics(out);
  const snowLine = stats.min + clamp(finite(options.snowLine, 0.72), 0, 1) * (stats.max - stats.min);
  const amount = clamp(finite(options.amount, 0.03), 0, 1);
  const windX = clamp(finite(options.windX, -0.6), -2, 2);
  for (let y = 1; y < out.height - 1; y++) {
    for (let x = 1; x < out.width - 1; x++) {
      const i = y * out.width + x;
      if (out.data[i] < snowLine) continue;
      const normal = heightmapNormal(out, x, y);
      const lee = clamp(0.5 - normal[0] * windX, 0, 1);
      const flatness = clamp(normal[1], 0, 1);
      out.data[i] += amount * lee * flatness;
    }
  }
  return out;
}

/** Directional wind erosion: erode windward faces, deposit in lee pockets. */
export function simulateWindErosion(heightmap, options = {}) {
  const out = cloneHeightmap(heightmap);
  const iterations = Math.round(clamp(finite(options.iterations, 10), 0, 200));
  const windX = Math.sign(finite(options.windX, 1)) || 1;
  const strength = clamp(finite(options.strength, 0.012), 0, 0.5);
  for (let pass = 0; pass < iterations; pass++) {
    const source = Float32Array.from(out.data);
    for (let y = 1; y < out.height - 1; y++) {
      for (let x = 1; x < out.width - 1; x++) {
        const i = y * out.width + x;
        const upwind = source[y * out.width + x - windX];
        const exposed = source[i] - upwind;
        if (exposed > 0) {
          const move = exposed * strength;
          out.data[i] -= move;
          const leeIndex = y * out.width + clamp(x + windX * 2, 0, out.width - 1);
          out.data[leeIndex] += move * 0.7;
        }
      }
    }
  }
  return { heightmap: out, iterations };
}

/** Bake a slope/roughness texture used by the material graph as a mask. */
export function bakeSlopeTexture(heightmap, options = {}) {
  const mask = maskBySlope(heightmap, options);
  const bytes = new Uint8Array(heightmap.width * heightmap.height * 4);
  for (let i = 0; i < mask.length; i++) {
    const v = Math.round(clamp(mask[i], 0, 1) * 255);
    bytes[i * 4] = v; bytes[i * 4 + 1] = v; bytes[i * 4 + 2] = v; bytes[i * 4 + 3] = 255;
  }
  return encodeRgbaToPngDataUrl(heightmap.width, heightmap.height, bytes);
}

/** Full hydrology pipeline: erode, carve rivers, terrace the coast. */
export function buildRiverTerrain(heightmap, options = {}) {
  const erosion = simulateTerrainErosion(heightmap, options);
  const carved = carveRiversFromFlow(erosion.heightmap, options);
  const coast = options.coastal === false ? carved.heightmap : applyCoastalTerrace(carved.heightmap, options);
  return { heightmap: coast, erosion, carvedCells: carved.carvedCells, riverPath: traceRiverPath(coast, options) };
}
