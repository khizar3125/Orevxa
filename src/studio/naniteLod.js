/**
 * Orvexa Nanite-style LOD — Quadric Error Metrics (QEM) iterative edge-collapse
 * decimation for triangle-soup meshes, plus a 4-level cluster DAG hierarchy.
 * Geometry in/out is a non-indexed triangle list (xyz per vertex, 9 floats per triangle).
 */
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;

function validate(geometry, label = 'Nanite mesh') {
  if (!(Array.isArray(geometry) || ArrayBuffer.isView(geometry)) || geometry.length < 9 || geometry.length % 9 !== 0) {
    throw new Error(`${label} needs triangle geometry (at least one triangle).`);
  }
  if (geometry.length > 2_250_000) throw new Error(`${label} exceeds the safe geometry budget.`);
  for (let i = 0; i < geometry.length; i++) if (!Number.isFinite(Number(geometry[i]))) throw new Error(`${label} contains a non-finite coordinate at ${i}.`);
}

const keyOf = p => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)},${Math.round(p[2] * 1e5)}`;

function weld(geometry) {
  const verts = []; const lookup = new Map(); const faces = [];
  for (let i = 0; i < geometry.length; i += 9) {
    const tri = [];
    for (let j = 0; j < 9; j += 3) {
      const p = [Number(geometry[i + j]), Number(geometry[i + j + 1]), Number(geometry[i + j + 2])];
      const k = keyOf(p);
      if (!lookup.has(k)) { lookup.set(k, verts.length); verts.push(p); }
      tri.push(lookup.get(k));
    }
    if (tri[0] !== tri[1] && tri[1] !== tri[2] && tri[0] !== tri[2]) faces.push(tri);
  }
  return { verts, faces };
}

function facePlane(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const len = Math.hypot(...n);
  if (len < 1e-12) return null;
  const nn = n.map(v => v / len);
  return [...nn, -(nn[0] * a[0] + nn[1] * a[1] + nn[2] * a[2])]; // nx,ny,nz,d
}

// Quadric stored as [a00,a01,a02,a03, a11,a12,a13, a22,a23, a33] for plane [n|d].
function planeQuadric(p) {
  const [a, b, c, d] = p;
  return [a * a, a * b, a * c, a * d, b * b, b * c, b * d, c * c, c * d, d * d];
}
function addQuadric(q, r, scale = 1) {
  const out = new Array(10);
  for (let i = 0; i < 10; i++) out[i] = q[i] + r[i] * scale;
  return out;
}
function quadricError(q, v) {
  const [x, y, z] = v;
  // v^T K v with homogeneous w=1
  return (
    q[0] * x * x + 2 * q[1] * x * y + 2 * q[2] * x * z + 2 * q[3] * x +
    q[4] * y * y + 2 * q[5] * y * z + 2 * q[6] * y +
    q[7] * z * z + 2 * q[8] * z + q[9]
  );
}
function optimalPoint(q, fallbackA, fallbackB) {
  // Solve A v = -b where K = [A b; b^T c]
  const A = [[q[0], q[1], q[2]], [q[1], q[4], q[5]], [q[2], q[5], q[7]]];
  const b = [q[3], q[6], q[8]];
  const det =
    A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
  const candidates = [];
  if (Math.abs(det) > 1e-12) {
    // Cramer's rule for A v = -b
    const rhs = b.map(v => -v);
    const replace = col => A.map((row, r) => row.map((v, c) => (c === col ? rhs[r] : v)));
    const detOf = M =>
      M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
      M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
      M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    const v = [detOf(replace(0)) / det, detOf(replace(1)) / det, detOf(replace(2)) / det];
    if (v.every(Number.isFinite)) candidates.push(v);
  }
  candidates.push([(fallbackA[0] + fallbackB[0]) / 2, (fallbackA[1] + fallbackB[1]) / 2, (fallbackA[2] + fallbackB[2]) / 2]);
  candidates.push(fallbackA, fallbackB);
  let best = candidates[0]; let bestErr = Infinity;
  for (const c of candidates) { const e = quadricError(q, c); if (e < bestErr) { bestErr = e; best = c; } }
  return { point: best, error: Math.max(0, bestErr) };
}

function expand(verts, faces) {
  const out = new Float32Array(faces.length * 9);
  let o = 0;
  for (const f of faces) for (const idx of f) { out[o++] = verts[idx][0]; out[o++] = verts[idx][1]; out[o++] = verts[idx][2]; }
  return out;
}

function hybridResult(geometry, meta) {
  const out = geometry instanceof Float32Array ? geometry : new Float32Array(geometry);
  out.geometry = out;
  Object.assign(out, meta);
  return out;
}

/**
 * Decimate a triangle mesh with QEM iterative edge collapse.
 * Returns a Float32Array triangle soup (also carrying `.geometry`,
 * `.triangleCount`, `.originalTriangles`, `.targetTriangles`, `.collapsedEdges`).
 */
export function decimateTriangleMesh(geometry, options = {}) {
  validate(geometry, 'Decimate source');
  const targetRatio = clamp(finite(options.targetRatio, 0.5), 0.01, 1);
  const minTriangles = Math.max(1, Math.round(finite(options.minTriangles, 4)));
  const preserveBoundaries = options.preserveBoundaries !== false;
  const { verts, faces: initialFaces } = weld(geometry);
  const originalTriangles = initialFaces.length;
  const targetTriangles = Math.max(Math.min(minTriangles, originalTriangles), Math.round(originalTriangles * targetRatio));
  if (targetRatio >= 1 || originalTriangles <= targetTriangles) {
    return hybridResult(expand(verts, initialFaces), {
      triangleCount: originalTriangles, originalTriangles, targetTriangles: originalTriangles,
      targetRatio: 1, collapsedEdges: 0, vertexCount: verts.length,
    });
  }
  let faces = initialFaces.map(f => [...f]);
  // Per-vertex quadrics
  let quadrics = verts.map(() => new Array(10).fill(0));
  for (const f of faces) {
    const plane = facePlane(verts[f[0]], verts[f[1]], verts[f[2]]);
    if (!plane) continue;
    const q = planeQuadric(plane);
    for (const idx of f) quadrics[idx] = addQuadric(quadrics[idx], q);
  }
  const positions = verts.map(p => [...p]);
  const alive = verts.map(() => true);
  let collapsedEdges = 0;

  const boundaryVertices = () => {
    if (!preserveBoundaries) return new Set();
    const counts = new Map();
    for (const f of faces) for (let e = 0; e < 3; e++) {
      const a = f[e], b = f[(e + 1) % 3]; const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const set = new Set();
    for (const [k, count] of counts) if (count === 1) { const [a, b] = k.split('|').map(Number); set.add(a); set.add(b); }
    return set;
  };

  // Iterative greedy collapse: recompute the cheapest edge each round (bounded meshes).
  let guard = originalTriangles * 4 + 100;
  while (faces.length > targetTriangles && guard-- > 0) {
    const edgeSet = new Map();
    for (const f of faces) for (let e = 0; e < 3; e++) {
      const a = f[e], b = f[(e + 1) % 3]; const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (!edgeSet.has(k)) edgeSet.set(k, [Math.min(a, b), Math.max(a, b)]);
    }
    if (!edgeSet.size) break;
    const boundary = boundaryVertices();
    let best = null;
    for (const [a, b] of edgeSet.values()) {
      if (!alive[a] || !alive[b]) continue;
      const q = addQuadric(quadrics[a], quadrics[b]);
      const { point, error } = optimalPoint(q, positions[a], positions[b]);
      let cost = error;
      if (preserveBoundaries && (boundary.has(a) || boundary.has(b))) cost = cost * 100 + 1; // strongly discourage, never forbid
      // Slight preference for shorter edges keeps collapses local and stable.
      const len = Math.hypot(positions[a][0] - positions[b][0], positions[a][1] - positions[b][1], positions[a][2] - positions[b][2]);
      cost += len * 1e-9;
      if (!best || cost < best.cost) best = { a, b, point, cost, q };
    }
    if (!best) break;
    const { a, b, point, q } = best;
    positions[a] = point; quadrics[a] = q; alive[b] = false;
    const nextFaces = [];
    for (const f of faces) {
      const mapped = f.map(idx => (idx === b ? a : idx));
      if (mapped[0] === mapped[1] || mapped[1] === mapped[2] || mapped[0] === mapped[2]) continue;
      nextFaces.push(mapped);
    }
    if (nextFaces.length >= faces.length) break; // no progress possible
    faces = nextFaces; collapsedEdges++;
  }

  // Compact faces (positions array already holds collapsed locations)
  const result = expand(positions, faces);
  return hybridResult(result, {
    triangleCount: faces.length, originalTriangles, targetTriangles,
    targetRatio, collapsedEdges, vertexCount: positions.length,
  });
}

function clusterBounds(vertsLike, faces, start, end) {
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (let i = start; i < end; i++) for (const idx of faces[i]) {
    const p = vertsLike[idx];
    for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], p[a]); max[a] = Math.max(max[a], p[a]); }
  }
  return { min, max, center: min.map((v, i) => (v + max[i]) / 2) };
}

/**
 * Build a Nanite-style cluster DAG: the source triangles are partitioned into
 * fixed-size clusters at LOD 1.0, and QEM-decimated geometry provides the
 * 0.5 / 0.25 / 0.125 levels, each re-clustered for streaming.
 */
export function buildNaniteClusterDAG(geometry, options = {}) {
  validate(geometry, 'Nanite cluster source');
  const clusterSize = Math.max(1, Math.round(clamp(finite(options.clusterSize, 64), 1, 4096)));
  const ratios = [1.0, 0.5, 0.25, 0.125];
  const levels = [];
  const allNodes = [];
  for (let level = 0; level < ratios.length; level++) {
    const ratio = ratios[level];
    const levelGeometry = level === 0
      ? new Float32Array(Array.from(geometry, Number))
      : decimateTriangleMesh(geometry, { targetRatio: ratio, minTriangles: 4, preserveBoundaries: options.preserveBoundaries !== false }).geometry;
    const { verts, faces } = weld(levelGeometry);
    const clusters = [];
    for (let start = 0; start < faces.length; start += clusterSize) {
      const end = Math.min(faces.length, start + clusterSize);
      const cluster = {
        id: `lod${level}-cluster-${clusters.length}`,
        level, lodLevel: level, ratio,
        triangleStart: start, triangleCount: end - start,
        triangleIndices: Array.from({ length: end - start }, (_, i) => start + i),
        bounds: clusterBounds(verts, faces, start, end),
        error: level === 0 ? 0 : Number(((1 - ratio) * 0.01).toFixed(6)),
        parent: level > 0 ? `lod${level - 1}-cluster-${Math.floor(start / clusterSize)}` : null,
      };
      clusters.push(cluster); allNodes.push(cluster);
    }
    levels.push({
      level, lodLevel: level, ratio,
      geometry: levelGeometry,
      triangleCount: faces.length,
      vertexCount: verts.length,
      clusters, clusterCount: clusters.length,
    });
  }
  return {
    levels, hierarchy: levels, lodLevels: levels,
    nodes: allNodes, clusters: allNodes,
    clusterSize,
    levelCount: levels.length,
    ratios: [...ratios],
    totalTriangles: levels[0].triangleCount,
    triangleCount: levels[0].triangleCount,
  };
}

export const NANITE_LOD_RATIOS = Object.freeze([1.0, 0.5, 0.25, 0.125]);
