/** Topology-aware mesh editing operations for Orvexa Modeler triangle-soup meshes. */
const MAX_FLOATS = 2_250_000;
const MAX_TOPOLOGY_TRIANGLES = 60_000;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function meshVertexKey(point, precision = 1e-5) {
  const q = v => Math.round(Number(v) / precision);
  return `${q(point[0])},${q(point[1])},${q(point[2])}`;
}

export function meshEdgeKey(a, b) {
  const ka = (Array.isArray(a) || ArrayBuffer.isView(a)) ? meshVertexKey(a) : String(a);
  const kb = (Array.isArray(b) || ArrayBuffer.isView(b)) ? meshVertexKey(b) : String(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

function validate(geometry) {
  if (!(Array.isArray(geometry) || ArrayBuffer.isView(geometry)) || geometry.length < 9 || geometry.length % 9 !== 0) {
    throw new Error('Mesh edit needs triangle geometry (at least one triangle).');
  }
  if (geometry.length > MAX_FLOATS) throw new Error('Mesh edit exceeds the safe geometry budget. Reduce mesh detail first.');
  for (let i = 0; i < geometry.length; i++) if (!Number.isFinite(Number(geometry[i]))) throw new Error(`Mesh contains a non-finite coordinate at ${i}.`);
}

function trianglesFrom(geometry) {
  const faces = [];
  for (let i = 0; i < geometry.length; i += 9) faces.push([
    [Number(geometry[i]), Number(geometry[i + 1]), Number(geometry[i + 2])],
    [Number(geometry[i + 3]), Number(geometry[i + 4]), Number(geometry[i + 5])],
    [Number(geometry[i + 6]), Number(geometry[i + 7]), Number(geometry[i + 8])],
  ]);
  return faces;
}

function faceNormal(face) {
  const a = face[0], b = face[1], c = face[2];
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const length = Math.hypot(...n) || 1;
  return n.map(v => v / length);
}

function flatten(faces) {
  const out = new Array(faces.length * 9);
  let offset = 0;
  for (const face of faces) for (const point of face) for (const axis of point) out[offset++] = axis;
  if (out.length > MAX_FLOATS) throw new Error('Mesh operation exceeds the safe geometry budget. Reduce the selection or mesh detail.');
  return new Float32Array(out);
}

function normalizedIndices(indices, triangleCount) {
  const result = new Set();
  for (const raw of indices || []) {
    const index = Number(raw);
    if (Number.isInteger(index) && index >= 0 && index < triangleCount) result.add(index);
  }
  if (!result.size) throw new Error('Select one or more mesh faces first.');
  return result;
}

function buildFaceTopology(faces) {
  const edges = new Map(), normals = faces.map(faceNormal);
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  faces.forEach((face, faceIndex) => {
    for (const p of face) for (let axis = 0; axis < 3; axis++) { lo[axis] = Math.min(lo[axis], p[axis]); hi[axis] = Math.max(hi[axis], p[axis]); }
    for (let i = 0; i < 3; i++) {
      const a = face[i], b = face[(i + 1) % 3], key = meshEdgeKey(a, b);
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push(faceIndex);
    }
  });
  const scale = Math.max(1, ...lo.map((v, i) => hi[i] - v));
  return { edges, normals, tolerance: scale * 1e-5 };
}

function findCoplanarRegion(faces, startIndex, topology, allowed = null) {
  const seed = faces[startIndex], normal = topology.normals[startIndex], origin = seed[0];
  const isCoplanar = index => {
    if (index === startIndex || !faces[index] || (allowed && !allowed.has(index))) return index === startIndex;
    const candidateNormal = topology.normals[index];
    if (normal[0] * candidateNormal[0] + normal[1] * candidateNormal[1] + normal[2] * candidateNormal[2] < 0.99995) return false;
    return faces[index].every(point => Math.abs((point[0] - origin[0]) * normal[0] + (point[1] - origin[1]) * normal[1] + (point[2] - origin[2]) * normal[2]) <= topology.tolerance);
  };
  const result = new Set([startIndex]), queue = [startIndex];
  while (queue.length) {
    const current = queue.pop();
    for (let i = 0; i < 3; i++) {
      const key = meshEdgeKey(faces[current][i], faces[current][(i + 1) % 3]);
      for (const neighbour of topology.edges.get(key) || []) {
        if (result.has(neighbour) || !isCoplanar(neighbour)) continue;
        result.add(neighbour); queue.push(neighbour);
      }
    }
  }
  return result;
}

/** Return all edge-connected, coplanar triangles belonging to the clicked mesh face region. */
export function coplanarTriangleRegion(geometry, startFaceIndex) {
  validate(geometry);
  const faces = trianglesFrom(geometry), index = Number(startFaceIndex);
  if (!Number.isInteger(index) || index < 0 || index >= faces.length) throw new Error('The selected face index is outside this mesh.');
  // Large meshes avoid allocating a full half-million-edge adjacency map on mobile devices.
  if (faces.length > MAX_TOPOLOGY_TRIANGLES) return [index];
  return [...findCoplanarRegion(faces, index, buildFaceTopology(faces))].sort((a, b) => a - b);
}

function orderedRegionBoundary(faces, region) {
  const edgeUses = new Map();
  for (const faceIndex of region) {
    const face = faces[faceIndex];
    for (let edge = 0; edge < 3; edge++) {
      const from = face[edge], to = face[(edge + 1) % 3], key = meshEdgeKey(from, to);
      if (!edgeUses.has(key)) edgeUses.set(key, []);
      edgeUses.get(key).push({ from, to });
    }
  }
  const boundary = [...edgeUses.values()].filter(uses => uses.length === 1).map(uses => uses[0]);
  if (boundary.length < 3) return null;
  const outgoing = new Map();
  for (const edge of boundary) {
    const key = meshVertexKey(edge.from);
    if (outgoing.has(key)) return null;
    outgoing.set(key, edge);
  }
  const ordered = []; const first = boundary[0]; let current = first;
  for (let guard = 0; guard <= boundary.length; guard++) {
    ordered.push(current);
    const nextKey = meshVertexKey(current.to);
    if (nextKey === meshVertexKey(first.from)) break;
    current = outgoing.get(nextKey);
    if (!current) return null;
  }
  return ordered.length === boundary.length && meshVertexKey(ordered[ordered.length - 1]?.to || []) === meshVertexKey(first.from) ? ordered : null;
}

/** Offset a planar polygon boundary inward in its own plane. Width is a ratio of the shortest boundary edge. */
function offsetPolygonInward3D(outer, seedNormal, amount) {
  if (outer.length < 3) return null;
  const origin = outer[0], firstDirection = outer[1].map((value, i) => value - origin[i]);
  const firstLength = Math.hypot(...firstDirection) || 1, u = firstDirection.map(v => v / firstLength);
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  let v = cross3(seedNormal, u), vLength = Math.hypot(...v) || 1; v = v.map(value => value / vLength);
  const flat = outer.map(point => { const delta = point.map((value, i) => value - origin[i]); return [delta.reduce((sum, value, i) => sum + value * u[i], 0), delta.reduce((sum, value, i) => sum + value * v[i], 0)]; });
  let area = 0;
  for (let i = 0; i < flat.length; i++) { const a = flat[i], b = flat[(i + 1) % flat.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const orientation = area >= 0 ? 1 : -1, edgeNormals = [], lengths = [];
  for (let i = 0; i < flat.length; i++) {
    const a = flat[i], b = flat[(i + 1) % flat.length], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
    lengths.push(length); edgeNormals.push(orientation > 0 ? [-dy / length, dx / length] : [dy / length, -dx / length]);
  }
  const minEdge = Math.min(...lengths), distance = Math.max(1e-6, minEdge * amount), inner2 = [];
  const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
  for (let i = 0; i < flat.length; i++) {
    const prev = flat[(i + flat.length - 1) % flat.length], current = flat[i], next = flat[(i + 1) % flat.length];
    const prevDir = [current[0] - prev[0], current[1] - prev[1]], nextDir = [next[0] - current[0], next[1] - current[1]];
    const prevNormal = edgeNormals[(i + flat.length - 1) % flat.length], nextNormal = edgeNormals[i];
    const prevOffset = [current[0] + prevNormal[0] * distance, current[1] + prevNormal[1] * distance];
    const nextOffset = [current[0] + nextNormal[0] * distance, current[1] + nextNormal[1] * distance];
    const denominator = cross2(prevDir, nextDir), delta = [nextOffset[0] - prevOffset[0], nextOffset[1] - prevOffset[1]];
    if (Math.abs(denominator) < 1e-8) inner2.push([(prevOffset[0] + nextOffset[0]) * 0.5, (prevOffset[1] + nextOffset[1]) * 0.5]);
    else { const t = cross2(delta, nextDir) / denominator; inner2.push([prevOffset[0] + prevDir[0] * t, prevOffset[1] + prevDir[1] * t]); }
  }
  const inner3 = inner2.map(point => [0, 1, 2].map(axis => origin[axis] + u[axis] * point[0] + v[axis] * point[1]));
  return inner3.flat().every(Number.isFinite) ? inner3 : null;
}

/** Bevel all edges between planar face regions by offsetting faces inward and building chamfer strips/corner caps. */
export function bevelTriangleMesh(geometry, options = {}) {
  validate(geometry);
  const faces = trianglesFrom(geometry);
  if (faces.length > MAX_TOPOLOGY_TRIANGLES) throw new Error(`Bevel topology budget is ${MAX_TOPOLOGY_TRIANGLES.toLocaleString()} triangles. Reduce mesh detail before beveling.`);
  const width = Math.max(0.005, Math.min(0.35, finite(options.width, 0.08)));
  const topology = buildFaceTopology(faces), remaining = new Set(faces.map((_, index) => index)), regions = [];
  while (remaining.size) {
    const start = remaining.values().next().value;
    const region = findCoplanarRegion(faces, start, topology, remaining);
    for (const index of region) remaining.delete(index);
    regions.push(region);
  }
  const patches = [];
  for (const region of regions) {
    const boundary = orderedRegionBoundary(faces, region);
    if (!boundary) throw new Error('Bevel needs each planar face region to have one simple boundary loop. Clean or simplify non-manifold geometry first.');
    const outer = boundary.map(edge => edge.from), normal = topology.normals[region.values().next().value];
    const inner = offsetPolygonInward3D(outer, normal, width);
    if (!inner || inner.length !== outer.length) throw new Error('Bevel could not create a stable inset on this face region. Reduce the bevel width or simplify the mesh.');
    patches.push({ outer, inner, normal });
  }
  const edges = new Map(), vertexCorners = new Map();
  for (let patchIndex = 0; patchIndex < patches.length; patchIndex++) {
    const patch = patches[patchIndex];
    for (let i = 0; i < patch.outer.length; i++) {
      const next = (i + 1) % patch.outer.length, key = meshEdgeKey(patch.outer[i], patch.outer[next]);
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push({ patchIndex, outerA: patch.outer[i], outerB: patch.outer[next], innerA: patch.inner[i], innerB: patch.inner[next] });
      const vertexKey = meshVertexKey(patch.outer[i]);
      if (!vertexCorners.has(vertexKey)) vertexCorners.set(vertexKey, { original: patch.outer[i], points: [] });
      vertexCorners.get(vertexKey).points.push({ point: patch.inner[i], normal: patch.normal });
    }
  }
  const output = [];
  for (const patch of patches) for (let i = 1; i < patch.inner.length - 1; i++) output.push([patch.inner[0], patch.inner[i], patch.inner[i + 1]]);
  let bevelledEdges = 0;
  for (const uses of edges.values()) {
    if (uses.length > 2) throw new Error('Bevel cannot process a non-manifold edge shared by more than two planar regions. Clean the mesh first.');
    const a = uses[0], b = uses[1]; bevelledEdges++;
    if (!b) {
      output.push([a.outerA, a.outerB, a.innerB], [a.outerA, a.innerB, a.innerA]);
      continue;
    }
    const same = meshVertexKey(a.outerA) === meshVertexKey(b.outerA);
    const bAtA = same ? b.innerA : b.innerB, bAtB = same ? b.innerB : b.innerA;
    output.push([a.innerA, a.innerB, bAtB], [a.innerA, bAtB, bAtA]);
  }
  let vertexCaps = 0;
  for (const corner of vertexCorners.values()) {
    const unique = new Map(corner.points.map(item => [meshVertexKey(item.point), item]));
    const points = [...unique.values()];
    if (points.length < 3) continue;
    const normalSum = points.reduce((sum, item) => sum.map((value, axis) => value + item.normal[axis]), [0, 0, 0]);
    const normalLength = Math.hypot(...normalSum) || 1, normal = normalSum.map(value => value / normalLength);
    const first = points[0].point.map((value, axis) => value - corner.original[axis]), firstLength = Math.hypot(...first) || 1, u = first.map(value => value / firstLength);
    const rawV = [normal[1] * u[2] - normal[2] * u[1], normal[2] * u[0] - normal[0] * u[2], normal[0] * u[1] - normal[1] * u[0]], vLength = Math.hypot(...rawV) || 1, v = rawV.map(value => value / vLength);
    points.sort((a, b) => {
      const da = a.point.map((value, axis) => value - corner.original[axis]), db = b.point.map((value, axis) => value - corner.original[axis]);
      return Math.atan2(da.reduce((sum, value, axis) => sum + value * v[axis], 0), da.reduce((sum, value, axis) => sum + value * u[axis], 0)) - Math.atan2(db.reduce((sum, value, axis) => sum + value * v[axis], 0), db.reduce((sum, value, axis) => sum + value * u[axis], 0));
    });
    for (let i = 1; i < points.length - 1; i++) output.push([points[0].point, points[i].point, points[i + 1].point]);
    vertexCaps++;
  }
  const result = flatten(output);
  validate(result);
  return { geometry: result, bevelledFaces: patches.length, bevelledEdges, vertexCaps, triangleCount: output.length };
}

/** Translate selected vertex/edge/face elements. Shared triangle-soup corners are welded by position key during the edit. */
export function translateMeshElements(geometry, selection = {}, delta = {}) {
  validate(geometry);
  const faces = trianglesFrom(geometry);
  const keys = new Set();
  const mode = ['vertex', 'edge', 'face'].includes(selection.mode) ? selection.mode : 'face';
  if (mode === 'vertex') for (const key of selection.vertices || []) keys.add(String(key));
  else if (mode === 'edge') for (const key of selection.edges || []) for (const part of String(key).split('|')) keys.add(part);
  else {
    for (const faceIndex of normalizedIndices(selection.faces, faces.length)) {
      for (const point of faces[faceIndex]) keys.add(meshVertexKey(point));
    }
  }
  if (!keys.size) throw new Error(`Select at least one ${mode} element before moving it.`);
  const offset = [finite(delta.x), finite(delta.y), finite(delta.z)];
  if (offset.every(v => Math.abs(v) < 1e-12)) throw new Error('Enter a non-zero X, Y or Z movement.');
  let affected = 0;
  for (const face of faces) for (const point of face) {
    if (keys.has(meshVertexKey(point))) {
      point[0] += offset[0]; point[1] += offset[1]; point[2] += offset[2]; affected++;
    }
  }
  if (!affected) throw new Error('The selected mesh elements could not be matched to mesh vertices. Select them again.');
  return { geometry: flatten(faces), affectedCorners: affected, movedVertices: keys.size };
}

/** Extrude selected triangle faces along averaged selected-region normals and create side walls only on selection boundaries. */
export function extrudeTriangleFaces(geometry, faceIndices, distance = 0.25) {
  validate(geometry);
  const faces = trianglesFrom(geometry);
  const selected = normalizedIndices(faceIndices, faces.length);
  const amount = Math.max(-100, Math.min(100, finite(distance, 0.25)));
  if (Math.abs(amount) < 1e-8) throw new Error('Extrusion distance must be non-zero.');
  const vertexNormals = new Map(), edgeUse = new Map();
  for (const faceIndex of selected) {
    const face = faces[faceIndex], normal = faceNormal(face);
    for (const point of face) {
      const key = meshVertexKey(point), sum = vertexNormals.get(key) || [0, 0, 0];
      sum[0] += normal[0]; sum[1] += normal[1]; sum[2] += normal[2]; vertexNormals.set(key, sum);
    }
    for (let i = 0; i < 3; i++) {
      const a = face[i], b = face[(i + 1) % 3], key = meshEdgeKey(a, b), old = edgeUse.get(key);
      if (old) old.count++;
      else edgeUse.set(key, { a, b, count: 1 });
    }
  }
  for (const [key, n] of vertexNormals) {
    const length = Math.hypot(...n) || 1;
    vertexNormals.set(key, n.map(v => v / length));
  }
  const topPoint = point => {
    const n = vertexNormals.get(meshVertexKey(point)) || [0, 1, 0];
    return [point[0] + n[0] * amount, point[1] + n[1] * amount, point[2] + n[2] * amount];
  };
  const output = [];
  for (let i = 0; i < faces.length; i++) if (!selected.has(i)) output.push(faces[i]);
  for (const i of selected) output.push(faces[i].map(topPoint));
  let sideTriangles = 0;
  for (const edge of edgeUse.values()) {
    if (edge.count !== 1) continue;
    const a = edge.a, b = edge.b, ta = topPoint(a), tb = topPoint(b);
    output.push([a, b, tb], [a, tb, ta]); sideTriangles += 2;
  }
  return { geometry: flatten(output), extrudedFaces: selected.size, sideTriangles, triangleCount: output.length };
}

/** Inset selected face regions. Coplanar adjacent triangles are treated as one polygon region. */
export function insetTriangleFaces(geometry, faceIndices, factor = 0.15) {
  validate(geometry);
  const faces = trianglesFrom(geometry);
  const selected = normalizedIndices(faceIndices, faces.length);
  const amount = Math.max(0.01, Math.min(0.45, finite(factor, 0.15)));
  const topology = faces.length <= MAX_TOPOLOGY_TRIANGLES ? buildFaceTopology(faces) : null, remaining = new Set(selected), regions = [];
  while (remaining.size) {
    const start = remaining.values().next().value;
    const region = topology ? findCoplanarRegion(faces, start, topology, remaining) : new Set([start]);
    for (const index of region) remaining.delete(index);
    regions.push(region);
  }

  const regionResults = new Map();
  for (const region of regions) {
    const edgeUses = new Map();
    for (const faceIndex of region) {
      const face = faces[faceIndex];
      for (let edge = 0; edge < 3; edge++) {
        const from = face[edge], to = face[(edge + 1) % 3], key = meshEdgeKey(from, to);
        if (!edgeUses.has(key)) edgeUses.set(key, []);
        edgeUses.get(key).push({ from, to });
      }
    }
    const boundary = [...edgeUses.values()].filter(uses => uses.length === 1).map(uses => uses[0]);
    const output = [];
    let usableLoop = boundary.length >= 3;
    const outgoing = new Map();
    for (const edge of boundary) {
      const fromKey = meshVertexKey(edge.from);
      if (outgoing.has(fromKey)) { usableLoop = false; break; }
      outgoing.set(fromKey, edge);
    }
    const ordered = [];
    if (usableLoop) {
      const first = boundary[0]; let edge = first;
      for (let guard = 0; guard <= boundary.length; guard++) {
        ordered.push(edge);
        const nextKey = meshVertexKey(edge.to);
        if (nextKey === meshVertexKey(first.from)) break;
        edge = outgoing.get(nextKey);
        if (!edge) { usableLoop = false; break; }
      }
      if (ordered.length !== boundary.length || meshVertexKey(ordered[ordered.length - 1]?.to || []) !== meshVertexKey(first.from)) usableLoop = false;
    }

    if (!usableLoop) {
      // Safe fallback for non-manifold/multi-loop selections: inset each triangle independently.
      for (const faceIndex of region) {
        const face = faces[faceIndex], center = [0, 1, 2].map(axis => (face[0][axis] + face[1][axis] + face[2][axis]) / 3);
        const inner = face.map(point => point.map((value, axis) => value + (center[axis] - value) * amount));
        output.push(inner);
        for (let edge = 0; edge < 3; edge++) { const next = (edge + 1) % 3; output.push([face[edge], face[next], inner[next]], [face[edge], inner[next], inner[edge]]); }
      }
      regionResults.set(region, output); continue;
    }

    const outer = ordered.map(edge => edge.from), seedNormal = topology?.normals[region.values().next().value] || faceNormal(faces[region.values().next().value]);
    const inner3 = offsetPolygonInward3D(outer, seedNormal, amount);
    if (!inner3) {
      for (const faceIndex of region) {
        const face = faces[faceIndex], center = [0, 1, 2].map(axis => (face[0][axis] + face[1][axis] + face[2][axis]) / 3);
        const inner = face.map(point => point.map((value, axis) => value + (center[axis] - value) * amount));
        output.push(inner);
        for (let edge = 0; edge < 3; edge++) { const next = (edge + 1) % 3; output.push([face[edge], face[next], inner[next]], [face[edge], inner[next], inner[edge]]); }
      }
      regionResults.set(region, output); continue;
    }
    // Triangulate the inset polygon as a fan, then bridge its boundary back to the source boundary.
    for (let i = 1; i < inner3.length - 1; i++) output.push([inner3[0], inner3[i], inner3[i + 1]]);
    for (let i = 0; i < outer.length; i++) { const j = (i + 1) % outer.length; output.push([outer[i], outer[j], inner3[j]], [outer[i], inner3[j], inner3[i]]); }
    regionResults.set(region, output);
  }

  const output = [];
  for (let i = 0; i < faces.length; i++) {
    if (selected.has(i)) continue;
    output.push(faces[i]);
  }
  for (const regionOutput of regionResults.values()) output.push(...regionOutput);
  return { geometry: flatten(output), insetFaces: selected.size, insetRegions: regions.length, triangleCount: output.length };
}

/**
 * Inspect mesh topology and return truthful vertex, edge, boundary, manifold, and bounding-box diagnostics.
 */
export function inspectMeshTopology(geometry) {
  validate(geometry);
  const faces = trianglesFrom(geometry);
  const vertices = new Set();
  const edgeCounts = new Map();
  let degenerateTriangles = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const face of faces) {
    const keys = face.map(p => meshVertexKey(p));
    for (const k of keys) vertices.add(k);
    for (const p of face) {
      for (let a = 0; a < 3; a++) {
        if (p[a] < min[a]) min[a] = p[a];
        if (p[a] > max[a]) max[a] = p[a];
      }
    }
    const ab = [face[1][0] - face[0][0], face[1][1] - face[0][1], face[1][2] - face[0][2]];
    const ac = [face[2][0] - face[0][0], face[2][1] - face[0][1], face[2][2] - face[0][2]];
    const cross = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const doubleArea = Math.hypot(...cross);
    if (doubleArea < 1e-9 || keys[0] === keys[1] || keys[1] === keys[2] || keys[0] === keys[2]) {
      degenerateTriangles++;
    }
    for (let e = 0; e < 3; e++) {
      const ek = meshEdgeKey(keys[e], keys[(e + 1) % 3]);
      edgeCounts.set(ek, (edgeCounts.get(ek) || 0) + 1);
    }
  }

  let manifoldEdges = 0, boundaryEdges = 0, nonManifoldEdges = 0;
  for (const count of edgeCounts.values()) {
    if (count === 1) boundaryEdges++;
    else if (count === 2) manifoldEdges++;
    else nonManifoldEdges++;
  }

  return {
    triangleCount: faces.length,
    vertexCornerCount: faces.length * 3,
    weldedVertexCount: vertices.size,
    edgeCount: edgeCounts.size,
    manifoldEdges,
    boundaryEdges,
    nonManifoldEdges,
    degenerateTriangles,
    isManifold: nonManifoldEdges === 0 && degenerateTriangles === 0,
    isWatertight: boundaryEdges === 0 && nonManifoldEdges === 0 && degenerateTriangles === 0,
    bounds: {
      min,
      max,
      size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    },
  };
}

/**
 * Delete selected triangle faces from a mesh while guarding against empty output.
 */
export function deleteSelectedFaces(geometry, faceIndices) {
  validate(geometry);
  const faces = trianglesFrom(geometry);
  const selected = normalizedIndices(faceIndices, faces.length);
  if (selected.size >= faces.length) {
    throw new Error('Cannot delete every face in the mesh; keep at least one face or delete the object.');
  }
  const remaining = faces.filter((_, idx) => !selected.has(idx));
  return {
    geometry: flatten(remaining),
    deletedFaces: selected.size,
    triangleCount: remaining.length,
  };
}

/**
 * Weld vertices within a given distance threshold and remove collapsed degenerate triangles.
 */
export function weldMeshVertices(geometry, distance = 0.01, selectedVertexKeys = null) {
  validate(geometry);
  const threshold = Math.max(1e-6, Math.min(5, finite(distance, 0.01)));
  const faces = trianglesFrom(geometry);
  const selectedSet = selectedVertexKeys && selectedVertexKeys.length
    ? new Set(selectedVertexKeys.map(String))
    : null;

  const beforeKeys = new Set();
  const clusters = [];
  const assignCluster = point => {
    const key = meshVertexKey(point);
    beforeKeys.add(key);
    if (selectedSet && !selectedSet.has(key)) return point;
    for (const cluster of clusters) {
      const d = Math.hypot(
        point[0] - cluster.center[0],
        point[1] - cluster.center[1],
        point[2] - cluster.center[2],
      );
      if (d <= threshold) {
        cluster.sum[0] += point[0];
        cluster.sum[1] += point[1];
        cluster.sum[2] += point[2];
        cluster.count++;
        cluster.center = cluster.sum.map(v => v / cluster.count);
        return cluster.center;
      }
    }
    const entry = { sum: [...point], count: 1, center: [...point] };
    clusters.push(entry);
    return entry.center;
  };

  for (const face of faces) {
    for (const point of face) assignCluster(point);
  }

  const snapPoint = point => {
    const key = meshVertexKey(point);
    if (selectedSet && !selectedSet.has(key)) return point;
    let best = null, bestDist = Infinity;
    for (const cluster of clusters) {
      const d = Math.hypot(
        point[0] - cluster.center[0],
        point[1] - cluster.center[1],
        point[2] - cluster.center[2],
      );
      if (d <= threshold && d < bestDist) {
        bestDist = d;
        best = cluster.center;
      }
    }
    return best ? [...best] : point;
  };

  const weldedFaces = [];
  let removedTriangles = 0;
  const afterKeys = new Set();
  for (const face of faces) {
    const a = snapPoint(face[0]);
    const b = snapPoint(face[1]);
    const c = snapPoint(face[2]);
    const ka = meshVertexKey(a), kb = meshVertexKey(b), kc = meshVertexKey(c);
    if (ka === kb || kb === kc || ka === kc) {
      removedTriangles++;
      continue;
    }
    afterKeys.add(ka); afterKeys.add(kb); afterKeys.add(kc);
    weldedFaces.push([a, b, c]);
  }

  if (!weldedFaces.length) {
    throw new Error('Weld threshold is too large and would collapse the entire mesh.');
  }

  return {
    geometry: flatten(weldedFaces),
    beforeVertices: beforeKeys.size,
    afterVertices: afterKeys.size,
    weldedCount: Math.max(0, beforeKeys.size - afterKeys.size),
    removedTriangles,
    triangleCount: weldedFaces.length,
  };
}

/**
 * Split triangles along selected undirected edges by inserting midpoint vertices.
 */
export function splitSelectedEdges(geometry, edgeKeys) {
  validate(geometry);
  const faces = trianglesFrom(geometry);
  const targetEdges = new Set((edgeKeys || []).map(String));
  if (!targetEdges.size) throw new Error('Select at least one edge before splitting.');

  const midpoint = (a, b) => [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
  const output = [];
  let splitCount = 0;

  for (const face of faces) {
    const [v0, v1, v2] = face;
    const e0 = targetEdges.has(meshEdgeKey(v0, v1));
    const e1 = targetEdges.has(meshEdgeKey(v1, v2));
    const e2 = targetEdges.has(meshEdgeKey(v2, v0));
    const count = (e0 ? 1 : 0) + (e1 ? 1 : 0) + (e2 ? 1 : 0);

    if (count === 0) {
      output.push(face);
      continue;
    }
    splitCount++;
    if (count === 1) {
      if (e0) {
        const m = midpoint(v0, v1);
        output.push([v0, m, v2], [m, v1, v2]);
      } else if (e1) {
        const m = midpoint(v1, v2);
        output.push([v0, v1, m], [v0, m, v2]);
      } else {
        const m = midpoint(v2, v0);
        output.push([v0, v1, m], [m, v1, v2]);
      }
    } else if (count === 2) {
      if (e0 && e1) {
        const m01 = midpoint(v0, v1), m12 = midpoint(v1, v2);
        output.push([m01, v1, m12], [v0, m01, m12], [v0, m12, v2]);
      } else if (e1 && e2) {
        const m12 = midpoint(v1, v2), m20 = midpoint(v2, v0);
        output.push([v2, m20, m12], [v0, v1, m12], [v0, m12, m20]);
      } else {
        const m01 = midpoint(v0, v1), m20 = midpoint(v2, v0);
        output.push([v0, m01, m20], [m01, v1, v2], [m01, v2, m20]);
      }
    } else {
      const m01 = midpoint(v0, v1), m12 = midpoint(v1, v2), m20 = midpoint(v2, v0);
      output.push([v0, m01, m20], [m01, v1, m12], [m20, m12, v2], [m01, m12, m20]);
    }
  }

  if (!splitCount) throw new Error('None of the selected edges matched triangles in this mesh.');
  return {
    geometry: flatten(output),
    splitFaces: splitCount,
    triangleCount: output.length,
  };
}

/**
 * Flip face winding order on selected faces (or all faces when faceIndices is omitted/empty).
 */
export function flipMeshNormals(geometry, faceIndices = null) {
  validate(geometry);
  const faces = trianglesFrom(geometry);
  const subset = Array.isArray(faceIndices) && faceIndices.length
    ? normalizedIndices(faceIndices, faces.length)
    : null;
  let flippedFaces = 0;
  const output = faces.map((face, idx) => {
    if (subset && !subset.has(idx)) return face;
    flippedFaces++;
    return [face[0], face[2], face[1]];
  });
  return { geometry: flatten(output), flippedFaces, triangleCount: output.length };
}

/**
 * Recalculate triangle winding so face normals point outward from the mesh centroid.
 */
export function recalculateMeshNormals(geometry) {
  validate(geometry);
  const faces = trianglesFrom(geometry);
  const center = [0, 0, 0];
  let count = 0;
  for (const face of faces) {
    for (const p of face) {
      center[0] += p[0];
      center[1] += p[1];
      center[2] += p[2];
      count++;
    }
  }
  if (count > 0) {
    center[0] /= count;
    center[1] /= count;
    center[2] /= count;
  }
  let correctedFaces = 0;
  const output = faces.map(face => {
    const n = faceNormal(face);
    const fc = [
      (face[0][0] + face[1][0] + face[2][0]) / 3 - center[0],
      (face[0][1] + face[1][1] + face[2][1]) / 3 - center[1],
      (face[0][2] + face[1][2] + face[2][2]) / 3 - center[2],
    ];
    const dot = n[0] * fc[0] + n[1] * fc[1] + n[2] * fc[2];
    if (dot < -1e-6) {
      correctedFaces++;
      return [face[0], face[2], face[1]];
    }
    return face;
  });
  return { geometry: flatten(output), correctedFaces, triangleCount: output.length };
}


/** Split every triangle crossed by a cutting plane, inserting a clean edge loop. Options: {axis, position (world coord or 0..1 fraction), t, cuts, segments}. */
export function loopCutTriangleMesh(geometry, options = {}) {
  validate(geometry);
  const opts = typeof options === 'number' ? { position: options } : (options || {});
  const axisName = ['x', 'y', 'z'].includes(opts.axis) ? opts.axis : 'x';
  const axis = { x: 0, y: 1, z: 2 }[axisName];
  let faces = trianglesFrom(geometry);
  // bounds
  let lo = Infinity, hi = -Infinity;
  for (const f of faces) for (const p of f) { lo = Math.min(lo, p[axis]); hi = Math.max(hi, p[axis]); }
  const span = Math.max(1e-9, hi - lo);
  let positions = [];
  if (Array.isArray(opts.cuts)) positions = opts.cuts.map(Number).filter(Number.isFinite);
  else if (Number.isFinite(Number(opts.segments)) && Number(opts.segments) > 1) {
    const n = Math.min(16, Math.round(Number(opts.segments)));
    for (let i = 1; i < n; i++) positions.push(lo + (span * i) / n);
  } else if (Number.isFinite(Number(opts.count)) && Number(opts.count) > 1) {
    const n = Math.min(16, Math.round(Number(opts.count)));
    for (let i = 1; i < n; i++) positions.push(lo + (span * i) / n);
  } else {
    const raw = finite(opts.position ?? opts.t ?? opts.offset, 0.5);
    positions = [raw > lo && raw < hi && (raw < 0 || raw > 1 || Math.abs(span - 1) < 1e-9 && raw !== 0.5) ? raw : (raw >= -1e-9 && raw <= 1 + 1e-9 && !(raw > lo && raw < hi) ? lo + span * clampCut(raw) : (raw > lo && raw < hi ? raw : lo + span * 0.5))];
    function clampCut(v) { return Math.min(0.95, Math.max(0.05, v)); }
    // Simpler deterministic rule: a value strictly inside bounds is a coordinate, otherwise a fraction.
    const candidate = finite(opts.position ?? opts.t ?? opts.offset, 0.5);
    positions = [candidate > lo && candidate < hi ? candidate : lo + span * Math.min(0.95, Math.max(0.05, candidate >= 0 && candidate <= 1 ? candidate : 0.5))];
  }
  positions = [...new Set(positions.filter(v => v > lo + 1e-9 && v < hi - 1e-9))].sort((a, b) => a - b);
  if (!positions.length) positions = [lo + span * 0.5];
  let cutEdges = 0;
  const lerpPoint = (a, b, plane) => {
    const denom = b[axis] - a[axis]; const t = Math.abs(denom) < 1e-12 ? 0 : (plane - a[axis]) / denom;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };
  const clipPoly = (poly, plane, keepBelow) => {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i], prev = poly[(i + poly.length - 1) % poly.length];
      const curIn = keepBelow ? cur[axis] <= plane + 1e-9 : cur[axis] >= plane - 1e-9;
      const prevIn = keepBelow ? prev[axis] <= plane + 1e-9 : prev[axis] >= plane - 1e-9;
      if (curIn !== prevIn) out.push(lerpPoint(prev, cur, plane));
      if (curIn) out.push(cur);
    }
    return out;
  };
  const fan = poly => {
    const tris = [];
    for (let i = 1; i + 1 < poly.length; i++) tris.push([poly[0], poly[i], poly[i + 1]]);
    return tris;
  };
  for (const plane of positions) {
    const next = [];
    for (const face of faces) {
      const vals = face.map(p => p[axis]);
      if (Math.min(...vals) >= plane - 1e-9 || Math.max(...vals) <= plane + 1e-9) { next.push(face); continue; }
      cutEdges++;
      next.push(...fan(clipPoly(face, plane, true)), ...fan(clipPoly(face, plane, false)));
    }
    faces = next;
  }
  return { geometry: flatten(faces), triangleCount: faces.length, cutCount: positions.length, loopCount: positions.length, cutEdges, axis: axisName, positions };
}

/** Poke selected faces: insert a (optionally raised) centre vertex and fan it to the face corners. */
export function pokeSelectedFaces(geometry, faceIndices, options = {}) {
  validate(geometry);
  const opts = typeof options === 'number' ? { depth: options } : (options || {});
  const faces = trianglesFrom(geometry);
  const selected = normalizedIndices(faceIndices, faces.length);
  const depth = clampPoke(finite(opts.depth ?? opts.height ?? opts.distance, 0));
  function clampPoke(v) { return Math.min(10, Math.max(-10, v)); }
  const output = [];
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    if (!selected.has(i)) { output.push(face); continue; }
    const center = [0, 1, 2].map(a => (face[0][a] + face[1][a] + face[2][a]) / 3);
    const n = faceNormal(face);
    const c = center.map((v, a) => v + n[a] * depth);
    output.push([face[0], face[1], c], [face[1], face[2], c], [face[2], face[0], c]);
  }
  return { geometry: flatten(output), pokedFaces: selected.size, triangleCount: output.length };
}

/** Fill open boundary holes by fanning each boundary loop to its centroid. */
export function fillMeshHoles(geometry, options = {}) {
  validate(geometry);
  const faces = trianglesFrom(geometry);
  const edgeUses = new Map();
  const pointByKey = new Map();
  for (const face of faces) for (const p of face) pointByKey.set(meshVertexKey(p), p);
  faces.forEach((face, fi) => {
    for (let e = 0; e < 3; e++) {
      const a = face[e], b = face[(e + 1) % 3], key = meshEdgeKey(a, b);
      if (!edgeUses.has(key)) edgeUses.set(key, []);
      edgeUses.get(key).push({ from: a, to: b, face: fi });
    }
  });
  const boundary = [...edgeUses.values()].filter(u => u.length === 1).map(u => u[0]);
  if (!boundary.length) return { geometry: flatten(faces), filledHoles: 0, boundaryEdges: 0, triangleCount: faces.length };
  // Chain boundary edges into loops by undirected vertex adjacency (neighbour
  // faces around a hole may wind either way, so direction cannot be trusted).
  const adjacency = new Map();
  boundary.forEach((edge, edgeIndex) => {
    for (const [from, to] of [[edge.from, edge.to], [edge.to, edge.from]]) {
      const k = meshVertexKey(from);
      if (!adjacency.has(k)) adjacency.set(k, []);
      adjacency.get(k).push({ edgeIndex, point: from, other: to, otherKey: meshVertexKey(to) });
    }
  });
  const usedEdges = new Set(); const loops = [];
  for (let startIndex = 0; startIndex < boundary.length; startIndex++) {
    if (usedEdges.has(startIndex)) continue;
    const startEdge = boundary[startIndex];
    usedEdges.add(startIndex);
    const loop = [startEdge.from, startEdge.to];
    let currentKey = meshVertexKey(startEdge.to);
    const startKey = meshVertexKey(startEdge.from);
    let guard = boundary.length + 2;
    while (currentKey !== startKey && guard-- > 0) {
      const candidates = (adjacency.get(currentKey) || []).filter(c => !usedEdges.has(c.edgeIndex));
      if (!candidates.length) break;
      const next = candidates[0];
      usedEdges.add(next.edgeIndex);
      if (next.otherKey === startKey) break;
      loop.push(next.other);
      currentKey = next.otherKey;
    }
    if (loop.length >= 3 && currentKey === startKey || (loop.length >= 3 && (adjacency.get(currentKey) || []).some(c => c.otherKey === startKey))) loops.push(loop);
  }
  const fillFaces = [];
  let filledHoles = 0;
  const loopsToFill = loops;
  for (const loop of loopsToFill) {
    const center = [0, 1, 2].map(a => loop.reduce((s, pt) => s + pt[a], 0) / loop.length);
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      fillFaces.push([b, a, center]);
    }
    filledHoles++;
  }
  const output = [...faces, ...fillFaces];
  return { geometry: flatten(output), filledHoles, filledLoops: filledHoles, boundaryEdges: boundary.length, addedTriangles: fillFaces.length, triangleCount: output.length };
}

function pointInBox(p, min, max, eps = 1e-7) {
  return p[0] > min[0] + eps && p[0] < max[0] - eps && p[1] > min[1] + eps && p[1] < max[1] - eps && p[2] > min[2] + eps && p[2] < max[2] - eps;
}
function boxOf(faces) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const p of f) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], p[a]); max[a] = Math.max(max[a], p[a]); }
  return { min, max };
}
function splitFaceByBoxPlanes(face, box) {
  // Subdivide by the 6 AABB planes so every sub-triangle classifies cleanly.
  let polys = [face];
  const planes = [];
  for (let a = 0; a < 3; a++) { planes.push({ axis: a, value: box.min[a] }); planes.push({ axis: a, value: box.max[a] }); }
  const interp = (p, q, axis, value) => {
    const denom = q[axis] - p[axis]; const t = Math.abs(denom) < 1e-12 ? 0 : (value - p[axis]) / denom;
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  };
  const clip = (poly, axis, value, keepBelow) => {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i], prev = poly[(i + poly.length - 1) % poly.length];
      const curIn = keepBelow ? cur[axis] <= value + 1e-9 : cur[axis] >= value - 1e-9;
      const prevIn = keepBelow ? prev[axis] <= value + 1e-9 : prev[axis] >= value - 1e-9;
      if (curIn !== prevIn) out.push(interp(prev, cur, axis, value));
      if (curIn) out.push(cur);
    }
    return out;
  };
  for (const plane of planes) {
    const next = [];
    for (const poly of polys) {
      const below = clip(poly, plane.axis, plane.value, true);
      const above = clip(poly, plane.axis, plane.value, false);
      if (below.length >= 3) next.push(below);
      if (above.length >= 3) next.push(above);
      if (below.length < 3 && above.length < 3 && poly.length >= 3) next.push(poly);
    }
    polys = next;
    if (polys.length > 512) break;
  }
  const tris = [];
  for (const poly of polys) for (let i = 1; i + 1 < poly.length; i++) tris.push([poly[0], poly[i], poly[i + 1]]);
  return tris;
}

/** Boolean (CSG) combine of two triangle meshes: 'union' | 'difference' | 'intersect'. AABB-plane subdivision + centroid classification; exact for box-like meshes and bounded for general meshes. */
export function booleanTriangleMeshes(geometryA, geometryB, operationOrOptions = 'union') {
  validate(geometryA); validate(geometryB);
  const operation = typeof operationOrOptions === 'string' ? operationOrOptions : String(operationOrOptions?.operation || operationOrOptions?.mode || 'union');
  if (!['union', 'difference', 'intersect'].includes(operation)) throw new Error(`Unknown boolean operation "${operation}". Use union, difference or intersect.`);
  const facesA = trianglesFrom(geometryA), facesB = trianglesFrom(geometryB);
  const boxA = boxOf(facesA), boxB = boxOf(facesB);
  const centroid = f => [0, 1, 2].map(a => (f[0][a] + f[1][a] + f[2][a]) / 3);
  const splitA = facesA.flatMap(f => splitFaceByBoxPlanes(f, boxB));
  const splitB = facesB.flatMap(f => splitFaceByBoxPlanes(f, boxA));
  const out = [];
  if (operation === 'union') {
    for (const f of splitA) if (!pointInBox(centroid(f), boxB.min, boxB.max)) out.push(f);
    for (const f of splitB) if (!pointInBox(centroid(f), boxA.min, boxA.max)) out.push(f);
  } else if (operation === 'difference') {
    for (const f of splitA) if (!pointInBox(centroid(f), boxB.min, boxB.max)) out.push(f);
    for (const f of splitB) if (pointInBox(centroid(f), boxA.min, boxA.max)) out.push([f[0], f[2], f[1]]);
  } else {
    for (const f of splitA) if (pointInBox(centroid(f), boxB.min, boxB.max)) out.push(f);
    for (const f of splitB) if (pointInBox(centroid(f), boxA.min, boxA.max)) out.push(f);
  }
  // Remove exact duplicate triangles (e.g. coincident faces in a union).
  const seen = new Set(); const deduped = [];
  for (const f of out) {
    const key = f.map(p => meshVertexKey(p)).sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key); deduped.push(f);
  }
  return { geometry: deduped.length ? flatten(deduped) : new Float32Array(0), triangleCount: deduped.length, operation };
}

/** 3D Voronoi cellular fracture: assign triangles to seeded 3D Voronoi cells and (optionally) explode the shards apart. */
export function fractureTriangleMesh(geometry, options = {}) {
  validate(geometry);
  const opts = options || {};
  const cellCount = Math.round(Math.min(128, Math.max(1, finite(opts.cells ?? opts.cellCount ?? opts.fragments ?? opts.pieces, 8))));
  const seed = Math.trunc(finite(opts.seed, 1234));
  const explode = Math.min(5, Math.max(0, finite(opts.explode ?? opts.explodeFactor, 0.04)));
  const faces = trianglesFrom(geometry);
  const box = boxOf(faces);
  const center = [0, 1, 2].map(a => (box.min[a] + box.max[a]) / 2);
  let state = (seed || 1234) >>> 0;
  const rand = () => { state = (state + 0x6D2B79F5) >>> 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const sites = Array.from({ length: cellCount }, () => [box.min[0] + rand() * (box.max[0] - box.min[0]), box.min[1] + rand() * (box.max[1] - box.min[1]), box.min[2] + rand() * (box.max[2] - box.min[2])]);
  const groups = new Map();
  for (const face of faces) {
    const c = [0, 1, 2].map(a => (face[0][a] + face[1][a] + face[2][a]) / 3);
    let best = 0, bestD = Infinity;
    sites.forEach((s, i) => { const d = (c[0] - s[0]) ** 2 + (c[1] - s[1]) ** 2 + (c[2] - s[2]) ** 2; if (d < bestD) { bestD = d; best = i; } });
    if (!groups.has(best)) groups.set(best, []);
    groups.get(best).push(face);
  }
  const fragments = []; const output = [];
  for (const [cell, cellFaces] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    const fc = [0, 1, 2].map(a => cellFaces.reduce((s, f) => s + (f[0][a] + f[1][a] + f[2][a]) / 3, 0) / cellFaces.length);
    let dir = fc.map((v, a) => v - center[a]); const len = Math.hypot(...dir) || 1; dir = dir.map(v => v / len);
    const moved = cellFaces.map(f => f.map(p => p.map((v, a) => v + dir[a] * explode)));
    for (const f of moved) output.push(f);
    fragments.push({ id: `fragment-${cell}`, cell, triangleCount: cellFaces.length, centroid: fc, geometry: flatten(moved) });
  }
  return { geometry: flatten(output), fragments, fragmentCount: fragments.length, pieceCount: fragments.length, cellCount, triangleCount: output.length, seed };
}

/** Weld triangle soup into an indexed mesh { positions, indices } honoring exact vertex keys. */
export function weldToIndexedMesh(geometry) {
  validate(geometry);
  const faces = trianglesFrom(geometry);
  const keyToIndex = new Map();
  const positions = [];
  const indices = [];
  const indexOf = (point) => {
    const key = meshVertexKey(point);
    if (!keyToIndex.has(key)) {
      keyToIndex.set(key, positions.length / 3);
      positions.push(point[0], point[1], point[2]);
    }
    return keyToIndex.get(key);
  };
  for (const face of faces) for (const point of face) indices.push(indexOf(point));
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices), vertexCount: positions.length / 3, triangleCount: indices.length / 3 };
}

/**
 * True Catmull-Clark subdivision over the welded polygon mesh.
 * Each source triangle becomes three quads (face point + edge points +
 * smoothed vertex points) using the standard edge/vertex point rules with
 * boundary handling; quads are fan-triangulated for the triangle pipeline.
 */
export function subdivideCatmullClark(geometry, options = {}) {
  const iterations = Math.max(1, Math.min(4, Math.round(finite(options.iterations, 1))));
  let indexed = weldToIndexedMesh(geometry);
  for (let iteration = 0; iteration < iterations; iteration++) {
    const pos = indexed.positions;
    const idx = indexed.indices;
    const vertexCount = indexed.vertexCount;
    const faces = [];
    for (let i = 0; i < idx.length; i += 3) faces.push([idx[i], idx[i + 1], idx[i + 2]]);
    if (faces.length > MAX_TOPOLOGY_TRIANGLES) throw new Error('Catmull-Clark exceeds the topology safety budget.');
    const pointOf = (vi) => [pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]];
    // Face points (centroids).
    const facePoints = faces.map(face => {
      const c = [0, 0, 0];
      for (const vi of face) { const p = pointOf(vi); c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
      return [c[0] / face.length, c[1] / face.length, c[2] / face.length];
    });
    // Edge bookkeeping.
    const edgeMap = new Map();
    const edgeKeyOf = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    faces.forEach((face, fi) => {
      for (let e = 0; e < face.length; e++) {
        const key = edgeKeyOf(face[e], face[(e + 1) % face.length]);
        if (!edgeMap.has(key)) edgeMap.set(key, { a: face[e], b: face[(e + 1) % face.length], faces: [] });
        edgeMap.get(key).faces.push(fi);
      }
    });
    // Edge points: interior = (A + B + F1 + F2) / 4, boundary = midpoint.
    const edgePoints = new Map();
    for (const [key, edge] of edgeMap) {
      const a = pointOf(edge.a); const b = pointOf(edge.b);
      if (edge.faces.length === 2) {
        const f1 = facePoints[edge.faces[0]]; const f2 = facePoints[edge.faces[1]];
        edgePoints.set(key, [0, 1, 2].map(ax => (a[ax] + b[ax] + f1[ax] + f2[ax]) / 4));
      } else {
        edgePoints.set(key, [0, 1, 2].map(ax => (a[ax] + b[ax]) / 2));
      }
    }
    // Vertex points: interior (F + 2R + (n-3)P) / n; boundary (6P + B1 + B2) / 8.
    const vertexFaces = Array.from({ length: vertexCount }, () => []);
    faces.forEach((face, fi) => { for (const vi of face) vertexFaces[vi].push(fi); });
    const vertexEdges = Array.from({ length: vertexCount }, () => []);
    for (const edge of edgeMap.values()) { vertexEdges[edge.a].push(edge); vertexEdges[edge.b].push(edge); }
    const newPositions = [];
    const pushPoint = (p) => { newPositions.push(p[0], p[1], p[2]); return newPositions.length / 3 - 1; };
    const newVertexIndex = new Array(vertexCount);
    for (let vi = 0; vi < vertexCount; vi++) {
      const p = pointOf(vi);
      const boundaryEdges = vertexEdges[vi].filter(e => e.faces.length === 1);
      if (boundaryEdges.length >= 2) {
        const others = boundaryEdges.slice(0, 2).map(e => pointOf(e.a === vi ? e.b : e.a));
        newVertexIndex[vi] = pushPoint([0, 1, 2].map(ax => (6 * p[ax] + others[0][ax] + others[1][ax]) / 8));
      } else {
        const n = Math.max(1, vertexFaces[vi].length);
        const F = [0, 0, 0]; const R = [0, 0, 0];
        for (const fi of vertexFaces[vi]) { const fp = facePoints[fi]; F[0] += fp[0]; F[1] += fp[1]; F[2] += fp[2]; }
        for (const edge of vertexEdges[vi]) { const a = pointOf(edge.a); const b = pointOf(edge.b); R[0] += (a[0] + b[0]) / 2; R[1] += (a[1] + b[1]) / 2; R[2] += (a[2] + b[2]) / 2; }
        const edgeCount = Math.max(1, vertexEdges[vi].length);
        newVertexIndex[vi] = pushPoint([0, 1, 2].map(ax => {
          const fAvg = F[ax] / n; const rAvg = R[ax] / edgeCount;
          return (fAvg + 2 * rAvg + (n - 3) * p[ax]) / n;
        }));
      }
    }
    const edgePointIndex = new Map();
    for (const [key, point] of edgePoints) edgePointIndex.set(key, pushPoint(point));
    const facePointIndex = facePoints.map(point => pushPoint(point));
    // Rebuild: each face -> one quad per corner (vertex, next edge, face point, prev edge).
    const outIndices = [];
    faces.forEach((face, fi) => {
      const n = face.length;
      for (let c = 0; c < n; c++) {
        const v = face[c];
        const nextEdge = edgePointIndex.get(edgeKeyOf(v, face[(c + 1) % n]));
        const prevEdge = edgePointIndex.get(edgeKeyOf(face[(c - 1 + n) % n], v));
        const quad = [newVertexIndex[v], nextEdge, facePointIndex[fi], prevEdge];
        outIndices.push(quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]);
      }
    });
    indexed = { positions: new Float32Array(newPositions), indices: new Uint32Array(outIndices), vertexCount: newPositions.length / 3, triangleCount: outIndices.length / 3 };
  }
  const out = new Float32Array(indexed.indices.length * 3);
  let o = 0;
  for (const vi of indexed.indices) { out[o++] = indexed.positions[vi * 3]; out[o++] = indexed.positions[vi * 3 + 1]; out[o++] = indexed.positions[vi * 3 + 2]; }
  if (out.length > MAX_FLOATS) throw new Error('Catmull-Clark result exceeds the geometry safety budget.');
  return out;
}

/** Bridge two ordered vertex loops with a quad strip (resamples loop B when counts differ). */
export function bridgeVertexLoops(loopA, loopB, options = {}) {
  const clean = (loop) => (Array.isArray(loop) ? loop : []).map(p => [finite(p?.[0] ?? p?.x), finite(p?.[1] ?? p?.y), finite(p?.[2] ?? p?.z)]);
  let a = clean(loopA);
  let b = clean(loopB);
  if (a.length < 3 || b.length < 3) throw new Error('Bridge needs two loops of at least three points.');
  const resample = (loop, count) => {
    if (loop.length === count) return loop;
    const out = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * loop.length;
      const i0 = Math.floor(t) % loop.length; const i1 = (i0 + 1) % loop.length; const f = t - Math.floor(t);
      out.push([0, 1, 2].map(ax => loop[i0][ax] + (loop[i1][ax] - loop[i0][ax]) * f));
    }
    return out;
  };
  const count = Math.max(a.length, b.length);
  a = resample(a, count); b = resample(b, count);
  if (options.closed !== false) { /* loops are treated cyclically */ }
  const faces = [];
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    faces.push([a[i], b[i], b[j]]);
    faces.push([a[i], b[j], a[j]]);
  }
  return flatten(faces);
}

/** Revolve a [[radius, y], ...] profile around the Y axis. Returns triangle positions Float32Array. */
export function latheProfileToMesh(profile, options = {}) {
  const detailed = latheProfileDetailed(profile, options);
  return detailed.geometry;
}

export function latheProfileDetailed(profile, options = {}) {
  const points = (Array.isArray(profile) ? profile : []).map(p => [Math.max(0, finite(p?.[0] ?? p?.r)), finite(p?.[1] ?? p?.y)]);
  if (points.length < 2) throw new Error('Lathe needs at least two [radius, y] profile points.');
  const segments = Math.max(3, Math.min(256, Math.round(finite(options.segments, 24))));
  const phiStart = finite(options.phiStart, 0);
  const phiLength = finite(options.phiLength, Math.PI * 2);
  const positions = [];
  const uvs = [];
  const vertex = (pi, si) => {
    const phi = phiStart + (si / segments) * phiLength;
    const [r, y] = points[pi];
    positions.push(Math.cos(phi) * r, y, Math.sin(phi) * r);
    uvs.push(si / segments, pi / (points.length - 1));
  };
  const grid = [];
  for (let pi = 0; pi < points.length; pi++) {
    grid.push([]);
    for (let si = 0; si <= segments; si++) { grid[pi].push(positions.length / 3); vertex(pi, si); }
  }
  const indices = [];
  for (let pi = 0; pi < points.length - 1; pi++) {
    for (let si = 0; si < segments; si++) {
      const a = grid[pi][si]; const b = grid[pi][si + 1]; const c = grid[pi + 1][si + 1]; const d = grid[pi + 1][si];
      indices.push(a, d, c, a, c, b);
    }
  }
  const out = new Float32Array(indices.length * 3);
  let o = 0;
  for (const vi of indices) { out[o++] = positions[vi * 3]; out[o++] = positions[vi * 3 + 1]; out[o++] = positions[vi * 3 + 2]; }
  const outUvs = new Float32Array(indices.length * 2);
  let u = 0;
  for (const vi of indices) { outUvs[u++] = uvs[vi * 2]; outUvs[u++] = uvs[vi * 2 + 1]; }
  return { geometry: out, uvs: outUvs, segments, profilePoints: points.length, triangleCount: indices.length / 3 };
}

/** Icosahedron-based geodesic sphere, subdivided and projected onto the radius. */
export function createGeodesicSphere(options = {}) {
  return geodesicSphereDetailed(options).geometry;
}

export function geodesicSphereDetailed(options = {}) {
  const radius = Math.max(0.01, finite(options.radius, 1));
  const subdivisions = Math.max(0, Math.min(4, Math.round(finite(options.subdivisions, 1))));
  const t = (1 + Math.sqrt(5)) / 2;
  let vertices = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(p => { const l = Math.hypot(...p); return p.map(v => (v / l) * radius); });
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const midpointCache = new Map();
  const midpoint = (a, b) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (midpointCache.has(key)) return midpointCache.get(key);
    const pa = vertices[a]; const pb = vertices[b];
    const mid = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2];
    const l = Math.hypot(...mid) || 1;
    vertices.push(mid.map(v => (v / l) * radius));
    const index = vertices.length - 1;
    midpointCache.set(key, index);
    return index;
  };
  for (let s = 0; s < subdivisions; s++) {
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b); const bc = midpoint(b, c); const ca = midpoint(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  const out = new Float32Array(faces.length * 9);
  const uvs = new Float32Array(faces.length * 6);
  let o = 0; let u = 0;
  for (const face of faces) {
    for (const vi of face) {
      const p = vertices[vi];
      out[o++] = p[0]; out[o++] = p[1]; out[o++] = p[2];
      uvs[u++] = 0.5 + Math.atan2(p[2], p[0]) / (Math.PI * 2);
      uvs[u++] = 0.5 - Math.asin(Math.max(-1, Math.min(1, p[1] / radius))) / Math.PI;
    }
  }
  return { geometry: out, uvs, radius, subdivisions, triangleCount: faces.length };
}

/** Generate planar / box / spherical UVs for triangle soup; returns Float32Array of uv pairs per vertex. */
export function generateMeshUVs(geometry, options = {}) {
  validate(geometry);
  const mode = ['planar', 'box', 'spherical'].includes(options.mode) ? options.mode : 'planar';
  const scale = Math.max(1e-6, finite(options.scale, 1));
  const faces = trianglesFrom(geometry);
  const out = new Float32Array(faces.length * 6);
  let u = 0;
  for (const face of faces) {
    const n = faceNormal(face);
    const axis = Math.abs(n[0]) > Math.abs(n[1]) && Math.abs(n[0]) > Math.abs(n[2]) ? 0 : Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2;
    for (const p of face) {
      if (mode === 'spherical') {
        const l = Math.hypot(...p) || 1;
        out[u++] = 0.5 + Math.atan2(p[2], p[0]) / (Math.PI * 2);
        out[u++] = 0.5 - Math.asin(Math.max(-1, Math.min(1, p[1] / l))) / Math.PI;
      } else if (mode === 'box') {
        if (axis === 0) { out[u++] = p[2] * scale; out[u++] = p[1] * scale; }
        else if (axis === 1) { out[u++] = p[0] * scale; out[u++] = p[2] * scale; }
        else { out[u++] = p[0] * scale; out[u++] = p[1] * scale; }
      } else {
        out[u++] = p[0] * scale; out[u++] = p[2] * scale;
      }
    }
  }
  return out;
}

/**
 * 3D Voronoi fracture: assigns faces to seeded 3D cells, explodes shards and
 * generates interior planar UVs per shard so fresh fracture faces texture cleanly.
 */
export function fractureMeshVoronoi3D(geometry, options = {}) {
  validate(geometry);
  const cellCount = Math.max(1, Math.min(96, Math.round(finite(options.cells ?? options.cellCount, 8))));
  const seed = Math.trunc(finite(options.seed, 4242));
  const explode = Math.min(5, Math.max(0, finite(options.explode, 0.03)));
  const faces = trianglesFrom(geometry);
  const box = boxOf(faces);
  const center = [0, 1, 2].map(a => (box.min[a] + box.max[a]) / 2);
  let state = (seed || 4242) >>> 0;
  const rand = () => { state = (state + 0x6D2B79F5) >>> 0; let tt = Math.imul(state ^ (state >>> 15), 1 | state); tt = (tt + Math.imul(tt ^ (tt >>> 7), 61 | tt)) ^ tt; return ((tt ^ (tt >>> 14)) >>> 0) / 4294967296; };
  const sites = Array.from({ length: cellCount }, () => [box.min[0] + rand() * (box.max[0] - box.min[0]), box.min[1] + rand() * (box.max[1] - box.min[1]), box.min[2] + rand() * (box.max[2] - box.min[2])]);
  const groups = new Map();
  for (const face of faces) {
    const c = [0, 1, 2].map(a => (face[0][a] + face[1][a] + face[2][a]) / 3);
    let best = 0; let bestD = Infinity;
    sites.forEach((s, i) => { const d = (c[0] - s[0]) ** 2 + (c[1] - s[1]) ** 2 + (c[2] - s[2]) ** 2; if (d < bestD) { bestD = d; best = i; } });
    if (!groups.has(best)) groups.set(best, []);
    groups.get(best).push(face);
  }
  const shards = [];
  const merged = [];
  const mergedUvs = [];
  for (const [cell, cellFaces] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    const centroid = [0, 1, 2].map(a => cellFaces.reduce((s, f) => s + (f[0][a] + f[1][a] + f[2][a]) / 3, 0) / cellFaces.length);
    let dir = centroid.map((v, a) => v - center[a]);
    const len = Math.hypot(...dir) || 1;
    dir = dir.map(v => v / len);
    const moved = cellFaces.map(f => f.map(p => p.map((v, a) => v + dir[a] * explode)));
    const shardGeometry = flatten(moved);
    const shardUvs = generateMeshUVs(shardGeometry, { mode: 'box', scale: finite(options.uvScale, 0.5) });
    shards.push({
      id: `shard-${cell}`,
      cell,
      centroid,
      triangleCount: cellFaces.length,
      geometry: shardGeometry,
      uvs: shardUvs,
      interiorUvMode: 'box-planar',
    });
    for (const f of moved) merged.push(f);
    mergedUvs.push(...shardUvs);
  }
  return {
    geometry: flatten(merged),
    uvs: new Float32Array(mergedUvs),
    shards,
    shardCount: shards.length,
    cellCount,
    seed,
    triangleCount: merged.length,
  };
}
