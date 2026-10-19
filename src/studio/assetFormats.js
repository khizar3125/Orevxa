/** Dependency-free subset of glTF 2.0 binary/glTF and ASCII FBX for mesh interchange. */
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const cleanName = (name, fallback = 'Imported Model') => String(name || fallback).replace(/\.(glb|gltf|fbx)$/i, '').replace(/[^\w .-]/g, '_').slice(0, 100) || fallback;
function bytesOf(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError('Asset data must be bytes.');
}
function readArrayBuffer(view, buffer, accessor, expectedType, label) {
  if (!accessor || accessor.type !== expectedType || !Number.isInteger(accessor.count) || accessor.count < 1) throw new Error(`glTF ${label} accessor is invalid.`);
  const types = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const components = types[accessor.type];
  const componentTypes = { 5121: [Uint8Array, 1], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
  const info = componentTypes[accessor.componentType];
  if (!info) throw new Error(`glTF ${label} uses an unsupported component type.`);
  const [Ctor, componentBytes] = info;
  const bv = view.bufferViews?.[accessor.bufferView];
  if (!bv || bv.buffer !== 0) throw new Error(`glTF ${label} must use the embedded buffer.`);
  const start = (bv.byteOffset || 0) + (accessor.byteOffset || 0), stride = bv.byteStride || components * componentBytes;
  const end = start + (accessor.count - 1) * stride + components * componentBytes;
  if (start < 0 || end > buffer.length || stride < components * componentBytes) throw new Error(`glTF ${label} reads beyond its buffer.`);
  const out = new Array(accessor.count * components);
  const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  for (let i = 0; i < accessor.count; i++) for (let c = 0; c < components; c++) {
    const at = start + i * stride + c * componentBytes;
    let v;
    if (accessor.componentType === 5121) v = dv.getUint8(at);
    else if (accessor.componentType === 5123) v = dv.getUint16(at, true);
    else if (accessor.componentType === 5125) v = dv.getUint32(at, true);
    else v = dv.getFloat32(at, true);
    if (!Number.isFinite(v)) throw new Error(`glTF ${label} contains invalid numeric data.`);
    out[i * components + c] = v;
  }
  return out;
}
function decodeBase64(text) {
  const source = String(text).replace(/\s/g, '');
  if (typeof atob === 'function') { const raw = atob(source); return Uint8Array.from(raw, c => c.charCodeAt(0)); }
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(source, 'base64'));
  throw new Error('This browser cannot decode base64 glTF buffers.');
}
function encodeBase64(bytes) {
  let binary = ''; const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) binary += String.fromCharCode(...bytes.subarray(i, i + size));
  if (typeof btoa === 'function') return btoa(binary);
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  throw new Error('This browser cannot encode embedded image data.');
}
function appendDataUri(mime, bytes) { return `data:${mime};base64,${encodeBase64(bytes)}`; }
function gltfTextureDataUri(doc, buffer, textureIndex) {
  const texture = Number.isInteger(textureIndex) ? doc.textures?.[textureIndex] : null;
  const image = Number.isInteger(texture?.source) ? doc.images?.[texture.source] : null;
  if (typeof image?.uri === 'string' && /^data:image\/(?:png|jpeg|webp);base64,/i.test(image.uri)) return image.uri;
  if (!Number.isInteger(image?.bufferView)) return null;
  const view = doc.bufferViews?.[image.bufferView]; if (!view || view.buffer !== 0) return null;
  const start = Number(view.byteOffset || 0), end = start + Number(view.byteLength || 0);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > buffer.length || end <= start || end - start > 4_000_000) return null;
  const mime = ['image/png','image/jpeg','image/webp'].includes(image.mimeType) ? image.mimeType : 'image/png';
  return appendDataUri(mime, buffer.subarray(start, end));
}
function quaternionToEuler(q) {
  const [x, y, z, w] = q;
  const sinr = 2 * (w * x + y * z), cosr = 1 - 2 * (x * x + y * y);
  const sinp = 2 * (w * y - z * x);
  const siny = 2 * (w * z + x * y), cosy = 1 - 2 * (y * y + z * z);
  return { x: Math.atan2(sinr, cosr), y: Math.asin(Math.max(-1, Math.min(1, sinp))), z: Math.atan2(siny, cosy) };
}
function parseGltfDocument(doc, buffer, name) {
  if (doc?.asset?.version?.split('.')[0] !== '2') throw new Error('Only glTF 2.x assets are supported.');
  if (!(buffer instanceof Uint8Array) || buffer.length > MAX_FILE_BYTES) throw new Error('glTF embedded binary data is missing or exceeds 32 MB.');
  const nodes = doc.nodes || [], meshes = doc.meshes || [], sceneNodeIndices = doc.scenes?.[doc.scene ?? 0]?.nodes || nodes.map((_, i) => i);
  const result = [], visit = (index, parent) => {
    const node = nodes[index]; if (!node) return;
    const translation = node.translation || [0, 0, 0], scale = node.scale || [1, 1, 1], rotation = node.rotation || [0, 0, 0, 1];
    const worldPosition = { x: parent.position.x + Number(translation[0] || 0), y: parent.position.y + Number(translation[1] || 0), z: parent.position.z + Number(translation[2] || 0) };
    const worldScale = { x: parent.scale.x * Number(scale[0] ?? 1), y: parent.scale.y * Number(scale[1] ?? 1), z: parent.scale.z * Number(scale[2] ?? 1) };
    if (Number.isInteger(node.mesh) && meshes[node.mesh]) {
      for (const [primitiveIndex, primitive] of (meshes[node.mesh].primitives || []).entries()) {
        if (primitive.mode !== undefined && primitive.mode !== 4) continue;
        const attrs = primitive.attributes || {}, posIndex = attrs.POSITION;
        if (!Number.isInteger(posIndex)) continue;
        const positions = readArrayBuffer(doc, buffer, doc.accessors?.[posIndex], 'VEC3', 'POSITION');
        const uvs = Number.isInteger(attrs.TEXCOORD_0) ? readArrayBuffer(doc, buffer, doc.accessors?.[attrs.TEXCOORD_0], 'VEC2', 'TEXCOORD_0') : null;
        let indices;
        if (Number.isInteger(primitive.indices)) indices = readArrayBuffer(doc, buffer, doc.accessors?.[primitive.indices], 'SCALAR', 'index');
        else indices = Array.from({ length: positions.length / 3 }, (_, i) => i);
        if (indices.length % 3 !== 0 || indices.length > 3_000_000) throw new Error('glTF primitive must contain a bounded triangle index list.');
        const geometry = [], flatUV = [];
        for (const indexValue of indices) {
          const idx = Number(indexValue);
          if (!Number.isInteger(idx) || idx < 0 || idx >= positions.length / 3) throw new Error('glTF index refers to a missing vertex.');
          geometry.push(positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2]);
          if (uvs) flatUV.push(uvs[idx * 2], uvs[idx * 2 + 1]);
        }
        const gltfMaterial = doc.materials?.[primitive.material] || {}, material = gltfMaterial.pbrMetallicRoughness || {};
        const factor = material.baseColorFactor || [0.49, 0.36, 1, 1];
        const color = '#' + factor.slice(0, 3).map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
        const emissive = (gltfMaterial.emissiveFactor || [0, 0, 0]).map(v => Math.max(0, Math.min(1, Number(v) || 0)));
        const emissiveFactorMax = Math.max(...emissive);
        const emissiveStrength = Math.max(0, Math.min(2, Number(gltfMaterial.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1)));
        const emissiveIntensity = emissiveFactorMax * emissiveStrength;
        const outMaterial = {
          metallic: Number(material.metallicFactor ?? 0),
          roughness: Number(material.roughnessFactor ?? 1),
          emissive: emissiveIntensity,
          emissiveTint: emissiveFactorMax > 0 ? emissive.map(v => v / emissiveFactorMax) : [1, 1, 1],
          aoStrength: Math.max(0, Math.min(1, Number(gltfMaterial.occlusionTexture?.strength ?? 1))),
          normalScale: Math.max(0, Math.min(4, Number(gltfMaterial.normalTexture?.scale ?? 1))),
          ...(Number.isFinite(Number(gltfMaterial.extras?.clearcoat)) ? { clearcoat: Math.max(0, Math.min(1, Number(gltfMaterial.extras.clearcoat))) } : {}),
          ...(gltfMaterial.extras?.materialGraph ? { materialGraph: gltfMaterial.extras.materialGraph } : {}),
        };
        const channelTextures = [
          ['baseColorImage', material.baseColorTexture?.index],
          ['metallicRoughnessImage', material.metallicRoughnessTexture?.index],
          ['aoImage', gltfMaterial.occlusionTexture?.index],
          ['emissiveImage', gltfMaterial.emissiveTexture?.index],
          ['normalImage', gltfMaterial.normalTexture?.index],
        ];
        for (const [field, index] of channelTextures) { const image = gltfTextureDataUri(doc, buffer, index); if (image) outMaterial[field] = image; }
        result.push({
          type: 'mesh',
          name: cleanName(node.name || meshes[node.mesh].name || `${name} ${primitiveIndex + 1}`),
          position: worldPosition,
          rotation: quaternionToEuler(rotation),
          scale: worldScale,
          size: 1,
          color,
          visible: node.extras?.visible !== false,
          geometry,
          ...(flatUV.length ? { uvs: flatUV } : {}),
          material: outMaterial,
          ...(gltfMaterial.extras?.materialGraph ? { materialGraph: gltfMaterial.extras.materialGraph } : {}),
          ...(node.extras?.collisionMode ? { collisionMode: String(node.extras.collisionMode) } : {}),
          ...(node.extras?.gameplayRole ? { gameplayRole: String(node.extras.gameplayRole) } : {}),
          ...(node.extras?.loreText ? { loreText: String(node.extras.loreText).slice(0, 240) } : {}),
          sourceFormat: 'glTF 2.0',
        });
      }
    }
    for (const child of node.children || []) visit(child, { position: worldPosition, scale: worldScale });
  };
  const uniqueRoots = [...new Set(sceneNodeIndices)];
  for (const root of uniqueRoots) visit(root, { position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } });
  if (!result.length) throw new Error('glTF asset does not contain a supported triangle mesh.');
  return result;
}

/** Parse self-contained GLB or .gltf with an embedded base64 buffer. */
export function importGLTF(input, name = 'Imported Model') {
  if (typeof input === 'string') {
    const doc = JSON.parse(input);
    if (!(doc.buffers || []).length) throw new Error('glTF file has no binary buffer.');
    const uri = doc.buffers[0].uri;
    if (!uri?.startsWith('data:') || !uri.includes(';base64,')) throw new Error('Only self-contained .gltf files with embedded base64 buffers are supported; use GLB for single-file model sharing.');
    const buffer = decodeBase64(uri.slice(uri.indexOf(';base64,') + 8));
    return parseGltfDocument(doc, buffer, cleanName(name));
  }
  const bytes = bytesOf(input);
  if (bytes.length > MAX_FILE_BYTES) throw new Error('GLB is limited to 32 MB.');
  if (bytes.length < 20) throw new Error('GLB file is truncated.');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Not a valid GLB file (wrong magic).');
  if (dv.getUint32(4, true) !== 2) throw new Error('Only GLB version 2 is supported.');
  if (dv.getUint32(8, true) !== bytes.length) throw new Error('GLB declared length does not match file size.');
  let offset = 12, document = null, binary = null;
  while (offset + 8 <= bytes.length) {
    const size = dv.getUint32(offset, true), type = dv.getUint32(offset + 4, true); offset += 8;
    if (size > bytes.length - offset) throw new Error('GLB chunk extends beyond the file.');
    const chunk = bytes.subarray(offset, offset + size);
    if (type === 0x4e4f534a && !document) { try { document = JSON.parse(new TextDecoder().decode(chunk).replace(/\0+$/g, '').trim()); } catch { throw new Error('GLB JSON chunk is malformed.'); } }
    else if (type === 0x004e4942 && !binary) binary = chunk;
    offset += size;
  }
  if (!document || !binary) throw new Error('GLB must contain JSON and BIN chunks.');
  return parseGltfDocument(document, binary, cleanName(name));
}

const align = (n, size = 4) => Math.ceil(n / size) * size;
function rgb(hex) {
  let h = String(hex || '#7c5cff').replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) h = '7c5cff';
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
}
function localGeometry(object) {
  const source = object.geometry;
  if (!(Array.isArray(source) || ArrayBuffer.isView(source)) || source.length < 9 || source.length % 9 !== 0 || !Array.from(source).every(Number.isFinite)) throw new Error('Export requires a valid triangle mesh. Convert a primitive to a mesh first.');
  return Array.from(source, Number);
}
function normalArray(g) {
  const out = [];
  for (let i = 0; i < g.length; i += 9) {
    const ux = g[i + 3] - g[i], uy = g[i + 4] - g[i + 1], uz = g[i + 5] - g[i + 2], vx = g[i + 6] - g[i], vy = g[i + 7] - g[i + 1], vz = g[i + 8] - g[i + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    out.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  }
  return out;
}
function quaternionFromEuler(r = {}) {
  const x = Number(r.x) || 0, y = Number(r.y) || 0, z = Number(r.z) || 0, cx = Math.cos(x / 2), sx = Math.sin(x / 2), cy = Math.cos(y / 2), sy = Math.sin(y / 2), cz = Math.cos(z / 2), sz = Math.sin(z / 2);
  return [sx * cy * cz - cx * sy * sz, cx * sy * cz + sx * cy * sz, cx * cy * sz - sx * sy * cz, cx * cy * cz + sx * sy * sz];
}
/** Export one triangle mesh to a self-contained glTF 2.0 binary (.glb) asset. */
export function exportGLB(object) {
  const g = localGeometry(object), count = g.length / 3;
  if (count > 700_000) throw new Error('Mesh is too large for a safe GLB export.');
  const uv = object.uvs && object.uvs.length === count * 2 ? Array.from(object.uvs, Number) : generateSimpleUv(g);
  const normals = normalArray(g);
  const indices = Array.from({ length: count }, (_, i) => i);
  const IndexCtor = count <= 65535 ? Uint16Array : Uint32Array;
  const chunks = [], views = [], accessors = []; let byteOffset = 0;
  const append = (array, componentType, type, minMax = null) => {
    const Ctor = array instanceof Float32Array || array instanceof Uint16Array || array instanceof Uint32Array ? array.constructor : Float32Array;
    const typed = array instanceof Ctor ? array : new Ctor(array);
    byteOffset = align(byteOffset); const start = byteOffset, bytes = new Uint8Array(typed.buffer.slice(typed.byteOffset, typed.byteOffset + typed.byteLength));
    if (start > chunks.reduce((s, c) => s + c.length, 0)) { const gap = start - chunks.reduce((s, c) => s + c.length, 0); chunks.push(new Uint8Array(gap)); }
    chunks.push(bytes); byteOffset = start + bytes.length;
    const viewIndex = views.length; views.push({ buffer: 0, byteOffset: start, byteLength: bytes.length });
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3 }[type], accessor = { bufferView: viewIndex, componentType, count: typed.length / comps, type };
    if (minMax) { accessor.min = minMax.min; accessor.max = minMax.max; }
    const accessorIndex = accessors.length; accessors.push(accessor); return accessorIndex;
  };
  const appendRaw = bytes => {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    byteOffset = align(byteOffset); const currentLength = chunks.reduce((sum, part) => sum + part.length, 0); if (byteOffset > currentLength) chunks.push(new Uint8Array(byteOffset - currentLength));
    const start = byteOffset; chunks.push(data); byteOffset = start + data.length; const viewIndex = views.length; views.push({ buffer: 0, byteOffset: start, byteLength: data.length }); return viewIndex;
  };
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < g.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], g[i + a]); max[a] = Math.max(max[a], g[i + a]); }
  const posAcc = append(new Float32Array(g), 5126, 'VEC3', { min, max });
  const normAcc = append(new Float32Array(normals), 5126, 'VEC3');
  const uvAcc = append(new Float32Array(uv), 5126, 'VEC2');
  const indexAcc = append(new IndexCtor(indices), count <= 65535 ? 5123 : 5125, 'SCALAR');
  const imageSpecs = [], textureIndices = {};
  const textureFields = [
    ['baseColorImage', 'baseColor'],
    ['metallicRoughnessImage', 'metallicRoughness'],
    ['aoImage', 'occlusion'],
    ['emissiveImage', 'emissive'],
    ['normalImage', 'normal'],
  ];
  for (const [field, role] of textureFields) {
    const source = object.material?.[field];
    const match = typeof source === 'string' ? source.match(/^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i) : null;
    if (!match) continue;
    const imageBytes = decodeBase64(match[2]);
    if (imageBytes.length > 4_000_000) throw new Error(`${role} textures are limited to 4 MB each for exported GLB assets.`);
    const textureIndex = imageSpecs.length;
    imageSpecs.push({ mimeType: match[1].toLowerCase(), bufferView: appendRaw(imageBytes) });
    textureIndices[field] = textureIndex;
  }
  const binaryLength = align(chunks.reduce((s, c) => s + c.length, 0));
  const binary = new Uint8Array(binaryLength); let cursor = 0; for (const chunk of chunks) { binary.set(chunk, cursor); cursor += chunk.length; }
  const material = object.material || {}, c = rgb(object.color), size = Number(object.size ?? 1) || 1, scale = object.scale || { x: 1, y: 1, z: 1 };
  const pbr = { baseColorFactor: [...c, 1], metallicFactor: Math.max(0, Math.min(1, Number(material.metallic) || 0)), roughnessFactor: Math.max(0.04, Math.min(1, Number(material.roughness ?? 0.68))) };
  if (textureIndices.baseColorImage !== undefined) pbr.baseColorTexture = { index: textureIndices.baseColorImage, texCoord: 0 };
  if (textureIndices.metallicRoughnessImage !== undefined) pbr.metallicRoughnessTexture = { index: textureIndices.metallicRoughnessImage, texCoord: 0 };
  const emissiveTint = Array.isArray(material.emissiveTint) && material.emissiveTint.length >= 3 ? material.emissiveTint.slice(0, 3).map(v => Math.max(0, Math.min(1, Number.isFinite(Number(v)) ? Number(v) : 1))) : [1, 1, 1];
  const emissiveIntensity = Math.max(0, Math.min(2, Number(material.emissive) || 0));
  const emissiveFactor = emissiveIntensity > 1 ? [...emissiveTint] : emissiveTint.map(v => Math.max(0, Math.min(1, v * emissiveIntensity)));
  const materialExtras = {};
  if (Number.isFinite(Number(material.clearcoat))) materialExtras.clearcoat = Math.max(0, Math.min(1, Number(material.clearcoat)));
  const matGraph = object.materialGraph || material.materialGraph;
  if (matGraph && typeof matGraph === 'object') materialExtras.materialGraph = matGraph;
  const materialDoc = {
    name: `${cleanName(object.name)} Material`,
    pbrMetallicRoughness: pbr,
    emissiveFactor,
    ...(emissiveIntensity > 1 ? { extensions: { KHR_materials_emissive_strength: { emissiveStrength: emissiveIntensity } } } : {}),
    ...(Object.keys(materialExtras).length ? { extras: materialExtras } : {}),
  };
  if (textureIndices.aoImage !== undefined) materialDoc.occlusionTexture = { index: textureIndices.aoImage, texCoord: 0, strength: Math.max(0, Math.min(1, Number(material.aoStrength ?? 1))) };
  if (textureIndices.emissiveImage !== undefined) materialDoc.emissiveTexture = { index: textureIndices.emissiveImage, texCoord: 0 };
  if (textureIndices.normalImage !== undefined) materialDoc.normalTexture = { index: textureIndices.normalImage, texCoord: 0, scale: Math.max(0, Math.min(4, Number(material.normalScale ?? 1))) };
  const nodeExtras = {};
  if (object.visible === false) nodeExtras.visible = false;
  if (object.collisionMode) nodeExtras.collisionMode = String(object.collisionMode);
  if (object.gameplayRole) nodeExtras.gameplayRole = String(object.gameplayRole);
  if (object.loreText) nodeExtras.loreText = String(object.loreText).slice(0, 240);
  const document = {
    asset: { version: '2.0', generator: 'Orvexa Forge' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{
      name: cleanName(object.name),
      mesh: 0,
      translation: [Number(object.position?.x) || 0, Number(object.position?.y) || 0, Number(object.position?.z) || 0],
      rotation: quaternionFromEuler(object.rotation),
      scale: [(Number(scale.x) || 1) * size, (Number(scale.y) || 1) * size, (Number(scale.z) || 1) * size],
      ...(Object.keys(nodeExtras).length ? { extras: nodeExtras } : {}),
    }],
    meshes: [{ name: cleanName(object.name), primitives: [{ attributes: { POSITION: posAcc, NORMAL: normAcc, TEXCOORD_0: uvAcc }, indices: indexAcc, material: 0, mode: 4 }] }],
    materials: [materialDoc],
    buffers: [{ byteLength: binary.length }],
    bufferViews: views,
    accessors,
  };
  if (emissiveIntensity > 1) document.extensionsUsed = ['KHR_materials_emissive_strength'];
  if (imageSpecs.length) { document.images = imageSpecs; document.samplers = [{ magFilter: 9729, minFilter: 9729, wrapS: 10497, wrapT: 10497 }]; document.textures = imageSpecs.map((_, index) => ({ sampler: 0, source: index })); }
  let json = new TextEncoder().encode(JSON.stringify(document)); const jsonLength = align(json.length); const jsonChunk = new Uint8Array(jsonLength); jsonChunk.fill(0x20); jsonChunk.set(json);
  const totalLength = 12 + 8 + jsonChunk.length + 8 + binary.length;
  const out = new Uint8Array(totalLength), dv = new DataView(out.buffer); dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, totalLength, true); dv.setUint32(12, jsonChunk.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(jsonChunk, 20); const binHeader = 20 + jsonChunk.length; dv.setUint32(binHeader, binary.length, true); dv.setUint32(binHeader + 4, 0x004e4942, true); out.set(binary, binHeader + 8);
  return out;
}
function generateSimpleUv(g) {
  const out = [];
  for (let i = 0; i < g.length; i += 9) {
    const ax = g[i], ay = g[i + 1], az = g[i + 2], bx = g[i + 3], by = g[i + 4], bz = g[i + 5], cx = g[i + 6], cy = g[i + 7], cz = g[i + 8];
    const nx = Math.abs((by - ay) * (cz - az) - (bz - az) * (cy - ay)), ny = Math.abs((bz - az) * (cx - ax) - (bx - ax) * (cz - az)), nz = Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
    const axis = nx >= ny && nx >= nz ? [2, 1] : ny >= nx && ny >= nz ? [0, 2] : [0, 1]; const points = [[ax, ay, az], [bx, by, bz], [cx, cy, cz]], u0 = Math.min(...points.map(p => p[axis[0]])), u1 = Math.max(...points.map(p => p[axis[0]])), v0 = Math.min(...points.map(p => p[axis[1]])), v1 = Math.max(...points.map(p => p[axis[1]]));
    for (const p of points) out.push((p[axis[0]] - u0) / Math.max(1e-6, u1 - u0), (p[axis[1]] - v0) / Math.max(1e-6, v1 - v0));
  }
  return out;
}

/** Export a mesh as a simple ASCII FBX 7.4 geometry/model pair (no textures/skin animations). */
export function exportFBX(object) {
  const g = localGeometry(object), name = cleanName(object.name, 'OrvexaMesh').replace(/\s/g, '_');
  if (g.length / 3 > 250_000) throw new Error('FBX export is limited to 250,000 mesh vertices.');
  const p = object.position || { x: 0, y: 0, z: 0 }, r = object.rotation || {}, s = object.scale || { x: 1, y: 1, z: 1 }, size = Number(object.size ?? 1) || 1;
  const vertices = [];
  for (let i = 0; i < g.length; i += 3) {
    let x = g[i] * size * (Number(s.x) || 1), y = g[i + 1] * size * (Number(s.y) || 1), z = g[i + 2] * size * (Number(s.z) || 1);
    const rx = Number(r.x) || 0, ry = Number(r.y) || 0, rz = Number(r.z) || 0;
    let yy = y * Math.cos(rx) - z * Math.sin(rx), zz = y * Math.sin(rx) + z * Math.cos(rx); y = yy; z = zz;
    let xx = x * Math.cos(ry) + z * Math.sin(ry); zz = -x * Math.sin(ry) + z * Math.cos(ry); x = xx; z = zz;
    xx = x * Math.cos(rz) - y * Math.sin(rz); yy = x * Math.sin(rz) + y * Math.cos(rz); x = xx; y = yy;
    vertices.push((x + (Number(p.x) || 0)).toFixed(6), (y + (Number(p.y) || 0)).toFixed(6), (z + (Number(p.z) || 0)).toFixed(6));
  }
  const indices = Array.from({ length: g.length / 3 }, (_, i) => i); for (let i = 2; i < indices.length; i += 3) indices[i] = -indices[i] - 1;
  const arrayBlock = (label, values) => `${label}: *${values.length} {\n a: ${values.join(',')}\n}`;
  return `; FBX 7.4.0 project file - generated by Orvexa Forge\nFBXHeaderExtension:  {\n FBXHeaderVersion: 1003\n FBXVersion: 7400\n Creator: "Orvexa Forge"\n}\nGlobalSettings:  {\n Version: 1000\n Properties70:  {\n  P: "UpAxis", "int", "Integer", "",1\n  P: "UpAxisSign", "int", "Integer", "",1\n  P: "FrontAxis", "int", "Integer", "",2\n  P: "FrontAxisSign", "int", "Integer", "",-1\n  P: "CoordAxis", "int", "Integer", "",0\n  P: "CoordAxisSign", "int", "Integer", "",1\n }\n}\nDefinitions:  {\n Version: 100\n Count: 2\n ObjectType: "Geometry" { Count: 1 }\n ObjectType: "Model" { Count: 1 }\n}\nObjects:  {\n Geometry: 100000, "Geometry::${name}", "Mesh" {\n  ${arrayBlock('Vertices', vertices)}\n  ${arrayBlock('PolygonVertexIndex', indices)}\n }\n Model: 100001, "Model::${name}", "Mesh" {\n  Version: 232\n  Properties70:  {\n   P: "Lcl Translation", "Lcl Translation", "A", "",0,0,0\n  }\n  Shading: T\n  Culling: "CullingOff"\n }\n}\nConnections:  {\n C: "OO",100000,100001\n}\n`;
}

/** Import a conservative ASCII FBX mesh pair. Binary FBX is deliberately rejected with a clear message. */
export function importFBX(text, name = 'Imported FBX') {
  if (typeof text !== 'string') throw new TypeError('FBX source must be text.');
  if (text.length > MAX_FILE_BYTES) throw new Error('FBX file is limited to 32 MB.');
  if (text.startsWith('Kaydara FBX Binary')) throw new Error('Binary FBX is not supported in the lightweight offline engine yet. Re-export as ASCII FBX 7.x or GLB.');
  const readArray = label => {
    const match = text.match(new RegExp(`${label}:\\s*\\*\\d+\\s*\\{\\s*a:\\s*([\\s\\S]*?)\\}`));
    if (!match) throw new Error(`ASCII FBX is missing the ${label} array.`);
    const values = match[1].split(/[\s,]+/).filter(Boolean).map(Number);
    if (!values.length || values.some(v => !Number.isFinite(v))) throw new Error(`ASCII FBX ${label} array is malformed.`);
    return values;
  };
  const vertices = readArray('Vertices'), polygonIndices = readArray('PolygonVertexIndex');
  if (vertices.length % 3 !== 0 || vertices.length / 3 > 250_000) throw new Error('FBX vertex array has an invalid size.');
  const polygons = []; let polygon = [];
  for (const raw of polygonIndices) {
    const index = raw < 0 ? -raw - 1 : raw;
    if (!Number.isInteger(index) || index < 0 || index >= vertices.length / 3) throw new Error('FBX polygon references a missing vertex.');
    polygon.push(index);
    if (raw < 0) { if (polygon.length >= 3) polygons.push(polygon); polygon = []; }
    if (polygons.length > 750_000) throw new Error('FBX exceeds the safe polygon limit.');
  }
  const geometry = [];
  for (const poly of polygons) for (let i = 1; i < poly.length - 1; i++) for (const id of [poly[0], poly[i], poly[i + 1]]) geometry.push(vertices[id * 3], vertices[id * 3 + 1], vertices[id * 3 + 2]);
  if (!geometry.length) throw new Error('FBX has no supported polygon mesh.');
  return [{ type: 'mesh', name: cleanName(name), position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, size: 1, color: '#7c5cff', geometry, material: { metallic: 0, roughness: 0.72, emissive: 0 }, sourceFormat: 'ASCII FBX' }];
}

/** Validate a mesh asset and return a structured report covering geometry, UVs, textures, and Material Lab graph metadata. */
export function validateMeshAsset(object) {
  const warnings = [];
  const g = object?.geometry;
  if (!object || object.type !== 'mesh' || !(Array.isArray(g) || ArrayBuffer.isView(g)) || g.length < 9 || g.length % 9 !== 0) {
    return { ok: false, vertexCount: 0, triangleCount: 0, hasUVs: false, hasMaterialGraph: false, textureChannels: [], warnings: ['Object is not a valid triangle mesh.'] };
  }
  const vertexCount = g.length / 3;
  const triangleCount = g.length / 9;
  const hasUVs = Array.isArray(object.uvs) && object.uvs.length === vertexCount * 2;
  if (!hasUVs) warnings.push('Missing explicit UVs; automatic planar UVs will be generated on export.');
  const mat = object.material || {};
  const textureChannels = ['baseColorImage', 'metallicRoughnessImage', 'aoImage', 'emissiveImage', 'normalImage'].filter(ch => typeof mat[ch] === 'string' && mat[ch].startsWith('data:image/'));
  const hasMaterialGraph = Boolean(object.materialGraph && Array.isArray(object.materialGraph.nodes));
  if (triangleCount > 100_000) warnings.push('High triangle count (>100k); consider decimating before real-time world streaming.');
  return {
    ok: true,
    vertexCount,
    triangleCount,
    hasUVs,
    hasMaterialGraph,
    textureChannels,
    warnings,
  };
}

