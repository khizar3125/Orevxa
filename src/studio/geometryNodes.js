/**
 * Orvexa Procedural Geometry Nodes — Deterministic, dependency-tracked, cycle-checked
 * node-based geometry generation and instancing for Orvexa Modeler & World Studio.
 */
import { createMeshGeometry } from './scene3d.js';
import { createProceduralTerrainGeometry, subdivideTriangleMesh } from './engine.js';
import { bakeTriangleMeshTransform } from './modeling.js';
import { displaceTriangleMesh } from './modifiers.js';

const MAX_GEOMETRY_FLOATS = 1_800_000;
const MAX_SCATTER_POINTS = 256;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;

function seededRandom(seed) {
  let s = (Math.trunc(seed) || 1) >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GEOMETRY_NODE_TYPES = Object.freeze({
  primitiveMesh: {
    label: 'Primitive / Terrain',
    inputs: {},
    outputs: { geometry: 'geometry' },
    defaults: { shape: 'cube', segments: 12, size: 1, seed: 42 },
  },
  transformGeometry: {
    label: 'Transform Geometry',
    inputs: { geometry: 'geometry' },
    outputs: { geometry: 'geometry' },
    defaults: { translateX: 0, translateY: 0, translateZ: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
  },
  subdivideMesh: {
    label: 'Subdivide Mesh',
    inputs: { geometry: 'geometry' },
    outputs: { geometry: 'geometry' },
    defaults: { levels: 1 },
  },
  noiseDisplace: {
    label: 'Noise Displace',
    inputs: { geometry: 'geometry' },
    outputs: { geometry: 'geometry' },
    defaults: { axis: 'y', amount: 0.18, frequency: 2.5, seed: 19 },
  },
  scatterPoints: {
    label: 'Scatter Points on Surface',
    inputs: { surface: 'geometry' },
    outputs: { points: 'points' },
    defaults: { count: 12, seed: 101, minSlopeY: 0.35, radius: 3.5 },
  },
  instanceOnPoints: {
    label: 'Instance on Points',
    inputs: { points: 'points', instance: 'geometry' },
    outputs: { geometry: 'geometry' },
    defaults: { minScale: 0.65, maxScale: 1.25, randomYaw: true, seed: 202 },
  },
  mergeGeometry: {
    label: 'Merge Geometry',
    inputs: { geometryA: 'geometry', geometryB: 'geometry' },
    outputs: { geometry: 'geometry' },
    defaults: {},
  },
  geometryOutput: {
    label: 'Geometry Output',
    inputs: { geometry: 'geometry' },
    outputs: {},
    defaults: {},
  },
  curveToMesh: {
    label: 'Curve to Mesh (Sweep)',
    inputs: { geometry: 'geometry' },
    outputs: { geometry: 'geometry' },
    defaults: { curve: 'arc', points: 8, radius: 0.18, seed: 12 },
  },
  gridScatter: {
    label: 'Grid Scatter Points',
    inputs: { surface: 'geometry' },
    outputs: { points: 'points' },
    defaults: { columns: 4, rows: 4, spacing: 1.2, jitter: 0.25, seed: 44 },
  },
  radialArray: {
    label: 'Radial Array',
    inputs: { geometry: 'geometry' },
    outputs: { geometry: 'geometry' },
    defaults: { count: 8, radius: 2.2, seed: 8 },
  },
});


export function validateGeometryNodeGraph(graph) {
  const diagnostics = [];
  if (!graph || !Array.isArray(graph.nodes) || !graph.nodes.length) {
    return { ok: false, order: [], diagnostics: [{ code: 'EMPTY_GRAPH', message: 'Geometry node graph must contain nodes.' }], outputNodeId: null };
  }
  if (graph.nodes.length > 48) {
    diagnostics.push({ code: 'TOO_MANY_NODES', message: 'Geometry node graph is limited to 48 nodes.' });
  }
  const nodeMap = new Map();
  let outputNodeId = null;
  for (const raw of graph.nodes) {
    const id = String(raw?.id || '');
    if (!id || nodeMap.has(id)) {
      diagnostics.push({ code: 'INVALID_NODE_ID', message: `Invalid or duplicate geometry node id "${id}".` });
      continue;
    }
    if (!GEOMETRY_NODE_TYPES[raw?.type]) {
      diagnostics.push({ code: 'UNKNOWN_NODE_TYPE', nodeId: id, message: `Unknown geometry node type "${raw?.type}".` });
      continue;
    }
    const spec = GEOMETRY_NODE_TYPES[raw.type];
    nodeMap.set(id, { id, type: raw.type, name: String(raw.name || spec.label).slice(0, 80), params: { ...spec.defaults, ...(raw.params || {}) } });
    if (raw.type === 'geometryOutput') outputNodeId = id;
  }
  if (!outputNodeId) {
    diagnostics.push({ code: 'MISSING_OUTPUT', message: 'Geometry node graph requires a geometryOutput node.' });
  }

  const adj = new Map();
  const inDegree = new Map();
  const validConnections = [];
  for (const id of nodeMap.keys()) { adj.set(id, []); inDegree.set(id, 0); }

  for (const edge of Array.isArray(graph.connections) ? graph.connections : []) {
    const fromNode = nodeMap.get(edge?.from);
    const toNode = nodeMap.get(edge?.to);
    if (!fromNode || !toNode) {
      diagnostics.push({ code: 'MISSING_ENDPOINT', message: `Connection references unknown node "${edge?.from}" or "${edge?.to}".` });
      continue;
    }
    if (fromNode.id === toNode.id) {
      diagnostics.push({ code: 'SELF_LOOP', nodeId: fromNode.id, message: `Node "${fromNode.id}" cannot connect to itself.` });
      continue;
    }
    const outType = GEOMETRY_NODE_TYPES[fromNode.type]?.outputs?.[edge?.fromPort];
    const inType = GEOMETRY_NODE_TYPES[toNode.type]?.inputs?.[edge?.toPort];
    if (!outType || !inType || outType !== inType) {
      diagnostics.push({ code: 'PORT_MISMATCH', nodeId: toNode.id, message: `Incompatible ports ${fromNode.id}.${edge?.fromPort} (${outType || 'none'}) -> ${toNode.id}.${edge?.toPort} (${inType || 'none'}).` });
      continue;
    }
    validConnections.push({ from: fromNode.id, fromPort: edge.fromPort, to: toNode.id, toPort: edge.toPort });
    adj.get(fromNode.id).push(toNode.id);
    inDegree.set(toNode.id, (inDegree.get(toNode.id) || 0) + 1);
  }

  const queue = [];
  for (const [id, deg] of inDegree.entries()) if (deg === 0) queue.push(id);
  const order = [];
  while (queue.length) {
    const current = queue.shift();
    order.push(current);
    for (const next of adj.get(current) || []) {
      const d = (inDegree.get(next) || 0) - 1;
      inDegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  if (order.length !== nodeMap.size) {
    diagnostics.push({ code: 'CYCLE_DETECTED', message: 'Cycle detected in geometry node graph.' });
  }
  return { ok: diagnostics.length === 0, order, diagnostics, outputNodeId, nodeMap, validConnections };
}

export function normalizeGeometryNodeGraph(graph = {}) {
  const checked = validateGeometryNodeGraph(graph);
  const nodes = checked.nodeMap ? [...checked.nodeMap.values()] : [];
  return {
    name: String(graph?.name || 'Geometry Node Graph').slice(0, 80),
    preset: String(graph?.preset || 'custom').slice(0, 48),
    nodes,
    connections: checked.validConnections ? [...checked.validConnections] : [],
  };
}

export function evaluateGeometryNodeGraph(graph) {
  const checked = validateGeometryNodeGraph(graph);
  if (!checked.ok) {
    throw new Error(checked.diagnostics.map(d => d.message).join(' '));
  }
  const incoming = new Map();
  for (const conn of checked.validConnections) incoming.set(`${conn.to}:${conn.toPort}`, conn);
  const outputs = new Map();
  const readInput = (nodeId, port) => {
    const conn = incoming.get(`${nodeId}:${port}`);
    if (!conn) return null;
    return outputs.get(conn.from)?.[conn.fromPort] ?? null;
  };

  for (const nodeId of checked.order) {
    const node = checked.nodeMap.get(nodeId);
    const p = node.params;
    if (node.type === 'primitiveMesh') {
      const shape = String(p.shape || 'cube');
      const segments = Math.round(clamp(finite(p.segments, 12), 4, 36));
      const size = clamp(finite(p.size, 1), 0.05, 50);
      let geom;
      if (shape === 'terrain') {
        geom = createProceduralTerrainGeometry({ width: size * 4, depth: size * 4, segments, amplitude: size * 0.65, seed: finite(p.seed, 42) });
      } else {
        const base = createMeshGeometry(shape, segments);
        geom = new Float32Array(base.length);
        for (let i = 0; i < base.length; i++) geom[i] = base[i] * size;
      }
      outputs.set(nodeId, { geometry: geom });
    } else if (node.type === 'transformGeometry') {
      const src = readInput(nodeId, 'geometry');
      if (!src || !src.length) { outputs.set(nodeId, { geometry: new Float32Array(0) }); continue; }
      const deg = d => (finite(d, 0) * Math.PI) / 180;
      const baked = bakeTriangleMeshTransform(src, {
        position: { x: finite(p.translateX, 0), y: finite(p.translateY, 0), z: finite(p.translateZ, 0) },
        rotation: { x: deg(p.rotateX), y: deg(p.rotateY), z: deg(p.rotateZ) },
        scale: { x: clamp(finite(p.scaleX, 1), 0.01, 50), y: clamp(finite(p.scaleY, 1), 0.01, 50), z: clamp(finite(p.scaleZ, 1), 0.01, 50) },
        size: 1,
      }, { includeTranslation: true });
      outputs.set(nodeId, { geometry: new Float32Array(baked) });
    } else if (node.type === 'subdivideMesh') {
      const src = readInput(nodeId, 'geometry');
      if (!src || !src.length) { outputs.set(nodeId, { geometry: new Float32Array(0) }); continue; }
      const levels = Math.round(clamp(finite(p.levels, 1), 1, 2));
      let geom = Array.from(src);
      for (let i = 0; i < levels; i++) geom = subdivideTriangleMesh(geom, MAX_GEOMETRY_FLOATS);
      outputs.set(nodeId, { geometry: new Float32Array(geom) });
    } else if (node.type === 'noiseDisplace') {
      const src = readInput(nodeId, 'geometry');
      if (!src || !src.length) { outputs.set(nodeId, { geometry: new Float32Array(0) }); continue; }
      outputs.set(nodeId, {
        geometry: displaceTriangleMesh(src, {
          axis: ['x', 'y', 'z'].includes(p.axis) ? p.axis : 'y',
          amount: clamp(finite(p.amount, 0.18), -3, 3),
          frequency: clamp(finite(p.frequency, 2.5), 0.1, 25),
          seed: finite(p.seed, 19),
        }),
      });
    } else if (node.type === 'scatterPoints') {
      const surface = readInput(nodeId, 'surface');
      const count = Math.round(clamp(finite(p.count, 12), 1, MAX_SCATTER_POINTS));
      const rng = seededRandom(finite(p.seed, 101));
      const minSlopeY = clamp(finite(p.minSlopeY, 0.35), -1, 0.99);
      const points = [];
      if (surface && surface.length >= 9) {
        const triCount = Math.floor(surface.length / 9);
        let attempts = 0;
        while (points.length < count && attempts < count * 8) {
          attempts++;
          const tri = Math.floor(rng() * triCount) * 9;
          const ax = surface[tri], ay = surface[tri + 1], az = surface[tri + 2];
          const bx = surface[tri + 3], by = surface[tri + 4], bz = surface[tri + 5];
          const cx = surface[tri + 6], cy = surface[tri + 7], cz = surface[tri + 8];
          const ux = bx - ax, uy = by - ay, uz = bz - az;
          const vx = cx - ax, vy = cy - ay, vz = cz - az;
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          const len = Math.hypot(nx, ny, nz) || 1;
          if (ny / len < minSlopeY) continue;
          let r1 = rng(), r2 = rng();
          if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
          const r0 = 1 - r1 - r2;
          points.push({
            x: ax * r0 + bx * r1 + cx * r2,
            y: ay * r0 + by * r1 + cy * r2,
            z: az * r0 + bz * r1 + cz * r2,
            normal: [nx / len, ny / len, nz / len],
          });
        }
      } else {
        const radius = clamp(finite(p.radius, 3.5), 0.2, 50);
        for (let i = 0; i < count; i++) {
          const angle = rng() * Math.PI * 2;
          const dist = Math.sqrt(rng()) * radius;
          points.push({ x: Math.cos(angle) * dist, y: 0, z: Math.sin(angle) * dist, normal: [0, 1, 0] });
        }
      }
      outputs.set(nodeId, { points });
    } else if (node.type === 'instanceOnPoints') {
      const points = readInput(nodeId, 'points') || [];
      const instance = readInput(nodeId, 'instance');
      if (!points.length || !instance || !instance.length) {
        outputs.set(nodeId, { geometry: new Float32Array(0) });
        continue;
      }
      const totalFloats = points.length * instance.length;
      if (totalFloats > MAX_GEOMETRY_FLOATS) {
        throw new Error('Geometry Nodes instancing exceeds the 600,000-vertex safety budget.');
      }
      const rng = seededRandom(finite(p.seed, 202));
      const minScale = clamp(finite(p.minScale, 0.65), 0.05, 20);
      const maxScale = Math.max(minScale, clamp(finite(p.maxScale, 1.25), 0.05, 20));
      const out = new Float32Array(totalFloats);
      let offset = 0;
      for (const pt of points) {
        const sc = minScale + rng() * (maxScale - minScale);
        const yaw = p.randomYaw !== false ? rng() * Math.PI * 2 : 0;
        const transformed = bakeTriangleMeshTransform(instance, {
          position: { x: pt.x, y: pt.y, z: pt.z },
          rotation: { x: 0, y: yaw, z: 0 },
          scale: { x: sc, y: sc, z: sc },
          size: 1,
        }, { includeTranslation: true });
        out.set(transformed, offset);
        offset += transformed.length;
      }
      outputs.set(nodeId, { geometry: out });
    } else if (node.type === 'mergeGeometry') {
      const a = readInput(nodeId, 'geometryA') || new Float32Array(0);
      const b = readInput(nodeId, 'geometryB') || new Float32Array(0);
      if (a.length + b.length > MAX_GEOMETRY_FLOATS) {
        throw new Error('Merged geometry exceeds the safety budget.');
      }
      const merged = new Float32Array(a.length + b.length);
      merged.set(a, 0);
      merged.set(b, a.length);
      outputs.set(nodeId, { geometry: merged });
    } else if (node.type === 'curveToMesh') {
      const profile = readInput(nodeId, 'geometry');
      const segments = Math.round(clamp(finite(p.points, 8), 2, 64));
      const radius = clamp(finite(p.radius, 0.18), 0.01, 8);
      const swept = [];
      const profileTris = profile && profile.length >= 9 ? profile : createMeshGeometry('cube', 6);
      for (let i = 0; i < segments; i++) {
        const tt = segments === 1 ? 0 : i / (segments - 1);
        const angle = tt * Math.PI * (p.curve === 'spiral' ? 4 : 1.2);
        const px = Math.sin(angle) * 1.6 * tt;
        const py = (p.curve === 'spiral' ? tt * 2.4 : Math.sin(tt * Math.PI) * 0.8);
        const pz = Math.cos(angle) * 1.2 * (1 - tt * 0.4);
        const placed = bakeTriangleMeshTransform(profileTris, {
          position: { x: px, y: py, z: pz }, rotation: { x: 0, y: angle, z: 0 },
          scale: { x: radius * 4, y: radius * 4, z: radius * 4 }, size: 1,
        }, { includeTranslation: true });
        swept.push(...placed);
      }
      outputs.set(nodeId, { geometry: new Float32Array(swept) });
    } else if (node.type === 'gridScatter') {
      const surface = readInput(nodeId, 'surface');
      const columns = Math.round(clamp(finite(p.columns, 4), 1, 32));
      const rows = Math.round(clamp(finite(p.rows, 4), 1, 32));
      const spacing = clamp(finite(p.spacing, 1.2), 0.05, 50);
      const jitter = clamp(finite(p.jitter, 0.25), 0, 1);
      const rng = seededRandom(finite(p.seed, 44));
      const points = [];
      let minY = 0;
      if (surface && surface.length) { minY = Infinity; for (let i = 1; i < surface.length; i += 3) minY = Math.min(minY, surface[i]); if (!Number.isFinite(minY)) minY = 0; }
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          points.push({
            x: (col - (columns - 1) / 2) * spacing + (rng() - 0.5) * jitter * spacing,
            y: minY,
            z: (row - (rows - 1) / 2) * spacing + (rng() - 0.5) * jitter * spacing,
            normal: [0, 1, 0],
          });
        }
      }
      outputs.set(nodeId, { points });
    } else if (node.type === 'radialArray') {
      const src = readInput(nodeId, 'geometry');
      if (!src || !src.length) { outputs.set(nodeId, { geometry: new Float32Array(0) }); continue; }
      const count = Math.round(clamp(finite(p.count, 8), 1, 64));
      const radius = clamp(finite(p.radius, 2.2), 0, 100);
      const pieces = [];
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        pieces.push(...bakeTriangleMeshTransform(src, {
          position: { x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius },
          rotation: { x: 0, y: -angle, z: 0 }, scale: { x: 1, y: 1, z: 1 }, size: 1,
        }, { includeTranslation: true }));
      }
      if (pieces.length > MAX_GEOMETRY_FLOATS) throw new Error('Radial array exceeds the geometry safety budget.');
      outputs.set(nodeId, { geometry: new Float32Array(pieces) });
    } else if (node.type === 'geometryOutput') {
      const geom = readInput(nodeId, 'geometry') || new Float32Array(0);
      outputs.set(nodeId, { geometry: geom instanceof Float32Array ? geom : new Float32Array(geom) });
    }
  }

  const finalGeom = outputs.get(checked.outputNodeId)?.geometry || new Float32Array(0);
  if (finalGeom.length < 9 || finalGeom.length % 9 !== 0) {
    throw new Error('Geometry node graph produced an empty mesh. Connect a valid geometry branch to Geometry Output.');
  }
  return {
    geometry: finalGeom,
    triangleCount: finalGeom.length / 9,
    vertexCount: finalGeom.length / 3,
    nodeCount: checked.nodeMap.size,
  };
}

export const GEOMETRY_NODE_PRESETS = Object.freeze({
  'crystal-cluster': {
    name: 'Sunshard Crystal Cluster',
    color: '#56e0e0',
    material: { metallic: 0.25, roughness: 0.14, clearcoat: 0.85, emissive: 0.45 },
    nodes: [
      { id: 'base-terrain', type: 'primitiveMesh', params: { shape: 'cylinder', segments: 10, size: 1.4 } },
      { id: 'base-flat', type: 'transformGeometry', params: { scaleX: 1.3, scaleY: 0.25, scaleZ: 1.3, translateY: -0.2 } },
      { id: 'scatter-1', type: 'scatterPoints', params: { count: 9, seed: 77, minSlopeY: 0.4 } },
      { id: 'spire-prim', type: 'primitiveMesh', params: { shape: 'cone', segments: 6, size: 0.55 } },
      { id: 'spire-tall', type: 'transformGeometry', params: { scaleX: 0.65, scaleY: 2.2, scaleZ: 0.65, translateY: 0.45 } },
      { id: 'inst-1', type: 'instanceOnPoints', params: { minScale: 0.65, maxScale: 1.35, randomYaw: true, seed: 88 } },
      { id: 'merge-1', type: 'mergeGeometry', params: {} },
      { id: 'out-1', type: 'geometryOutput', params: {} },
    ],
    connections: [
      { from: 'base-terrain', fromPort: 'geometry', to: 'base-flat', toPort: 'geometry' },
      { from: 'base-flat', fromPort: 'geometry', to: 'scatter-1', toPort: 'surface' },
      { from: 'spire-prim', fromPort: 'geometry', to: 'spire-tall', toPort: 'geometry' },
      { from: 'scatter-1', fromPort: 'points', to: 'inst-1', toPort: 'points' },
      { from: 'spire-tall', fromPort: 'geometry', to: 'inst-1', toPort: 'instance' },
      { from: 'base-flat', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryA' },
      { from: 'inst-1', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryB' },
      { from: 'merge-1', fromPort: 'geometry', to: 'out-1', toPort: 'geometry' },
    ],
  },
  'alpine-grove': {
    name: 'Procedural Alpine Outcrop',
    color: '#588c6c',
    material: { metallic: 0.04, roughness: 0.86, clearcoat: 0 },
    nodes: [
      { id: 'terr-1', type: 'primitiveMesh', params: { shape: 'terrain', segments: 16, size: 1.2, seed: 304 } },
      { id: 'scat-1', type: 'scatterPoints', params: { count: 14, seed: 412, minSlopeY: 0.55 } },
      { id: 'tree-1', type: 'primitiveMesh', params: { shape: 'cone', segments: 7, size: 0.48 } },
      { id: 'tree-up', type: 'transformGeometry', params: { scaleX: 0.85, scaleY: 1.9, scaleZ: 0.85, translateY: 0.42 } },
      { id: 'inst-1', type: 'instanceOnPoints', params: { minScale: 0.7, maxScale: 1.3, randomYaw: true, seed: 519 } },
      { id: 'merge-1', type: 'mergeGeometry', params: {} },
      { id: 'out-1', type: 'geometryOutput', params: {} },
    ],
    connections: [
      { from: 'terr-1', fromPort: 'geometry', to: 'scat-1', toPort: 'surface' },
      { from: 'tree-1', fromPort: 'geometry', to: 'tree-up', toPort: 'geometry' },
      { from: 'scat-1', fromPort: 'points', to: 'inst-1', toPort: 'points' },
      { from: 'tree-up', fromPort: 'geometry', to: 'inst-1', toPort: 'instance' },
      { from: 'terr-1', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryA' },
      { from: 'inst-1', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryB' },
      { from: 'merge-1', fromPort: 'geometry', to: 'out-1', toPort: 'geometry' },
    ],
  },
  'ruined-colonnade': {
    name: 'Ancient Ring Sanctuary',
    color: '#9ba3b0',
    material: { metallic: 0.08, roughness: 0.78, clearcoat: 0.05 },
    nodes: [
      { id: 'ring-1', type: 'primitiveMesh', params: { shape: 'torus', segments: 14, size: 2.2 } },
      { id: 'disp-1', type: 'noiseDisplace', params: { axis: 'y', amount: 0.12, frequency: 3.2, seed: 91 } },
      { id: 'pillar-1', type: 'primitiveMesh', params: { shape: 'cylinder', segments: 10, size: 0.65 } },
      { id: 'pillar-t', type: 'transformGeometry', params: { scaleX: 0.5, scaleY: 2.4, scaleZ: 0.5, translateY: 0.6 } },
      { id: 'merge-1', type: 'mergeGeometry', params: {} },
      { id: 'out-1', type: 'geometryOutput', params: {} },
    ],
    connections: [
      { from: 'ring-1', fromPort: 'geometry', to: 'disp-1', toPort: 'geometry' },
      { from: 'pillar-1', fromPort: 'geometry', to: 'pillar-t', toPort: 'geometry' },
      { from: 'disp-1', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryA' },
      { from: 'pillar-t', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryB' },
      { from: 'merge-1', fromPort: 'geometry', to: 'out-1', toPort: 'geometry' },
    ],
  },
  'pine-grove': {
    name: 'Pine Grove',
    color: '#4f8f5f',
    material: { metallic: 0.03, roughness: 0.88, clearcoat: 0 },
    nodes: [
      { id: 'terr-1', type: 'primitiveMesh', params: { shape: 'terrain', segments: 14, size: 1.1, seed: 511 } },
      { id: 'scat-1', type: 'scatterPoints', params: { count: 16, seed: 612, minSlopeY: 0.5 } },
      { id: 'pine-1', type: 'primitiveMesh', params: { shape: 'cone', segments: 8, size: 0.5 } },
      { id: 'pine-up', type: 'transformGeometry', params: { scaleX: 0.9, scaleY: 2.1, scaleZ: 0.9, translateY: 0.45 } },
      { id: 'inst-1', type: 'instanceOnPoints', params: { minScale: 0.7, maxScale: 1.35, randomYaw: true, seed: 713 } },
      { id: 'merge-1', type: 'mergeGeometry', params: {} },
      { id: 'out-1', type: 'geometryOutput', params: {} },
    ],
    connections: [
      { from: 'terr-1', fromPort: 'geometry', to: 'scat-1', toPort: 'surface' },
      { from: 'pine-1', fromPort: 'geometry', to: 'pine-up', toPort: 'geometry' },
      { from: 'scat-1', fromPort: 'points', to: 'inst-1', toPort: 'points' },
      { from: 'pine-up', fromPort: 'geometry', to: 'inst-1', toPort: 'instance' },
      { from: 'terr-1', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryA' },
      { from: 'inst-1', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryB' },
      { from: 'merge-1', fromPort: 'geometry', to: 'out-1', toPort: 'geometry' },
    ],
  },
  'ruin-colonade': {
    name: 'Ruin Colonade',
    color: '#a8adb8',
    material: { metallic: 0.06, roughness: 0.8, clearcoat: 0.04 },
    nodes: [
      { id: 'base-1', type: 'primitiveMesh', params: { shape: 'cylinder', segments: 12, size: 1.6 } },
      { id: 'base-flat', type: 'transformGeometry', params: { scaleX: 1.6, scaleY: 0.22, scaleZ: 1.6, translateY: -0.18 } },
      { id: 'scat-1', type: 'scatterPoints', params: { count: 8, seed: 814, minSlopeY: 0.45 } },
      { id: 'pillar-1', type: 'primitiveMesh', params: { shape: 'cylinder', segments: 10, size: 0.55 } },
      { id: 'pillar-t', type: 'transformGeometry', params: { scaleX: 0.55, scaleY: 2.6, scaleZ: 0.55, translateY: 0.65 } },
      { id: 'inst-1', type: 'instanceOnPoints', params: { minScale: 0.8, maxScale: 1.2, randomYaw: true, seed: 915 } },
      { id: 'merge-1', type: 'mergeGeometry', params: {} },
      { id: 'out-1', type: 'geometryOutput', params: {} },
    ],
    connections: [
      { from: 'base-1', fromPort: 'geometry', to: 'base-flat', toPort: 'geometry' },
      { from: 'base-flat', fromPort: 'geometry', to: 'scat-1', toPort: 'surface' },
      { from: 'pillar-1', fromPort: 'geometry', to: 'pillar-t', toPort: 'geometry' },
      { from: 'scat-1', fromPort: 'points', to: 'inst-1', toPort: 'points' },
      { from: 'pillar-t', fromPort: 'geometry', to: 'inst-1', toPort: 'instance' },
      { from: 'base-flat', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryA' },
      { from: 'inst-1', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryB' },
      { from: 'merge-1', fromPort: 'geometry', to: 'out-1', toPort: 'geometry' },
    ],
  },
  'stone-ring': {
    name: 'Stone Ring',
    color: '#8f9aa8',
    material: { metallic: 0.05, roughness: 0.85, clearcoat: 0.02 },
    nodes: [
      { id: 'ring-1', type: 'primitiveMesh', params: { shape: 'torus', segments: 18, size: 2.4 } },
      { id: 'disp-1', type: 'noiseDisplace', params: { axis: 'y', amount: 0.1, frequency: 2.8, seed: 121 } },
      { id: 'stone-1', type: 'primitiveMesh', params: { shape: 'cube', segments: 6, size: 0.6 } },
      { id: 'stone-t', type: 'transformGeometry', params: { scaleX: 0.7, scaleY: 1.9, scaleZ: 0.7, translateY: 0.5 } },
      { id: 'merge-1', type: 'mergeGeometry', params: {} },
      { id: 'out-1', type: 'geometryOutput', params: {} },
    ],
    connections: [
      { from: 'ring-1', fromPort: 'geometry', to: 'disp-1', toPort: 'geometry' },
      { from: 'stone-1', fromPort: 'geometry', to: 'stone-t', toPort: 'geometry' },
      { from: 'disp-1', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryA' },
      { from: 'stone-t', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryB' },
      { from: 'merge-1', fromPort: 'geometry', to: 'out-1', toPort: 'geometry' },
    ],
  },
  'spiral-staircase': {
    name: 'Spiral Staircase',
    color: '#c9a35f',
    material: { metallic: 0.12, roughness: 0.55, clearcoat: 0.1 },
    nodes: [
      { id: 'step-1', type: 'primitiveMesh', params: { shape: 'cube', segments: 8, size: 0.7 } },
      { id: 'sweep-1', type: 'curveToMesh', params: { curve: 'spiral', points: 14, radius: 0.22, seed: 12 } },
      { id: 'pole-1', type: 'primitiveMesh', params: { shape: 'cylinder', segments: 10, size: 0.35 } },
      { id: 'pole-t', type: 'transformGeometry', params: { scaleX: 0.35, scaleY: 6, scaleZ: 0.35, translateY: 1 } },
      { id: 'merge-1', type: 'mergeGeometry', params: {} },
      { id: 'out-1', type: 'geometryOutput', params: {} },
    ],
    connections: [
      { from: 'step-1', fromPort: 'geometry', to: 'sweep-1', toPort: 'geometry' },
      { from: 'pole-1', fromPort: 'geometry', to: 'pole-t', toPort: 'geometry' },
      { from: 'sweep-1', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryA' },
      { from: 'pole-t', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryB' },
      { from: 'merge-1', fromPort: 'geometry', to: 'out-1', toPort: 'geometry' },
    ],
  },
  'sci-fi-truss-bridge': {
    name: 'Sci-Fi Truss Bridge',
    color: '#48e5e5',
    material: { metallic: 0.72, roughness: 0.32, clearcoat: 0.4 },
    nodes: [
      { id: 'deck-1', type: 'primitiveMesh', params: { shape: 'cube', segments: 8, size: 1 } },
      { id: 'deck-t', type: 'transformGeometry', params: { scaleX: 6, scaleY: 0.18, scaleZ: 1.1, translateY: 0 } },
      { id: 'beam-1', type: 'primitiveMesh', params: { shape: 'cylinder', segments: 8, size: 0.4 } },
      { id: 'grid-1', type: 'gridScatter', params: { columns: 6, rows: 1, spacing: 1.4, jitter: 0.05, seed: 44 } },
      { id: 'inst-1', type: 'instanceOnPoints', params: { minScale: 0.5, maxScale: 0.5, randomYaw: false, seed: 45 } },
      { id: 'merge-1', type: 'mergeGeometry', params: {} },
      { id: 'out-1', type: 'geometryOutput', params: {} },
    ],
    connections: [
      { from: 'deck-1', fromPort: 'geometry', to: 'deck-t', toPort: 'geometry' },
      { from: 'deck-t', fromPort: 'geometry', to: 'grid-1', toPort: 'surface' },
      { from: 'grid-1', fromPort: 'points', to: 'inst-1', toPort: 'points' },
      { from: 'beam-1', fromPort: 'geometry', to: 'inst-1', toPort: 'instance' },
      { from: 'deck-t', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryA' },
      { from: 'inst-1', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryB' },
      { from: 'merge-1', fromPort: 'geometry', to: 'out-1', toPort: 'geometry' },
    ],
  },
  'asteroid-belt': {
    name: 'Asteroid Belt',
    color: '#9aa3b0',
    material: { metallic: 0.2, roughness: 0.85, clearcoat: 0 },
    nodes: [
      { id: 'ring-1', type: 'primitiveMesh', params: { shape: 'torus', segments: 16, size: 2.6 } },
      { id: 'rock-1', type: 'primitiveMesh', params: { shape: 'sphere', segments: 7, size: 0.4 } },
      { id: 'rock-d', type: 'noiseDisplace', params: { axis: 'y', amount: 0.3, frequency: 4, seed: 66 } },
      { id: 'scat-1', type: 'scatterPoints', params: { count: 18, seed: 707, minSlopeY: -0.9 } },
      { id: 'inst-1', type: 'instanceOnPoints', params: { minScale: 0.4, maxScale: 1.4, randomYaw: true, seed: 708 } },
      { id: 'out-1', type: 'geometryOutput', params: {} },
    ],
    connections: [
      { from: 'ring-1', fromPort: 'geometry', to: 'scat-1', toPort: 'surface' },
      { from: 'rock-1', fromPort: 'geometry', to: 'rock-d', toPort: 'geometry' },
      { from: 'scat-1', fromPort: 'points', to: 'inst-1', toPort: 'points' },
      { from: 'rock-d', fromPort: 'geometry', to: 'inst-1', toPort: 'instance' },
      { from: 'inst-1', fromPort: 'geometry', to: 'out-1', toPort: 'geometry' },
    ],
  },
  'procedural-pagoda': {
    name: 'Procedural Pagoda',
    color: '#b03a4a',
    material: { metallic: 0.1, roughness: 0.6, clearcoat: 0.15 },
    nodes: [
      { id: 'tier-1', type: 'primitiveMesh', params: { shape: 'cube', segments: 8, size: 1 } },
      { id: 'tier-t', type: 'transformGeometry', params: { scaleX: 1.6, scaleY: 0.8, scaleZ: 1.6, translateY: 0 } },
      { id: 'roof-1', type: 'primitiveMesh', params: { shape: 'cone', segments: 4, size: 1.2 } },
      { id: 'roof-t', type: 'transformGeometry', params: { scaleX: 1.3, scaleY: 0.7, scaleZ: 1.3, translateY: 0.75 } },
      { id: 'arr-1', type: 'radialArray', params: { count: 4, radius: 1.05, seed: 8 } },
      { id: 'merge-1', type: 'mergeGeometry', params: {} },
      { id: 'merge-2', type: 'mergeGeometry', params: {} },
      { id: 'out-1', type: 'geometryOutput', params: {} },
    ],
    connections: [
      { from: 'tier-1', fromPort: 'geometry', to: 'tier-t', toPort: 'geometry' },
      { from: 'roof-1', fromPort: 'geometry', to: 'roof-t', toPort: 'geometry' },
      { from: 'roof-t', fromPort: 'geometry', to: 'arr-1', toPort: 'geometry' },
      { from: 'tier-t', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryA' },
      { from: 'arr-1', fromPort: 'geometry', to: 'merge-1', toPort: 'geometryB' },
      { from: 'merge-1', fromPort: 'geometry', to: 'merge-2', toPort: 'geometryA' },
      { from: 'tier-t', fromPort: 'geometry', to: 'merge-2', toPort: 'geometryB' },
      { from: 'merge-2', fromPort: 'geometry', to: 'out-1', toPort: 'geometry' },
    ],
  },
});


export function buildPresetGeometryNodeGraph(presetKey = 'crystal-cluster') {
  const preset = GEOMETRY_NODE_PRESETS[presetKey] || GEOMETRY_NODE_PRESETS['crystal-cluster'];
  return JSON.parse(JSON.stringify(preset));
}

const geoSvgEsc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/**
 * Render an interactive SVG diagram of a Geometry Nodes DAG.
 * Mirrors renderMaterialGraphSvg: nodes carry data-node-id / data-node-type
 * and wires carry data-from / data-to for editor selection.
 */
export function renderGeometryNodeGraphSvg(graphInput, options = {}) {
  const checked = validateGeometryNodeGraph(graphInput);
  if (!checked.ok) throw new Error(checked.diagnostics.map(d => d.message).join(' '));
  const graph = graphInput;
  const width = Math.max(320, Math.min(2400, Math.round(Number(options.width) || 760)));
  const nodeWidth = 148; const nodeHeight = 60;
  const depthOf = (id, seen = new Set()) => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const incoming = checked.validConnections.filter(c => c.to === id);
    if (!incoming.length) return 0;
    return 1 + Math.max(...incoming.map(c => depthOf(c.from, seen)));
  };
  const columns = new Map();
  for (const id of checked.order) {
    const node = checked.nodeMap.get(id);
    const depth = node.type === 'geometryOutput' ? 4 : depthOf(id);
    if (!columns.has(depth)) columns.set(depth, []);
    columns.get(depth).push(node);
  }
  const positions = new Map();
  let maxRows = 1;
  for (const [depth, list] of columns) {
    maxRows = Math.max(maxRows, list.length);
    list.forEach((node, row) => positions.set(node.id, { x: 16 + depth * (nodeWidth + 54), y: 16 + row * (nodeHeight + 18) }));
  }
  const height = Math.max(140, 32 + maxRows * (nodeHeight + 18));
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Geometry node graph ${geoSvgEsc(graph.name || 'diagram')}" data-graph-name="${geoSvgEsc(graph.name || '')}">`);
  parts.push('<rect width="100%" height="100%" fill="#0e1a16"/>');
  for (let gx = 0; gx < width; gx += 24) parts.push(`<line x1="${gx}" y1="0" x2="${gx}" y2="${height}" stroke="#16302a" stroke-width="1"/>`);
  for (const conn of checked.validConnections) {
    const a = positions.get(conn.from); const b = positions.get(conn.to);
    if (!a || !b) continue;
    const x1 = a.x + nodeWidth; const y1 = a.y + 30; const x2 = b.x; const y2 = b.y + 30;
    const mid = Math.max(24, Math.abs(x2 - x1) / 2);
    parts.push(`<path d="M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}" fill="none" stroke="#7ce8a8" stroke-width="1.8" opacity="0.85" data-from="${geoSvgEsc(conn.from)}" data-from-port="${geoSvgEsc(conn.fromPort)}" data-to="${geoSvgEsc(conn.to)}" data-to-port="${geoSvgEsc(conn.toPort)}"/>`);
  }
  for (const node of graph.nodes || []) {
    const normalized = checked.nodeMap.get(node.id);
    const def = GEOMETRY_NODE_TYPES[normalized.type] || {};
    const pos = positions.get(node.id) || { x: 16, y: 16 };
    parts.push(`<g data-node-id="${geoSvgEsc(node.id)}" data-node-type="${geoSvgEsc(normalized.type)}" transform="translate(${pos.x}, ${pos.y})">`);
    parts.push(`<rect width="${nodeWidth}" height="${nodeHeight}" rx="9" fill="${normalized.type === 'geometryOutput' ? '#274d3d' : '#173528'}" stroke="#7ce8a8" stroke-width="1.2"/>`);
    parts.push(`<text x="10" y="19" fill="#eafff3" font-size="11" font-weight="700">${geoSvgEsc(normalized.name || def.label || normalized.type)}</text>`);
    parts.push(`<text x="10" y="33" fill="#8fd0aa" font-size="9">${geoSvgEsc(def.label || normalized.type)} · ${geoSvgEsc(normalized.type)}</text>`);
    Object.keys(def.inputs || {}).forEach((port, i) => parts.push(`<circle cx="0" cy="${30 + i * 11}" r="3.2" fill="#ffb86b" data-port="${geoSvgEsc(port)}" data-port-direction="input"><title>in · ${geoSvgEsc(port)}</title></circle>`));
    Object.keys(def.outputs || {}).forEach((port, i) => parts.push(`<circle cx="${nodeWidth}" cy="${30 + i * 11}" r="3.2" fill="#7ce8a8" data-port="${geoSvgEsc(port)}" data-port-direction="output"><title>out · ${geoSvgEsc(port)}</title></circle>`));
    parts.push('</g>');
  }
  parts.push('</svg>');
  return parts.join('');
}

export function listGeometryNodeTypes() {
  return Object.entries(GEOMETRY_NODE_TYPES).map(([id, def]) => ({ id, label: def.label, inputs: Object.keys(def.inputs || {}), outputs: Object.keys(def.outputs || {}) }));
}

