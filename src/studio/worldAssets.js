/** Shared asset bridge between Orvexa Modeler and the Aetherfall game. */
export const WORLD_ASSETS_STORAGE_KEY = 'orvexa-aetherfall-world-assets-v1';
export const WORLD_ASSET_SCHEMA = 'orvexa-aetherfall-assets';
export const WORLD_ASSET_MAX_OBJECTS = 24;
export const WORLD_ASSET_MAX_FLOATS = 360_000;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const safeVector = (value, fallback, limits = [-2000, 2000]) => ({
  x: clamp(finite(value?.x, fallback.x), limits[0], limits[1]),
  y: clamp(finite(value?.y, fallback.y), limits[0], limits[1]),
  z: clamp(finite(value?.z, fallback.z), limits[0], limits[1]),
});
const safeColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : '#8b9b80';
const ALLOWED_COLLISION_MODES = new Set(['solid', 'none', 'platform']);
const ALLOWED_GAMEPLAY_ROLES = new Set(['prop', 'landmark', 'lore-shrine', 'beacon-totem']);

/** Build a compact, validated package from the selected, evaluated Modeler meshes. */
export function createWorldAssetPackage(objects, selectedIds = []) {
  const selection = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const selected = (Array.isArray(objects) ? objects : []).filter(obj => obj && obj.type === 'mesh' && obj.visible !== false && selection.has(obj.engineId));
  if (!selected.length) throw new Error('Select one or more visible mesh objects before publishing to Aetherfall.');
  if (selected.length > WORLD_ASSET_MAX_OBJECTS) throw new Error(`Publish up to ${WORLD_ASSET_MAX_OBJECTS} mesh objects at a time.`);
  let totalFloats = 0;
  const assets = selected.map((obj, index) => {
    const geometry = obj.geometry || obj.baseGeometry;
    if (!(Array.isArray(geometry) || ArrayBuffer.isView(geometry)) || geometry.length < 9 || geometry.length % 9 !== 0 || !Array.from(geometry).every(Number.isFinite)) {
      throw new Error(`"${String(obj.name || `Mesh ${index + 1}`).slice(0, 60)}" has invalid triangle geometry.`);
    }
    totalFloats += geometry.length;
    if (totalFloats > WORLD_ASSET_MAX_FLOATS) throw new Error('Published meshes exceed the 360,000-float world budget. Reduce subdivision or publish fewer meshes.');
    const material = obj.material || {};
    const collisionMode = ALLOWED_COLLISION_MODES.has(obj.collisionMode) ? obj.collisionMode : 'solid';
    const gameplayRole = ALLOWED_GAMEPLAY_ROLES.has(obj.gameplayRole) ? obj.gameplayRole : 'prop';
    return {
      id: String(obj.engineId || `mesh-${index + 1}`).slice(0, 100),
      name: String(obj.name || `World Mesh ${index + 1}`).slice(0, 100),
      geometry: Array.from(geometry),
      position: safeVector(obj.position, { x: 0, y: 0, z: 0 }),
      rotation: safeVector(obj.rotation, { x: 0, y: 0, z: 0 }, [-Math.PI * 16, Math.PI * 16]),
      scale: safeVector(obj.scale, { x: 1, y: 1, z: 1 }, [0.01, 100]),
      size: clamp(finite(obj.size, 1), 0.01, 100),
      color: safeColor(obj.previewColor || obj.color),
      collisionMode,
      gameplayRole,
      loreText: String(obj.loreText || '').slice(0, 240),
      material: {
        metallic: clamp(finite(material.metallic, 0.05), 0, 1),
        roughness: clamp(finite(material.roughness, 0.68), 0.04, 1),
        emissive: clamp(finite(material.emissive, 0), 0, 4),
        clearcoat: clamp(finite(material.clearcoat, 0), 0, 1),
        aoStrength: clamp(finite(material.aoStrength, 1), 0, 1),
        normalScale: clamp(finite(material.normalScale, 1), 0, 4),
        preset: String(obj.materialGraph?.preset || material.preset || 'custom').slice(0, 48),
        ...((obj.materialGraph || material.materialGraph) ? { materialGraph: obj.materialGraph || material.materialGraph } : {}),
      },
    };
  });
  const result = { schema: WORLD_ASSET_SCHEMA, version: 1, updatedAt: new Date().toISOString(), source: 'Orvexa Modeler', assets };
  if (JSON.stringify(result).length > 2_800_000) throw new Error('Published world assets are too large for reliable browser storage. Reduce mesh complexity.');
  return result;
}

/** Validate persisted/imported world assets before using their geometry in the renderer. */
export function normalizeWorldAssetPackage(input) {
  let parsed = input;
  if (typeof input === 'string') {
    if (input.length > 2_800_000) throw new Error('World asset package is larger than 2.8 MB.');
    parsed = JSON.parse(input);
  }
  if (!parsed || parsed.schema !== WORLD_ASSET_SCHEMA || parsed.version !== 1 || !Array.isArray(parsed.assets)) {
    throw new Error('Unsupported Aetherfall world asset package. Publish the mesh again from Orvexa Modeler.');
  }
  if (parsed.assets.length > WORLD_ASSET_MAX_OBJECTS) throw new Error('World asset package contains too many objects.');
  let totalFloats = 0;
  const assets = parsed.assets.map((raw, index) => {
    const geometry = raw?.geometry;
    if (!(Array.isArray(geometry) || ArrayBuffer.isView(geometry)) || geometry.length < 9 || geometry.length % 9 !== 0 || !Array.from(geometry).every(Number.isFinite)) {
      throw new Error(`Published mesh ${index + 1} has invalid geometry.`);
    }
    totalFloats += geometry.length;
    if (totalFloats > WORLD_ASSET_MAX_FLOATS) throw new Error('World asset package exceeds the geometry budget.');
    const collisionMode = ALLOWED_COLLISION_MODES.has(raw.collisionMode) ? raw.collisionMode : 'solid';
    const gameplayRole = ALLOWED_GAMEPLAY_ROLES.has(raw.gameplayRole) ? raw.gameplayRole : 'prop';
    return {
      id: String(raw.id || `mesh-${index + 1}`).slice(0, 100),
      name: String(raw.name || `World Mesh ${index + 1}`).slice(0, 100),
      geometry: Array.from(geometry),
      position: safeVector(raw.position, { x: 0, y: 0, z: 0 }),
      rotation: safeVector(raw.rotation, { x: 0, y: 0, z: 0 }, [-Math.PI * 16, Math.PI * 16]),
      scale: safeVector(raw.scale, { x: 1, y: 1, z: 1 }, [0.01, 100]),
      size: clamp(finite(raw.size, 1), 0.01, 100),
      color: safeColor(raw.color),
      collisionMode,
      gameplayRole,
      loreText: String(raw.loreText || '').slice(0, 240),
      material: {
        metallic: clamp(finite(raw.material?.metallic, 0.05), 0, 1),
        roughness: clamp(finite(raw.material?.roughness, 0.68), 0.04, 1),
        emissive: clamp(finite(raw.material?.emissive, 0), 0, 4),
        clearcoat: clamp(finite(raw.material?.clearcoat, 0), 0, 1),
        aoStrength: clamp(finite(raw.material?.aoStrength, 1), 0, 1),
        normalScale: clamp(finite(raw.material?.normalScale, 1), 0, 4),
        preset: String(raw.material?.preset || 'custom').slice(0, 48),
      },
    };
  });
  return { schema: WORLD_ASSET_SCHEMA, version: 1, updatedAt: String(parsed.updatedAt || ''), source: 'Orvexa Modeler', assets };
}

/** Applies the same T · Rz · Ry · Rx · S transform order as the Orvexa scene renderer. */
export function transformWorldAssetVertex(vertex, asset) {
  let [x, y, z] = vertex;
  const scale = asset.scale || { x: 1, y: 1, z: 1 }, size = clamp(finite(asset.size, 1), 0.01, 100);
  x *= clamp(finite(scale.x, 1), 0.01, 100) * size;
  y *= clamp(finite(scale.y, 1), 0.01, 100) * size;
  z *= clamp(finite(scale.z, 1), 0.01, 100) * size;
  const r = asset.rotation || { x: 0, y: 0, z: 0 };
  let c = Math.cos(finite(r.x)), s = Math.sin(finite(r.x)); [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(finite(r.y)); s = Math.sin(finite(r.y)); [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(finite(r.z)); s = Math.sin(finite(r.z)); [x, y] = [x * c - y * s, x * s + y * c];
  const p = asset.position || { x: 0, y: 0, z: 0 };
  return [x + finite(p.x), y + finite(p.y), z + finite(p.z)];
}
