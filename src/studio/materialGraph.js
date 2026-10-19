/**
 * Orvexa Material Lab — Typed node-based material authoring, DAG validation,
 * cycle detection, PBR parameter compilation, and dependency-free PNG texture baking.
 */
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const finite = (n, fallback = 0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
const fract = x => x - Math.floor(x);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / Math.max(1e-6, b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const MATERIAL_GRAPH_SCHEMA = 'orvexa-material-graph';
export const MATERIAL_GRAPH_MAX_NODES = 64;
export const MATERIAL_GRAPH_MAX_EDGES = 128;

export const MATERIAL_NODE_TYPES = Object.freeze({
  uv: {
    label: 'UV Coordinates',
    category: 'input',
    inputs: {},
    outputs: { uv: 'vec2', u: 'float', v: 'float' },
    defaults: { scaleU: 1, scaleV: 1, offsetU: 0, offsetV: 0, rotation: 0 },
  },
  color: {
    label: 'Color Constant',
    category: 'input',
    inputs: {},
    outputs: { color: 'color', r: 'float', g: 'float', b: 'float' },
    defaults: { hex: '#7c5cff' },
  },
  scalar: {
    label: 'Scalar Value',
    category: 'input',
    inputs: {},
    outputs: { value: 'float' },
    defaults: { value: 0.5 },
  },
  vec3: {
    label: 'Vector3',
    category: 'input',
    inputs: { x: 'float', y: 'float', z: 'float' },
    outputs: { vector: 'vec3', length: 'float' },
    defaults: { x: 0, y: 1, z: 0 },
  },
  noise: {
    label: 'Procedural Noise',
    category: 'texture',
    inputs: { uv: 'vec2', scale: 'float' },
    outputs: { fac: 'float', color: 'color' },
    defaults: { scale: 6, octaves: 4, roughness: 0.52, contrast: 1.15, seed: 42 },
  },
  checker: {
    label: 'Checker Pattern',
    category: 'texture',
    inputs: { uv: 'vec2', colorA: 'color', colorB: 'color' },
    outputs: { color: 'color', fac: 'float' },
    defaults: { scale: 8, colorA: '#1d2436', colorB: '#7965ff' },
  },
  gradient: {
    label: 'UV Gradient',
    category: 'texture',
    inputs: { uv: 'vec2', colorA: 'color', colorB: 'color' },
    outputs: { color: 'color', fac: 'float' },
    defaults: { direction: 'vertical', colorA: '#182238', colorB: '#58d5c9' },
  },
  fresnel: {
    label: 'Fresnel / Rim',
    category: 'shading',
    inputs: { power: 'float', tint: 'color' },
    outputs: { fac: 'float', color: 'color' },
    defaults: { ior: 1.45, power: 3.2, tint: '#6ae2ff', viewAngle: 0.42 },
  },
  math: {
    label: 'Scalar Math',
    category: 'math',
    inputs: { a: 'float', b: 'float', c: 'float' },
    outputs: { value: 'float' },
    defaults: { operation: 'multiply', a: 0.5, b: 0.5, c: 0.5 },
  },
  colorMix: {
    label: 'Color Mix / Mask',
    category: 'color',
    inputs: { colorA: 'color', colorB: 'color', factor: 'float' },
    outputs: { color: 'color' },
    defaults: { blendMode: 'mix', factor: 0.5, colorA: '#2d374e', colorB: '#eab96d' },
  },
  normalStrength: {
    label: 'Height to Normal',
    category: 'shading',
    inputs: { height: 'float' },
    outputs: { normalScale: 'float', height: 'float' },
    defaults: { strength: 1.25, height: 0.5 },
  },
  materialOutput: {
    label: 'Material Output',
    category: 'output',
    inputs: {
      baseColor: 'color',
      metallic: 'float',
      roughness: 'float',
      normalScale: 'float',
      aoStrength: 'float',
      emissive: 'float',
      emissiveTint: 'color',
      clearcoat: 'float',
    },
    outputs: {},
    defaults: {
      baseColor: '#7965ff',
      metallic: 0.08,
      roughness: 0.56,
      normalScale: 1,
      aoStrength: 1,
      emissive: 0,
      emissiveTint: '#ffffff',
      clearcoat: 0,
    },
  },  voronoi: {
    label: 'Voronoi Cells',
    category: 'texture',
    inputs: { uv: 'vec2', scale: 'float' },
    outputs: { fac: 'float', color: 'color', edge: 'float' },
    defaults: { scale: 5, randomness: 0.85, seed: 17 },
  },
  musgrave: {
    label: 'Musgrave Texture',
    category: 'texture',
    inputs: { uv: 'vec2', scale: 'float' },
    outputs: { fac: 'float', color: 'color' },
    defaults: { scale: 6, dimension: 1.4, lacunarity: 2.1, seed: 23, offset: 0.12 },
  },
  wave: {
    label: 'Wave Texture',
    category: 'texture',
    inputs: { uv: 'vec2', scale: 'float' },
    outputs: { fac: 'float', color: 'color' },
    defaults: { scale: 9, distortion: 1.6, direction: 'bands', seed: 5 },
  },
  brick: {
    label: 'Brick Texture',
    category: 'texture',
    inputs: { uv: 'vec2', colorA: 'color', colorB: 'color' },
    outputs: { color: 'color', fac: 'float', mortar: 'float' },
    defaults: { scaleU: 4, scaleV: 8, mortarSize: 0.08, offset: 0.5, colorA: '#9a5a44', colorB: '#b98a6a', mortarColor: '#cfc4b2' },
  },
  colorRamp: {
    label: 'Color Ramp',
    category: 'color',
    inputs: { factor: 'float' },
    outputs: { color: 'color', fac: 'float' },
    defaults: { factor: 0.5, colorA: '#10182e', colorB: '#3f8f7a', colorC: '#f2d492', positionB: 0.55 },
  },
  bumpToNormal: {
    label: 'Bump to Normal',
    category: 'shading',
    inputs: { height: 'float' },
    outputs: { normalScale: 'float', height: 'float', normal: 'vec3' },
    defaults: { strength: 1.4, height: 0.5 },
  },
  pbrMaster: {
    label: 'PBR Master Output',
    category: 'output',
    inputs: {
      baseColor: 'color', metallic: 'float', roughness: 'float', normalScale: 'float',
      aoStrength: 'float', emissive: 'float', emissiveTint: 'color', clearcoat: 'float',
    },
    outputs: {},
    defaults: {
      baseColor: '#8a7a68', metallic: 0.1, roughness: 0.5, normalScale: 1,
      aoStrength: 1, emissive: 0, emissiveTint: '#ffffff', clearcoat: 0,
    },
  },
});

const COMPATIBLE_TYPES = Object.freeze({
  float: new Set(['float', 'color', 'vec3']),
  vec2: new Set(['vec2', 'float']),
  vec3: new Set(['vec3', 'color', 'float']),
  color: new Set(['color', 'vec3', 'float']),
});

export function hexToRgb01(hex, fallback = [0.475, 0.396, 1]) {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return [...fallback];
  let h = m[1];
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export function rgb01ToHex(rgb = [0.475, 0.396, 1]) {
  const toByte = v => Math.round(clamp(finite(v, 0), 0, 1) * 255).toString(16).padStart(2, '0');
  return `#${toByte(rgb[0])}${toByte(rgb[1])}${toByte(rgb[2])}`;
}

function coercePortValue(value, targetType) {
  if (targetType === 'float') {
    if (typeof value === 'number') return finite(value, 0);
    if (Array.isArray(value)) return finite((value[0] + (value[1] ?? value[0]) + (value[2] ?? value[0])) / 3, 0);
    if (typeof value === 'string' && value.startsWith('#')) {
      const [r, g, b] = hexToRgb01(value);
      return (r + g + b) / 3;
    }
    return finite(value, 0);
  }
  if (targetType === 'vec2') {
    if (Array.isArray(value) && value.length >= 2) return [finite(value[0], 0), finite(value[1], 0)];
    const scalar = coercePortValue(value, 'float');
    return [scalar, scalar];
  }
  if (targetType === 'color' || targetType === 'vec3') {
    if (Array.isArray(value) && value.length >= 3) {
      return [clamp(finite(value[0], 0), 0, 1), clamp(finite(value[1], 0), 0, 1), clamp(finite(value[2], 0), 0, 1)];
    }
    if (typeof value === 'string') return hexToRgb01(value);
    const scalar = clamp(coercePortValue(value, 'float'), 0, 1);
    return [scalar, scalar, scalar];
  }
  return value;
}

function hash2D(ix, iy, seed = 42) {
  return fract(Math.sin(ix * 127.1 + iy * 311.7 + seed * 17.37) * 43758.5453123);
}

function valueNoise2D(u, v, seed = 42) {
  const ix = Math.floor(u), iy = Math.floor(v);
  const fx = smoothstep(0, 1, u - ix), fy = smoothstep(0, 1, v - iy);
  const a = hash2D(ix, iy, seed);
  const b = hash2D(ix + 1, iy, seed);
  const c = hash2D(ix, iy + 1, seed);
  const d = hash2D(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function sampleProceduralFbm(u, v, options = {}) {
  const scale = clamp(finite(options.scale, 6), 0.25, 64);
  const octaves = Math.round(clamp(finite(options.octaves, 4), 1, 6));
  const roughness = clamp(finite(options.roughness, 0.52), 0.1, 0.95);
  const contrast = clamp(finite(options.contrast, 1.15), 0.2, 4);
  const seed = Math.trunc(finite(options.seed, 42));
  let x = u * scale, y = v * scale;
  let total = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < octaves; i++) {
    total += valueNoise2D(x, y, seed + i * 31) * amp;
    norm += amp;
    x = x * 2.02 + 13.7;
    y = y * 2.02 + 7.9;
    amp *= roughness;
  }
  const normalized = norm > 0 ? total / norm : 0.5;
  return clamp((normalized - 0.5) * contrast + 0.5, 0, 1);
}

export function normalizeMaterialNode(raw = {}, index = 1) {
  const type = MATERIAL_NODE_TYPES[raw?.type] ? raw.type : 'color';
  const spec = MATERIAL_NODE_TYPES[type];
  const id = String(raw?.id || `${type}-${index}`).slice(0, 80);
  const name = String(raw?.name || spec.label).slice(0, 80);
  const params = { ...spec.defaults, ...(raw?.params || {}) };
  if (type === 'uv') {
    params.scaleU = clamp(finite(params.scaleU, 1), 0.05, 64);
    params.scaleV = clamp(finite(params.scaleV, 1), 0.05, 64);
    params.offsetU = clamp(finite(params.offsetU, 0), -16, 16);
    params.offsetV = clamp(finite(params.offsetV, 0), -16, 16);
    params.rotation = clamp(finite(params.rotation, 0), -360, 360);
  } else if (type === 'color') {
    params.hex = rgb01ToHex(hexToRgb01(params.hex, [0.486, 0.361, 1]));
  } else if (type === 'scalar') {
    params.value = clamp(finite(params.value, 0.5), -10, 10);
  } else if (type === 'vec3') {
    params.x = clamp(finite(params.x, 0), -10, 10);
    params.y = clamp(finite(params.y, 1), -10, 10);
    params.z = clamp(finite(params.z, 0), -10, 10);
  } else if (type === 'noise') {
    params.scale = clamp(finite(params.scale, 6), 0.25, 64);
    params.octaves = Math.round(clamp(finite(params.octaves, 4), 1, 6));
    params.roughness = clamp(finite(params.roughness, 0.52), 0.1, 0.95);
    params.contrast = clamp(finite(params.contrast, 1.15), 0.2, 4);
    params.seed = Math.round(clamp(finite(params.seed, 42), -100000, 100000));
  } else if (type === 'checker') {
    params.scale = clamp(finite(params.scale, 8), 1, 64);
    params.colorA = rgb01ToHex(hexToRgb01(params.colorA, [0.11, 0.14, 0.21]));
    params.colorB = rgb01ToHex(hexToRgb01(params.colorB, [0.47, 0.4, 1]));
  } else if (type === 'gradient') {
    params.direction = ['vertical', 'horizontal', 'radial', 'diagonal'].includes(params.direction) ? params.direction : 'vertical';
    params.colorA = rgb01ToHex(hexToRgb01(params.colorA, [0.09, 0.13, 0.22]));
    params.colorB = rgb01ToHex(hexToRgb01(params.colorB, [0.35, 0.84, 0.79]));
  } else if (type === 'fresnel') {
    params.ior = clamp(finite(params.ior, 1.45), 1.01, 3.5);
    params.power = clamp(finite(params.power, 3.2), 0.25, 12);
    params.tint = rgb01ToHex(hexToRgb01(params.tint, [0.42, 0.89, 1]));
    params.viewAngle = clamp(finite(params.viewAngle, 0.42), 0.02, 0.98);
  } else if (type === 'math') {
    const ops = ['add', 'subtract', 'multiply', 'divide', 'power', 'min', 'max', 'clamp', 'mix', 'sin', 'cos'];
    params.operation = ops.includes(params.operation) ? params.operation : 'multiply';
    params.a = clamp(finite(params.a, 0.5), -10, 10);
    params.b = clamp(finite(params.b, 0.5), -10, 10);
    params.c = clamp(finite(params.c, 0.5), 0, 1);
  } else if (type === 'colorMix') {
    const modes = ['mix', 'multiply', 'screen', 'add', 'overlay'];
    params.blendMode = modes.includes(params.blendMode) ? params.blendMode : 'mix';
    params.factor = clamp(finite(params.factor, 0.5), 0, 1);
    params.colorA = rgb01ToHex(hexToRgb01(params.colorA, [0.18, 0.22, 0.31]));
    params.colorB = rgb01ToHex(hexToRgb01(params.colorB, [0.92, 0.73, 0.43]));
  } else if (type === 'normalStrength') {
    params.strength = clamp(finite(params.strength, 1.25), 0, 4);
    params.height = clamp(finite(params.height, 0.5), 0, 1);
  } else if (type === 'materialOutput') {
    params.baseColor = rgb01ToHex(hexToRgb01(params.baseColor, [0.475, 0.396, 1]));
    params.metallic = clamp(finite(params.metallic, 0.08), 0, 1);
    params.roughness = clamp(finite(params.roughness, 0.56), 0.04, 1);
    params.normalScale = clamp(finite(params.normalScale, 1), 0, 4);
    params.aoStrength = clamp(finite(params.aoStrength, 1), 0, 1);
    params.emissive = clamp(finite(params.emissive, 0), 0, 4);
    params.emissiveTint = rgb01ToHex(hexToRgb01(params.emissiveTint, [1, 1, 1]));
    params.clearcoat = clamp(finite(params.clearcoat, 0), 0, 1);
  }
  return { id, name, type, params };
}

export function createMaterialGraph(input = {}) {
  const rawNodes = Array.isArray(input?.nodes) && input.nodes.length
    ? input.nodes
    : [
        { id: 'color-1', type: 'color', name: 'Base Albedo', params: { hex: '#7965ff' } },
        { id: 'noise-1', type: 'noise', name: 'Surface Grain', params: { scale: 6, octaves: 4, roughness: 0.5, contrast: 1.2, seed: 42 } },
        { id: 'mix-1', type: 'colorMix', name: 'Albedo Blend', params: { blendMode: 'mix', factor: 0.28, colorA: '#7965ff', colorB: '#49c8c2' } },
        { id: 'output-1', type: 'materialOutput', name: 'Material Output', params: { metallic: 0.12, roughness: 0.48, clearcoat: 0.1 } },
      ];
  const rawConnections = Array.isArray(input?.connections)
    ? input.connections
    : [
        { from: 'color-1', fromPort: 'color', to: 'mix-1', toPort: 'colorA' },
        { from: 'noise-1', fromPort: 'fac', to: 'mix-1', toPort: 'factor' },
        { from: 'mix-1', fromPort: 'color', to: 'output-1', toPort: 'baseColor' },
      ];
  return {
    schema: MATERIAL_GRAPH_SCHEMA,
    version: 1,
    name: String(input?.name || 'Custom Material Graph').slice(0, 80),
    preset: String(input?.preset || 'custom').slice(0, 48),
    nodes: rawNodes.slice(0, MATERIAL_GRAPH_MAX_NODES).map((n, i) => normalizeMaterialNode(n, i + 1)),
    connections: rawConnections.slice(0, MATERIAL_GRAPH_MAX_EDGES).map(c => ({
      from: String(c?.from || ''),
      fromPort: String(c?.fromPort || ''),
      to: String(c?.to || ''),
      toPort: String(c?.toPort || ''),
    })),
  };
}

export function normalizeMaterialGraph(input = {}) {
  return createMaterialGraph(input || {});
}

/**
 * Validate node identities, port names, type compatibility, output presence, and DAG acyclicity.
 */
export function validateMaterialGraph(graphInput) {
  const diagnostics = [];
  if (!graphInput || typeof graphInput !== 'object' || !Array.isArray(graphInput.nodes)) {
    return { ok: false, order: [], diagnostics: [{ code: 'INVALID_GRAPH', message: 'Material graph must contain a nodes array.' }], outputNodeId: null };
  }
  if (graphInput.nodes.length === 0) {
    return { ok: false, order: [], diagnostics: [{ code: 'EMPTY_GRAPH', message: 'Material graph requires at least one Material Output (or PBR Master) node.' }], outputNodeId: null };
  }
  if (graphInput.nodes.length > MATERIAL_GRAPH_MAX_NODES) {
    diagnostics.push({ code: 'TOO_MANY_NODES', message: `Material graph exceeds the ${MATERIAL_GRAPH_MAX_NODES}-node limit.` });
  }
  const connections = Array.isArray(graphInput.connections) ? graphInput.connections : [];
  if (connections.length > MATERIAL_GRAPH_MAX_EDGES) {
    diagnostics.push({ code: 'TOO_MANY_EDGES', message: `Material graph exceeds the ${MATERIAL_GRAPH_MAX_EDGES}-connection limit.` });
  }

  const nodeMap = new Map();
  let outputNodeId = null;
  for (const rawNode of graphInput.nodes) {
    const id = String(rawNode?.id || '');
    if (!id) {
      diagnostics.push({ code: 'MISSING_NODE_ID', message: 'Every material node must have a non-empty id.' });
      continue;
    }
    if (nodeMap.has(id)) {
      diagnostics.push({ code: 'DUPLICATE_NODE_ID', nodeId: id, message: `Duplicate material node id "${id}".` });
      continue;
    }
    if (!MATERIAL_NODE_TYPES[rawNode?.type]) {
      diagnostics.push({ code: 'UNKNOWN_NODE_TYPE', nodeId: id, message: `Unknown material node type "${rawNode?.type}".` });
      continue;
    }
    const normalized = normalizeMaterialNode(rawNode, nodeMap.size + 1);
    nodeMap.set(id, normalized);
    if (normalized.type === 'materialOutput' || normalized.type === 'pbrMaster') outputNodeId = id;
  }

  if (!outputNodeId) {
    diagnostics.push({ code: 'MISSING_OUTPUT', message: 'Material graph must include a materialOutput or pbrMaster node.' });
  }

  const adj = new Map();
  const inDegree = new Map();
  const targetPortSources = new Map();
  for (const id of nodeMap.keys()) {
    adj.set(id, []);
    inDegree.set(id, 0);
  }

  for (const edge of connections) {
    const fromNode = nodeMap.get(edge?.from);
    const toNode = nodeMap.get(edge?.to);
    if (!fromNode) {
      diagnostics.push({ code: 'MISSING_SOURCE_NODE', message: `Connection references missing source node "${edge?.from}".` });
      continue;
    }
    if (!toNode) {
      diagnostics.push({ code: 'MISSING_TARGET_NODE', message: `Connection references missing target node "${edge?.to}".` });
      continue;
    }
    if (fromNode.id === toNode.id) {
      diagnostics.push({ code: 'SELF_LOOP', nodeId: fromNode.id, message: `Node "${fromNode.id}" cannot connect to itself.` });
      continue;
    }
    const fromType = MATERIAL_NODE_TYPES[fromNode.type]?.outputs?.[edge?.fromPort];
    const toType = MATERIAL_NODE_TYPES[toNode.type]?.inputs?.[edge?.toPort];
    if (!fromType) {
      diagnostics.push({ code: 'INVALID_SOURCE_PORT', nodeId: fromNode.id, message: `Node "${fromNode.id}" (${fromNode.type}) has no output port "${edge?.fromPort}".` });
      continue;
    }
    if (!toType) {
      diagnostics.push({ code: 'INVALID_TARGET_PORT', nodeId: toNode.id, message: `Node "${toNode.id}" (${toNode.type}) has no input port "${edge?.toPort}".` });
      continue;
    }
    if (!COMPATIBLE_TYPES[toType]?.has(fromType)) {
      diagnostics.push({
        code: 'TYPE_MISMATCH',
        nodeId: toNode.id,
        message: `Cannot connect ${fromNode.id}.${edge.fromPort} (${fromType}) to ${toNode.id}.${edge.toPort} (${toType}).`,
      });
      continue;
    }
    const targetKey = `${toNode.id}:${edge.toPort}`;
    if (targetPortSources.has(targetKey)) {
      diagnostics.push({
        code: 'DUPLICATE_TARGET_INPUT',
        nodeId: toNode.id,
        message: `Input port "${edge.toPort}" on "${toNode.id}" already has an incoming connection.`,
      });
      continue;
    }
    targetPortSources.set(targetKey, { from: fromNode.id, fromPort: edge.fromPort, to: toNode.id, toPort: edge.toPort });
    adj.get(fromNode.id).push(toNode.id);
    inDegree.set(toNode.id, (inDegree.get(toNode.id) || 0) + 1);
  }

  const queue = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }
  const order = [];
  while (queue.length) {
    const current = queue.shift();
    order.push(current);
    for (const next of adj.get(current) || []) {
      const updated = (inDegree.get(next) || 0) - 1;
      inDegree.set(next, updated);
      if (updated === 0) queue.push(next);
    }
  }

  if (order.length !== nodeMap.size) {
    const cyclicNodes = [...nodeMap.keys()].filter(id => !order.includes(id));
    diagnostics.push({
      code: 'CYCLE_DETECTED',
      nodeId: cyclicNodes[0],
      message: `Cycle detected in material graph involving: ${cyclicNodes.join(' → ')}.`,
    });
  }

  return {
    ok: diagnostics.length === 0,
    order,
    diagnostics,
    outputNodeId,
    nodeMap,
    validConnections: [...targetPortSources.values()],
  };
}

/**
 * Evaluate a validated material graph at a single UV coordinate (u, v).
 */

function cellHash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 974634211);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function voronoiSample(u, v, scale, randomness, seed) {
  const x = u * scale; const y = v * scale;
  const xi = Math.floor(x); const yi = Math.floor(y);
  let f1 = Infinity; let f2 = Infinity; let cellId = 0;
  for (let j = yi - 1; j <= yi + 1; j++) {
    for (let i = xi - 1; i <= xi + 1; i++) {
      const jitterX = randomness * cellHash2(i, j, seed);
      const jitterY = randomness * cellHash2(i, j, seed + 41);
      const px = i + jitterX; const py = j + jitterY;
      const d = Math.hypot(px - x, py - y);
      if (d < f1) { f2 = f1; f1 = d; cellId = cellHash2(i, j, seed + 97); }
      else if (d < f2) f2 = d;
    }
  }
  return { fac: clamp(f1, 0, 1), edge: clamp(f2 - f1, 0, 1), cellId };
}

function musgraveSample(u, v, params) {
  const scale = clamp(params.scale, 0.1, 64);
  let value = 0; let amplitude = 1; let frequency = 1; let norm = 0;
  for (let octave = 0; octave < 5; octave++) {
    const n = sampleProceduralFbm(u * frequency, v * frequency, { scale: scale * frequency, octaves: 2, seed: (params.seed || 0) + octave * 13 });
    const ridged = Math.pow(1 - Math.abs(n * 2 - 1), Math.max(0.2, params.dimension || 1.4));
    value += ridged * amplitude;
    norm += amplitude;
    amplitude *= 0.55;
    frequency *= Math.max(1.2, params.lacunarity || 2.1);
  }
  return clamp(value / Math.max(1e-9, norm) + (params.offset || 0), 0, 1);
}

function waveSample(u, v, params) {
  const scale = clamp(params.scale, 0.1, 96);
  const distortion = clamp(params.distortion ?? 1.6, 0, 12);
  const warp = sampleProceduralFbm(u, v, { scale: 3, octaves: 3, seed: params.seed || 0 }) * distortion;
  let phase;
  if (params.direction === 'rings') phase = Math.hypot(u - 0.5, v - 0.5) * scale + warp;
  else if (params.direction === 'diagonal') phase = (u + v) * 0.5 * scale + warp;
  else phase = u * scale + warp;
  return Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;
}

function brickSample(u, v, params) {
  const rows = Math.max(1, params.scaleV || 8);
  const cols = Math.max(1, params.scaleU || 4);
  const row = Math.floor(v * rows);
  const offset = (row % 2) * clamp(params.offset ?? 0.5, 0, 1);
  const colFloat = u * cols + offset;
  const col = Math.floor(colFloat);
  const localU = colFloat - col; const localV = (v * rows) - row;
  const mortarSize = clamp(params.mortarSize ?? 0.08, 0, 0.45);
  const mortar = (localU < mortarSize || localU > 1 - mortarSize || localV < mortarSize || localV > 1 - mortarSize) ? 1 : 0;
  const variation = cellHash2(col, row, 7);
  return { mortar, variation, fac: 0.35 + variation * 0.65 };
}

export function evaluateMaterialGraphAtUV(graphInput, u = 0.5, v = 0.5, validation = null) {
  const checked = validation || validateMaterialGraph(graphInput);
  if (!checked.ok) {
    throw new Error(checked.diagnostics.map(d => d.message).join(' '));
  }
  const incomingByTarget = new Map();
  for (const conn of checked.validConnections) {
    incomingByTarget.set(`${conn.to}:${conn.toPort}`, conn);
  }
  const outputsByNode = new Map();
  const resolveInput = (node, portName, expectedType, fallbackValue) => {
    const conn = incomingByTarget.get(`${node.id}:${portName}`);
    if (!conn) return coercePortValue(fallbackValue, expectedType);
    const sourceOutputs = outputsByNode.get(conn.from);
    if (!sourceOutputs || !(conn.fromPort in sourceOutputs)) return coercePortValue(fallbackValue, expectedType);
    return coercePortValue(sourceOutputs[conn.fromPort], expectedType);
  };

  for (const nodeId of checked.order) {
    const node = checked.nodeMap.get(nodeId);
    const p = node.params;
    if (node.type === 'uv') {
      const rad = (p.rotation * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const cu = u - 0.5, cv = v - 0.5;
      const ru = (cu * cos - cv * sin + 0.5) * p.scaleU + p.offsetU;
      const rv = (cu * sin + cv * cos + 0.5) * p.scaleV + p.offsetV;
      outputsByNode.set(nodeId, { uv: [ru, rv], u: ru, v: rv });
    } else if (node.type === 'color') {
      const rgb = hexToRgb01(p.hex);
      outputsByNode.set(nodeId, { color: rgb, r: rgb[0], g: rgb[1], b: rgb[2] });
    } else if (node.type === 'scalar') {
      outputsByNode.set(nodeId, { value: p.value });
    } else if (node.type === 'vec3') {
      const x = resolveInput(node, 'x', 'float', p.x);
      const y = resolveInput(node, 'y', 'float', p.y);
      const z = resolveInput(node, 'z', 'float', p.z);
      outputsByNode.set(nodeId, { vector: [x, y, z], length: Math.hypot(x, y, z) });
    } else if (node.type === 'noise') {
      const uv = resolveInput(node, 'uv', 'vec2', [u, v]);
      const scale = resolveInput(node, 'scale', 'float', p.scale);
      const fac = sampleProceduralFbm(uv[0], uv[1], { ...p, scale });
      outputsByNode.set(nodeId, { fac, color: [fac, fac, fac] });
    } else if (node.type === 'checker') {
      const uv = resolveInput(node, 'uv', 'vec2', [u, v]);
      const colorA = resolveInput(node, 'colorA', 'color', p.colorA);
      const colorB = resolveInput(node, 'colorB', 'color', p.colorB);
      const cell = (Math.floor(uv[0] * p.scale) + Math.floor(uv[1] * p.scale)) & 1;
      const fac = cell ? 1 : 0;
      outputsByNode.set(nodeId, { fac, color: cell ? colorB : colorA });
    } else if (node.type === 'gradient') {
      const uv = resolveInput(node, 'uv', 'vec2', [u, v]);
      const colorA = resolveInput(node, 'colorA', 'color', p.colorA);
      const colorB = resolveInput(node, 'colorB', 'color', p.colorB);
      let fac = clamp(uv[1], 0, 1);
      if (p.direction === 'horizontal') fac = clamp(uv[0], 0, 1);
      else if (p.direction === 'diagonal') fac = clamp((uv[0] + uv[1]) * 0.5, 0, 1);
      else if (p.direction === 'radial') fac = clamp(Math.hypot(uv[0] - 0.5, uv[1] - 0.5) * 1.414, 0, 1);
      const color = [0, 1, 2].map(i => colorA[i] + (colorB[i] - colorA[i]) * fac);
      outputsByNode.set(nodeId, { fac, color });
    } else if (node.type === 'fresnel') {
      const power = clamp(resolveInput(node, 'power', 'float', p.power), 0.25, 12);
      const tint = resolveInput(node, 'tint', 'color', p.tint);
      const f0 = ((p.ior - 1) / (p.ior + 1)) ** 2;
      const cosTheta = clamp(p.viewAngle, 0.02, 0.98);
      const fac = clamp(f0 + (1 - f0) * ((1 - cosTheta) ** power), 0, 1);
      outputsByNode.set(nodeId, { fac, color: tint.map(c => c * fac) });
    } else if (node.type === 'math') {
      const a = resolveInput(node, 'a', 'float', p.a);
      const b = resolveInput(node, 'b', 'float', p.b);
      const c = resolveInput(node, 'c', 'float', p.c);
      let value = 0;
      switch (p.operation) {
        case 'add': value = a + b; break;
        case 'subtract': value = a - b; break;
        case 'multiply': value = a * b; break;
        case 'divide': value = Math.abs(b) < 1e-6 ? 0 : a / b; break;
        case 'power': value = Math.pow(Math.max(0, a), clamp(b, -8, 8)); break;
        case 'min': value = Math.min(a, b); break;
        case 'max': value = Math.max(a, b); break;
        case 'clamp': value = clamp(a, Math.min(b, c), Math.max(b, c)); break;
        case 'mix': value = a + (b - a) * clamp(c, 0, 1); break;
        case 'sin': value = Math.sin(a * Math.max(0.01, b)) * 0.5 + 0.5; break;
        case 'cos': value = Math.cos(a * Math.max(0.01, b)) * 0.5 + 0.5; break;
        default: value = a * b;
      }
      outputsByNode.set(nodeId, { value: finite(value, 0) });
    } else if (node.type === 'colorMix') {
      const colorA = resolveInput(node, 'colorA', 'color', p.colorA);
      const colorB = resolveInput(node, 'colorB', 'color', p.colorB);
      const factor = clamp(resolveInput(node, 'factor', 'float', p.factor), 0, 1);
      const color = [0, 1, 2].map(i => {
        const a = colorA[i], b = colorB[i];
        let blended = b;
        if (p.blendMode === 'multiply') blended = a * b;
        else if (p.blendMode === 'screen') blended = 1 - (1 - a) * (1 - b);
        else if (p.blendMode === 'add') blended = clamp(a + b, 0, 1);
        else if (p.blendMode === 'overlay') blended = a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b);
        return clamp(a + (blended - a) * factor, 0, 1);
      });
      outputsByNode.set(nodeId, { color });
    } else if (node.type === 'normalStrength') {
      const h = clamp(resolveInput(node, 'height', 'float', p.height), 0, 1);
      outputsByNode.set(nodeId, { normalScale: clamp(p.strength, 0, 4), height: h });
    } else if (node.type === 'voronoi') {
      const uv = resolveInput(node, 'uv', 'vec2', [u, v]);
      const scale = clamp(resolveInput(node, 'scale', 'float', p.scale), 0.1, 64);
      const sample = voronoiSample(uv[0], uv[1], scale, clamp(p.randomness ?? 0.85, 0, 1), Math.trunc(p.seed || 0));
      outputsByNode.set(nodeId, { fac: sample.fac, edge: sample.edge, color: [sample.cellId, sample.cellId * 0.85, 1 - sample.cellId * 0.6] });
    } else if (node.type === 'musgrave') {
      const uv = resolveInput(node, 'uv', 'vec2', [u, v]);
      const fac = musgraveSample(uv[0], uv[1], p);
      outputsByNode.set(nodeId, { fac, color: [fac, fac, fac] });
    } else if (node.type === 'wave') {
      const uv = resolveInput(node, 'uv', 'vec2', [u, v]);
      const fac = waveSample(uv[0], uv[1], p);
      outputsByNode.set(nodeId, { fac, color: [fac, fac, fac] });
    } else if (node.type === 'brick') {
      const uv = resolveInput(node, 'uv', 'vec2', [u, v]);
      const colorA = resolveInput(node, 'colorA', 'color', p.colorA);
      const colorB = resolveInput(node, 'colorB', 'color', p.colorB);
      const sample = brickSample(uv[0], uv[1], p);
      const mortarColor = hexToRgb01(p.mortarColor || '#cfc4b2');
      const brickColor = [0, 1, 2].map(i => colorA[i] + (colorB[i] - colorA[i]) * sample.variation);
      const color = sample.mortar ? mortarColor : brickColor;
      outputsByNode.set(nodeId, { color, fac: sample.fac, mortar: sample.mortar });
    } else if (node.type === 'colorRamp') {
      const factor = clamp(resolveInput(node, 'factor', 'float', p.factor), 0, 1);
      const colorA = hexToRgb01(p.colorA); const colorB = hexToRgb01(p.colorB); const colorC = hexToRgb01(p.colorC);
      const mid = clamp(p.positionB ?? 0.55, 0.02, 0.98);
      const color = factor <= mid
        ? [0, 1, 2].map(i => colorA[i] + (colorB[i] - colorA[i]) * (factor / mid))
        : [0, 1, 2].map(i => colorB[i] + (colorC[i] - colorB[i]) * ((factor - mid) / (1 - mid)));
      outputsByNode.set(nodeId, { color, fac: factor });
    } else if (node.type === 'bumpToNormal') {
      const h = clamp(resolveInput(node, 'height', 'float', p.height), 0, 1);
      const strength = clamp(p.strength, 0, 6);
      const tilt = (h - 0.5) * strength;
      const inv = 1 / Math.hypot(tilt, tilt * 0.6, 1);
      outputsByNode.set(nodeId, { normalScale: strength, height: h, normal: [tilt * inv, tilt * 0.6 * inv, inv] });
    } else if (node.type === 'pbrMaster') {
      outputsByNode.set(nodeId, {
        baseColor: resolveInput(node, 'baseColor', 'color', p.baseColor),
        metallic: clamp(resolveInput(node, 'metallic', 'float', p.metallic), 0, 1),
        roughness: clamp(resolveInput(node, 'roughness', 'float', p.roughness), 0.04, 1),
        normalScale: clamp(resolveInput(node, 'normalScale', 'float', p.normalScale), 0, 4),
        aoStrength: clamp(resolveInput(node, 'aoStrength', 'float', p.aoStrength), 0, 1),
        emissive: clamp(resolveInput(node, 'emissive', 'float', p.emissive), 0, 4),
        emissiveTint: resolveInput(node, 'emissiveTint', 'color', p.emissiveTint),
        clearcoat: clamp(resolveInput(node, 'clearcoat', 'float', p.clearcoat), 0, 1),
      });
    } else if (node.type === 'materialOutput') {
      const baseColor = resolveInput(node, 'baseColor', 'color', p.baseColor);
      const metallic = clamp(resolveInput(node, 'metallic', 'float', p.metallic), 0, 1);
      const roughness = clamp(resolveInput(node, 'roughness', 'float', p.roughness), 0.04, 1);
      const normalScale = clamp(resolveInput(node, 'normalScale', 'float', p.normalScale), 0, 4);
      const aoStrength = clamp(resolveInput(node, 'aoStrength', 'float', p.aoStrength), 0, 1);
      const emissive = clamp(resolveInput(node, 'emissive', 'float', p.emissive), 0, 4);
      const emissiveTint = resolveInput(node, 'emissiveTint', 'color', p.emissiveTint);
      const clearcoat = clamp(resolveInput(node, 'clearcoat', 'float', p.clearcoat), 0, 1);
      outputsByNode.set(nodeId, {
        baseColor,
        metallic,
        roughness,
        normalScale,
        aoStrength,
        emissive,
        emissiveTint,
        clearcoat,
      });
    }
  }
  return outputsByNode.get(checked.outputNodeId);
}

/**
 * Dependency-free uncompressed PNG encoder (RGBA -> data:image/png;base64,...).
 * Works identically in Node.js tests, GLB export, and browser <img>/<canvas>.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  let a = 1, b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32be(n) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function pngChunk(typeStr, dataBytes) {
  const type = [typeStr.charCodeAt(0), typeStr.charCodeAt(1), typeStr.charCodeAt(2), typeStr.charCodeAt(3)];
  const combined = new Uint8Array(4 + dataBytes.length);
  combined.set(type, 0);
  combined.set(dataBytes, 4);
  const crc = crc32(combined);
  const out = new Uint8Array(8 + dataBytes.length + 4);
  out.set(u32be(dataBytes.length), 0);
  out.set(combined, 4);
  out.set(u32be(crc), 8 + dataBytes.length);
  return out;
}

function toBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function encodeRgbaToPngDataUrl(width, height, rgbaBytes) {
  const w = Math.max(1, Math.min(256, Math.floor(width)));
  const h = Math.max(1, Math.min(256, Math.floor(height)));
  const raw = new Uint8Array(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const rowStart = y * (1 + w * 4);
    raw[rowStart] = 0; // filter type 0 (None)
    const srcStart = y * w * 4;
    raw.set(rgbaBytes.subarray(srcStart, srcStart + w * 4), rowStart + 1);
  }
  // Wrap in zlib stream with stored (uncompressed) DEFLATE blocks (max 65535 bytes per block).
  const blocks = [];
  let offset = 0;
  while (offset < raw.length) {
    const len = Math.min(65535, raw.length - offset);
    const isFinal = offset + len >= raw.length ? 1 : 0;
    const nlen = (~len) & 0xffff;
    const header = new Uint8Array([isFinal, len & 0xff, (len >>> 8) & 0xff, nlen & 0xff, (nlen >>> 8) & 0xff]);
    blocks.push(header, raw.subarray(offset, offset + len));
    offset += len;
  }
  const adler = adler32(raw);
  const idatLength = 2 + blocks.reduce((s, b) => s + b.length, 0) + 4;
  const idatPayload = new Uint8Array(idatLength);
  idatPayload[0] = 0x78;
  idatPayload[1] = 0x01;
  let pos = 2;
  for (const part of blocks) {
    idatPayload.set(part, pos);
    pos += part.length;
  }
  idatPayload.set(u32be(adler), pos);

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = pngChunk('IHDR', new Uint8Array([...u32be(w), ...u32be(h), 8, 6, 0, 0, 0]));
  const idat = pngChunk('IDAT', idatPayload);
  const iend = pngChunk('IEND', new Uint8Array(0));
  const total = new Uint8Array(signature.length + ihdr.length + idat.length + iend.length);
  total.set(signature, 0);
  total.set(ihdr, signature.length);
  total.set(idat, signature.length + ihdr.length);
  total.set(iend, signature.length + ihdr.length + idat.length);
  return `data:image/png;base64,${toBase64(total)}`;
}

/**
 * Compile a node graph into Orvexa's runtime PBR material object + procedural texture maps
 * so changes in Material Lab immediately update the WebGL viewport, GLB export, and game export.
 */
export function compileMaterialGraphToPBR(graphInput, options = {}) {
  const validation = validateMaterialGraph(graphInput);
  if (!validation.ok) {
    throw new Error(validation.diagnostics.map(d => d.message).join(' '));
  }
  const resolution = Math.max(8, Math.min(128, Math.floor(finite(options.resolution, 32))));
  const bakeTextures = options.bakeTextures !== false;
  const hasSpatialNodes = [...validation.nodeMap.values()].some(n => ['noise', 'checker', 'gradient', 'uv'].includes(n.type));

  const samples = [];
  const basePixels = new Uint8Array(resolution * resolution * 4);
  const mrPixels = new Uint8Array(resolution * resolution * 4);
  const normalPixels = new Uint8Array(resolution * resolution * 4);
  const aoPixels = new Uint8Array(resolution * resolution * 4);
  const emissivePixels = new Uint8Array(resolution * resolution * 4);
  const heightField = new Float32Array(resolution * resolution);

  let sumR = 0, sumG = 0, sumB = 0, sumMetal = 0, sumRough = 0, sumClear = 0, sumEmissive = 0, sumAo = 0, sumNormal = 0;
  let sumEmR = 0, sumEmG = 0, sumEmB = 0;
  const totalPixels = resolution * resolution;

  for (let y = 0; y < resolution; y++) {
    const v = (y + 0.5) / resolution;
    for (let x = 0; x < resolution; x++) {
      const u = (x + 0.5) / resolution;
      const sample = evaluateMaterialGraphAtUV(graphInput, u, v, validation);
      samples.push(sample);
      const idx = (y * resolution + x) * 4;
      const [r, g, b] = sample.baseColor;
      basePixels[idx] = Math.round(clamp(r, 0, 1) * 255);
      basePixels[idx + 1] = Math.round(clamp(g, 0, 1) * 255);
      basePixels[idx + 2] = Math.round(clamp(b, 0, 1) * 255);
      basePixels[idx + 3] = 255;

      // glTF convention: R = AO, G = Roughness, B = Metallic
      mrPixels[idx] = Math.round(clamp(sample.aoStrength, 0, 1) * 255);
      mrPixels[idx + 1] = Math.round(clamp(sample.roughness, 0.04, 1) * 255);
      mrPixels[idx + 2] = Math.round(clamp(sample.metallic, 0, 1) * 255);
      mrPixels[idx + 3] = 255;

      const aoByte = Math.round(clamp(sample.aoStrength, 0, 1) * 255);
      aoPixels[idx] = aoByte; aoPixels[idx + 1] = aoByte; aoPixels[idx + 2] = aoByte; aoPixels[idx + 3] = 255;
      emissivePixels[idx] = Math.round(clamp(sample.emissiveTint[0] * clamp(sample.emissive, 0, 1), 0, 1) * 255);
      emissivePixels[idx + 1] = Math.round(clamp(sample.emissiveTint[1] * clamp(sample.emissive, 0, 1), 0, 1) * 255);
      emissivePixels[idx + 2] = Math.round(clamp(sample.emissiveTint[2] * clamp(sample.emissive, 0, 1), 0, 1) * 255);
      emissivePixels[idx + 3] = 255;

      heightField[y * resolution + x] = (r + g + b) / 3;

      sumR += r; sumG += g; sumB += b;
      sumMetal += sample.metallic;
      sumRough += sample.roughness;
      sumClear += sample.clearcoat;
      sumEmissive += sample.emissive;
      sumAo += sample.aoStrength;
      sumNormal += sample.normalScale;
      sumEmR += sample.emissiveTint[0];
      sumEmG += sample.emissiveTint[1];
      sumEmB += sample.emissiveTint[2];
    }
  }

  // Compute tangent-space normal map from height derivatives when spatial patterns exist
  const avgNormalScale = sumNormal / totalPixels;
  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const left = heightField[y * resolution + ((x - 1 + resolution) % resolution)];
      const right = heightField[y * resolution + ((x + 1) % resolution)];
      const down = heightField[((y - 1 + resolution) % resolution) * resolution + x];
      const up = heightField[((y + 1) % resolution) * resolution + x];
      const dx = (left - right) * avgNormalScale * 2.2;
      const dy = (down - up) * avgNormalScale * 2.2;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz) || 1;
      const idx = (y * resolution + x) * 4;
      normalPixels[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      normalPixels[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      normalPixels[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      normalPixels[idx + 3] = 255;
    }
  }

  const avgColor = [sumR / totalPixels, sumG / totalPixels, sumB / totalPixels];
  const colorHex = rgb01ToHex(avgColor);
  const emissiveTint = [
    clamp(sumEmR / totalPixels, 0, 1),
    clamp(sumEmG / totalPixels, 0, 1),
    clamp(sumEmB / totalPixels, 0, 1),
  ];

  const material = {
    metallic: Number((sumMetal / totalPixels).toFixed(3)),
    roughness: Number(clamp(sumRough / totalPixels, 0.04, 1).toFixed(3)),
    clearcoat: Number((sumClear / totalPixels).toFixed(3)),
    emissive: Number((sumEmissive / totalPixels).toFixed(3)),
    emissiveTint: emissiveTint.map(v => Number(v.toFixed(3))),
    aoStrength: Number((sumAo / totalPixels).toFixed(3)),
    normalScale: Number((sumNormal / totalPixels).toFixed(3)),
  };

  if (bakeTextures) {
    // When baking a procedural baseColor texture, set object tint to white (#ffffff) or neutral so the texture colors aren't double-darkened
    material.baseColorImage = encodeRgbaToPngDataUrl(resolution, resolution, basePixels);
    material.metallicRoughnessImage = encodeRgbaToPngDataUrl(resolution, resolution, mrPixels);
    material.aoImage = encodeRgbaToPngDataUrl(resolution, resolution, aoPixels);
    material.normalImage = encodeRgbaToPngDataUrl(resolution, resolution, normalPixels);
    material.emissiveImage = encodeRgbaToPngDataUrl(resolution, resolution, emissivePixels);
  }

  return {
    color: hasSpatialNodes && bakeTextures ? '#ffffff' : colorHex,
    previewHex: colorHex,
    baseColorImage: material.baseColorImage || null,
    metallicRoughnessImage: material.metallicRoughnessImage || null,
    aoImage: material.aoImage || null,
    normalImage: material.normalImage || null,
    emissiveImage: material.emissiveImage || null,
    material,
    hasSpatialNodes,
    nodeCount: validation.nodeMap.size,
    connectionCount: validation.validConnections.length,
    order: validation.order,
  };
}

export const MATERIAL_GRAPH_PRESETS = Object.freeze({
  'gilded-relic': {
    name: 'Gilded Relic',
    description: 'Hammered ancient gold with FBM micro-roughness variation and clearcoat.',
    nodes: [
      { id: 'uv-1', type: 'uv', name: 'UV Tile', params: { scaleU: 4, scaleV: 4, offsetU: 0, offsetV: 0, rotation: 15 } },
      { id: 'noise-1', type: 'noise', name: 'Hammered Grain', params: { scale: 7, octaves: 4, roughness: 0.55, contrast: 1.4, seed: 108 } },
      { id: 'mix-1', type: 'colorMix', name: 'Gold Patina', params: { blendMode: 'mix', factor: 0.35, colorA: '#b5842f', colorB: '#ffe08a' } },
      { id: 'math-rough', type: 'math', name: 'Roughness Map', params: { operation: 'mix', a: 0.16, b: 0.42, c: 0.5 } },
      { id: 'out-1', type: 'materialOutput', name: 'Material Output', params: { metallic: 0.94, roughness: 0.24, clearcoat: 0.35, normalScale: 1.1 } },
    ],
    connections: [
      { from: 'uv-1', fromPort: 'uv', to: 'noise-1', toPort: 'uv' },
      { from: 'noise-1', fromPort: 'fac', to: 'mix-1', toPort: 'factor' },
      { from: 'noise-1', fromPort: 'fac', to: 'math-rough', toPort: 'c' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
      { from: 'math-rough', fromPort: 'value', to: 'out-1', toPort: 'roughness' },
    ],
  },
  'weathered-basalt': {
    name: 'Weathered Basalt',
    description: 'Stratified dark volcanic stone with mineral grain and pronounced surface normal relief.',
    nodes: [
      { id: 'uv-1', type: 'uv', name: 'Rock UVs', params: { scaleU: 5, scaleV: 5, offsetU: 0, offsetV: 0, rotation: 0 } },
      { id: 'noise-1', type: 'noise', name: 'Basalt FBM', params: { scale: 8, octaves: 5, roughness: 0.62, contrast: 1.5, seed: 312 } },
      { id: 'mix-1', type: 'colorMix', name: 'Mineral Strata', params: { blendMode: 'mix', factor: 0.5, colorA: '#232830', colorB: '#6a737d' } },
      { id: 'norm-1', type: 'normalStrength', name: 'Rock Relief', params: { strength: 1.85, height: 0.5 } },
      { id: 'out-1', type: 'materialOutput', name: 'Material Output', params: { metallic: 0.04, roughness: 0.86, clearcoat: 0, aoStrength: 0.95 } },
    ],
    connections: [
      { from: 'uv-1', fromPort: 'uv', to: 'noise-1', toPort: 'uv' },
      { from: 'noise-1', fromPort: 'fac', to: 'mix-1', toPort: 'factor' },
      { from: 'noise-1', fromPort: 'fac', to: 'norm-1', toPort: 'height' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
      { from: 'norm-1', fromPort: 'normalScale', to: 'out-1', toPort: 'normalScale' },
    ],
  },
  'cyber-neon-grid': {
    name: 'Cyber Neon Grid',
    description: 'Procedural checker circuit grid with glowing cyan/violet emissive accents.',
    nodes: [
      { id: 'uv-1', type: 'uv', name: 'Grid UVs', params: { scaleU: 1, scaleV: 1, offsetU: 0, offsetV: 0, rotation: 0 } },
      { id: 'check-1', type: 'checker', name: 'Holo Checker', params: { scale: 6, colorA: '#121829', colorB: '#48e5e5' } },
      { id: 'fres-1', type: 'fresnel', name: 'Rim Boost', params: { ior: 1.6, power: 2.8, tint: '#8b79ff', viewAngle: 0.35 } },
      { id: 'mix-1', type: 'colorMix', name: 'Neon Blend', params: { blendMode: 'screen', factor: 0.45, colorA: '#121829', colorB: '#8b79ff' } },
      { id: 'out-1', type: 'materialOutput', name: 'Material Output', params: { metallic: 0.65, roughness: 0.2, clearcoat: 0.75, emissive: 0.85, emissiveTint: '#48e5e5' } },
    ],
    connections: [
      { from: 'uv-1', fromPort: 'uv', to: 'check-1', toPort: 'uv' },
      { from: 'check-1', fromPort: 'color', to: 'mix-1', toPort: 'colorA' },
      { from: 'fres-1', fromPort: 'color', to: 'mix-1', toPort: 'colorB' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
    ],
  },
  'arcane-crystal': {
    name: 'Arcane Sunshard Crystal',
    description: 'Radial gradient crystal core with Fresnel edge luminescence and glossy clearcoat.',
    nodes: [
      { id: 'grad-1', type: 'gradient', name: 'Core Gradient', params: { direction: 'radial', colorA: '#64f0e8', colorB: '#53389e' } },
      { id: 'fres-1', type: 'fresnel', name: 'Crystal Fresnel', params: { ior: 1.8, power: 2.4, tint: '#aefbff', viewAngle: 0.38 } },
      { id: 'mix-1', type: 'colorMix', name: 'Facet Mix', params: { blendMode: 'add', factor: 0.42, colorA: '#64f0e8', colorB: '#aefbff' } },
      { id: 'out-1', type: 'materialOutput', name: 'Material Output', params: { metallic: 0.22, roughness: 0.12, clearcoat: 0.9, emissive: 0.65, emissiveTint: '#64f0e8' } },
    ],
    connections: [
      { from: 'grad-1', fromPort: 'color', to: 'mix-1', toPort: 'colorA' },
      { from: 'fres-1', fromPort: 'color', to: 'mix-1', toPort: 'colorB' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
    ],
  },
  'mossy-ruin': {
    name: 'Mossy Highland Ruin',
    description: 'Ancient highland masonry blended with organic forest moss via FBM noise mask.',
    nodes: [
      { id: 'noise-1', type: 'noise', name: 'Moss Mask', params: { scale: 5, octaves: 4, roughness: 0.58, contrast: 1.75, seed: 741 } },
      { id: 'mix-1', type: 'colorMix', name: 'Stone & Moss', params: { blendMode: 'mix', factor: 0.5, colorA: '#6e7682', colorB: '#3f7c56' } },
      { id: 'norm-1', type: 'normalStrength', name: 'Surface Bump', params: { strength: 1.4, height: 0.5 } },
      { id: 'out-1', type: 'materialOutput', name: 'Material Output', params: { metallic: 0.03, roughness: 0.84, clearcoat: 0.02, aoStrength: 0.9 } },
    ],
    connections: [
      { from: 'noise-1', fromPort: 'fac', to: 'mix-1', toPort: 'factor' },
      { from: 'noise-1', fromPort: 'fac', to: 'norm-1', toPort: 'height' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
      { from: 'norm-1', fromPort: 'normalScale', to: 'out-1', toPort: 'normalScale' },
    ],
  },
  'weathered-stone': {
    name: 'Weathered Stone',
    description: 'UE5-style weathered limestone and granite with FBM strata, moss-free worn edges and strong normal relief.',
    nodes: [
      { id: 'uv-1', type: 'uv', name: 'Stone UVs', params: { scaleU: 5, scaleV: 5, offsetU: 0, offsetV: 0, rotation: 0 } },
      { id: 'noise-1', type: 'noise', name: 'Stone Grain', params: { scale: 8, octaves: 5, roughness: 0.6, contrast: 1.45, seed: 421 } },
      { id: 'mix-1', type: 'colorMix', name: 'Worn Strata', params: { blendMode: 'mix', factor: 0.52, colorA: '#5d6066', colorB: '#a8a294' } },
      { id: 'norm-1', type: 'normalStrength', name: 'Stone Relief', params: { strength: 1.9, height: 0.5 } },
      { id: 'out-1', type: 'materialOutput', name: 'Material Output', params: { metallic: 0.03, roughness: 0.88, clearcoat: 0, aoStrength: 0.95 } },
    ],
    connections: [
      { from: 'uv-1', fromPort: 'uv', to: 'noise-1', toPort: 'uv' },
      { from: 'noise-1', fromPort: 'fac', to: 'mix-1', toPort: 'factor' },
      { from: 'noise-1', fromPort: 'fac', to: 'norm-1', toPort: 'height' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
      { from: 'norm-1', fromPort: 'normalScale', to: 'out-1', toPort: 'normalScale' },
    ],
  },
  'runed-bronze': {
    name: 'Runed Bronze',
    description: 'Ancient runed bronze with patina in the recesses, polished raised metal and a faint arcane emissive tint.',
    nodes: [
      { id: 'uv-1', type: 'uv', name: 'Bronze UVs', params: { scaleU: 4, scaleV: 4, offsetU: 0, offsetV: 0, rotation: 10 } },
      { id: 'noise-1', type: 'noise', name: 'Patina Mask', params: { scale: 6, octaves: 4, roughness: 0.55, contrast: 1.5, seed: 618 } },
      { id: 'mix-1', type: 'colorMix', name: 'Bronze & Patina', params: { blendMode: 'mix', factor: 0.38, colorA: '#8a5a28', colorB: '#3f8f7a' } },
      { id: 'out-1', type: 'materialOutput', name: 'Material Output', params: { metallic: 0.88, roughness: 0.34, clearcoat: 0.25, emissive: 0.18, emissiveTint: '#56f0e8' } },
    ],
    connections: [
      { from: 'uv-1', fromPort: 'uv', to: 'noise-1', toPort: 'uv' },
      { from: 'noise-1', fromPort: 'fac', to: 'mix-1', toPort: 'factor' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
    ],
  },
  'mossy-basalt': {
    name: 'Mossy Basalt',
    description: 'Dark columnar basalt softened by living moss, deep ambient occlusion and damp low roughness patches.',
    nodes: [
      { id: 'noise-1', type: 'noise', name: 'Moss & Basalt', params: { scale: 7, octaves: 5, roughness: 0.62, contrast: 1.7, seed: 733 } },
      { id: 'mix-1', type: 'colorMix', name: 'Basalt Moss Blend', params: { blendMode: 'mix', factor: 0.5, colorA: '#22262b', colorB: '#477a45' } },
      { id: 'norm-1', type: 'normalStrength', name: 'Basalt Relief', params: { strength: 1.7, height: 0.5 } },
      { id: 'out-1', type: 'materialOutput', name: 'Material Output', params: { metallic: 0.04, roughness: 0.82, clearcoat: 0.03, aoStrength: 0.96 } },
    ],
    connections: [
      { from: 'noise-1', fromPort: 'fac', to: 'mix-1', toPort: 'factor' },
      { from: 'noise-1', fromPort: 'fac', to: 'norm-1', toPort: 'height' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
      { from: 'norm-1', fromPort: 'normalScale', to: 'out-1', toPort: 'normalScale' },
    ],
  },
  'ember-magma': {
    name: 'Ember Magma',
    description: 'Cracked volcanic magma crust: near-black rock split by glowing ember channels and heat emissive.',
    nodes: [
      { id: 'uv-1', type: 'uv', name: 'Magma UVs', params: { scaleU: 3, scaleV: 3, offsetU: 0, offsetV: 0, rotation: 0 } },
      { id: 'noise-1', type: 'noise', name: 'Magma Cracks', params: { scale: 5, octaves: 5, roughness: 0.5, contrast: 2.1, seed: 909 } },
      { id: 'mix-1', type: 'colorMix', name: 'Crust & Ember', params: { blendMode: 'mix', factor: 0.45, colorA: '#17120f', colorB: '#ff5a1f' } },
      { id: 'out-1', type: 'materialOutput', name: 'Material Output', params: { metallic: 0.12, roughness: 0.62, clearcoat: 0.08, emissive: 1.6, emissiveTint: '#ff7a2a', aoStrength: 0.9 } },
    ],
    connections: [
      { from: 'uv-1', fromPort: 'uv', to: 'noise-1', toPort: 'uv' },
      { from: 'noise-1', fromPort: 'fac', to: 'mix-1', toPort: 'factor' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
    ],
  },
  'alpine-ice': {
    name: 'Alpine Ice',
    description: 'Glacial alpine ice with radial depth gradient, fresnel sheen, glassy clearcoat and low roughness.',
    nodes: [
      { id: 'grad-1', type: 'gradient', name: 'Ice Depth', params: { direction: 'radial', colorA: '#dff6ff', colorB: '#2f7fc4' } },
      { id: 'fres-1', type: 'fresnel', name: 'Ice Fresnel', params: { ior: 1.31, power: 2.2, tint: '#c8f2ff', viewAngle: 0.4 } },
      { id: 'mix-1', type: 'colorMix', name: 'Glacier Blend', params: { blendMode: 'screen', factor: 0.4, colorA: '#bfe9ff', colorB: '#eafcff' } },
      { id: 'out-1', type: 'materialOutput', name: 'Material Output', params: { metallic: 0.05, roughness: 0.16, clearcoat: 0.95, emissive: 0.12, emissiveTint: '#9fdcff' } },
    ],
    connections: [
      { from: 'grad-1', fromPort: 'color', to: 'mix-1', toPort: 'colorA' },
      { from: 'fres-1', fromPort: 'color', to: 'mix-1', toPort: 'colorB' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
    ],
  },
  'cyber-carbon-fiber': {
    name: 'Cyber Carbon Fiber',
    description: 'Woven checker carbon with clearcoat and fresnel rim.',
    nodes: [
      { id: 'uv-1', type: 'uv', name: 'Carbon Weave UV', params: { scaleU: 10, scaleV: 10, offsetU: 0, offsetV: 0, rotation: 0 } },
      { id: 'chk-1', type: 'checker', name: 'Weave Checker', params: { scale: 18, colorA: '#14161c', colorB: '#2e3444' } },
      { id: 'fr-1', type: 'fresnel', name: 'Rim Sheen', params: { ior: 1.46, power: 2.6, tint: '#58c8ff', viewAngle: 0.52 } },
      { id: 'mix-1', type: 'colorMix', name: 'Sheen Mix', params: { blendMode: 'screen', factor: 0.34, colorA: '#14161c', colorB: '#6ec8ff' } },
      { id: 'out-1', type: 'pbrMaster', name: 'PBR Master', params: { metallic: 0.72, roughness: 0.34, clearcoat: 0.9, normalScale: 1.4, aoStrength: 0.92 } },
    ],
    connections: [
      { from: 'uv-1', fromPort: 'uv', to: 'chk-1', toPort: 'uv' },
      { from: 'chk-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
      { from: 'fr-1', fromPort: 'fac', to: 'mix-1', toPort: 'factor' },
      { from: 'chk-1', fromPort: 'fac', to: 'out-1', toPort: 'aoStrength' },
    ],
  },
  'brushed-titanium': {
    name: 'Brushed Titanium',
    description: 'Anisotropic wave-brushed metal via Wave texture into a ColorRamp and PBR Master.',
    nodes: [
      { id: 'uv-1', type: 'uv', name: 'Brushed UV', params: { scaleU: 1, scaleV: 14, offsetU: 0, offsetV: 0, rotation: 90 } },
      { id: 'wv-1', type: 'wave', name: 'Brush Lines', params: { scale: 26, distortion: 0.7, direction: 'bands', seed: 5 } },
      { id: 'ramp-1', type: 'colorRamp', name: 'Titanium Ramp', params: { factor: 0.5, colorA: '#5c6470', colorB: '#aab4c2', colorC: '#e8eef7', positionB: 0.5 } },
      { id: 'bump-1', type: 'bumpToNormal', name: 'Brush Normal', params: { strength: 0.7, height: 0.5 } },
      { id: 'out-1', type: 'pbrMaster', name: 'PBR Master', params: { metallic: 0.96, roughness: 0.31, clearcoat: 0.15, normalScale: 0.7 } },
    ],
    connections: [
      { from: 'uv-1', fromPort: 'uv', to: 'wv-1', toPort: 'uv' },
      { from: 'wv-1', fromPort: 'fac', to: 'ramp-1', toPort: 'factor' },
      { from: 'ramp-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
      { from: 'wv-1', fromPort: 'fac', to: 'bump-1', toPort: 'height' },
      { from: 'bump-1', fromPort: 'normalScale', to: 'out-1', toPort: 'normalScale' },
    ],
  },
  'gold-filigree': {
    name: 'Gold Filigree',
    description: 'Voronoi filigree cells over hammered gold with emissive inlay.',
    nodes: [
      { id: 'uv-1', type: 'uv', name: 'Filigree UV', params: { scaleU: 5, scaleV: 5, offsetU: 0, offsetV: 0, rotation: 30 } },
      { id: 'vor-1', type: 'voronoi', name: 'Filigree Cells', params: { scale: 6, randomness: 0.9, seed: 17 } },
      { id: 'mix-1', type: 'colorMix', name: 'Gold Inlay', params: { blendMode: 'mix', factor: 0.55, colorA: '#8a5c1c', colorB: '#ffd77a' } },
      { id: 'out-1', type: 'pbrMaster', name: 'PBR Master', params: { metallic: 0.95, roughness: 0.22, clearcoat: 0.5, normalScale: 1.6, emissive: 0.12, emissiveTint: '#ffca6a' } },
    ],
    connections: [
      { from: 'uv-1', fromPort: 'uv', to: 'vor-1', toPort: 'uv' },
      { from: 'vor-1', fromPort: 'fac', to: 'mix-1', toPort: 'factor' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
      { from: 'vor-1', fromPort: 'edge', to: 'out-1', toPort: 'aoStrength' },
    ],
  },
  'iridescent-car-paint': {
    name: 'Iridescent Car Paint',
    description: 'Fresnel-driven hue shift over deep flakes with showroom clearcoat.',
    nodes: [
      { id: 'uv-1', type: 'uv', name: 'Paint UV', params: { scaleU: 7, scaleV: 7, offsetU: 0, offsetV: 0, rotation: 12 } },
      { id: 'noise-1', type: 'noise', name: 'Metallic Flake', params: { scale: 22, octaves: 3, roughness: 0.5, contrast: 1.6, seed: 64 } },
      { id: 'fr-1', type: 'fresnel', name: 'Hue Shift Fresnel', params: { ior: 1.52, power: 2.2, tint: '#b46eff', viewAngle: 0.45 } },
      { id: 'mix-1', type: 'colorMix', name: 'Iridescent Mix', params: { blendMode: 'screen', factor: 0.5, colorA: '#1c2f66', colorB: '#b46eff' } },
      { id: 'out-1', type: 'pbrMaster', name: 'PBR Master', params: { metallic: 0.85, roughness: 0.18, clearcoat: 1, normalScale: 0.7, emissive: 0.05, emissiveTint: '#8a5cff' } },
    ],
    connections: [
      { from: 'uv-1', fromPort: 'uv', to: 'noise-1', toPort: 'uv' },
      { from: 'noise-1', fromPort: 'fac', to: 'mix-1', toPort: 'factor' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
      { from: 'fr-1', fromPort: 'fac', to: 'out-1', toPort: 'emissive' },
    ],
  },
  'toxic-slime': {
    name: 'Toxic Slime',
    description: 'Musgrave blister slime with glowing voronoi pustules.',
    nodes: [
      { id: 'uv-1', type: 'uv', name: 'Slime UV', params: { scaleU: 4, scaleV: 4, offsetU: 0, offsetV: 0, rotation: 0 } },
      { id: 'mus-1', type: 'musgrave', name: 'Blister Musgrave', params: { scale: 7, dimension: 1.7, lacunarity: 2.2, seed: 23, offset: 0.08 } },
      { id: 'vor-1', type: 'voronoi', name: 'Pustule Cells', params: { scale: 9, randomness: 0.75, seed: 31 } },
      { id: 'mix-1', type: 'colorMix', name: 'Toxic Mix', params: { blendMode: 'mix', factor: 0.62, colorA: '#1e4d1e', colorB: '#8aff5e' } },
      { id: 'out-1', type: 'pbrMaster', name: 'PBR Master', params: { metallic: 0.05, roughness: 0.28, clearcoat: 0.6, normalScale: 1.9, emissive: 0.55, emissiveTint: '#6eff4a' } },
    ],
    connections: [
      { from: 'uv-1', fromPort: 'uv', to: 'mus-1', toPort: 'uv' },
      { from: 'uv-1', fromPort: 'uv', to: 'vor-1', toPort: 'uv' },
      { from: 'mus-1', fromPort: 'fac', to: 'mix-1', toPort: 'factor' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
      { from: 'vor-1', fromPort: 'edge', to: 'out-1', toPort: 'emissive' },
    ],
  },
  'ancient-terracotta': {
    name: 'Ancient Terracotta',
    description: 'Brick-laid terracotta with dusty musgrave wear and matte finish.',
    nodes: [
      { id: 'uv-1', type: 'uv', name: 'Brick UV', params: { scaleU: 2, scaleV: 2, offsetU: 0, offsetV: 0, rotation: 0 } },
      { id: 'brk-1', type: 'brick', name: 'Terracotta Bricks', params: { scaleU: 4, scaleV: 8, mortarSize: 0.09, offset: 0.5, colorA: '#8a4632', colorB: '#b06a48', mortarColor: '#d8c6ac' } },
      { id: 'mus-1', type: 'musgrave', name: 'Dust Wear', params: { scale: 5, dimension: 1.2, lacunarity: 2, seed: 11, offset: 0.05 } },
      { id: 'out-1', type: 'pbrMaster', name: 'PBR Master', params: { metallic: 0.02, roughness: 0.86, clearcoat: 0, normalScale: 1.2, aoStrength: 0.9 } },
    ],
    connections: [
      { from: 'uv-1', fromPort: 'uv', to: 'brk-1', toPort: 'uv' },
      { from: 'uv-1', fromPort: 'uv', to: 'mus-1', toPort: 'uv' },
      { from: 'brk-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
      { from: 'mus-1', fromPort: 'fac', to: 'out-1', toPort: 'roughness' },
      { from: 'brk-1', fromPort: 'mortar', to: 'out-1', toPort: 'aoStrength' },
    ],
  },
  'hologram-glass': {
    name: 'Hologram Glass',
    description: 'Iridescent hologram glass with fresnel sheen and low roughness transmission feel.',
    nodes: [
      { id: 'uv-1', type: 'uv', name: 'Holo UV', params: { scaleU: 3, scaleV: 3, offsetU: 0, offsetV: 0, rotation: 30 } },
      { id: 'noise-1', type: 'noise', name: 'Holo Bands', params: { scale: 5, octaves: 3, roughness: 0.4, contrast: 1.6, seed: 777 } },
      { id: 'mix-1', type: 'colorMix', name: 'Rainbow Sheen', params: { blendMode: 'mix', factor: 0.45, colorA: '#56f0e8', colorB: '#c88aff' } },
      { id: 'out-1', type: 'materialOutput', name: 'Material Output', params: { metallic: 0.1, roughness: 0.08, clearcoat: 1, normalScale: 0.6 } },
    ],
    connections: [
      { from: 'uv-1', fromPort: 'uv', to: 'noise-1', toPort: 'uv' },
      { from: 'noise-1', fromPort: 'fac', to: 'mix-1', toPort: 'factor' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
      { from: 'noise-1', fromPort: 'fac', to: 'out-1', toPort: 'roughness' },
    ],
  },
  'candy-gloss-pop': {
    name: 'Candy Gloss Pop',
    description: 'Glossy candy-coat pop colours with sparkle grain for playful props and karts.',
    nodes: [
      { id: 'uv-1', type: 'uv', name: 'Candy UV', params: { scaleU: 2, scaleV: 2, offsetU: 0, offsetV: 0, rotation: 0 } },
      { id: 'noise-1', type: 'noise', name: 'Sugar Sparkle', params: { scale: 14, octaves: 2, roughness: 0.25, contrast: 2, seed: 99 } },
      { id: 'mix-1', type: 'colorMix', name: 'Pop Coat', params: { blendMode: 'mix', factor: 0.3, colorA: '#ff5c8a', colorB: '#ffd94a' } },
      { id: 'out-1', type: 'materialOutput', name: 'Material Output', params: { metallic: 0.05, roughness: 0.18, clearcoat: 0.9, normalScale: 0.4 } },
    ],
    connections: [
      { from: 'uv-1', fromPort: 'uv', to: 'noise-1', toPort: 'uv' },
      { from: 'noise-1', fromPort: 'fac', to: 'mix-1', toPort: 'factor' },
      { from: 'mix-1', fromPort: 'color', to: 'out-1', toPort: 'baseColor' },
    ],
  },
});


export function buildPresetMaterialGraph(presetKey = 'gilded-relic') {
  const preset = MATERIAL_GRAPH_PRESETS[presetKey] || MATERIAL_GRAPH_PRESETS['gilded-relic'];
  return createMaterialGraph({
    name: preset.name,
    preset: MATERIAL_GRAPH_PRESETS[presetKey] ? presetKey : 'gilded-relic',
    nodes: structuredClone ? structuredClone(preset.nodes) : JSON.parse(JSON.stringify(preset.nodes)),
    connections: structuredClone ? structuredClone(preset.connections) : JSON.parse(JSON.stringify(preset.connections)),
  });
}

const svgEsc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/**
 * Render an interactive node-wire SVG diagram of a material graph.
 * Nodes are <g data-node-id> groups with typed port circles; connections are
 * <path data-from data-to> wires a visual editor can select and re-route.
 */
export function renderMaterialGraphSvg(graphInput, options = {}) {
  const validation = validateMaterialGraph(graphInput);
  if (!validation.ok) throw new Error(validation.diagnostics.map(d => d.message).join(' '));
  const graph = validation.graph || graphInput;
  const nodes = graph.nodes || [];
  const width = Math.max(320, Math.min(2400, Math.round(Number(options.width) || 760)));
  const nodeWidth = 148; const nodeHeight = 62;
  const columns = new Map();
  for (const id of validation.order) {
    const node = validation.nodeMap.get(id);
    const depth = node.type === 'materialOutput' || node.type === 'pbrMaster' ? 4
      : node.category === 'output' ? 4 : _graphDepth(validation, id);
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
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Material graph ${svgEsc(graph.name || 'diagram')}" data-graph-name="${svgEsc(graph.name || '')}">`);
  parts.push('<rect width="100%" height="100%" fill="#10142a"/>');
  for (let gx = 0; gx < width; gx += 24) parts.push(`<line x1="${gx}" y1="0" x2="${gx}" y2="${height}" stroke="#1a2042" stroke-width="1"/>`);
  for (let gy = 0; gy < height; gy += 24) parts.push(`<line x1="0" y1="${gy}" x2="${width}" y2="${gy}" stroke="#1a2042" stroke-width="1"/>`);
  const portY = (nodeId, port, isOutput) => {
    const node = validation.nodeMap.get(nodeId);
    const ports = Object.keys(isOutput ? (MATERIAL_NODE_TYPES[node.type]?.outputs || {}) : (MATERIAL_NODE_TYPES[node.type]?.inputs || {}));
    const index = Math.max(0, ports.indexOf(port));
    const pos = positions.get(nodeId);
    return pos.y + 30 + index * 11;
  };
  for (const conn of validation.validConnections) {
    const fromPos = positions.get(conn.from); const toPos = positions.get(conn.to);
    if (!fromPos || !toPos) continue;
    const x1 = fromPos.x + nodeWidth; const y1 = portY(conn.from, conn.fromPort, true);
    const x2 = toPos.x; const y2 = portY(conn.to, conn.toPort, false);
    const mid = Math.max(24, Math.abs(x2 - x1) / 2);
    parts.push(`<path d="M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}" fill="none" stroke="#56f0e8" stroke-width="1.8" opacity="0.85" data-from="${svgEsc(conn.from)}" data-from-port="${svgEsc(conn.fromPort)}" data-to="${svgEsc(conn.to)}" data-to-port="${svgEsc(conn.toPort)}"/>`);
  }
  for (const node of nodes) {
    const normalized = validation.nodeMap.get(node.id);
    const def = MATERIAL_NODE_TYPES[normalized.type] || {};
    const pos = positions.get(node.id) || { x: 16, y: 16 };
    const fill = normalized.type === 'materialOutput' || normalized.type === 'pbrMaster' ? '#3a2d5e' : def.category === 'texture' ? '#17384a' : def.category === 'color' ? '#3d2c4e' : '#20264a';
    parts.push(`<g data-node-id="${svgEsc(node.id)}" data-node-type="${svgEsc(normalized.type)}" transform="translate(${pos.x}, ${pos.y})">`);
    parts.push(`<rect width="${nodeWidth}" height="${nodeHeight}" rx="9" fill="${fill}" stroke="#55d6be" stroke-width="1.2"/>`);
    parts.push(`<text x="10" y="19" fill="#eef1ff" font-size="11" font-weight="700">${svgEsc(normalized.name || def.label || normalized.type)}</text>`);
    parts.push(`<text x="10" y="33" fill="#93a0d0" font-size="9">${svgEsc(def.label || normalized.type)} · ${svgEsc(normalized.type)}</text>`);
    Object.keys(def.inputs || {}).forEach((port, i) => {
      parts.push(`<circle cx="0" cy="${30 + i * 11}" r="3.2" fill="#ffb86b" data-port="${svgEsc(port)}" data-port-direction="input"><title>in · ${svgEsc(port)}</title></circle>`);
    });
    Object.keys(def.outputs || {}).forEach((port, i) => {
      parts.push(`<circle cx="${nodeWidth}" cy="${30 + i * 11}" r="3.2" fill="#56f0e8" data-port="${svgEsc(port)}" data-port-direction="output"><title>out · ${svgEsc(port)}</title></circle>`);
    });
    parts.push('</g>');
  }
  parts.push(`<text x="${width - 10}" y="${height - 8}" fill="#93a0d0" font-size="10" text-anchor="end">${svgEsc(graph.name || 'Material Graph')} · ${nodes.length} nodes · ${validation.validConnections.length} wires</text>`);
  parts.push('</svg>');
  return parts.join('');
}

function _graphDepth(validation, nodeId, seen = new Set()) {
  if (seen.has(nodeId)) return 0;
  seen.add(nodeId);
  const incoming = validation.validConnections.filter(c => c.to === nodeId);
  if (!incoming.length) return 0;
  return 1 + Math.max(...incoming.map(c => _graphDepth(validation, c.from, seen)));
}

export function listMaterialNodeTypes() {
  return Object.entries(MATERIAL_NODE_TYPES).map(([id, def]) => ({ id, label: def.label, category: def.category, inputs: Object.keys(def.inputs || {}), outputs: Object.keys(def.outputs || {}) }));
}

