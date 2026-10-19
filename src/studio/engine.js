/** Orvexa Forge engine core: deterministic, dependency-free scene and rigid-body helpers. */
export const ENGINE_VERSION = '1.3.0';

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const PHYSICAL_SHAPES = new Set(['cube', 'sphere', 'plane', 'cylinder', 'torus', 'cone', 'pyramid', 'capsule', 'mesh']);
const vec3 = (value, fallback = { x: 0, y: 0, z: 0 }) => ({
  x: finite(value?.x, fallback.x), y: finite(value?.y, fallback.y), z: finite(value?.z, fallback.z),
});

export function createRigidBody(options = {}) {
  return {
    enabled: options.enabled !== false,
    bodyType: ['dynamic', 'static', 'kinematic'].includes(options.bodyType) ? options.bodyType : 'dynamic',
    mass: clamp(finite(options.mass, 1), 0.01, 100_000),
    restitution: clamp(finite(options.restitution, 0.12), 0, 1),
    friction: clamp(finite(options.friction, 0.72), 0, 1),
    useGravity: options.useGravity !== false,
    linearDamping: clamp(finite(options.linearDamping, 0.05), 0, 20),
    angularDamping: clamp(finite(options.angularDamping, 0.08), 0, 20),
    velocity: vec3(options.velocity),
    angularVelocity: vec3(options.angularVelocity),
  };
}

export function createEngineObject(type, index = 1) {
  const allowed = ['cube', 'sphere', 'plane', 'cylinder', 'torus', 'cone', 'pyramid', 'capsule', 'mesh'];
  const safeType = allowed.includes(type) ? type : 'cube';
  return {
    __orvexaScene: true,
    engineId: `added:${Date.now().toString(36)}:${index.toString(36)}`,
    type: safeType,
    name: `${safeType[0].toUpperCase()}${safeType.slice(1)} ${index}`,
    position: { x: 0, y: safeType === 'plane' ? -1 : 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    size: 1,
    color: ({ cube: '#7965ff', sphere: '#ffb86b', plane: '#343a57', cylinder: '#55d6be', torus: '#ff6b9d' })[safeType] || '#7965ff',
    material: { metallic: 0.05, roughness: 0.68, emissive: 0, clearcoat: 0 },
    visible: true,
    rigidBody: createRigidBody({ enabled: false }),
  };
}

export function normalizeEngineObject(object) {
  const out = { ...object };
  out.position = vec3(object.position);
  out.rotation = vec3(object.rotation);
  out.scale = { x: clamp(finite(object.scale?.x, 1), 0.01, 100), y: clamp(finite(object.scale?.y, 1), 0.01, 100), z: clamp(finite(object.scale?.z, 1), 0.01, 100) };
  out.size = clamp(finite(object.size ?? object.radius, 1), 0.01, 100);
  out.material = {
    metallic: clamp(finite(object.material?.metallic, 0.05), 0, 1),
    roughness: clamp(finite(object.material?.roughness, 0.68), 0.04, 1),
    emissive: clamp(finite(object.material?.emissive, 0), 0, 2),
    clearcoat: clamp(finite(object.material?.clearcoat, 0), 0, 1),
    ...(typeof object.material?.baseColorImage === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(object.material.baseColorImage) && object.material.baseColorImage.length <= 1_500_000 ? { baseColorImage: object.material.baseColorImage } : {}),
  };
  if (object.rigidBody) out.rigidBody = createRigidBody(object.rigidBody);
  return out;
}

function radiusOf(object) {
  const s = Math.abs(finite(object.size ?? object.radius, 1)) * Math.max(Math.abs(finite(object.scale?.x, 1)), Math.abs(finite(object.scale?.y, 1)), Math.abs(finite(object.scale?.z, 1)));
  return Math.max(0.025, 0.5 * s * (object.type === 'sphere' ? 1 : 1.15));
}



/** Generate deterministic, bounded fractal-noise terrain as triangle-soup mesh geometry. */
export function createProceduralTerrainGeometry(options = {}) {
  const width = clamp(finite(options.width, 18), 1, 500);
  const depth = clamp(finite(options.depth, 18), 1, 500);
  const segments = Math.round(clamp(finite(options.segments, 32), 4, 128));
  const amplitude = clamp(finite(options.amplitude, 2.2), 0, 80);
  const seed = Math.trunc(finite(options.seed, 1337));
  const frequency = clamp(finite(options.frequency, 2.5), 0.1, 20);
  const persistence = clamp(finite(options.persistence, 0.48), 0.1, 0.9);
  const lacunarity = clamp(finite(options.lacunarity, 2.05), 1.2, 4);
  const hash = (x, z, octaveSeed) => {
    const n = Math.sin(x * 127.1 + z * 311.7 + octaveSeed * 74.7) * 43758.5453123;
    return (n - Math.floor(n)) * 2 - 1;
  };
  const smooth = t => t * t * (3 - 2 * t);
  const noise = (x, z, octaveSeed) => {
    const ix = Math.floor(x), iz = Math.floor(z), fx = smooth(x - ix), fz = smooth(z - iz);
    const a = hash(ix, iz, octaveSeed), b = hash(ix + 1, iz, octaveSeed);
    const c = hash(ix, iz + 1, octaveSeed), d = hash(ix + 1, iz + 1, octaveSeed);
    const ab = a + (b - a) * fx, cd = c + (d - c) * fx;
    return ab + (cd - ab) * fz;
  };
  const sample = (u, v) => {
    let amp = 1, freq = frequency, total = 0, weight = 0;
    for (let octave = 0; octave < 5; octave++) {
      total += noise(u * freq, v * freq, seed + octave * 1013) * amp;
      weight += amp; amp *= persistence; freq *= lacunarity;
    }
    // Gently flatten the outer border to make terrain tiles easier to join.
    const edge = Math.min(u, v, 1 - u, 1 - v);
    const edgeFade = Math.max(0, Math.min(1, edge * segments / 2));
    return (total / Math.max(weight, 1e-6)) * amplitude * edgeFade;
  };
  const points = new Array((segments + 1) * (segments + 1));
  const at = (x, z) => points[z * (segments + 1) + x];
  for (let z = 0; z <= segments; z++) for (let x = 0; x <= segments; x++) {
    const u = x / segments, v = z / segments;
    points[z * (segments + 1) + x] = [(u - 0.5) * width, sample(u, v), (v - 0.5) * depth];
  }
  const geometry = new Float32Array(segments * segments * 6 * 3);
  let offset = 0;
  const put = point => { geometry[offset++] = point[0]; geometry[offset++] = point[1]; geometry[offset++] = point[2]; };
  for (let z = 0; z < segments; z++) for (let x = 0; x < segments; x++) {
    const a = at(x, z), b = at(x + 1, z), c = at(x + 1, z + 1), d = at(x, z + 1);
    // Counter-clockwise from above: upward-facing terrain triangles.
    put(a); put(d); put(c); put(a); put(c); put(b);
  }
  return geometry;
}

/** Remove degenerate and duplicate triangles from triangle-soup meshes without moving surviving vertices. */
export function optimizeTriangleMesh(geometry, options = {}) {
  if (!(Array.isArray(geometry) || ArrayBuffer.isView(geometry)) || geometry.length < 9 || geometry.length % 9 !== 0) throw new Error('Mesh optimization requires triangle-soup geometry.');
  if (geometry.length > 2_250_000) throw new Error('Mesh exceeds the 250,000-triangle optimization safety limit.');
  const tolerance = clamp(finite(options.tolerance, 1e-6), 1e-9, 0.01);
  const quant = value => Math.round(Number(value) / tolerance);
  const keyPoint = offset => `${quant(geometry[offset])},${quant(geometry[offset + 1])},${quant(geometry[offset + 2])}`;
  const output = [], seen = new Set(); let removedDegenerate = 0, removedDuplicate = 0;
  for (let i = 0; i < geometry.length; i += 9) {
    const a = [Number(geometry[i]), Number(geometry[i + 1]), Number(geometry[i + 2])];
    const b = [Number(geometry[i + 3]), Number(geometry[i + 4]), Number(geometry[i + 5])];
    const c = [Number(geometry[i + 6]), Number(geometry[i + 7]), Number(geometry[i + 8])];
    if (![...a, ...b, ...c].every(Number.isFinite)) { removedDegenerate++; continue; }
    const ab = b.map((v, k) => v - a[k]), ac = c.map((v, k) => v - a[k]);
    const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (cross[0] ** 2 + cross[1] ** 2 + cross[2] ** 2 <= tolerance ** 4) { removedDegenerate++; continue; }
    const keys = [keyPoint(i), keyPoint(i + 3), keyPoint(i + 6)];
    const sorted = [...keys].sort(); const key = sorted.join('|');
    if (seen.has(key)) { removedDuplicate++; continue; }
    seen.add(key); output.push(...a, ...b, ...c);
  }
  if (!output.length) throw new Error('No valid triangles remain after optimization; original mesh was not changed.');
  return { geometry: new Float32Array(output), beforeTriangles: geometry.length / 9, afterTriangles: output.length / 9, removedDegenerate, removedDuplicate };
}

/** Integrate a stable semi-implicit Euler step, with basic plane and sphere collisions. */
export function advancePhysics(scene, deltaSeconds, settings = {}) {
  if (!scene || !Array.isArray(scene.objects)) return { moved: 0, collisions: 0 };
  const dt = clamp(finite(deltaSeconds, 0), 0, 1 / 20);
  if (dt === 0) return { moved: 0, collisions: 0 };
  const gravity = clamp(finite(settings.gravity, 9.81), 0, 100);
  const collisionEnabled = settings.collisions !== false;
  const objects = scene.objects;
  const floors = collisionEnabled ? objects.filter(o => o.type === 'plane' && o.visible !== false) : [];
  let moved = 0, collisions = 0;
  for (const object of objects) {
    const body = object.rigidBody;
    if (!body || body.enabled === false || body.bodyType !== 'dynamic' || object.visible === false) continue;
    body.velocity = vec3(body.velocity);
    object.position = vec3(object.position);
    if (body.useGravity) body.velocity.y -= gravity * dt;
    // Exponential damping behaves consistently across frame rates.
    const damping = Math.exp(-clamp(finite(body.linearDamping, 0.05), 0, 20) * dt);
    body.velocity.x *= damping; body.velocity.y *= damping; body.velocity.z *= damping;
    const angular = vec3(body.angularVelocity);
    object.rotation = vec3(object.rotation);
    const angularDamping = Math.exp(-clamp(finite(body.angularDamping, 0.08), 0, 20) * dt);
    for (const axis of ['x', 'y', 'z']) { object.rotation[axis] += angular[axis] * dt; angular[axis] *= angularDamping; }
    body.angularVelocity = angular;
    body.velocity.x = clamp(body.velocity.x, -250, 250);
    body.velocity.y = clamp(body.velocity.y, -250, 250);
    body.velocity.z = clamp(body.velocity.z, -250, 250);
    object.position.x += body.velocity.x * dt;
    object.position.y += body.velocity.y * dt;
    object.position.z += body.velocity.z * dt;
    moved++;
    if (!collisionEnabled) continue;
    const radius = radiusOf(object);
    for (const floor of floors) {
      if (floor === object) continue;
      const fs = Math.abs(finite(floor.size, 1)) * Math.max(0.01, finite(floor.scale?.x, 1));
      const fz = Math.abs(finite(floor.size, 1)) * Math.max(0.01, finite(floor.scale?.z, 1));
      const fp = vec3(floor.position);
      const within = Math.abs(object.position.x - fp.x) <= fs * 0.5 + radius * 0.35 && Math.abs(object.position.z - fp.z) <= fz * 0.5 + radius * 0.35;
      const floorTop = fp.y + 0.001;
      if (within && object.position.y - radius < floorTop && body.velocity.y <= 0) {
        object.position.y = floorTop + radius;
        body.velocity.y = Math.abs(body.velocity.y) < 0.65 ? 0 : -body.velocity.y * body.restitution;
        body.velocity.x *= Math.max(0, 1 - body.friction * dt * 4);
        body.velocity.z *= Math.max(0, 1 - body.friction * dt * 4);
        collisions++;
      }
    }
    // A conservative sphere-vs-sphere response against static/kinematic objects.
    for (const other of objects) {
      if (other === object || other.visible === false || !PHYSICAL_SHAPES.has(other.type) || other.type === 'plane') continue;
      if (other.rigidBody?.enabled && other.rigidBody.bodyType === 'dynamic') continue;
      const p = vec3(other.position), dx = object.position.x - p.x;
      const minDistance = radius + radiusOf(other);
      // Cheap broadphase rejection avoids most square roots and 3D distance work in busy scenes.
      if (Math.abs(dx) >= minDistance) continue;
      const dy = object.position.y - p.y, dz = object.position.z - p.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < minDistance * minDistance && d2 > 1e-8) {
        const distance = Math.sqrt(d2), nx = dx / distance, ny = dy / distance, nz = dz / distance;
        const overlap = minDistance - distance;
        object.position.x += nx * overlap; object.position.y += ny * overlap; object.position.z += nz * overlap;
        const speedAlongNormal = body.velocity.x * nx + body.velocity.y * ny + body.velocity.z * nz;
        if (speedAlongNormal < 0) {
          const impulse = (1 + body.restitution) * speedAlongNormal;
          body.velocity.x -= impulse * nx; body.velocity.y -= impulse * ny; body.velocity.z -= impulse * nz;
        }
        collisions++;
      }
    }
  }
  // Dynamic-vs-dynamic coarse sphere contacts. This is an arcade approximation,
  // not a substitute for a production rigid-body solver or shape-specific manifolds.
  if (collisionEnabled) {
    const dynamic = objects.filter(o => o.visible !== false && o.rigidBody?.enabled && o.rigidBody.bodyType === 'dynamic' && PHYSICAL_SHAPES.has(o.type) && o.type !== 'plane');
    // Sweep-and-prune broadphase: sort on X, then stop scanning once pairs cannot overlap.
    const sortedDynamic = dynamic.slice().sort((a, b) => finite(a.position?.x, 0) - finite(b.position?.x, 0));
    const maxDynamicRadius = sortedDynamic.reduce((max, object) => Math.max(max, radiusOf(object)), 0);
    for (let i = 0; i < sortedDynamic.length; i++) for (let j = i + 1; j < sortedDynamic.length; j++) {
      const a = sortedDynamic[i], b = sortedDynamic[j], pa = vec3(a.position), pb = vec3(b.position);
      let dx = pa.x - pb.x, dy = pa.y - pb.y, dz = pa.z - pb.z;
      const minDistance = radiusOf(a) + radiusOf(b);
      if (Math.abs(dx) >= radiusOf(a) + maxDynamicRadius) break;
      if (Math.abs(dx) >= minDistance) continue;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= minDistance * minDistance || d2 < 1e-10) continue;
      const distance = Math.sqrt(d2), nx = dx / distance, ny = dy / distance, nz = dz / distance;
      const invA = 1 / clamp(finite(a.rigidBody.mass, 1), .01, 100_000), invB = 1 / clamp(finite(b.rigidBody.mass, 1), .01, 100_000), invTotal = invA + invB;
      const overlap = minDistance - distance;
      a.position.x += nx * overlap * invA / invTotal; a.position.y += ny * overlap * invA / invTotal; a.position.z += nz * overlap * invA / invTotal;
      b.position.x -= nx * overlap * invB / invTotal; b.position.y -= ny * overlap * invB / invTotal; b.position.z -= nz * overlap * invB / invTotal;
      const va = a.rigidBody.velocity, vb = b.rigidBody.velocity;
      const relativeNormal = (finite(va?.x, 0) - finite(vb?.x, 0)) * nx + (finite(va?.y, 0) - finite(vb?.y, 0)) * ny + (finite(va?.z, 0) - finite(vb?.z, 0)) * nz;
      if (relativeNormal < 0) {
        const restitution = Math.min(clamp(finite(a.rigidBody.restitution, .12), 0, 1), clamp(finite(b.rigidBody.restitution, .12), 0, 1));
        const impulse = -(1 + restitution) * relativeNormal / invTotal;
        for (const [axis, n] of [['x', nx], ['y', ny], ['z', nz]]) { va[axis] = finite(va[axis], 0) + impulse * invA * n; vb[axis] = finite(vb[axis], 0) - impulse * invB * n; }
      }
      collisions++;
    }
  }
  return { moved, collisions };
}

export function countSceneStats(scene) {
  const objects = scene?.objects || [];
  let vertices = 0, triangles = 0, dynamicBodies = 0;
  for (const object of objects) {
    if (object.type === 'mesh' && (Array.isArray(object.geometry) || ArrayBuffer.isView(object.geometry))) {
      vertices += object.geometry.length / 3;
      triangles += Math.floor(object.geometry.length / 9);
    } else if (['cube', 'sphere', 'plane', 'cylinder', 'torus', 'cone', 'pyramid', 'capsule'].includes(object.type)) {
      // Estimates are shown as approximate counts for procedural primitives.
      const estimates = { cube: [36, 12], sphere: [1536, 512], plane: [6, 2], cylinder: [384, 128], torus: [1536, 512], cone: [96, 32], pyramid: [18, 6], capsule: [2304, 768] };
      const estimate=estimates[object.type]||[0,0];vertices += estimate[0]; triangles += estimate[1];
    }
    if (object.rigidBody?.enabled) dynamicBodies++;
  }
  return { objects: objects.length, vertices, triangles, dynamicBodies };
}

/** Split each triangle into four; rejects meshes that would exceed browser-safe edit limits. */
export function subdivideTriangleMesh(geometry, maxFloats = 180_000) {
  if (!geometry || geometry.length < 9 || geometry.length % 9 !== 0 || Array.from(geometry).some(v => !Number.isFinite(Number(v)))) {
    throw new Error('Subdivide needs a valid triangle mesh.');
  }
  if (geometry.length * 4 > maxFloats) throw new Error('Subdivision would exceed the safe editable-mesh limit. Reduce detail or use a smaller mesh.');
  const output = [];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  for (let i = 0; i < geometry.length; i += 9) {
    const a = [Number(geometry[i]), Number(geometry[i + 1]), Number(geometry[i + 2])];
    const b = [Number(geometry[i + 3]), Number(geometry[i + 4]), Number(geometry[i + 5])];
    const c = [Number(geometry[i + 6]), Number(geometry[i + 7]), Number(geometry[i + 8])];
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    output.push(...a, ...ab, ...ca, ...ab, ...b, ...bc, ...ca, ...bc, ...c, ...ab, ...bc, ...ca);
  }
  return output;
}

/** Mirror a triangle mesh across one local axis while restoring triangle winding. */
export function mirrorTriangleMesh(geometry, axis = 'x') {
  const axisIndex = ({ x: 0, y: 1, z: 2 })[axis];
  if (axisIndex === undefined) throw new Error('Mirror axis must be x, y or z.');
  if (!geometry || geometry.length < 9 || geometry.length % 9 !== 0 || Array.from(geometry).some(v => !Number.isFinite(Number(v)))) throw new Error('Mirror needs a valid triangle mesh.');
  const output = [];
  for (let i = 0; i < geometry.length; i += 9) {
    const a = [Number(geometry[i]), Number(geometry[i + 1]), Number(geometry[i + 2])];
    const b = [Number(geometry[i + 3]), Number(geometry[i + 4]), Number(geometry[i + 5])];
    const c = [Number(geometry[i + 6]), Number(geometry[i + 7]), Number(geometry[i + 8])];
    a[axisIndex] *= -1; b[axisIndex] *= -1; c[axisIndex] *= -1;
    output.push(...a, ...c, ...b);
  }
  return output;
}

/** Duplicate a triangle mesh across a local axis and reverse reflected winding. This is a lightweight mirror modifier, without seam welding. */
export function mirrorDuplicateTriangleMesh(geometry, axis = 'x') {
  if (!geometry || geometry.length < 9 || geometry.length % 9 !== 0 || Array.from(geometry).some(v => !Number.isFinite(Number(v)))) throw new Error('Mirror modifier needs a valid triangle mesh.');
  if (geometry.length * 2 > 750_000) throw new Error('Mirror modifier would exceed the safe persistent-mesh limit. Reduce mesh detail before mirroring.');
  return [...Array.from(geometry, Number), ...mirrorTriangleMesh(geometry, axis)];
}

/** Move entities with simple arcade-style controls while the simulation is running. */
export function advanceControllers(scene, deltaSeconds, pressedKeys = new Set()) {
  if (!scene || !Array.isArray(scene.objects)) return 0;
  const dt = clamp(finite(deltaSeconds, 0), 0, 1 / 20);
  let moved = 0;
  for (const object of scene.objects) {
    const controller = object.controller;
    if (!controller || object.visible === false) continue;
    const speed = clamp(finite(controller.speed, 3), 0, 100);
    const x = (pressedKeys.has('d') || pressedKeys.has('arrowright') ? 1 : 0) - (pressedKeys.has('a') || pressedKeys.has('arrowleft') ? 1 : 0);
    const z = (pressedKeys.has('s') || pressedKeys.has('arrowdown') ? 1 : 0) - (pressedKeys.has('w') || pressedKeys.has('arrowup') ? 1 : 0);
    const length = Math.hypot(x, z) || 1;
    object.position = vec3(object.position);
    object.position.x += x / length * speed * dt;
    object.position.z += z / length * speed * dt;
    const wantsJump = pressedKeys.has(' ') || pressedKeys.has('space');
    if (wantsJump && !controller.__jumpHeld) {
      const body = object.rigidBody;
      if (body?.enabled && body.bodyType === 'dynamic') {
        const floorY = scene.objects.filter(o => o.type === 'plane' && o.visible !== false).reduce((floor, o) => Math.max(floor, finite(o.position?.y, -Infinity)), -Infinity);
        const grounded = object.position.y <= floorY + radiusOf(object) + 0.12;
        if (grounded) body.velocity.y = clamp(finite(controller.jumpSpeed, 5), 0, 50);
      }
    }
    controller.__jumpHeld = wantsJump;
    if (x || z) moved++;
  }
  return moved;
}
