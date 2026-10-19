/** Mesh editing helpers for Orvexa Forge. Geometry is a non-indexed triangle list (xyz per vertex). */
const finite = (n, fallback = 0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
const AXIS = { x: 0, y: 1, z: 2 };
function validGeometry(geometry, label = 'Mesh') {
  if (!(Array.isArray(geometry) || ArrayBuffer.isView(geometry)) || geometry.length < 9 || geometry.length % 9 !== 0) throw new Error(`${label} must be a triangle mesh.`);
  for (let i = 0; i < geometry.length; i++) if (!Number.isFinite(Number(geometry[i]))) throw new Error(`${label} contains a non-finite coordinate.`);
  if (geometry.length > 2_250_000) throw new Error(`${label} exceeds the safe mesh edit limit.`);
}
const key3 = (x, y, z) => `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;

const MAX_EDIT_FLOATS = 2_250_000;

/** Apply an object's scale, size and Euler rotation to mesh vertices. Translation is opt-in so transforms can be baked without moving the object origin. */
export function bakeTriangleMeshTransform(geometry, transform = {}, options = {}) {
  validGeometry(geometry, 'Transform source');
  const position = transform.position || {};
  const rotation = transform.rotation || {};
  const scale = transform.scale || {};
  const size = Math.max(0.0001, Math.min(1000, Math.abs(finite(transform.size ?? transform.radius, 1))));
  const sx = (finite(scale.x, 1) || 1) * size, sy = (finite(scale.y, 1) || 1) * size, sz = (finite(scale.z, 1) || 1) * size;
  const rx = finite(rotation.x, 0), ry = finite(rotation.y, 0), rz = finite(rotation.z, 0);
  const cx = Math.cos(rx), ux = Math.sin(rx), cy = Math.cos(ry), uy = Math.sin(ry), cz = Math.cos(rz), uz = Math.sin(rz);
  const tx = options.includeTranslation === true ? finite(position.x, 0) : 0;
  const ty = options.includeTranslation === true ? finite(position.y, 0) : 0;
  const tz = options.includeTranslation === true ? finite(position.z, 0) : 0;
  const out = new Array(geometry.length);
  for (let i = 0; i < geometry.length; i += 3) {
    const x = Number(geometry[i]) * sx, y = Number(geometry[i + 1]) * sy, z = Number(geometry[i + 2]) * sz;
    const y1 = y * cx - z * ux, z1 = y * ux + z * cx;
    const x2 = x * cy + z1 * uy, z2 = -x * uy + z1 * cy;
    const x3 = x2 * cz - y1 * uz, y3 = x2 * uz + y1 * cz;
    out[i] = x3 + tx; out[i + 1] = y3 + ty; out[i + 2] = z2 + tz;
  }
  if (out.some(value => !Number.isFinite(value))) throw new Error('Transform produced non-finite mesh coordinates.');
  return out;
}

/** Join several triangle meshes into one world-space mesh, preserving each source object's visible transform. */
export function joinTriangleMeshes(items, options = {}) {
  if (!Array.isArray(items) || items.length < 2) throw new Error('Select at least two mesh objects to join.');
  if (items.length > 64) throw new Error('Join is limited to 64 objects at a time for safe memory use.');
  const maxFloats = Math.max(9, Math.min(MAX_EDIT_FLOATS, Math.floor(finite(options.maxFloats, MAX_EDIT_FLOATS))));
  const totalFloats = items.reduce((total, item) => {
    const geometry = item?.geometry;
    if (!(Array.isArray(geometry) || ArrayBuffer.isView(geometry)) || geometry.length < 9 || geometry.length % 9 !== 0) throw new Error(`Object "${item?.name || 'Unnamed'}" has no valid triangle mesh. Convert it to a mesh first.`);
    const nextTotal = total + geometry.length;
    if (nextTotal > maxFloats) throw new Error(`Joining these meshes would exceed the ${Math.floor(maxFloats / 3).toLocaleString()}-vertex editor limit. Join fewer or lower-detail objects.`);
    for (let i = 0; i < geometry.length; i++) if (!Number.isFinite(Number(geometry[i]))) throw new Error(`Object "${item?.name || 'Unnamed'}" contains invalid mesh coordinates.`);
    return nextTotal;
  }, 0);
  const geometry = new Array(totalFloats);
  let offset = 0;
  for (const item of items) {
    const transformed = bakeTriangleMeshTransform(item.geometry, item, { includeTranslation: true });
    for (let i = 0; i < transformed.length; i++) geometry[offset++] = transformed[i];
  }
  return { geometry, objectCount: items.length, vertexCount: geometry.length / 3, triangleCount: geometry.length / 9 };
}


/**
 * Generate a six-face box-projection UV atlas. Each triangle is assigned to the
 * dominant signed face direction and packed into a 3x2 grid with an island margin.
 * This avoids the old per-triangle full-square projection which caused severe overlap.
 */
export function generatePlanarUVs(geometry, options = {}) {
  validGeometry(geometry, 'UV unwrap source');
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < geometry.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const value = Number(geometry[i + axis]);
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
  const extent = max.map((value, axis) => Math.max(1e-6, value - min[axis]));
  const pad = Math.max(0.002, Math.min(0.12, finite(options.margin, 0.035)));
  const tileW = 1 / 3, tileH = 1 / 2;
  const coordsByFace = [
    { u: 2, v: 1, flipU: false, flipV: false }, // +X
    { u: 2, v: 1, flipU: true,  flipV: false }, // -X
    { u: 0, v: 2, flipU: false, flipV: false }, // +Y
    { u: 0, v: 2, flipU: false, flipV: true  }, // -Y
    { u: 0, v: 1, flipU: false, flipV: false }, // +Z
    { u: 0, v: 1, flipU: true,  flipV: false }, // -Z
  ];
  const uvs = new Array(geometry.length / 3 * 2);
  let uvOffset = 0;
  for (let i = 0; i < geometry.length; i += 9) {
    const ax = Number(geometry[i]), ay = Number(geometry[i + 1]), az = Number(geometry[i + 2]);
    const bx = Number(geometry[i + 3]), by = Number(geometry[i + 4]), bz = Number(geometry[i + 5]);
    const cx = Number(geometry[i + 6]), cy = Number(geometry[i + 7]), cz = Number(geometry[i + 8]);
    const ab = [bx - ax, by - ay, bz - az], ac = [cx - ax, cy - ay, cz - az];
    const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    let axis = 0;
    if (Math.abs(normal[1]) > Math.abs(normal[axis])) axis = 1;
    if (Math.abs(normal[2]) > Math.abs(normal[axis])) axis = 2;
    const sign = normal[axis] >= 0 ? 1 : -1;
    const faceId = axis === 0 ? (sign > 0 ? 0 : 1) : axis === 1 ? (sign > 0 ? 2 : 3) : (sign > 0 ? 4 : 5);
    const map = coordsByFace[faceId];
    const col = faceId % 3, row = Math.floor(faceId / 3);
    const points = [[ax, ay, az], [bx, by, bz], [cx, cy, cz]];
    for (const point of points) {
      let u = (point[map.u] - min[map.u]) / extent[map.u];
      let v = (point[map.v] - min[map.v]) / extent[map.v];
      if (map.flipU) u = 1 - u;
      if (map.flipV) v = 1 - v;
      uvs[uvOffset++] = col * tileW + pad * tileW + u * tileW * (1 - 2 * pad);
      uvs[uvOffset++] = row * tileH + pad * tileH + v * tileH * (1 - 2 * pad);
    }
  }
  return uvs;
}

/** Apply a bounded sculpt brush to welded mesh vertices, with optional X-axis symmetry and grab mode. */
export function sculptTriangleMesh(geometry, options = {}) {
  validGeometry(geometry, 'Sculpt source');
  const radius = Math.max(0.01, Math.min(10, finite(options.radius, 0.55)));
  const strength = Math.max(-1, Math.min(1, finite(options.strength, 0.12)));
  const mode = ['raise', 'lower', 'inflate', 'smooth', 'flatten', 'grab', 'crease', 'pinch'].includes(options.mode) ? options.mode : 'raise';
  const center = [finite(options.center?.x, 0), finite(options.center?.y, 0), finite(options.center?.z, 0)];
  const symmetryX = options.symmetryX === true;
  const grabDelta = [finite(options.delta?.x, 0), finite(options.delta?.y, strength), finite(options.delta?.z, 0)];
  const points = new Map(), pointIndices = [];
  for (let i = 0; i < geometry.length; i += 3) {
    const p = [Number(geometry[i]), Number(geometry[i + 1]), Number(geometry[i + 2])], key = key3(...p);
    if (!points.has(key)) points.set(key, { p, sum: [...p], changed: false, neighbors: new Set() });
    pointIndices.push(key);
  }
  for (let i = 0; i < pointIndices.length; i += 3) {
    const tri = pointIndices.slice(i, i + 3);
    for (const a of tri) for (const b of tri) if (a !== b) points.get(a).neighbors.add(b);
  }
  const average = new Map();
  for (const [key, entry] of points) {
    const neighbours = [...entry.neighbors].map(k => points.get(k).p);
    if (neighbours.length) average.set(key, [0, 1, 2].map(axis => neighbours.reduce((sum, p) => sum + p[axis], 0) / neighbours.length));
  }
  const strokes = [{ c: center, mirrorSign: 1 }];
  if (symmetryX && Math.abs(center[0]) > 1e-4) {
    strokes.push({ c: [-center[0], center[1], center[2]], mirrorSign: -1 });
  }
  let changed = 0;
  for (const [key, entry] of points) {
    const p = entry.p;
    let vertexTouched = false;
    for (const stroke of strokes) {
      const sc = stroke.c;
      const delta = [p[0] - sc[0], p[1] - sc[1], p[2] - sc[2]];
      const dist = Math.hypot(...delta);
      if (dist > radius) continue;
      const falloff = (1 - dist / radius) ** 2;
      vertexTouched = true;
      if (mode === 'smooth') {
        const avg = average.get(key);
        if (!avg) continue;
        for (let axis = 0; axis < 3; axis++) entry.sum[axis] += (avg[axis] - p[axis]) * Math.abs(strength) * falloff;
      } else if (mode === 'flatten') {
        entry.sum[1] += (sc[1] - p[1]) * Math.abs(strength) * falloff;
      } else if (mode === 'inflate') {
        const norm = dist || 1;
        for (let axis = 0; axis < 3; axis++) entry.sum[axis] += (delta[axis] / norm) * strength * falloff;
      } else if (mode === 'pinch') {
        for (let axis = 0; axis < 3; axis++) entry.sum[axis] += (sc[axis] - p[axis]) * Math.abs(strength) * falloff;
      } else if (mode === 'crease') {
        // Crease: pinch toward the brush centre while pressing a sharp valley along Y.
        for (let axis = 0; axis < 3; axis++) entry.sum[axis] += (sc[axis] - p[axis]) * Math.abs(strength) * 0.55 * falloff;
        entry.sum[1] -= Math.abs(strength) * falloff * 0.65;
      } else if (mode === 'grab') {
        entry.sum[0] += grabDelta[0] * stroke.mirrorSign * falloff;
        entry.sum[1] += grabDelta[1] * falloff;
        entry.sum[2] += grabDelta[2] * falloff;
      } else {
        entry.sum[1] += (mode === 'lower' ? -Math.abs(strength) : Math.abs(strength)) * falloff;
      }
    }
    if (vertexTouched) {
      entry.changed = true;
      changed++;
    }
  }
  const output = [];
  for (const key of pointIndices) {
    const p = points.get(key), changedPoint = p.changed ? p.sum : p.p;
    output.push(...changedPoint);
  }
  if (!changed) throw new Error('The sculpt brush did not touch any vertices. Increase the radius or move the brush center closer to the mesh.');
  return { geometry: output, changedVertices: changed, symmetryX, mode };
}

/** Create a lightweight 7-bone biped rig with one-bone-per-vertex weights. */
export function createBasicRig(geometry) {
  validGeometry(geometry, 'Rig source');
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < geometry.length; i += 3) { minX = Math.min(minX, geometry[i]); maxX = Math.max(maxX, geometry[i]); minY = Math.min(minY, geometry[i + 1]); maxY = Math.max(maxY, geometry[i + 1]); minZ = Math.min(minZ, geometry[i + 2]); maxZ = Math.max(maxZ, geometry[i + 2]); }
  const height = Math.max(0.001, maxY - minY), width = Math.max(0.001, maxX - minX), cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const y = ratio => minY + height * ratio;
  const bones = [
    { name: 'root', parent: -1, pivot: [cx, y(0.06), cz], pose: { x: 0, y: 0, z: 0 } },
    { name: 'spine', parent: 0, pivot: [cx, y(0.45), cz], pose: { x: 0, y: 0, z: 0 } },
    { name: 'head', parent: 1, pivot: [cx, y(0.78), cz], pose: { x: 0, y: 0, z: 0 } },
    { name: 'leftArm', parent: 1, pivot: [cx - width * 0.28, y(0.64), cz], pose: { x: 0, y: 0, z: 0 } },
    { name: 'rightArm', parent: 1, pivot: [cx + width * 0.28, y(0.64), cz], pose: { x: 0, y: 0, z: 0 } },
    { name: 'leftLeg', parent: 0, pivot: [cx - width * 0.14, y(0.18), cz], pose: { x: 0, y: 0, z: 0 } },
    { name: 'rightLeg', parent: 0, pivot: [cx + width * 0.14, y(0.18), cz], pose: { x: 0, y: 0, z: 0 } },
  ];
  const weights = [];
  for (let i = 0; i < geometry.length; i += 3) {
    const x = Number(geometry[i]), yy = Number(geometry[i + 1]);
    let bone = yy > y(0.76) ? 2 : yy > y(0.56) && Math.abs(x - cx) > width * 0.18 ? (x < cx ? 3 : 4) : yy < y(0.32) ? (x < cx ? 5 : 6) : yy > y(0.27) ? 1 : 0;
    weights.push(bone);
  }
  const vertexWeights = weights.map(bone => [{ bone, weight: 1 }]);
  return { version: 2, type: 'OrvexaBasicBiped', bones, weights, vertexWeights, height, width, sourceVertexCount: geometry.length / 3, restGeometry: Array.from(geometry) };
}

function clamp01(value) { return Math.max(0, Math.min(1, finite(value, 0))); }
function normalizedVertexWeights(rig, vertexCount) {
  if (Array.isArray(rig.vertexWeights) && rig.vertexWeights.length === vertexCount) {
    return rig.vertexWeights.map((influences, i) => {
      const map = new Map();
      for (const influence of Array.isArray(influences) ? influences : []) {
        const bone = Number(influence?.bone), weight = Math.max(0, finite(influence?.weight, 0));
        if (Number.isInteger(bone) && bone >= 0 && bone < rig.bones.length && weight > 0) map.set(bone, (map.get(bone) || 0) + weight);
      }
      let entries = [...map].map(([bone, weight]) => ({ bone, weight }));
      const sum = entries.reduce((acc, entry) => acc + entry.weight, 0);
      if (!sum) { const bone = Number(rig.weights?.[i]); entries = [{ bone: Number.isInteger(bone) && bone >= 0 && bone < rig.bones.length ? bone : 0, weight: 1 }]; }
      else entries = entries.map(entry => ({ ...entry, weight: entry.weight / sum }));
      return entries;
    });
  }
  if (!Array.isArray(rig.weights) || rig.weights.length !== vertexCount) throw new Error('Rig weights do not match this mesh. Rebuild the rig.');
  return rig.weights.map(bone => [{ bone: Number.isInteger(bone) && bone >= 0 && bone < rig.bones.length ? bone : 0, weight: 1 }]);
}
function rotatePointAroundPivot(point, pivot, pose = {}) {
  let [x, y, z] = [point[0] - pivot[0], point[1] - pivot[1], point[2] - pivot[2]];
  const rx = finite(pose.x, 0), ry = finite(pose.y, 0), rz = finite(pose.z, 0);
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  const y1 = y * cx - z * sx, z1 = y * sx + z * cx;
  const x2 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy;
  const x3 = x2 * cz - y1 * sz, y3 = x2 * sz + y1 * cz;
  return [x3 + pivot[0], y3 + pivot[1], z2 + pivot[2]];
}

/** Paint normalized multi-bone weights within a smooth spatial brush. */
export function paintRigWeights(geometry, rig, boneName, options = {}) {
  validGeometry(geometry, 'Weight-paint source');
  if (!rig || rig.type !== 'OrvexaBasicBiped' || !Array.isArray(rig.bones)) throw new Error('Create a basic biped rig before painting weights.');
  const boneIndex = rig.bones.findIndex(bone => bone.name === boneName);
  if (boneIndex < 0) throw new Error(`Unknown rig bone "${boneName}".`);
  const radius = Math.max(0.01, Math.min(1000, finite(options.radius, 0.55)));
  const strength = clamp01(Math.abs(finite(options.strength, 0.25)));
  const center = [finite(options.center?.x, 0), finite(options.center?.y, 0), finite(options.center?.z, 0)];
  const nextRig = JSON.parse(JSON.stringify(rig));
  const vertexCount = geometry.length / 3;
  nextRig.vertexWeights = normalizedVertexWeights(nextRig, vertexCount);
  nextRig.restGeometry = Array.isArray(nextRig.restGeometry) && nextRig.restGeometry.length === geometry.length ? nextRig.restGeometry : Array.from(geometry);
  let changedVertices = 0;
  for (let i = 0; i < vertexCount; i++) {
    const k = i * 3, distance = Math.hypot(Number(geometry[k]) - center[0], Number(geometry[k + 1]) - center[1], Number(geometry[k + 2]) - center[2]);
    if (distance > radius) continue;
    const falloff = (1 - distance / radius) ** 2;
    const amount = clamp01(strength * falloff);
    if (amount <= 1e-7) continue;
    const entries = nextRig.vertexWeights[i];
    const oldTarget = entries.find(entry => entry.bone === boneIndex)?.weight || 0;
    const newTarget = oldTarget + (1 - oldTarget) * amount;
    if (newTarget - oldTarget <= 1e-7) continue;
    const otherTotal = entries.filter(entry => entry.bone !== boneIndex).reduce((sum, entry) => sum + entry.weight, 0);
    const remapped = entries.filter(entry => entry.bone !== boneIndex).map(entry => ({ bone: entry.bone, weight: otherTotal > 0 ? entry.weight * (1 - newTarget) / otherTotal : 0 }));
    remapped.push({ bone: boneIndex, weight: newTarget });
    nextRig.vertexWeights[i] = remapped.filter(entry => entry.weight > 1e-6);
    changedVertices++;
  }
  nextRig.weights = nextRig.vertexWeights.map(entries => entries.reduce((best, entry) => entry.weight > best.weight ? entry : best, { bone: 0, weight: -1 }).bone);
  nextRig.version = 2;
  if (!changedVertices) throw new Error('The weight brush did not affect vertices. Increase the radius, strength, or move the brush centre closer to the mesh.');
  return { rig: nextRig, changedVertices };
}

/** Evaluate multi-influence skinning from the original rest mesh without destroying the rig. */
export function evaluateRigSkin(geometry, rig) {
  validGeometry(geometry, 'Skinning source');
  if (!rig || rig.type !== 'OrvexaBasicBiped' || !Array.isArray(rig.bones)) throw new Error('Create a basic biped rig before evaluating skinning.');
  const rest = Array.isArray(rig.restGeometry) && rig.restGeometry.length === geometry.length ? rig.restGeometry : Array.from(geometry);
  const influences = normalizedVertexWeights(rig, rest.length / 3);
  const out = new Array(rest.length); let affectedVertices = 0;
  for (let i = 0; i < influences.length; i++) {
    const k = i * 3, point = [Number(rest[k]), Number(rest[k + 1]), Number(rest[k + 2])];
    let x = 0, y = 0, z = 0, total = 0, influenced = false;
    for (const entry of influences[i]) {
      const bone = rig.bones[entry.bone]; if (!bone) continue;
      const w = entry.weight; const transformed = rotatePointAroundPivot(point, Array.isArray(bone.pivot) ? bone.pivot : [0, 0, 0], bone.pose || {});
      x += transformed[0] * w; y += transformed[1] * w; z += transformed[2] * w; total += w;
      if (w > 1e-5 && (Math.abs(finite(bone.pose?.x, 0)) + Math.abs(finite(bone.pose?.y, 0)) + Math.abs(finite(bone.pose?.z, 0)) > 1e-5)) influenced = true;
    }
    const inv = total > 0 ? 1 / total : 0; out[k] = total ? x * inv : point[0]; out[k + 1] = total ? y * inv : point[1]; out[k + 2] = total ? z * inv : point[2];
    if (influenced) affectedVertices++;
  }
  return { geometry: out, affectedVertices };
}

/** Bake a pose into mesh coordinates while retaining the rest mesh for later edits/reset. */
export function bakeRigPose(geometry, rig, boneName, pose = {}) {
  validGeometry(geometry, 'Rig pose source');
  if (!rig || rig.type !== 'OrvexaBasicBiped' || !Array.isArray(rig.bones) || !Array.isArray(rig.weights)) throw new Error('Create a basic biped rig before posing this mesh.');
  const boneIndex = rig.bones.findIndex(bone => bone.name === boneName);
  if (boneIndex < 0) throw new Error(`Unknown rig bone "${boneName}".`);
  if (!Array.isArray(rig.restGeometry) || rig.restGeometry.length !== geometry.length) rig.restGeometry = Array.from(geometry);
  rig.vertexWeights = normalizedVertexWeights(rig, geometry.length / 3);
  const selected = rig.bones[boneIndex];
  selected.pose = { x: Math.max(-Math.PI, Math.min(Math.PI, finite(pose.x, selected.pose?.x ?? 0))), y: Math.max(-Math.PI, Math.min(Math.PI, finite(pose.y, selected.pose?.y ?? 0))), z: Math.max(-Math.PI, Math.min(Math.PI, finite(pose.z, selected.pose?.z ?? 0))) };
  const result = evaluateRigSkin(rig.restGeometry, rig);
  return { geometry: result.geometry, affectedVertices: result.affectedVertices, rig };
}

/** Create a tiny keyframed skeletal clip from bone poses. */
export function createAnimationClip(rig, name = 'Action', tracks = {}, duration = 1) {
  if (!rig || rig.type !== 'OrvexaBasicBiped' || !Array.isArray(rig.bones)) throw new Error('Create a basic biped rig before creating an animation clip.');
  const safeDuration = Math.max(0.01, Math.min(600, finite(duration, 1)));
  const normalizedTracks = {};
  for (const [boneName, frames] of Object.entries(tracks || {})) {
    if (!rig.bones.some(bone => bone.name === boneName)) throw new Error(`Unknown animation bone "${boneName}".`);
    if (!Array.isArray(frames) || !frames.length || frames.length > 256) throw new Error(`Animation track for ${boneName} must contain 1 to 256 keyframes.`);
    normalizedTracks[boneName] = frames.map(frame => ({ time: Math.max(0, Math.min(safeDuration, finite(frame.time, 0))), pose: { x: finite(frame.pose?.x, 0), y: finite(frame.pose?.y, 0), z: finite(frame.pose?.z, 0) } })).sort((a, b) => a.time - b.time);
  }
  if (!Object.keys(normalizedTracks).length) throw new Error('Animation clip must contain at least one bone track.');
  return { version: 1, name: String(name || 'Action').slice(0, 80), duration: safeDuration, loop: true, tracks: normalizedTracks };
}

/** Sample a keyframed clip using linear Euler interpolation and optional looping. */
export function sampleAnimationClip(clip, timeSeconds) {
  if (!clip || !clip.tracks || typeof clip.tracks !== 'object') throw new Error('Invalid Orvexa animation clip.');
  const duration = Math.max(0.01, finite(clip.duration, 1));
  const time = clip.loop === false ? Math.max(0, Math.min(duration, finite(timeSeconds, 0))) : ((finite(timeSeconds, 0) % duration) + duration) % duration;
  const poses = {};
  for (const [boneName, framesRaw] of Object.entries(clip.tracks)) {
    const frames = [...framesRaw].sort((a, b) => a.time - b.time); if (!frames.length) continue;
    if (time <= frames[0].time) { poses[boneName] = { ...frames[0].pose }; continue; }
    if (time >= frames[frames.length - 1].time) { poses[boneName] = { ...frames[frames.length - 1].pose }; continue; }
    let left = frames[0], right = frames[frames.length - 1];
    for (let i = 0; i < frames.length - 1; i++) if (time >= frames[i].time && time <= frames[i + 1].time) { left = frames[i]; right = frames[i + 1]; break; }
    const t = (time - left.time) / Math.max(1e-9, right.time - left.time);
    poses[boneName] = { x: left.pose.x + (right.pose.x - left.pose.x) * t, y: left.pose.y + (right.pose.y - left.pose.y) * t, z: left.pose.z + (right.pose.z - left.pose.z) * t };
  }
  return { time, poses };
}

/** Apply a clip pose at a chosen time and return non-destructive skinned geometry. */
export function applyAnimationClip(geometry, rig, clip, timeSeconds) {
  if (!rig || rig.type !== 'OrvexaBasicBiped') throw new Error('Create a basic biped rig before playing an animation.');
  const sampled = sampleAnimationClip(clip, timeSeconds);
  const nextRig = JSON.parse(JSON.stringify(rig));
  nextRig.restGeometry = Array.isArray(nextRig.restGeometry) && nextRig.restGeometry.length === geometry.length ? nextRig.restGeometry : Array.from(geometry);
  for (const [boneName, pose] of Object.entries(sampled.poses)) {
    const bone = nextRig.bones.find(item => item.name === boneName); if (bone) bone.pose = { x: pose.x, y: pose.y, z: pose.z };
  }
  const result = evaluateRigSkin(nextRig.restGeometry, nextRig);
  return { geometry: result.geometry, affectedVertices: result.affectedVertices, rig: nextRig, time: sampled.time };
}

/** Return a packed, normalized UV panel layout for drawing a UV preview. */
export function validateUVs(uvs, vertexCount) {
  if (!(Array.isArray(uvs) || ArrayBuffer.isView(uvs)) || uvs.length !== vertexCount * 2 || Array.from(uvs).some(v => !Number.isFinite(Number(v)))) throw new Error('UV coordinates must contain two finite values per mesh vertex.');
  return true;
}

/**
 * Seam-and-normal-cluster UV island unwrapping with padded grid packing.
 * Groups edge-connected triangles whose normals stay within angleThresholdCos
 * unless separated by explicit seam edges.
 */
export function unwrapMeshUVIslands(geometry, options = {}) {
  validGeometry(geometry, 'UV island unwrap source');
  const triCount = geometry.length / 9;
  if (triCount > 60_000) {
    return { uvs: generatePlanarUVs(geometry, options), islandCount: 6, seamEdgeCount: 0 };
  }
  const angleThresholdCos = Math.max(-0.5, Math.min(0.999, finite(options.angleThresholdCos, 0.55)));
  const margin = Math.max(0.005, Math.min(0.12, finite(options.margin, 0.03)));
  const seamSet = new Set(Array.isArray(options.seams) ? options.seams.map(String) : []);
  const edgeKey = (a, b) => {
    const ka = key3(a[0], a[1], a[2]), kb = key3(b[0], b[1], b[2]);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };

  const faces = [];
  const normals = [];
  const edgeToFaces = new Map();
  for (let i = 0; i < geometry.length; i += 9) {
    const fIdx = i / 9;
    const a = [Number(geometry[i]), Number(geometry[i + 1]), Number(geometry[i + 2])];
    const b = [Number(geometry[i + 3]), Number(geometry[i + 4]), Number(geometry[i + 5])];
    const c = [Number(geometry[i + 6]), Number(geometry[i + 7]), Number(geometry[i + 8])];
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const len = Math.hypot(...n) || 1;
    normals.push([n[0] / len, n[1] / len, n[2] / len]);
    faces.push([a, b, c]);
    for (const [p0, p1] of [[a, b], [b, c], [c, a]]) {
      const ek = edgeKey(p0, p1);
      if (!edgeToFaces.has(ek)) edgeToFaces.set(ek, []);
      edgeToFaces.get(ek).push(fIdx);
    }
  }

  const visited = new Uint8Array(triCount);
  const islands = [];
  for (let start = 0; start < triCount; start++) {
    if (visited[start]) continue;
    visited[start] = 1;
    const island = [start];
    const seedNormal = normals[start];
    const queue = [start];
    while (queue.length) {
      const curr = queue.pop();
      const [a, b, c] = faces[curr];
      for (const [p0, p1] of [[a, b], [b, c], [c, a]]) {
        const ek = edgeKey(p0, p1);
        if (seamSet.has(ek)) continue;
        for (const nb of edgeToFaces.get(ek) || []) {
          if (visited[nb]) continue;
          const nn = normals[nb];
          const dot = seedNormal[0] * nn[0] + seedNormal[1] * nn[1] + seedNormal[2] * nn[2];
          if (dot < angleThresholdCos) continue;
          visited[nb] = 1;
          island.push(nb);
          queue.push(nb);
        }
      }
    }
    islands.push(island);
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(islands.length)));
  const rows = Math.max(1, Math.ceil(islands.length / cols));
  const tileW = 1 / cols, tileH = 1 / rows;
  const uvs = new Array(triCount * 6).fill(0);

  islands.forEach((island, idx) => {
    const avgN = [0, 0, 0];
    for (const fIdx of island) {
      avgN[0] += normals[fIdx][0];
      avgN[1] += normals[fIdx][1];
      avgN[2] += normals[fIdx][2];
    }
    const nLen = Math.hypot(...avgN) || 1;
    const N = avgN.map(v => v / nLen);
    const up = Math.abs(N[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const rawU = [
      up[1] * N[2] - up[2] * N[1],
      up[2] * N[0] - up[0] * N[2],
      up[0] * N[1] - up[1] * N[0],
    ];
    const uLen = Math.hypot(...rawU) || 1;
    const U = rawU.map(v => v / uLen);
    const V = [
      N[1] * U[2] - N[2] * U[1],
      N[2] * U[0] - N[0] * U[2],
      N[0] * U[1] - N[1] * U[0],
    ];

    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    const projected = island.map(fIdx => {
      const pts = faces[fIdx].map(p => {
        const pu = p[0] * U[0] + p[1] * U[1] + p[2] * U[2];
        const pv = p[0] * V[0] + p[1] * V[1] + p[2] * V[2];
        if (pu < minU) minU = pu;
        if (pu > maxU) maxU = pu;
        if (pv < minV) minV = pv;
        if (pv > maxV) maxV = pv;
        return [pu, pv];
      });
      return { fIdx, pts };
    });

    const spanU = Math.max(1e-6, maxU - minU);
    const spanV = Math.max(1e-6, maxV - minV);
    const col = idx % cols, row = Math.floor(idx / cols);
    for (const { fIdx, pts } of projected) {
      for (let corner = 0; corner < 3; corner++) {
        const nu = (pts[corner][0] - minU) / spanU;
        const nv = (pts[corner][1] - minV) / spanV;
        const outIdx = (fIdx * 3 + corner) * 2;
        uvs[outIdx] = col * tileW + margin * tileW + nu * tileW * (1 - 2 * margin);
        uvs[outIdx + 1] = row * tileH + margin * tileH + nv * tileH * (1 - 2 * margin);
      }
    }
  });

  return {
    uvs,
    islandCount: islands.length,
    seamEdgeCount: seamSet.size,
  };
}

/**
 * Inspect a UV layout for out-of-bounds coordinates, zero-area UV triangles, and total atlas coverage.
 */
export function inspectUVLayout(uvs, geometry) {
  validGeometry(geometry, 'UV inspection mesh');
  validateUVs(uvs, geometry.length / 3);
  let outOfBoundsCount = 0;
  let degenerateUVTriangles = 0;
  let totalArea = 0;
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;

  for (let i = 0; i < uvs.length; i += 2) {
    const u = Number(uvs[i]), v = Number(uvs[i + 1]);
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
    if (u < -1e-5 || u > 1.00001 || v < -1e-5 || v > 1.00001) outOfBoundsCount++;
  }

  for (let i = 0; i < uvs.length; i += 6) {
    const u0 = Number(uvs[i]), v0 = Number(uvs[i + 1]);
    const u1 = Number(uvs[i + 2]), v1 = Number(uvs[i + 3]);
    const u2 = Number(uvs[i + 4]), v2 = Number(uvs[i + 5]);
    const area = Math.abs((u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)) * 0.5;
    if (area < 1e-8) degenerateUVTriangles++;
    totalArea += area;
  }

  return {
    vertexCount: uvs.length / 2,
    triangleCount: uvs.length / 6,
    outOfBoundsCount,
    degenerateUVTriangles,
    coverage: Math.min(1, Number(totalArea.toFixed(4))),
    bounds: { minU, maxU, minV, maxV },
  };
}

/**
 * Blend two skeletal animation clips at timeSeconds by blendFactor (0..1) and return skinned geometry.
 */
export function blendAnimationClips(geometry, rig, clipA, clipB, timeSeconds = 0, blendFactor = 0.5) {
  if (!rig || rig.type !== 'OrvexaBasicBiped') throw new Error('Create a basic biped rig before blending animations.');
  const a = sampleAnimationClip(clipA, timeSeconds);
  const b = sampleAnimationClip(clipB, timeSeconds);
  const alpha = clamp01(blendFactor);
  const nextRig = JSON.parse(JSON.stringify(rig));
  nextRig.restGeometry = Array.isArray(nextRig.restGeometry) && nextRig.restGeometry.length === geometry.length ? nextRig.restGeometry : Array.from(geometry);
  for (const bone of nextRig.bones) {
    const pa = a.poses[bone.name] || bone.pose || { x: 0, y: 0, z: 0 };
    const pb = b.poses[bone.name] || bone.pose || { x: 0, y: 0, z: 0 };
    bone.pose = {
      x: pa.x + (pb.x - pa.x) * alpha,
      y: pa.y + (pb.y - pa.y) * alpha,
      z: pa.z + (pb.z - pa.z) * alpha,
    };
  }
  const result = evaluateRigSkin(nextRig.restGeometry, nextRig);
  return {
    geometry: result.geometry,
    affectedVertices: result.affectedVertices,
    rig: nextRig,
    blendFactor: alpha,
  };
}



/**
 * 3D CCD (Cyclic Coordinate Descent) inverse kinematics.
 * `solveRigIK(rig, { chain, target, iterations, damping })` rotates each joint
 * in the chain (last joint = end effector) toward the target in world space,
 * writing the result back as Euler bone poses on a cloned rig.
 */
export function solveRigIK(rig, options = {}) {
  if (!rig || !Array.isArray(rig.bones) || !rig.bones.length) throw new Error('Create a rig before solving IK.');
  const opts = options || {};
  let chainNames;
  if (Array.isArray(opts.chain)) chainNames = opts.chain.map(String);
  else if (typeof opts.chain === 'string') chainNames = opts.chain.split(/[>,\s]+/).filter(Boolean);
  else if (Array.isArray(opts.chainBones)) chainNames = opts.chainBones.map(String);
  else chainNames = rig.bones.map(b => b.name);
  const chainIndices = [];
  for (const name of chainNames) {
    const idx = Number.isInteger(Number(name)) && rig.bones[Number(name)] && String(Number(name)) === String(name)
      ? Number(name)
      : rig.bones.findIndex(b => b.name === name);
    if (idx < 0) throw new Error(`Unknown IK chain bone "${name}".`);
    chainIndices.push(idx);
  }
  if (chainIndices.length < 2) throw new Error('IK chain needs at least two bones (a joint and an end effector).');
  const targetRaw = opts.target || opts.targetPosition || { x: 0, y: 0, z: 0 };
  const target = Array.isArray(targetRaw)
    ? [finite(targetRaw[0], 0), finite(targetRaw[1], 0), finite(targetRaw[2], 0)]
    : [finite(targetRaw.x, 0), finite(targetRaw.y, 0), finite(targetRaw.z, 0)];
  const iterations = Math.round(Math.min(200, Math.max(1, finite(opts.iterations, 16))));
  const damping = Math.min(1, Math.max(0.01, finite(opts.damping, 0.85)));
  const tolerance = Math.max(1e-6, finite(opts.tolerance, 1e-4));

  const solved = JSON.parse(JSON.stringify(rig));
  // Joint world positions start from the rest pivots.
  const joints = chainIndices.map(idx => {
    const pivot = solved.bones[idx].pivot;
    return Array.isArray(pivot) ? [finite(pivot[0], 0), finite(pivot[1], 0), finite(pivot[2], 0)] : [0, 0, 0];
  });
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = v => { const l = Math.hypot(...v); return l > 1e-9 ? v.map(x => x / l) : [0, 0, 0]; };
  const rotateAround = (point, centre, axisUnit, angle) => {
    const v = sub(point, centre); const c = Math.cos(angle), s = Math.sin(angle);
    // Rodrigues' rotation formula
    const term1 = v.map(x => x * c);
    const cr = cross(axisUnit, v).map(x => x * s);
    const d = dot(axisUnit, v); const term3 = axisUnit.map(x => x * d * (1 - c));
    return [centre[0] + term1[0] + cr[0] + term3[0], centre[1] + term1[1] + cr[1] + term3[1], centre[2] + term1[2] + cr[2] + term3[2]];
  };
  // Per-joint accumulated axis-angle -> Euler approximation for the bone pose.
  const accum = chainIndices.map(() => ({ axis: [0, 0, 1], angle: 0 }));
  const axisAngleToEuler = (axis, angle) => {
    // Small/moderate angle decomposition: distribute the rotation onto Euler axes.
    return {
      x: Math.max(-Math.PI, Math.min(Math.PI, axis[0] * angle)),
      y: Math.max(-Math.PI, Math.min(Math.PI, axis[1] * angle)),
      z: Math.max(-Math.PI, Math.min(Math.PI, axis[2] * angle)),
    };
  };

  let error = Math.hypot(...sub(joints[joints.length - 1], target));
  let performed = 0;
  for (let iter = 0; iter < iterations; iter++) {
    performed++;
    // CCD sweeps from the joint just before the end effector back to the root.
    for (let j = joints.length - 2; j >= 0; j--) {
      const end = joints[joints.length - 1];
      const toEnd = norm(sub(end, joints[j]));
      const toTarget = norm(sub(target, joints[j]));
      if (!toEnd[0] && !toEnd[1] && !toEnd[2]) continue;
      if (!toTarget[0] && !toTarget[1] && !toTarget[2]) continue;
      const cos = Math.max(-1, Math.min(1, dot(toEnd, toTarget)));
      let axis = cross(toEnd, toTarget);
      const axisLen = Math.hypot(...axis);
      if (axisLen < 1e-8) continue;
      axis = axis.map(v => v / axisLen);
      const angle = Math.acos(cos) * damping;
      if (!Number.isFinite(angle) || angle < 1e-9) continue;
      for (let k = j + 1; k < joints.length; k++) joints[k] = rotateAround(joints[k], joints[j], axis, angle);
      // Accumulate (compose approximately by adding the dominant contribution).
      const acc = accum[j];
      const prev = acc.axis.map((v, i) => v * acc.angle);
      const next = prev.map((v, i) => v + axis[i] * angle);
      const nextAngle = Math.hypot(...next);
      accum[j] = { axis: nextAngle > 1e-9 ? next.map(v => v / nextAngle) : [0, 0, 1], angle: nextAngle };
    }
    error = Math.hypot(...sub(joints[joints.length - 1], target));
    if (error <= tolerance) break;
  }

  chainIndices.forEach((boneIdx, j) => {
    if (j === chainIndices.length - 1) return; // end effector joint itself is not rotated
    const bone = solved.bones[boneIdx];
    const base = bone.pose || { x: 0, y: 0, z: 0 };
    const delta = axisAngleToEuler(accum[j].axis, accum[j].angle);
    bone.pose = {
      x: Math.max(-Math.PI, Math.min(Math.PI, finite(base.x, 0) + delta.x)),
      y: Math.max(-Math.PI, Math.min(Math.PI, finite(base.y, 0) + delta.y)),
      z: Math.max(-Math.PI, Math.min(Math.PI, finite(base.z, 0) + delta.z)),
    };
  });
  const endEffector = joints[joints.length - 1];
  solved.ik = { chain: [...chainNames], target, iterations: performed, error, endEffector: [...endEffector] };
  return {
    rig: solved,
    chain: [...chainNames],
    target,
    iterations: performed,
    damping,
    error,
    distance: error,
    converged: error <= Math.max(tolerance, 0.01),
    endEffector: [...endEffector],
    endEffectorPosition: [...endEffector],
    jointPositions: joints.map(j => [...j]),
  };
}
