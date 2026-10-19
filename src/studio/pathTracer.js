import { createMeshGeometry } from './scene3d.js';

/**
 * Dependency-free CPU progressive path tracer. It traces actual scene triangles,
 * shadow rays and diffuse/specular bounces. Intended for offline previews, not realtime 4K rendering.
 */
const EPS = 1e-4;
const MAX_TRIANGLES = 45_000;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const v3 = (v, fallback = [0, 0, 0]) => [0, 1, 2].map((i) => Number.isFinite(Number(v?.[i] ?? (i === 0 ? v?.x : i === 1 ? v?.y : v?.z))) ? Number(v?.[i] ?? (i === 0 ? v?.x : i === 1 ? v?.y : v?.z)) : fallback[i]);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const had = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (length(a) || 1));
const luminance = (c) => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;

function hexColor(value, fallback = [0.48, 0.38, 0.95]) {
  let text = String(value || '').trim();
  if (/^#[\da-f]{3}$/i.test(text)) text = '#' + [...text.slice(1)].map((ch) => ch + ch).join('');
  if (!/^#[\da-f]{6}$/i.test(text)) return fallback;
  const rgb = [1, 3, 5].map((i) => parseInt(text.slice(i, i + 2), 16) / 255);
  return rgb.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
}

function transformLocal(point, object) {
  const position = v3(object.position), scale = v3(object.scale, [1, 1, 1]);
  const factor = Number(object.size ?? object.radius ?? 1) || 1;
  let [x, y, z] = [point[0] * scale[0] * factor, point[1] * scale[1] * factor, point[2] * scale[2] * factor];
  const rotation = object.rotation || {};
  const rx = Number(rotation.x) || 0, ry = Number(rotation.y) || 0, rz = Number(rotation.z) || 0;
  const x1 = x, y1 = y * Math.cos(rx) - z * Math.sin(rx), z1 = y * Math.sin(rx) + z * Math.cos(rx);
  const x2 = x1 * Math.cos(ry) + z1 * Math.sin(ry), y2 = y1, z2 = -x1 * Math.sin(ry) + z1 * Math.cos(ry);
  return [x2 * Math.cos(rz) - y2 * Math.sin(rz) + position[0], x2 * Math.sin(rz) + y2 * Math.cos(rz) + position[1], z2 + position[2]];
}

async function loadBaseColorTextures(scene) {
  const decoded = new Map();
  if (typeof document === 'undefined' || typeof Image === 'undefined') return decoded;
  let pixelBudget = 2_000_000;
  const objects = (scene?.objects || []).filter(object => typeof object?.material?.baseColorImage === 'string' && /^data:image\/(?:png|jpeg|webp);base64,/i.test(object.material.baseColorImage)).slice(0, 32);
  for (const object of objects) {
    if (pixelBudget <= 0) break;
    const source = object.material.baseColorImage;
    if (source.length > 1_400_000) continue;
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Texture decode failed'));
        img.src = source;
      });
      const budget = Math.min(pixelBudget, 1_000_000);
      const ratio = Math.min(1, 1024 / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height), Math.sqrt(budget / Math.max(1, (image.naturalWidth || image.width) * (image.naturalHeight || image.height))));
      const width = Math.max(1, Math.floor((image.naturalWidth || image.width) * ratio));
      const height = Math.max(1, Math.floor((image.naturalHeight || image.height) * ratio));
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      ctx.drawImage(image, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height).data;
      decoded.set(object, { width, height, pixels });
      pixelBudget -= width * height;
    } catch { /* Broken/corrupt image textures fall back to the object's constant base colour. */ }
  }
  return decoded;
}

function sceneTriangles(scene, decodedTextures = new Map()) {
  const triangles = [];
  for (const object of scene?.objects || []) {
    if (!object || object.visible === false || ['camera', 'light', 'animation', 'rigidbody', 'material', 'controller'].includes(object.type)) continue;
    let geometry;
    if ((Array.isArray(object.geometry) || ArrayBuffer.isView(object.geometry)) && object.geometry.length >= 9 && object.geometry.length % 9 === 0) geometry = object.geometry;
    else geometry = createMeshGeometry(['cube', 'sphere', 'plane', 'cylinder', 'cone', 'torus', 'pyramid', 'capsule'].includes(object.type) ? object.type : 'cube', 12);
    if (geometry.length / 9 + triangles.length > MAX_TRIANGLES) throw new Error(`Path tracer safety limit is ${MAX_TRIANGLES.toLocaleString()} triangles. Reduce mesh density or split this scene.`);
    const baseColor = hexColor(object.color), material = object.material || {}, texture = decodedTextures.get(object) || null;
    let uvs = object.uvs;
    if (texture && (!(Array.isArray(uvs) || ArrayBuffer.isView(uvs)) || uvs.length !== geometry.length / 3 * 2)) {
      // Procedural primitives receive a basic per-triangle planar map when textured.
      uvs = [];
      for (let offset = 0; offset < geometry.length; offset += 9) {
        const pts = [[geometry[offset], geometry[offset + 1], geometry[offset + 2]], [geometry[offset + 3], geometry[offset + 4], geometry[offset + 5]], [geometry[offset + 6], geometry[offset + 7], geometry[offset + 8]]];
        const spans = [0, 1, 2].map(axis => Math.max(...pts.map(point => point[axis])) - Math.min(...pts.map(point => point[axis])));
        const normalAxis = spans.indexOf(Math.min(...spans)); const other = [0, 1, 2].filter(value => value !== normalAxis);
        const mins = other.map(a => Math.min(...pts.map(point => point[a]))), maxs = other.map(a => Math.max(...pts.map(point => point[a])));
        for (const point of pts) uvs.push((point[other[0]] - mins[0]) / Math.max(1e-6, maxs[0] - mins[0]), (point[other[1]] - mins[1]) / Math.max(1e-6, maxs[1] - mins[1]));
      }
    }
    const metallic = clamp(Number(material.metallic) || 0, 0, 1), roughness = clamp(Number(material.roughness ?? 0.7), 0.04, 1), emissive = Math.max(0, Math.min(8, Number(material.emissive) || 0));
    for (let i = 0; i < geometry.length; i += 9) {
      const a = transformLocal([Number(geometry[i]), Number(geometry[i + 1]), Number(geometry[i + 2])], object);
      const b = transformLocal([Number(geometry[i + 3]), Number(geometry[i + 4]), Number(geometry[i + 5])], object);
      const c = transformLocal([Number(geometry[i + 6]), Number(geometry[i + 7]), Number(geometry[i + 8])], object);
      if (![...a, ...b, ...c].every(Number.isFinite)) continue;
      const normal = norm(cross(sub(b, a), sub(c, a)));
      if (length(normal) < 1e-8) continue;
      const pts = [a, b, c];
      const triangleIndex = i / 9, uvOffset = triangleIndex * 6;
      const triangleUVs = texture && uvs && uvs.length >= uvOffset + 6 ? [0, 1, 2, 3, 4, 5].map(offset => Number(uvs[uvOffset + offset])) : null;
      const usableUVs = triangleUVs && triangleUVs.every(Number.isFinite) ? triangleUVs : null;
      triangles.push({ a, b, c, normal, albedo: baseColor, texture: usableUVs ? texture : null, uvs: usableUVs, metallic, roughness, emission: mul(baseColor, emissive), min: [0, 1, 2].map(k => Math.min(a[k], b[k], c[k])), max: [0, 1, 2].map(k => Math.max(a[k], b[k], c[k])), centroid: [0, 1, 2].map(k => (a[k] + b[k] + c[k]) / 3), objectName: String(object.name || object.type || 'mesh'), pts });
    }
  }
  return triangles;
}

function boundsOf(tris) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const tri of tris) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], tri.min[k]); max[k] = Math.max(max[k], tri.max[k]); }
  return { min, max };
}
function buildBVH(tris, depth = 0) {
  const bounds = boundsOf(tris);
  if (tris.length <= 8 || depth >= 28) return { ...bounds, tris };
  const span = bounds.max.map((v, i) => v - bounds.min[i]);
  const axis = span[0] >= span[1] && span[0] >= span[2] ? 0 : span[1] >= span[2] ? 1 : 2;
  const sorted = [...tris].sort((a, b) => a.centroid[axis] - b.centroid[axis]);
  const mid = Math.floor(sorted.length / 2);
  if (mid <= 0 || mid >= sorted.length) return { ...bounds, tris };
  return { ...bounds, left: buildBVH(sorted.slice(0, mid), depth + 1), right: buildBVH(sorted.slice(mid), depth + 1) };
}
function hitBounds(origin, dir, min, max, maxT) {
  let low = EPS, high = maxT;
  for (let axis = 0; axis < 3; axis++) {
    const d = dir[axis];
    if (Math.abs(d) < 1e-12) { if (origin[axis] < min[axis] || origin[axis] > max[axis]) return false; continue; }
    const inv = 1 / d, t0 = (min[axis] - origin[axis]) * inv, t1 = (max[axis] - origin[axis]) * inv;
    low = Math.max(low, Math.min(t0, t1)); high = Math.min(high, Math.max(t0, t1));
    if (high < low) return false;
  }
  return true;
}
function hitTriangle(ray, tri, maxT) {
  const e1 = sub(tri.b, tri.a), e2 = sub(tri.c, tri.a), p = cross(ray.dir, e2), det = dot(e1, p);
  if (Math.abs(det) < 1e-9) return null;
  const inv = 1 / det, tvec = sub(ray.origin, tri.a), u = dot(tvec, p) * inv;
  if (u < 0 || u > 1) return null;
  const q = cross(tvec, e1), v = dot(ray.dir, q) * inv;
  if (v < 0 || u + v > 1) return null;
  const t = dot(e2, q) * inv;
  if (t < EPS || t >= maxT) return null;
  let normal = tri.normal;
  if (dot(normal, ray.dir) > 0) normal = mul(normal, -1);
  let albedo = tri.albedo;
  if (tri.texture && tri.uvs) {
    const texU = tri.uvs[0] * (1 - u - v) + tri.uvs[2] * u + tri.uvs[4] * v;
    const texV = tri.uvs[1] * (1 - u - v) + tri.uvs[3] * u + tri.uvs[5] * v;
    const tx = Math.min(tri.texture.width - 1, Math.max(0, Math.floor(((texU % 1 + 1) % 1) * tri.texture.width)));
    const ty = Math.min(tri.texture.height - 1, Math.max(0, Math.floor((1 - ((texV % 1 + 1) % 1)) * tri.texture.height)));
    const pixel = (ty * tri.texture.width + tx) * 4, rgba = tri.texture.pixels;
    const texel = [0, 1, 2].map(channel => { const value = rgba[pixel + channel] / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
    albedo = had(albedo, texel);
  }
  return { t, point: add(ray.origin, mul(ray.dir, t)), normal, tri, albedo, barycentric: [1 - u - v, u, v], front: dot(tri.normal, ray.dir) < 0 };
}
function intersectBVH(node, ray, current = null) {
  if (!node || !hitBounds(ray.origin, ray.dir, node.min, node.max, current?.t ?? Infinity)) return current;
  let hit = current;
  if (node.tris) {
    for (const tri of node.tris) { const candidate = hitTriangle(ray, tri, hit?.t ?? Infinity); if (candidate) hit = candidate; }
    return hit;
  }
  hit = intersectBVH(node.left, ray, hit);
  return intersectBVH(node.right, ray, hit);
}
function randomSource(seed) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function cosineHemisphere(normal, random) {
  const r = Math.sqrt(random()), phi = 2 * Math.PI * random(), local = [r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(Math.max(0, 1 - r * r))];
  const helper = Math.abs(normal[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0], tangent = norm(cross(helper, normal)), bitangent = cross(normal, tangent);
  return norm(add(add(mul(tangent, local[0]), mul(bitangent, local[1])), mul(normal, local[2])));
}
function reflect(direction, normal) { return sub(direction, mul(normal, 2 * dot(direction, normal))); }
function skyColor(direction) { const t = clamp(direction[1] * 0.5 + 0.5, 0, 1); return [0.07 + 0.24 * t, 0.08 + 0.35 * t, 0.12 + 0.55 * t]; }
/** Normalize shared scene lights for the offline renderer; type, direction, cone and range are retained. */
export function normalizePathTracerLights(scene) {
  const lights = (scene?.objects || []).filter(o => o?.type === 'light' && o.visible !== false).slice(0, 8).map(o => {
    const type = ['point', 'directional', 'spot'].includes(o.lightType) ? o.lightType : 'point';
    let direction = v3(o.direction, [0, -1, 0]);
    direction = norm(direction);
    if (length(direction) < 1e-8) direction = [0, -1, 0];
    const inner = clamp(Number(o.innerCone ?? 15), 0, 88) * Math.PI / 180;
    const outer = clamp(Number(o.outerCone ?? 35), Math.max(1, Number(o.innerCone ?? 15) + 1), 89) * Math.PI / 180;
    return {
      type, position: v3(o.position), direction,
      color: hexColor(o.color, [1, 0.95, 0.85]),
      intensity: clamp(Number(o.intensity ?? o.power ?? 32), 0, 5000),
      range: clamp(Number(o.range ?? 500), 0.1, 500),
      innerCone: inner, outerCone: outer,
      radius: clamp(Number(o.radius ?? o.sourceRadius ?? 0), 0, 10),
    };
  });
  if (!lights.length) lights.push({ type: 'point', position: [3.5, 6, 4.5], direction: norm([-3.5, -6, -4.5]), color: [1, 0.93, 0.82], intensity: 42, range: 500, innerCone: 0, outerCone: Math.PI / 4, radius: 0 });
  return lights;
}

function sampleLightPosition(light, random) {
  if (!(light.radius > 0)) return light.position;
  const z = random() * 2 - 1, phi = random() * Math.PI * 2, radial = Math.sqrt(Math.max(0, 1 - z * z)) * light.radius;
  return [light.position[0] + Math.cos(phi) * radial, light.position[1] + z * light.radius, light.position[2] + Math.sin(phi) * radial];
}

/** Cook-Torrance direct light with point, directional, spot, range falloff and sampled soft shadows. */
export function directLighting(hit, bvh, lights, viewDirection, random = Math.random) {
  let result = [0, 0, 0];
  const albedo = hit.albedo || hit.tri.albedo;
  const normal = hit.normal, view = norm(viewDirection);
  const nDotV = Math.max(1e-5, dot(normal, view));
  const metallic = hit.tri.metallic, roughness = hit.tri.roughness;
  const alpha = Math.max(0.0016, roughness * roughness), alpha2 = alpha * alpha;
  const f0 = albedo.map(c => 0.04 * (1 - metallic) + c * metallic);
  const geometryK = ((roughness + 1) ** 2) / 8;
  for (const light of lights) {
    const sampleCount = light.type !== 'directional' && light.radius > 0 ? 4 : 1;
    let lightContribution = [0, 0, 0];
    for (let sample = 0; sample < sampleCount; sample++) {
      let l, distance = Infinity, distance2 = 1, spotFactor = 1, attenuation;
      if (light.type === 'directional') {
        l = mul(light.direction, -1);
        attenuation = light.intensity;
      } else {
        const source = sampleLightPosition(light, random), delta = sub(source, hit.point);
        distance2 = dot(delta, delta); distance = Math.sqrt(distance2);
        if (distance < 1e-4 || distance >= light.range) continue;
        l = mul(delta, 1 / distance);
        const rangeFalloff = clamp(1 - (distance / light.range) ** 2, 0, 1);
        attenuation = light.intensity * rangeFalloff * rangeFalloff / (4 * Math.PI * Math.max(1, distance2));
        if (light.type === 'spot') {
          const fromLight = mul(l, -1), cone = dot(fromLight, light.direction);
          const outerCos = Math.cos(light.outerCone), innerCos = Math.cos(light.innerCone);
          if (cone <= outerCos) continue;
          const t = clamp((cone - outerCos) / Math.max(1e-5, innerCos - outerCos), 0, 1);
          spotFactor = t * t * (3 - 2 * t);
        }
      }
      const nDotL = Math.max(0, dot(normal, l));
      if (nDotL <= 0) continue;
      const shadowRay = { origin: add(hit.point, mul(normal, EPS * 4)), dir: l };
      const blocker = intersectBVH(bvh, shadowRay, null);
      if (blocker && (light.type === 'directional' || blocker.t < distance - EPS * 8)) continue;
      const halfVector = norm(add(l, view)), nDotH = Math.max(0, dot(normal, halfVector)), vDotH = Math.max(0, dot(view, halfVector));
      const denominator = Math.max(1e-6, Math.PI * (nDotH * nDotH * (alpha2 - 1) + 1) ** 2);
      const distribution = alpha2 / denominator;
      const geometryView = nDotV / (nDotV * (1 - geometryK) + geometryK);
      const geometryLight = nDotL / (nDotL * (1 - geometryK) + geometryK);
      const fresnel = f0.map(c => c + (1 - c) * (1 - vDotH) ** 5);
      const specular = mul(fresnel, distribution * geometryView * geometryLight / Math.max(1e-5, 4 * nDotV));
      const diffuse = mul(albedo, (1 - metallic) * nDotL / Math.PI);
      lightContribution = add(lightContribution, had(add(diffuse, specular), mul(light.color, attenuation * spotFactor)));
    }
    result = add(result, mul(lightContribution, 1 / sampleCount));
  }
  return result;
}
function tracePath(ray, bvh, lights, random, bounceLimit, counter) {
  let radiance = [0, 0, 0], throughput = [1, 1, 1];
  for (let bounce = 0; bounce <= bounceLimit; bounce++) {
    counter.rays++;
    const hit = intersectBVH(bvh, ray);
    if (!hit) { radiance = add(radiance, had(throughput, skyColor(ray.dir))); break; }
    const tri = hit.tri, albedo = hit.albedo || tri.albedo;
    if (bounce === 0 || tri.emission.some(c => c > 0.001)) radiance = add(radiance, had(throughput, tri.emission));
    radiance = add(radiance, had(throughput, directLighting(hit, bvh, lights, mul(ray.dir, -1), random)));
    if (bounce >= bounceLimit) break;
    let nextDir;
    if (random() < tri.metallic) {
      const ideal = norm(reflect(ray.dir, hit.normal)), diffuse = cosineHemisphere(hit.normal, random);
      const roughness = tri.roughness * tri.roughness;
      nextDir = norm(add(mul(ideal, 1 - roughness), mul(diffuse, roughness)));
      throughput = had(throughput, albedo.map(c => 0.04 * (1 - tri.metallic) + c * tri.metallic));
    } else {
      nextDir = cosineHemisphere(hit.normal, random);
      throughput = had(throughput, mul(albedo, 1 - tri.metallic));
    }
    if (bounce >= 2) {
      const survive = clamp(Math.max(...throughput), 0.08, 0.92);
      if (random() > survive) break;
      throughput = mul(throughput, 1 / survive);
    }
    ray = { origin: add(hit.point, mul(hit.normal, EPS * 4)), dir: nextDir };
  }
  return radiance;
}

/** Render one offline progressive frame; returns linear-to-display RGBA bytes and scene statistics. */
export async function renderPathTracedImage(scene, options = {}) {
  const width = clamp(Math.floor(Number(options.width) || 128), 16, 480);
  const height = clamp(Math.floor(Number(options.height) || Math.round(width * 0.72)), 16, 360);
  const samples = clamp(Math.floor(Number(options.samples) || 2), 1, 16);
  const bounces = clamp(Math.floor(Number(options.bounces) || 3), 1, 6);
  const exposure = clamp(Number(options.exposure ?? scene?.renderSettings?.exposure ?? 1), 0.1, 4);
  const textures = await loadBaseColorTextures(scene);
  const triangles = sceneTriangles(scene, textures);
  if (!triangles.length) throw new Error('Add visible geometry to the scene before path tracing.');
  const bvh = buildBVH(triangles), lights = normalizePathTracerLights(scene), pixels = new Uint8ClampedArray(width * height * 4), random = randomSource(Number(options.seed) || 20261016), counter = { rays: 0 };
  const cameraObject = (scene.objects || []).find(o => o?.type === 'camera');
  const cameraPosition = v3(cameraObject?.position, [0, 2.2, 7]);
  const target = v3(cameraObject?.target, [0, 0, 0]);
  const forward = norm(sub(target, cameraPosition));
  const cameraRight = norm(cross(forward, Math.abs(forward[1]) > 0.96 ? [0, 0, 1] : [0, 1, 0]));
  const cameraUp = norm(cross(cameraRight, forward));
  const fov = clamp(Number(cameraObject?.fov ?? 50), 20, 110) * Math.PI / 180;
  const halfHeight = Math.tan(fov / 2), aspect = width / height;
  const progress = (done) => { if (typeof options.onProgress === 'function') options.onProgress({ done, total: height, percent: Math.round(done / height * 100), rays: counter.rays }); };
  for (let y = 0; y < height; y++) {
    if (options.signal?.aborted) throw new Error('Path trace cancelled.');
    for (let x = 0; x < width; x++) {
      let sum = [0, 0, 0];
      for (let sample = 0; sample < samples; sample++) {
        const sx = ((x + random()) / width * 2 - 1) * aspect * halfHeight;
        const sy = (1 - (y + random()) / height * 2) * halfHeight;
        const dir = norm(add(add(forward, mul(cameraRight, sx)), mul(cameraUp, sy)));
        sum = add(sum, tracePath({ origin: cameraPosition, dir }, bvh, lights, random, bounces, counter));
      }
      sum = mul(sum, 1 / samples);
      // ACES-style filmic operator followed by sRGB transfer.
      const mapped = sum.map(linear => { const c = Math.max(0, linear * exposure); const filmic = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0, 1); return Math.round(255 * (filmic <= 0.0031308 ? 12.92 * filmic : 1.055 * Math.pow(filmic, 1 / 2.4) - 0.055)); });
      const idx = (y * width + x) * 4; pixels[idx] = mapped[0]; pixels[idx + 1] = mapped[1]; pixels[idx + 2] = mapped[2]; pixels[idx + 3] = 255;
    }
    if ((y + 1) % 4 === 0 || y === height - 1) {
      progress(y + 1);
      // Yield to the browser between scan-line batches so progress and Cancel remain responsive.
      if (typeof setTimeout === 'function') await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  return { width, height, pixels, stats: { triangleCount: triangles.length, lightCount: lights.length, samples, bounces, rays: counter.rays, indirectGlobalIllumination: true, baseColorTextures: textures.size, physicallyInspiredBRDF: true, shadows: true } };
}
