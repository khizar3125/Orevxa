/** Non-destructive, bounded modifier stack for Orvexa Modeler and Forge scenes. */
import { mirrorDuplicateTriangleMesh, optimizeTriangleMesh, subdivideTriangleMesh } from './engine.js';
import { bevelTriangleMesh } from './meshEdit.js';
import { decimateTriangleMesh } from './naniteLod.js';

const MAX_FLOATS = 2_250_000;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const AXIS = Object.freeze({ x: 0, y: 1, z: 2 });

export const MODIFIER_TYPES = Object.freeze([
  { id: 'subdivision', label: 'Subdivision', description: 'Split each triangle into four triangles. Reversible until applied.' },
  { id: 'mirror', label: 'Mirror', description: 'Reflect the mesh across a local axis.' },
  { id: 'array', label: 'Array', description: 'Repeat the mesh along a local offset.' },
  { id: 'solidify', label: 'Solidify', description: 'Give an open surface thickness and create side walls.' },
  { id: 'bevel', label: 'Bevel', description: 'Offset planar face regions and bridge their boundaries to bevel edges and corners.' },
  { id: 'smooth', label: 'Smooth', description: 'Relax connected vertices while preserving the original triangle count.' },
  { id: 'displace', label: 'Displace', description: 'Apply deterministic procedural displacement along a local axis.' },
  { id: 'optimize', label: 'Cleanup', description: 'Remove degenerate and duplicate triangles.' },
  { id: 'simpleDeform', label: 'Simple Deform', description: 'Twist, bend or taper the mesh around an axis (Blender Simple Deform).' },
  { id: 'decimate', label: 'Decimate', description: 'QEM edge-collapse decimation powered by decimateTriangleMesh (Nanite LOD).' },
  { id: 'remesh', label: 'Remesh', description: 'Voxel-grid remesh: snap welded vertices to a regular grid and rebuild clean topology.' },
  { id: 'wireframe', label: 'Wireframe', description: 'Convert triangle edges into thin solid wireframe strips.' },
  { id: 'wave', label: 'Wave', description: 'Animated-style sinusoidal wave displacement along the surface.' },
]);

export function normalizeModifier(input = {}, index = 1) {
  const type = MODIFIER_TYPES.some(item => item.id === input.type) ? input.type : 'subdivision';
  const defaults = {
    subdivision: { levels: 1 }, mirror: { axis: 'x' }, array: { count: 2, offsetX: 2, offsetY: 0, offsetZ: 0 },
    solidify: { thickness: 0.1, offset: 0 }, bevel: { width: 0.08 }, smooth: { iterations: 1, factor: 0.25 },
    displace: { axis: 'y', amount: 0.1, frequency: 2.5, seed: 17 }, optimize: { tolerance: 0.00001 },
    simpleDeform: { mode: 'twist', axis: 'y', angle: 45, factor: 0.5 }, decimate: { targetRatio: 0.5 },
    remesh: { voxelSize: 0.25, depth: 4 }, wireframe: { thickness: 0.02 }, wave: { amplitude: 0.12, frequency: 3, speed: 1, phase: 0 },
  }[type];
  const value = { ...defaults, ...input };
  return {
    id: String(input.id || `modifier-${Date.now().toString(36)}-${index.toString(36)}`),
    name: String(input.name || MODIFIER_TYPES.find(item => item.id === type).label).slice(0, 80),
    type, enabled: input.enabled !== false,
    ...(type === 'subdivision' ? { levels: Math.round(clamp(finite(value.levels, 1), 1, 3)) } : {}),
    ...(type === 'mirror' ? { axis: AXIS[value.axis] !== undefined ? value.axis : 'x' } : {}),
    ...(type === 'array' ? { count: Math.round(clamp(finite(value.count, 2), 2, 32)), offsetX: clamp(finite(value.offsetX, 2), -1000, 1000), offsetY: clamp(finite(value.offsetY, 0), -1000, 1000), offsetZ: clamp(finite(value.offsetZ, 0), -1000, 1000) } : {}),
    ...(type === 'solidify' ? { thickness: clamp(finite(value.thickness, 0.1), 0.001, 10), offset: clamp(finite(value.offset, 0), -1, 1) } : {}),
    ...(type === 'bevel' ? { width: clamp(finite(value.width, 0.08), 0.005, 0.35) } : {}),
    ...(type === 'smooth' ? { iterations: Math.round(clamp(finite(value.iterations, 1), 1, 5)), factor: clamp(finite(value.factor, 0.25), 0, 0.9) } : {}),
    ...(type === 'displace' ? { axis: AXIS[value.axis] !== undefined ? value.axis : 'y', amount: clamp(finite(value.amount, 0.1), -5, 5), frequency: clamp(finite(value.frequency, 2.5), 0.1, 40), seed: Math.round(clamp(finite(value.seed, 17), -100000, 100000)) } : {}),
    ...(type === 'optimize' ? { tolerance: clamp(finite(value.tolerance, 0.00001), 1e-9, 0.01) } : {}),
    ...(type === 'simpleDeform' ? { mode: ['twist', 'bend', 'taper'].includes(value.mode) ? value.mode : (['twist', 'bend', 'taper'].includes(value.deformMode) ? value.deformMode : 'twist'), deformMode: ['twist', 'bend', 'taper'].includes(value.mode) ? value.mode : (['twist', 'bend', 'taper'].includes(value.deformMode) ? value.deformMode : 'twist'), axis: AXIS[value.axis] !== undefined ? value.axis : 'y', angle: clamp(finite(value.angle, 45), -720, 720), factor: clamp(finite(value.factor, 0.5), -5, 5) } : {}),
    ...(type === 'decimate' ? { targetRatio: clamp(finite(value.targetRatio ?? value.ratio, 0.5), 0.02, 1) } : {}),
    ...(type === 'remesh' ? { voxelSize: clamp(finite(value.voxelSize, 0.25), 0.01, 5), depth: Math.round(clamp(finite(value.depth, 4), 1, 8)) } : {}),
    ...(type === 'wireframe' ? { thickness: clamp(finite(value.thickness, 0.02), 0.001, 1) } : {}),
    ...(type === 'wave' ? { amplitude: clamp(finite(value.amplitude, 0.12), -3, 3), frequency: clamp(finite(value.frequency, 3), 0.1, 40), speed: clamp(finite(value.speed, 1), -20, 20), phase: clamp(finite(value.phase, 0), -1000, 1000) } : {}),
  };
}

function validGeometry(geometry) {
  if (!(Array.isArray(geometry) || ArrayBuffer.isView(geometry)) || geometry.length < 9 || geometry.length % 9 !== 0) throw new Error('Modifier stack needs a triangle-soup mesh.');
  if (geometry.length > MAX_FLOATS) throw new Error('Modifier input exceeds the 750,000-vertex safety budget.');
  for (let i = 0; i < geometry.length; i++) if (!Number.isFinite(Number(geometry[i]))) throw new Error(`Mesh coordinate ${i} is not finite.`);
}
const vertexKey = (x, y, z) => `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;

/** Laplacian relaxation on welded triangle-soup positions, maintaining triangle topology. */
export function smoothTriangleMesh(geometry, options = {}) {
  validGeometry(geometry);
  const iterations = Math.round(clamp(finite(options.iterations, 1), 1, 5));
  const factor = clamp(finite(options.factor, 0.25), 0, 0.9);
  let current = Array.from(geometry, Number);
  for (let iteration = 0; iteration < iterations && factor > 0; iteration++) {
    const vertices = new Map();
    const triangleKeys = [];
    for (let i = 0; i < current.length; i += 9) {
      const keys = [];
      for (let j = 0; j < 9; j += 3) {
        const x = current[i + j], y = current[i + j + 1], z = current[i + j + 2], key = vertexKey(x, y, z);
        if (!vertices.has(key)) vertices.set(key, { point: [x, y, z], neighbours: new Set() });
        keys.push(key);
      }
      triangleKeys.push(keys);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) vertices.get(keys[a]).neighbours.add(keys[b]);
    }
    const moved = new Map();
    for (const [key, item] of vertices) {
      if (!item.neighbours.size) { moved.set(key, item.point); continue; }
      const neighbours = [...item.neighbours];
      const mean = [0, 1, 2].map(axis => neighbours.reduce((sum, neighbour) => sum + vertices.get(neighbour).point[axis], 0) / neighbours.length);
      moved.set(key, item.point.map((value, axis) => value + (mean[axis] - value) * factor));
    }
    const next = new Array(current.length); let offset = 0;
    for (const keys of triangleKeys) for (const key of keys) { const point = moved.get(key); next[offset++] = point[0]; next[offset++] = point[1]; next[offset++] = point[2]; }
    current = next;
  }
  return new Float32Array(current);
}

/** Seeded analytic displacement; shared positions get identical offsets to avoid cracks. */
export function displaceTriangleMesh(geometry, options = {}) {
  validGeometry(geometry);
  const axis = AXIS[options.axis] !== undefined ? options.axis : 'y';
  const axisIndex = AXIS[axis], amount = clamp(finite(options.amount, 0.1), -5, 5), frequency = clamp(finite(options.frequency, 2.5), 0.1, 40), seed = finite(options.seed, 17);
  const out = new Float32Array(geometry.length);
  const offsets = new Map();
  for (let i = 0; i < geometry.length; i += 3) {
    const x = Number(geometry[i]), y = Number(geometry[i + 1]), z = Number(geometry[i + 2]), key = vertexKey(x, y, z);
    let offset = offsets.get(key);
    if (offset === undefined) {
      const wave = Math.sin((x + seed * 0.113) * frequency) * Math.cos((z - seed * 0.071) * frequency * 0.83);
      const wave2 = Math.sin((y + x * 0.37 + seed) * frequency * 0.47) * 0.35;
      offset = (wave + wave2) * amount;
      offsets.set(key, offset);
    }
    out[i] = x; out[i + 1] = y; out[i + 2] = z; out[i + axisIndex] += offset;
  }
  return out;
}

/** Repeat a triangle mesh in local space, guarding allocation before copying. */
export function arrayTriangleMesh(geometry, options = {}) {
  validGeometry(geometry);
  const count = Math.round(clamp(finite(options.count, 2), 2, 32));
  const offset = [finite(options.offsetX, 2), finite(options.offsetY, 0), finite(options.offsetZ, 0)];
  const totalLength = geometry.length * count;
  if (totalLength > MAX_FLOATS) throw new Error('Array modifier would exceed the mesh safety budget. Reduce copies or mesh detail.');
  const out = new Float32Array(totalLength);
  for (let copy = 0; copy < count; copy++) {
    const base = copy * geometry.length;
    for (let i = 0; i < geometry.length; i += 3) {
      out[base + i] = Number(geometry[i]) + offset[0] * copy;
      out[base + i + 1] = Number(geometry[i + 1]) + offset[1] * copy;
      out[base + i + 2] = Number(geometry[i + 2]) + offset[2] * copy;
    }
  }
  return out;
}

/**
 * Generate a non-destructive solid shell. Welded positions share smoothed normals;
 * boundary edges receive side walls, while closed meshes receive inner and outer shells.
 */
export function solidifyTriangleMesh(geometry, options = {}) {
  validGeometry(geometry);
  const thickness = clamp(finite(options.thickness, 0.1), 0.001, 10);
  const offset = clamp(finite(options.offset, 0), -1, 1);
  const keyPoint = (x, y, z) => vertexKey(x, y, z);
  const points = [], pointLookup = new Map(), faces = [];
  const indexOf = point => {
    const key = keyPoint(point[0], point[1], point[2]);
    if (pointLookup.has(key)) return pointLookup.get(key);
    const index = points.length; points.push(point); pointLookup.set(key, index); return index;
  };
  for (let i = 0; i < geometry.length; i += 9) {
    const a = indexOf([Number(geometry[i]), Number(geometry[i + 1]), Number(geometry[i + 2])]);
    const b = indexOf([Number(geometry[i + 3]), Number(geometry[i + 4]), Number(geometry[i + 5])]);
    const c = indexOf([Number(geometry[i + 6]), Number(geometry[i + 7]), Number(geometry[i + 8])]);
    faces.push([a, b, c]);
  }
  const normals = points.map(() => [0, 0, 0]);
  const edges = new Map();
  for (const face of faces) {
    const a = points[face[0]], b = points[face[1]], c = points[face[2]];
    const ab = b.map((v, i) => v - a[i]), ac = c.map((v, i) => v - a[i]);
    const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    for (const index of face) for (let axis = 0; axis < 3; axis++) normals[index][axis] += normal[axis];
    for (let j = 0; j < 3; j++) {
      const aIndex = face[j], bIndex = face[(j + 1) % 3], key = aIndex < bIndex ? `${aIndex}|${bIndex}` : `${bIndex}|${aIndex}`;
      const entry = edges.get(key);
      if (entry) entry.count++;
      else edges.set(key, { a: aIndex, b: bIndex, count: 1 });
    }
  }
  for (const normal of normals) {
    const length = Math.hypot(...normal) || 1;
    for (let axis = 0; axis < 3; axis++) normal[axis] /= length;
  }
  const outerShift = thickness * (offset + 1) * 0.5, innerShift = thickness * (offset - 1) * 0.5;
  const outer = points.map((p, i) => p.map((v, a) => v + normals[i][a] * outerShift));
  const inner = points.map((p, i) => p.map((v, a) => v + normals[i][a] * innerShift));
  const boundaryCount = [...edges.values()].filter(edge => edge.count === 1).length;
  const outputTriangleCount = faces.length * 2 + boundaryCount * 2;
  if (outputTriangleCount * 9 > MAX_FLOATS) throw new Error('Solidify modifier would exceed the mesh safety budget. Reduce mesh detail first.');
  const out = [];
  const putTriangle = (a, b, c) => { out.push(...a, ...b, ...c); };
  for (const [a, b, c] of faces) {
    putTriangle(outer[a], outer[b], outer[c]);
    putTriangle(inner[c], inner[b], inner[a]);
  }
  for (const edge of edges.values()) {
    if (edge.count !== 1) continue;
    const a = edge.a, b = edge.b;
    putTriangle(outer[a], outer[b], inner[b]);
    putTriangle(outer[a], inner[b], inner[a]);
  }
  const result = new Float32Array(out);
  validGeometry(result);
  return result;
}


/** Blender-style Simple Deform: twist / bend / taper around an axis. */
export function simpleDeformTriangleMesh(geometry, options = {}) {
  validGeometry(geometry);
  const mode = ['twist', 'bend', 'taper'].includes(options.mode || options.deformMode) ? (options.mode || options.deformMode) : 'twist';
  const axis = AXIS[options.axis] !== undefined ? options.axis : 'y';
  const ai = AXIS[axis];
  const others = [0, 1, 2].filter(a => a !== ai);
  let min = Infinity, max = -Infinity;
  for (let i = ai; i < geometry.length; i += 3) { min = Math.min(min, Number(geometry[i])); max = Math.max(max, Number(geometry[i])); }
  const span = Math.max(1e-9, max - min);
  const angleRad = clamp(finite(options.angle, 45), -720, 720) * Math.PI / 180;
  const factor = clamp(finite(options.factor, 0.5), -5, 5);
  const out = new Float32Array(geometry.length);
  for (let i = 0; i < geometry.length; i += 3) {
    const p = [Number(geometry[i]), Number(geometry[i + 1]), Number(geometry[i + 2])];
    const t = (p[ai] - min) / span; // 0..1 along deform axis
    if (mode === 'twist') {
      const ang = angleRad * (t - 0.5);
      const [u, v] = [p[others[0]], p[others[1]]];
      const cu = (u), cv = (v);
      p[others[0]] = cu * Math.cos(ang) - cv * Math.sin(ang);
      p[others[1]] = cu * Math.sin(ang) + cv * Math.cos(ang);
    } else if (mode === 'bend') {
      const ang = (angleRad || factor) * (t - 0.5) * 0.5;
      const u = p[others[0]], along = p[ai];
      p[others[0]] = u * Math.cos(ang) ;
      p[ai] = along + Math.sin(ang) * (1 - Math.abs(t - 0.5)) * factor;
      p[others[1]] = p[others[1]] + Math.sin(ang) * 0.25;
    } else { // taper
      const s = Math.max(0.02, 1 + factor * (t - 0.5));
      p[others[0]] *= s; p[others[1]] *= s;
    }
    out[i] = p[0]; out[i + 1] = p[1]; out[i + 2] = p[2];
  }
  return out;
}

/** Voxel-grid remesh: snap positions to a regular grid, drop collapsed / duplicate triangles. */
export function remeshTriangleMesh(geometry, options = {}) {
  validGeometry(geometry);
  const voxelSize = clamp(finite(options.voxelSize, 0.25), 0.01, 5);
  const snap = v => Math.round(Number(v) / voxelSize) * voxelSize;
  const seen = new Set(); const out = [];
  for (let i = 0; i < geometry.length; i += 9) {
    const pts = [];
    for (let j = 0; j < 9; j += 3) pts.push([snap(geometry[i + j]), snap(geometry[i + j + 1]), snap(geometry[i + j + 2])]);
    const keys = pts.map(pt => vertexKey(pt[0], pt[1], pt[2]));
    if (keys[0] === keys[1] || keys[1] === keys[2] || keys[0] === keys[2]) continue;
    const faceKey = [...keys].sort().join('|');
    if (seen.has(faceKey)) continue;
    seen.add(faceKey);
    for (const pt of pts) out.push(...pt);
  }
  if (!out.length) throw new Error('Remesh voxel size is too large and collapsed the whole mesh. Reduce voxelSize.');
  return new Float32Array(out);
}

/** Convert triangle edges into thin in-plane wireframe strips. */
export function wireframeTriangleMesh(geometry, options = {}) {
  validGeometry(geometry);
  const thickness = clamp(finite(options.thickness, 0.02), 0.001, 1);
  const out = [];
  for (let i = 0; i < geometry.length; i += 9) {
    const pts = [[Number(geometry[i]), Number(geometry[i + 1]), Number(geometry[i + 2])], [Number(geometry[i + 3]), Number(geometry[i + 4]), Number(geometry[i + 5])], [Number(geometry[i + 6]), Number(geometry[i + 7]), Number(geometry[i + 8])]];
    const centroid = [0, 1, 2].map(a => (pts[0][a] + pts[1][a] + pts[2][a]) / 3);
    for (let e = 0; e < 3; e++) {
      const a = pts[e], b = pts[(e + 1) % 3];
      const inset = p => p.map((v, ax) => v + (centroid[ax] - v) * Math.min(0.45, thickness * 4));
      const a2 = inset(a), b2 = inset(b);
      out.push(...a, ...b, ...b2, ...a, ...b2, ...a2);
    }
  }
  const result = new Float32Array(out);
  if (result.length > MAX_FLOATS) throw new Error('Wireframe modifier would exceed the mesh safety budget.');
  return result;
}

/** Sinusoidal wave displacement (Wave modifier). */
export function waveTriangleMesh(geometry, options = {}) {
  validGeometry(geometry);
  const amplitude = clamp(finite(options.amplitude, 0.12), -3, 3);
  const frequency = clamp(finite(options.frequency, 3), 0.1, 40);
  const phase = finite(options.phase, 0) + finite(options.speed, 1);
  const out = new Float32Array(geometry.length);
  const offsets = new Map();
  for (let i = 0; i < geometry.length; i += 3) {
    const x = Number(geometry[i]), y = Number(geometry[i + 1]), z = Number(geometry[i + 2]), key = vertexKey(x, y, z);
    let off = offsets.get(key);
    if (off === undefined) { off = Math.sin(x * frequency + phase) * Math.cos(z * frequency * 0.8 + phase * 0.7) * amplitude; offsets.set(key, off); }
    out[i] = x; out[i + 1] = y + off; out[i + 2] = z;
  }
  return out;
}

export function applyModifier(geometry, inputModifier) {
  validGeometry(geometry);
  const modifier = normalizeModifier(inputModifier);
  if (!modifier.enabled) return new Float32Array(geometry);
  let out;
  switch (modifier.type) {
    case 'subdivision': {
      out = Array.from(geometry, Number);
      for (let level = 0; level < modifier.levels; level++) out = subdivideTriangleMesh(out, 1_800_000);
      break;
    }
    case 'mirror': out = mirrorDuplicateTriangleMesh(geometry, modifier.axis); break;
    case 'array': out = arrayTriangleMesh(geometry, modifier); break;
    case 'solidify': out = solidifyTriangleMesh(geometry, modifier); break;
    case 'bevel': out = bevelTriangleMesh(geometry, modifier).geometry; break;
    case 'smooth': out = smoothTriangleMesh(geometry, modifier); break;
    case 'displace': out = displaceTriangleMesh(geometry, modifier); break;
    case 'optimize': out = optimizeTriangleMesh(geometry, { tolerance: modifier.tolerance }).geometry; break;
    case 'simpleDeform': out = simpleDeformTriangleMesh(geometry, modifier); break;
    case 'decimate': out = decimateTriangleMesh(geometry, { targetRatio: modifier.targetRatio, preserveBoundaries: true }); break;
    case 'remesh': out = remeshTriangleMesh(geometry, modifier); break;
    case 'wireframe': out = wireframeTriangleMesh(geometry, modifier); break;
    case 'wave': out = waveTriangleMesh(geometry, modifier); break;
    default: throw new Error(`Unknown modifier type: ${modifier.type}`);
  }
  validGeometry(out);
  return out instanceof Float32Array ? out : new Float32Array(out);
}

/** Evaluate a stack in order. Base geometry is never mutated; failure leaves the caller's source intact. */
export function evaluateModifierStack(baseGeometry, modifiers = []) {
  validGeometry(baseGeometry);
  if (!Array.isArray(modifiers)) throw new TypeError('Modifier stack must be an array.');
  if (modifiers.length > 32) throw new Error('A modifier stack is limited to 32 entries.');
  let geometry = new Float32Array(baseGeometry);
  const results = [];
  for (const [index, item] of modifiers.entries()) {
    const modifier = normalizeModifier(item, index + 1);
    const beforeTriangles = geometry.length / 9;
    geometry = applyModifier(geometry, modifier);
    results.push({ id: modifier.id, name: modifier.name, type: modifier.type, enabled: modifier.enabled, beforeTriangles, afterTriangles: geometry.length / 9 });
  }
  return { geometry, results, baseTriangles: baseGeometry.length / 9, finalTriangles: geometry.length / 9 };
}

export function applyModifierStack(geometry, modifiers) {
  return evaluateModifierStack(geometry, modifiers).geometry;
}
