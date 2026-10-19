/**
 * Orvexa Sequencer — Blender Dope Sheet / Unreal Level Sequencer class
 * keyframe animation system for Orvexa Studio and the Modeler.
 *
 * A Sequence owns Tracks; each Track owns Channels (one animatable scalar
 * property such as position.x, emissive or intensity); each Channel owns
 * Keyframes with an interpolation mode and Bezier tangents. Sampling a
 * sequence at a time evaluates every channel, applies Transform / Material /
 * Light / Camera / Bone values onto a scene graph, and supports baking,
 * SVG timeline rendering, clip blending and event markers.
 */
export const SEQUENCER_VERSION = 1;
export const SEQUENCER_SCHEMA = 'orvexa-sequencer-sequence';
export const INTERPOLATION_MODES = Object.freeze(['linear', 'bezier', 'step', 'easeInOut', 'elastic', 'bounce']);
export const TRACK_KINDS = Object.freeze(['transform', 'material', 'light', 'camera', 'bone', 'event']);
export const TRANSFORM_CHANNELS = Object.freeze([
  'position.x', 'position.y', 'position.z',
  'rotation.x', 'rotation.y', 'rotation.z',
  'scale.x', 'scale.y', 'scale.z',
]);
export const MATERIAL_CHANNELS = Object.freeze(['material.emissive', 'material.roughness', 'material.metallic', 'material.clearcoat', 'material.aoStrength', 'material.normalScale']);
export const LIGHT_CHANNELS = Object.freeze(['intensity', 'range', 'color.r', 'color.g', 'color.b']);
export const CAMERA_CHANNELS = Object.freeze(['camera.position.x', 'camera.position.y', 'camera.position.z', 'camera.target.x', 'camera.target.y', 'camera.target.z', 'camera.fov', 'camera.zoom']);
export const BONE_CHANNELS = Object.freeze(['bone.rotation.x', 'bone.rotation.y', 'bone.rotation.z', 'bone.position.x', 'bone.position.y', 'bone.position.z']);

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const lerp = (a, b, t) => a + (b - a) * t;
let sequenceCounter = 1;
let keyframeCounter = 1;

export function sequencerUid(prefix = 'seq') {
  return `${prefix}-${Date.now().toString(36)}-${(sequenceCounter++).toString(36)}-${(keyframeCounter++).toString(36)}`;
}

const EASING = {
  linear: (t) => t,
  step: () => 0,
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  elastic: (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  bounce: (t) => {
    const n1 = 7.5625; const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

export function easingFunction(name) {
  return EASING[name] || EASING.linear;
}

/** Cubic Bezier (Hermite-converted) interpolation between two keyframes. */
export function cubicBezierInterpolate(v0, v1, tangentOut, tangentIn, t, duration) {
  const dt = Math.max(1e-6, duration);
  const m0 = clamp(finite(tangentOut, 0), -1e4, 1e4) * dt;
  const m1 = clamp(finite(tangentIn, 0), -1e4, 1e4) * dt;
  const t2 = t * t; const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * v0 + h10 * m0 + h01 * v1 + h11 * m1;
}

/** Parse a hex colour into [r, g, b] floats in 0..1. */
export function hexToRgb01Sequencer(hex, fallback = [1, 1, 1]) {
  const match = String(hex || '').match(/^#?([0-9a-f]{6})$/i);
  if (!match) return [...fallback];
  const n = parseInt(match[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Format [r,g,b] floats as a CSS rgb() string for colour channels. */
export function rgb01ToCss(rgb) {
  const c = (v) => Math.round(clamp(finite(v, 0), 0, 1) * 255);
  return `rgb(${c(rgb[0])}, ${c(rgb[1])}, ${c(rgb[2])})`;
}

/**
 * Create one keyframe. `tangentIn`/`tangentOut` are Hermite slopes
 * (value-units per second) used by the `bezier` interpolation mode.
 */
export function createKeyframe(time, value, options = {}) {
  if (!Number.isFinite(Number(time))) throw new TypeError('Keyframe time must be a finite number of seconds.');
  if (!Number.isFinite(Number(value))) throw new TypeError('Keyframe value must be a finite number.');
  return {
    id: String(options.id || sequencerUid('key')),
    time: Math.max(0, Number(time)),
    value: Number(value),
    interpolation: INTERPOLATION_MODES.includes(options.interpolation) ? options.interpolation : 'bezier',
    tangentIn: finite(options.tangentIn, 0),
    tangentOut: finite(options.tangentOut, 0),
    label: String(options.label || ''),
  };
}

export function normalizeKeyframe(raw, index = 0) {
  if (!raw || typeof raw !== 'object') throw new TypeError(`Keyframe ${index + 1} is not an object.`);
  return createKeyframe(raw.time, raw.value, raw);
}

export function createChannel(property, keyframes = [], options = {}) {
  const prop = String(property || '').trim();
  if (!prop) throw new TypeError('Channel property is required (e.g. "position.y").');
  const sorted = keyframes.map((k, i) => normalizeKeyframe(k, i)).sort((a, b) => a.time - b.time);
  return {
    id: String(options.id || sequencerUid('channel')),
    property: prop,
    color: /^#[0-9a-f]{6}$/i.test(String(options.color || '')) ? String(options.color) : '#7c5cff',
    keyframes: sorted,
    muted: options.muted === true,
    defaultValue: finite(options.defaultValue, sorted[0]?.value ?? 0),
  };
}

export function normalizeChannel(raw, index = 0) {
  if (!raw || typeof raw !== 'object') throw new TypeError(`Channel ${index + 1} is not an object.`);
  return createChannel(raw.property || raw.name || '', raw.keyframes || [], raw);
}

/**
 * Create a track bound to a scene object (by engineId or name), a bone of a
 * rig, a light, or the scene camera. Channels are created lazily by
 * addSequenceTrack / insertKeyframe.
 */
export function createSequenceTrack(input = {}) {
  const kind = TRACK_KINDS.includes(input.kind) ? input.kind : 'transform';
  return {
    id: String(input.id || sequencerUid('track')),
    kind,
    name: String(input.name || input.targetName || 'Track').slice(0, 120),
    targetId: input.targetId != null ? String(input.targetId) : null,
    targetName: input.targetName != null ? String(input.targetName) : (input.name ? String(input.name) : null),
    boneName: input.boneName != null ? String(input.boneName) : null,
    enabled: input.enabled !== false,
    locked: input.locked === true,
    channels: (input.channels || []).map((c, i) => normalizeChannel(c, i)),
  };
}

export function normalizeSequenceTrack(raw, index = 0) {
  if (!raw || typeof raw !== 'object') throw new TypeError(`Track ${index + 1} is not an object.`);
  return createSequenceTrack(raw);
}

let sequenceIdCounter = 1;
/** Create an empty timeline sequence. */
export function createTimelineSequence(input = {}) {
  const duration = clamp(finite(input.duration, 10), 0.1, 3600);
  return {
    schema: SEQUENCER_SCHEMA,
    version: SEQUENCER_VERSION,
    id: String(input.id || `sequence-${(sequenceIdCounter++).toString(36)}`),
    name: String(input.name || 'Untitled Sequence').slice(0, 120),
    duration,
    fps: Math.round(clamp(finite(input.fps, 30), 1, 240)),
    loop: input.loop === true,
    loopStart: clamp(finite(input.loopStart, 0), 0, duration),
    loopEnd: clamp(finite(input.loopEnd, duration), 0, duration),
    timeScale: clamp(finite(input.timeScale, 1), 0.01, 100),
    tracks: (input.tracks || []).map((t, i) => normalizeSequenceTrack(t, i)),
    markers: (input.markers || []).map((m, i) => normalizeMarker(m, i)),
    createdWith: 'orvexa-sequencer',
  };
}

export function normalizeMarker(raw, index = 0) {
  if (!raw || typeof raw !== 'object') throw new TypeError(`Marker ${index + 1} is not an object.`);
  return {
    id: String(raw.id || sequencerUid('marker')),
    time: Math.max(0, finite(raw.time, 0)),
    label: String(raw.label || `Marker ${index + 1}`).slice(0, 80),
    color: /^#[0-9a-f]{6}$/i.test(String(raw.color || '')) ? String(raw.color) : '#eab96d',
    action: String(raw.action || ''),
  };
}

export function addMarker(sequence, marker) {
  const next = normalizeMarker(marker, sequence.markers.length);
  sequence.markers.push(next);
  sequence.markers.sort((a, b) => a.time - b.time);
  return next;
}

export function removeMarker(sequence, markerId) {
  const before = sequence.markers.length;
  sequence.markers = sequence.markers.filter((m) => m.id !== markerId);
  return sequence.markers.length !== before;
}

/** Normalise any user/LLM supplied sequence into the canonical schema. */
export function normalizeTimelineSequence(input = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('A sequence object is required.');
  return createTimelineSequence(input);
}

/** Add (or return the existing) track for a target. Returns the track. */
export function addSequenceTrack(sequence, trackInput = {}) {
  if (!sequence || !Array.isArray(sequence.tracks)) throw new TypeError('Valid sequence required.');
  const track = createSequenceTrack(trackInput);
  const existing = sequence.tracks.find((t) => t.targetId && track.targetId && t.targetId === track.targetId && t.kind === track.kind && t.boneName === track.boneName);
  if (existing) return existing;
  sequence.tracks.push(track);
  return track;
}

export function findTrack(sequence, trackId) {
  return sequence.tracks.find((t) => t.id === trackId) || null;
}

export function removeSequenceTrack(sequence, trackId) {
  const before = sequence.tracks.length;
  sequence.tracks = sequence.tracks.filter((t) => t.id !== trackId);
  return sequence.tracks.length !== before;
}

export function findChannel(track, property) {
  return track.channels.find((c) => c.property === property) || null;
}

export function ensureChannel(track, property, options = {}) {
  let channel = findChannel(track, property);
  if (!channel) {
    channel = createChannel(property, [], options);
    track.channels.push(channel);
  }
  return channel;
}

/**
 * Insert a keyframe into a track channel, replacing any keyframe at the
 * same time (within 1e-6 s). Returns the inserted keyframe.
 */
export function insertKeyframe(sequence, trackId, property, time, value, options = {}) {
  const track = findTrack(sequence, trackId);
  if (!track) throw new Error(`Sequence track "${trackId}" was not found.`);
  if (track.locked) throw new Error(`Sequence track "${track.name}" is locked.`);
  const channel = ensureChannel(track, property, options.channel || {});
  const key = createKeyframe(time, value, options);
  const existingIndex = channel.keyframes.findIndex((k) => Math.abs(k.time - key.time) < 1e-6);
  if (existingIndex >= 0) channel.keyframes.splice(existingIndex, 1);
  channel.keyframes.push(key);
  channel.keyframes.sort((a, b) => a.time - b.time);
  sequence.duration = Math.max(sequence.duration, key.time);
  return key;
}

/** Convenience: add a keyframe using a target name instead of a track id. */
export function insertKeyframeForTarget(sequence, targetName, property, time, value, options = {}) {
  let track = sequence.tracks.find((t) => t.targetName === targetName || t.targetId === targetName);
  if (!track) track = addSequenceTrack(sequence, { name: targetName, targetName, kind: options.kind || inferTrackKind(property) });
  return insertKeyframe(sequence, track.id, property, time, value, options);
}

export function inferTrackKind(property) {
  if (property.startsWith('camera.')) return 'camera';
  if (property.startsWith('bone.')) return 'bone';
  if (property.startsWith('material.') || property === 'color') return 'material';
  if (LIGHT_CHANNELS.includes(property)) return 'light';
  return 'transform';
}

/** Remove a keyframe by id from any track/channel. Returns true if removed. */
export function removeKeyframe(sequence, keyframeId) {
  for (const track of sequence.tracks) {
    for (const channel of track.channels) {
      const index = channel.keyframes.findIndex((k) => k.id === keyframeId);
      if (index >= 0) {
        channel.keyframes.splice(index, 1);
        return true;
      }
    }
  }
  return false;
}

export function moveKeyframe(sequence, keyframeId, newTime) {
  for (const track of sequence.tracks) {
    for (const channel of track.channels) {
      const key = channel.keyframes.find((k) => k.id === keyframeId);
      if (key) {
        key.time = Math.max(0, finite(newTime, key.time));
        channel.keyframes.sort((a, b) => a.time - b.time);
        sequence.duration = Math.max(sequence.duration, key.time);
        return key;
      }
    }
  }
  throw new Error(`Keyframe "${keyframeId}" was not found.`);
}

export function listKeyframes(sequence) {
  const out = [];
  for (const track of sequence.tracks) {
    for (const channel of track.channels) {
      for (const key of channel.keyframes) out.push({ track, channel, keyframe: key });
    }
  }
  return out.sort((a, b) => a.keyframe.time - b.keyframe.time);
}

/**
 * Evaluate one channel at a time. Handles empty/single-key channels,
 * before-first / after-last clamping, and every interpolation mode.
 */
export function evaluateCurveChannel(channel, timeSeconds) {
  if (!channel || typeof channel !== 'object') throw new TypeError('Valid channel required.');
  const keys = [...(channel.keyframes || [])].sort((a, b) => a.time - b.time);
  const t = Math.max(0, finite(timeSeconds, 0));
  if (!keys.length) return finite(channel.defaultValue, 0);
  if (keys.length === 1 || t <= keys[0].time) return keys[0].value;
  const last = keys[keys.length - 1];
  if (t >= last.time) return last.value;
  let index = 0;
  for (let i = 0; i < keys.length - 1; i++) {
    if (t >= keys[i].time && t <= keys[i + 1].time) { index = i; break; }
  }
  const a = keys[index]; const b = keys[index + 1];
  const span = Math.max(1e-9, b.time - a.time);
  const local = clamp((t - a.time) / span, 0, 1);
  switch (a.interpolation) {
    case 'step':
      return a.value;
    case 'linear':
      return lerp(a.value, b.value, local);
    case 'bezier':
      return cubicBezierInterpolate(a.value, b.value, a.tangentOut, b.tangentIn, local, span);
    case 'easeInOut':
    case 'elastic':
    case 'bounce':
      return lerp(a.value, b.value, EASING[a.interpolation](local));
    default:
      return lerp(a.value, b.value, local);
  }
}

export function evaluateChannelAt(channel, time) {
  return evaluateCurveChannel(channel, time);
}

/** Evaluate every channel of a track at a time into a property map. */
export function evaluateTrackAt(track, timeSeconds) {
  const values = {};
  if (!track || track.enabled === false) return values;
  for (const channel of track.channels || []) {
    if (channel.muted) continue;
    values[channel.property] = evaluateCurveChannel(channel, timeSeconds);
  }
  return values;
}

export function resolveSequenceTime(sequence, timeSeconds) {
  const t = Math.max(0, finite(timeSeconds, 0)) * clamp(finite(sequence?.timeScale, 1), 0.01, 100);
  if (sequence?.loop) {
    const start = clamp(finite(sequence.loopStart, 0), 0, sequence.duration);
    const end = Math.max(start + 1e-6, clamp(finite(sequence.loopEnd, sequence.duration), 0, sequence.duration));
    if (t > end) return start + ((t - start) % (end - start));
  }
  return clamp(t, 0, finite(sequence?.duration, t));
}

function setNested(object, property, value) {
  const parts = property.split('.');
  let cursor = object;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') cursor[parts[i]] = {};
    cursor = cursor[parts[i]];
  }
  cursor[parts[parts.length - 1]] = value;
}

function findSceneObject(scene, track) {
  const objects = scene?.objects || scene?.scene?.objects || [];
  if (!Array.isArray(objects)) return null;
  return objects.find((o) => (track.targetId && (o.engineId === track.targetId || o.id === track.targetId))
    || (track.targetName && (o.name === track.targetName || o.engineId === track.targetName))) || null;
}

function applyTransformValues(object, values) {
  for (const property of TRANSFORM_CHANNELS) {
    if (values[property] === undefined) continue;
    const [group, axisName] = property.split('.');
    object[group] = object[group] && typeof object[group] === 'object' ? object[group] : { x: 0, y: 0, z: 0 };
    object[group][axisName] = values[property];
  }
}

function applyMaterialValues(object, values) {
  object.material = object.material && typeof object.material === 'object' ? object.material : {};
  for (const property of MATERIAL_CHANNELS) {
    if (values[property] === undefined) continue;
    object.material[property.split('.')[1]] = values[property];
  }
  if (values['color.r'] !== undefined || values.color !== undefined) {
    const base = object.__sequencerColor || hexToRgb01Sequencer(object.color || '#ffffff');
    object.__sequencerColor = base;
    if (values['color.r'] !== undefined) base[0] = clamp(values['color.r'], 0, 1);
    if (values['color.g'] !== undefined) base[1] = clamp(values['color.g'], 0, 1);
    if (values['color.b'] !== undefined) base[2] = clamp(values['color.b'], 0, 1);
    object.color = rgb01ToCss(base);
  }
}

function applyLightValues(object, values) {
  if (values.intensity !== undefined) object.intensity = Math.max(0, values.intensity);
  if (values.range !== undefined) object.range = Math.max(0, values.range);
  if (values['color.r'] !== undefined || values['color.g'] !== undefined || values['color.b'] !== undefined) {
    const base = object.__sequencerColor || hexToRgb01Sequencer(object.color || '#ffffff');
    object.__sequencerColor = base;
    if (values['color.r'] !== undefined) base[0] = clamp(values['color.r'], 0, 1);
    if (values['color.g'] !== undefined) base[1] = clamp(values['color.g'], 0, 1);
    if (values['color.b'] !== undefined) base[2] = clamp(values['color.b'], 0, 1);
    object.color = rgb01ToCss(base);
  }
}

function applyBoneValues(object, track, values) {
  object.rig = object.rig && typeof object.rig === 'object' ? object.rig : null;
  const rig = object.rig || object.skeleton || null;
  if (!rig || !Array.isArray(rig.bones)) return;
  const bone = rig.bones.find((b) => b.name === track.boneName) || rig.bones[0];
  if (!bone) return;
  bone.pose = bone.pose && typeof bone.pose === 'object' ? bone.pose : { x: 0, y: 0, z: 0 };
  bone.pivot = Array.isArray(bone.pivot) ? bone.pivot : [0, 0, 0];
  for (const [property, value] of Object.entries(values)) {
    if (property.startsWith('bone.rotation.')) bone.pose[property.split('.')[2]] = value;
    if (property.startsWith('bone.position.')) {
      const axisIndex = { x: 0, y: 1, z: 2 }[property.split('.')[2]];
      if (axisIndex !== undefined) bone.pivot[axisIndex] = value;
    }
  }
  object.__sequencerIkDirty = true;
}

function applyCameraValues(scene, values) {
  const camera = scene.editorCamera || scene.camera || (scene.editorCamera = { target: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 2, z: 8 } });
  camera.target = camera.target && typeof camera.target === 'object' ? camera.target : { x: 0, y: 0, z: 0 };
  camera.position = camera.position && typeof camera.position === 'object' ? camera.position : { x: 0, y: 2, z: 8 };
  for (const [property, value] of Object.entries(values)) {
    if (property.startsWith('camera.')) setNested({ camera }, property, value);
  }
  return camera;
}

/**
 * Sample a sequence at a time. Evaluates every track into a values map and,
 * when a scene ({ objects: [] }) is supplied, applies Transform, Material,
 * Light, Bone and Camera values onto it. Returns
 * { time, duration, values: {trackId: {property: value}}, applied, markers }.
 */
export function sampleTimelineAtTime(sequenceInput, timeSeconds = 0, scene = null) {
  const sequence = normalizeTimelineSequence(sequenceInput);
  const time = resolveSequenceTime(sequence, timeSeconds);
  const values = {};
  let applied = 0;
  for (const track of sequence.tracks) {
    const trackValues = evaluateTrackAt(track, time);
    values[track.id] = trackValues;
    if (!scene || !Object.keys(trackValues).length) continue;
    if (track.kind === 'camera') { applyCameraValues(scene, trackValues); applied++; continue; }
    const object = findSceneObject(scene, track);
    if (!object) continue;
    if (track.kind === 'material') applyMaterialValues(object, trackValues);
    else if (track.kind === 'light') applyLightValues(object, trackValues);
    else if (track.kind === 'bone') applyBoneValues(object, track, trackValues);
    else applyTransformValues(object, trackValues);
    applied++;
  }
  const activeMarkers = sequence.markers.filter((m) => Math.abs(m.time - time) < 0.05);
  return { sequence, time, duration: sequence.duration, values, applied, markers: activeMarkers, looped: Boolean(sequence.loop) };
}

/**
 * Bake a sequence into dense per-frame keyframes at its fps. Useful for
 * exporters that only understand linear keys. Returns a new sequence whose
 * channels contain baked `linear` keyframes; the source is untouched.
 */
export function bakeSequenceToKeyframes(sequenceInput, options = {}) {
  const sequence = normalizeTimelineSequence(sequenceInput);
  const fps = Math.round(clamp(finite(options.fps, sequence.fps), 1, 240));
  const end = clamp(finite(options.endTime, sequence.duration), 0.1, 3600);
  const start = clamp(finite(options.startTime, 0), 0, end);
  const baked = createTimelineSequence({ ...sequence, id: undefined, name: `${sequence.name} (Baked)`, tracks: [], markers: sequence.markers });
  for (const track of sequence.tracks) {
    const bakedTrack = addSequenceTrack(baked, { ...track, id: undefined, channels: [] });
    for (const channel of track.channels) {
      const keys = [];
      const frames = Math.max(1, Math.round((end - start) * fps));
      for (let frame = 0; frame <= frames; frame++) {
        const time = start + (frame / fps);
        keys.push(createKeyframe(time, evaluateCurveChannel(channel, time), { interpolation: 'linear' }));
      }
      bakedTrack.channels.push(createChannel(channel.property, keys, { color: channel.color, defaultValue: channel.defaultValue }));
    }
  }
  return baked;
}

/** Sample-and-apply a sequence across a range, returning per-frame snapshots. */
export function sampleSequenceRange(sequence, scene, options = {}) {
  const fps = Math.round(clamp(finite(options.fps, sequence.fps || 30), 1, 120));
  const end = clamp(finite(options.endTime, sequence.duration), 0.1, 3600);
  const frames = [];
  const steps = Math.max(1, Math.round(end * fps));
  for (let i = 0; i <= steps; i++) {
    const time = i / fps;
    frames.push({ frame: i, time, result: sampleTimelineAtTime(sequence, time, scene) });
  }
  return frames;
}

export function sequenceDuration(sequence) {
  let end = finite(sequence?.duration, 0);
  for (const track of sequence?.tracks || []) {
    for (const channel of track.channels || []) {
      for (const key of channel.keyframes || []) end = Math.max(end, key.time);
    }
  }
  return end;
}

export function sequenceStatistics(sequenceInput) {
  const sequence = normalizeTimelineSequence(sequenceInput);
  let keyframes = 0; let channels = 0;
  const kinds = {};
  for (const track of sequence.tracks) {
    kinds[track.kind] = (kinds[track.kind] || 0) + 1;
    channels += track.channels.length;
    for (const channel of track.channels) keyframes += channel.keyframes.length;
  }
  return {
    name: sequence.name, duration: sequenceDuration(sequence), fps: sequence.fps,
    tracks: sequence.tracks.length, channels, keyframes, markers: sequence.markers.length, kinds,
    bakedFloats: keyframes, estimatedFrames: Math.round(sequenceDuration(sequence) * sequence.fps),
  };
}

export function cloneSequence(sequence) {
  return normalizeTimelineSequence(JSON.parse(JSON.stringify(sequence)));
}

export function mergeSequences(aInput, bInput, options = {}) {
  const a = normalizeTimelineSequence(aInput);
  const b = normalizeTimelineSequence(bInput);
  const offset = clamp(finite(options.offsetTime, a.duration), 0, 3600);
  const merged = createTimelineSequence({ name: options.name || `${a.name} + ${b.name}`, duration: Math.max(a.duration, offset + b.duration), fps: a.fps, tracks: [], markers: [] });
  for (const track of a.tracks) merged.tracks.push(createSequenceTrack(track));
  for (const track of b.tracks) {
    const copy = createSequenceTrack(track);
    for (const channel of copy.channels) {
      for (const key of channel.keyframes) key.time = Math.max(0, key.time + offset);
      channel.keyframes.sort((x, y) => x.time - y.time);
    }
    merged.tracks.push(copy);
  }
  merged.markers = [...a.markers, ...b.markers.map((m) => ({ ...m, time: m.time + offset }))].sort((x, y) => x.time - y.time);
  merged.duration = sequenceDuration(merged);
  return merged;
}

export function trimSequence(sequenceInput, startTime, endTime) {
  const sequence = normalizeTimelineSequence(sequenceInput);
  const start = Math.max(0, finite(startTime, 0));
  const end = Math.max(start + 0.1, finite(endTime, sequence.duration));
  const trimmed = createTimelineSequence({ ...sequence, id: undefined, duration: end - start, tracks: [], markers: [] });
  for (const track of sequence.tracks) {
    const copy = createSequenceTrack({ ...track, id: undefined, channels: [] });
    for (const channel of track.channels) {
      const keys = channel.keyframes.filter((k) => k.time >= start && k.time <= end)
        .map((k) => createKeyframe(k.time - start, k.value, k));
      if (keys.length) copy.channels.push(createChannel(channel.property, keys, channel));
    }
    if (copy.channels.length) trimmed.tracks.push(copy);
  }
  trimmed.markers = sequence.markers.filter((m) => m.time >= start && m.time <= end).map((m) => ({ ...m, time: m.time - start }));
  return trimmed;
}

export function reverseSequence(sequenceInput) {
  const sequence = normalizeTimelineSequence(sequenceInput);
  const duration = sequenceDuration(sequence);
  const reversed = cloneSequence(sequence);
  for (const track of reversed.tracks) {
    for (const channel of track.channels) {
      for (const key of channel.keyframes) {
        key.time = Math.max(0, duration - key.time);
        const swap = key.tangentIn; key.tangentIn = -finite(key.tangentOut, 0); key.tangentOut = -finite(swap, 0);
      }
      channel.keyframes.sort((a, b) => a.time - b.time);
    }
  }
  reversed.markers = reversed.markers.map((m) => ({ ...m, time: Math.max(0, duration - m.time) })).sort((a, b) => a.time - b.time);
  return reversed;
}

export function scaleSequenceTime(sequenceInput, factor) {
  const sequence = cloneSequence(sequenceInput);
  const scale = clamp(finite(factor, 1), 0.01, 100);
  sequence.duration = sequence.duration * scale;
  for (const track of sequence.tracks) {
    for (const channel of track.channels) {
      for (const key of channel.keyframes) key.time = key.time * scale;
    }
  }
  for (const marker of sequence.markers) marker.time = marker.time * scale;
  return sequence;
}

/** Find keyframes inside a time window (for dope-sheet selection boxes). */
export function keyframesInWindow(sequence, startTime, endTime) {
  const start = Math.min(finite(startTime, 0), finite(endTime, 0));
  const end = Math.max(finite(startTime, 0), finite(endTime, 0));
  return listKeyframes(sequence).filter(({ keyframe }) => keyframe.time >= start && keyframe.time <= end);
}

/** Delete every keyframe in a time window. Returns the removed count. */
export function deleteKeyframesInWindow(sequence, startTime, endTime) {
  const found = keyframesInWindow(sequence, startTime, endTime);
  for (const { keyframe } of found) removeKeyframe(sequence, keyframe.id);
  return found.length;
}

const svgEscape = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/**
 * Render an interactive dope-sheet / curve-preview SVG for a sequence.
 * Every keyframe is a clickable <circle data-keyframe-id data-time> and the
 * playhead is a <line data-playhead="true">, so Studio and Modeler can wire
 * scrubbing by reading data attributes from click events.
 */
export function renderTimelineSvg(sequenceInput, options = {}) {
  const sequence = normalizeTimelineSequence(sequenceInput);
  const width = Math.round(clamp(finite(options.width, 720), 200, 4000));
  const height = Math.round(clamp(finite(options.height, 220), 80, 2000));
  const currentTime = clamp(finite(options.currentTime, 0), 0, sequenceDuration(sequence) || 1);
  const duration = Math.max(0.1, sequenceDuration(sequence));
  const labelWidth = 132;
  const plotWidth = Math.max(40, width - labelWidth - 12);
  const plotHeight = Math.max(30, height - 34);
  const rows = [];
  for (const track of sequence.tracks) {
    for (const channel of track.channels) rows.push({ track, channel });
  }
  const rowHeight = rows.length ? clamp(plotHeight / rows.length, 12, 30) : 20;
  const xForTime = (time) => labelWidth + (clamp(time, 0, duration) / duration) * plotWidth;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Animation timeline for ${svgEscape(sequence.name)}" data-sequence-id="${svgEscape(sequence.id)}" data-duration="${duration}">`);
  parts.push('<rect width="100%" height="100%" fill="#11152a"/>');
  const tickCount = Math.max(2, Math.min(20, Math.round(duration * 2)));
  for (let i = 0; i <= tickCount; i++) {
    const time = (i / tickCount) * duration;
    const x = xForTime(time).toFixed(1);
    parts.push(`<line x1="${x}" y1="18" x2="${x}" y2="${height - 8}" stroke="#2a3054" stroke-width="1"/>`);
    parts.push(`<text x="${x}" y="12" fill="#8f97bd" font-size="9" text-anchor="middle">${time.toFixed(1)}s</text>`);
  }
  rows.forEach(({ track, channel }, rowIndex) => {
    const y = 22 + rowIndex * rowHeight;
    const midY = y + rowHeight / 2;
    parts.push(`<rect x="0" y="${y}" width="${width}" height="${rowHeight}" fill="${rowIndex % 2 ? '#151936' : '#12162e'}"/>`);
    parts.push(`<text x="8" y="${midY + 3}" fill="#dfe4ff" font-size="10">${svgEscape(track.name)} · ${svgEscape(channel.property)}</text>`);
    const values = channel.keyframes.map((k) => k.value);
    const min = Math.min(...values, channel.defaultValue);
    const max = Math.max(...values, channel.defaultValue);
    const span = Math.max(1e-9, max - min);
    let previous = null;
    for (const key of channel.keyframes) {
      const x = xForTime(key.time);
      const normalised = (key.value - min) / span;
      const cy = y + rowHeight - 3 - normalised * (rowHeight - 6);
      if (previous) {
        parts.push(`<line x1="${previous.x.toFixed(1)}" y1="${previous.y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${channel.color}" stroke-width="1.6" opacity="0.85"/>`);
      }
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.6" fill="${channel.color}" stroke="#0b0e1a" stroke-width="1" data-keyframe-id="${svgEscape(key.id)}" data-time="${key.time}" data-value="${key.value}"><title>${svgEscape(channel.property)} @ ${key.time.toFixed(2)}s = ${key.value}</title></circle>`);
      previous = { x, y: cy };
    }
  });
  for (const marker of sequence.markers) {
    const x = xForTime(marker.time).toFixed(1);
    parts.push(`<line x1="${x}" y1="16" x2="${x}" y2="${height - 8}" stroke="${marker.color}" stroke-width="1.4" stroke-dasharray="3 3" data-marker-id="${svgEscape(marker.id)}"/>`);
    parts.push(`<text x="${x}" y="${height - 10}" fill="${marker.color}" font-size="9" text-anchor="middle">${svgEscape(marker.label)}</text>`);
  }
  const playheadX = xForTime(currentTime).toFixed(1);
  parts.push(`<line x1="${playheadX}" y1="14" x2="${playheadX}" y2="${height - 6}" stroke="#ffcf5e" stroke-width="2" data-playhead="true"/>`);
  parts.push(`<circle cx="${playheadX}" cy="14" r="4" fill="#ffcf5e" data-playhead-handle="true"/>`);
  parts.push(`<text x="${width - 8}" y="${height - 10}" fill="#cfd6ff" font-size="10" text-anchor="end">${svgEscape(sequence.name)} · ${duration.toFixed(1)}s · ${rows.length} channels</text>`);
  parts.push('</svg>');
  return parts.join('');
}

function presetTrack(sequence, name, kind, channels, targetName = name) {
  const track = addSequenceTrack(sequence, { name, targetName, kind });
  for (const [property, keys] of Object.entries(channels)) {
    for (const [time, value, interpolation = 'bezier', tangentOut = 0, tangentIn = 0] of keys) {
      insertKeyframe(sequence, track.id, property, time, value, { interpolation, tangentOut, tangentIn });
    }
  }
  return track;
}

function buildSequencerPresets() {
  const presets = {};

  const turntable = createTimelineSequence({ name: 'Turntable Showcase', duration: 8, fps: 30, loop: true });
  presetTrack(turntable, 'Hero Product', 'transform', {
    'rotation.y': [[0, 0, 'linear'], [8, Math.PI * 2, 'linear']],
    'position.y': [[0, 0, 'easeInOut'], [2, 0.18, 'easeInOut'], [4, 0, 'easeInOut'], [6, 0.18, 'easeInOut'], [8, 0, 'easeInOut']],
    'scale.x': [[0, 1, 'bezier', 0.05, 0], [4, 1.06, 'bezier', 0, 0], [8, 1, 'bezier', 0, -0.05]],
    'scale.y': [[0, 1, 'bezier', 0.05, 0], [4, 1.06, 'bezier', 0, 0], [8, 1, 'bezier', 0, -0.05]],
    'scale.z': [[0, 1, 'bezier', 0.05, 0], [4, 1.06, 'bezier', 0, 0], [8, 1, 'bezier', 0, -0.05]],
  });
  presetTrack(turntable, 'Hero Product', 'material', {
    'material.emissive': [[0, 0.05, 'easeInOut'], [4, 0.45, 'easeInOut'], [8, 0.05, 'easeInOut']],
    'material.roughness': [[0, 0.5, 'linear'], [8, 0.22, 'linear']],
  });
  addMarker(turntable, { time: 0, label: 'Start' });
  addMarker(turntable, { time: 4, label: 'Half turn' });
  presets['turntable-showcase'] = turntable;

  const sweeps = createTimelineSequence({ name: 'Cinematic Camera Sweeps', duration: 12, fps: 30 });
  presetTrack(sweeps, 'Scene Camera', 'camera', {
    'camera.position.x': [[0, -7, 'bezier', 0.8, 0], [4, 0, 'bezier', 0, 0], [8, 6, 'bezier', 0, 0], [12, 2, 'bezier', 0, -0.6]],
    'camera.position.y': [[0, 1.2, 'bezier', 0.4, 0], [4, 2.6, 'bezier', 0, 0], [8, 4.5, 'bezier', 0, 0], [12, 2, 'easeInOut']],
    'camera.position.z': [[0, 9, 'easeInOut'], [6, 6, 'easeInOut'], [12, 8, 'easeInOut']],
    'camera.target.x': [[0, -1, 'linear'], [12, 1, 'linear']],
    'camera.target.y': [[0, 0.4, 'easeInOut'], [6, 1.2, 'easeInOut'], [12, 0.6, 'easeInOut']],
  }, 'Scene Camera');
  presetTrack(sweeps, 'Key Light', 'light', {
    intensity: [[0, 1.4, 'easeInOut'], [6, 2.8, 'easeInOut'], [12, 1.8, 'easeInOut']],
  });
  addMarker(sweeps, { time: 0, label: 'Wide open' });
  addMarker(sweeps, { time: 6, label: 'Crane up' });
  addMarker(sweeps, { time: 12, label: 'Hero settle' });
  presets['cinematic-camera-sweeps'] = sweeps;

  const hover = createTimelineSequence({ name: 'Hover Pulse', duration: 3, fps: 30, loop: true });
  presetTrack(hover, 'Hover Drone', 'transform', {
    'position.y': [[0, 1, 'easeInOut'], [0.75, 1.35, 'easeInOut'], [1.5, 1, 'easeInOut'], [2.25, 1.35, 'easeInOut'], [3, 1, 'easeInOut']],
    'rotation.z': [[0, -0.06, 'easeInOut'], [1.5, 0.06, 'easeInOut'], [3, -0.06, 'easeInOut']],
  });
  presetTrack(hover, 'Hover Drone', 'material', {
    'material.emissive': [[0, 0.4, 'bounce'], [1.5, 1.2, 'bounce'], [3, 0.4, 'bounce']],
  });
  presets['hover-pulse'] = hover;

  const quake = createTimelineSequence({ name: 'Earthquake Camera Shake', duration: 4, fps: 60 });
  const shakeX = []; const shakeY = [];
  for (let i = 0; i <= 24; i++) {
    const time = (i / 24) * 4;
    const decay = 1 - i / 28;
    shakeX.push([time, Math.sin(i * 12.9898) * 0.16 * decay, 'linear']);
    shakeY.push([time, Math.cos(i * 7.233) * 0.12 * decay, 'linear']);
  }
  presetTrack(quake, 'Scene Camera', 'camera', {
    'camera.position.x': shakeX,
    'camera.position.y': shakeY,
    'camera.position.z': [[0, 8, 'step'], [4, 8, 'step']],
  }, 'Scene Camera');
  presetTrack(quake, 'Dust Light', 'light', {
    intensity: [[0, 2, 'step'], [0.4, 0.6, 'step'], [0.7, 2.2, 'step'], [1.4, 1.2, 'easeInOut'], [4, 1.8, 'easeInOut']],
  });
  addMarker(quake, { time: 0, label: 'Impact' });
  presets['earthquake-camera-shake'] = quake;

  const dayNight = createTimelineSequence({ name: 'Day to Night Lighting', duration: 16, fps: 24, loop: true });
  presetTrack(dayNight, 'Sun Light', 'light', {
    intensity: [[0, 3, 'easeInOut'], [4, 2.6, 'easeInOut'], [8, 1.2, 'easeInOut'], [12, 0.25, 'easeInOut'], [16, 3, 'easeInOut']],
    'color.r': [[0, 1, 'linear'], [8, 1, 'linear'], [12, 0.55, 'linear'], [16, 1, 'linear']],
    'color.g': [[0, 0.95, 'linear'], [8, 0.62, 'linear'], [12, 0.62, 'linear'], [16, 0.95, 'linear']],
    'color.b': [[0, 0.85, 'linear'], [8, 0.45, 'linear'], [12, 0.95, 'linear'], [16, 0.85, 'linear']],
  });
  presetTrack(dayNight, 'Hero Product', 'material', {
    'material.emissive': [[0, 0, 'easeInOut'], [10, 0.1, 'easeInOut'], [13, 0.9, 'easeInOut'], [16, 0, 'easeInOut']],
  });
  addMarker(dayNight, { time: 8, label: 'Golden hour' });
  addMarker(dayNight, { time: 12, label: 'Midnight' });
  presets['day-to-night-lighting'] = dayNight;

  const combo = createTimelineSequence({ name: 'Biped Hero Combo', duration: 2.4, fps: 30 });
  presetTrack(combo, 'Hero', 'bone', {
    'bone.rotation.x': [[0, 0, 'easeInOut'], [0.4, -0.5, 'easeInOut'], [0.7, 0.35, 'elastic'], [1.2, 0.1, 'easeInOut'], [1.8, -0.25, 'bounce'], [2.4, 0, 'easeInOut']],
    'bone.rotation.z': [[0, 0, 'linear'], [0.7, 0.45, 'linear'], [1.4, -0.3, 'linear'], [2.4, 0, 'linear']],
    'bone.position.y': [[0, 0, 'easeInOut'], [0.7, 0.22, 'easeInOut'], [1.2, 0, 'bounce'], [1.8, 0.15, 'easeInOut'], [2.4, 0, 'easeInOut']],
  });
  presetTrack(combo, 'Hero', 'transform', {
    'position.z': [[0, 0, 'easeInOut'], [0.7, 0.8, 'easeInOut'], [1.4, 1.1, 'easeInOut'], [2.4, 1.2, 'easeInOut']],
    'rotation.y': [[0, 0, 'linear'], [2.4, Math.PI * 0.5, 'easeInOut']],
  });
  addMarker(combo, { time: 0.7, label: 'Strike 1', action: 'sword-slash' });
  addMarker(combo, { time: 1.4, label: 'Spin', action: 'portal-hum' });
  addMarker(combo, { time: 2.4, label: 'Recover' });
  presets['biped-hero-combo'] = combo;

  const bossIntro = createTimelineSequence({ name: 'Boss Fight Intro', duration: 5, fps: 30 });
  presetTrack(bossIntro, 'Boss Brute', 'transform', {
    'position.y': [[0, -3, 'easeInOut'], [1.2, 0, 'bounce'], [2, 0, 'easeInOut'], [3, 0.25, 'easeInOut'], [5, 0, 'easeInOut']],
    'scale.x': [[0, 1.6, 'easeInOut'], [1.2, 1, 'bounce'], [5, 1, 'linear']],
  });
  presetTrack(bossIntro, 'Boss Brute', 'material', {
    'material.emissive': [[0, 0, 'linear'], [2.2, 0, 'linear'], [2.6, 1.6, 'step'], [3.4, 0.3, 'easeInOut'], [5, 0.8, 'easeInOut']],
  });
  presetTrack(bossIntro, 'Scene Camera', 'camera', {
    'camera.position.z': [[0, 16, 'easeInOut'], [1.2, 9, 'bounce'], [5, 7, 'easeInOut']],
    'camera.position.y': [[0, 4, 'easeInOut'], [5, 2.2, 'easeInOut']],
  }, 'Scene Camera');
  addMarker(bossIntro, { time: 0, label: 'Silence' });
  addMarker(bossIntro, { time: 1.2, label: 'Boss lands', action: 'Boss Stomp' });
  addMarker(bossIntro, { time: 2.6, label: 'Eyes ignite', action: 'Portal Hum' });
  addMarker(bossIntro, { time: 5, label: 'Fight!' });
  presets['boss-fight-intro'] = bossIntro;

  const fanfare = createTimelineSequence({ name: 'Victory Celebration Fanfare', duration: 6, fps: 30, loop: true });
  presetTrack(fanfare, 'Hero', 'transform', {
    'position.y': [[0, 0, 'easeInOut'], [0.8, 1.1, 'bounce'], [1.6, 0, 'bounce'], [2.4, 1.1, 'bounce'], [3.2, 0, 'bounce'], [6, 0, 'easeInOut']],
    'rotation.y': [[0, 0, 'linear'], [3.2, Math.PI * 2, 'easeInOut'], [6, Math.PI * 2, 'linear']],
  });
  presetTrack(fanfare, 'Confetti Cannon', 'material', {
    'material.emissive': [[0, 0.2, 'linear'], [0.8, 1.8, 'step'], [2.4, 1.8, 'step'], [3.2, 0.4, 'easeInOut'], [6, 0.2, 'linear']],
  });
  addMarker(fanfare, { time: 0.8, label: 'Confetti burst', action: 'Confetti Pop' });
  addMarker(fanfare, { time: 2.4, label: 'Second burst' });
  addMarker(fanfare, { time: 6, label: 'Loop' });
  presets['victory-celebration-fanfare'] = fanfare;

  return Object.freeze(presets);
}

export const SEQUENCER_PRESETS = buildSequencerPresets();

export function getSequencerPreset(presetId) {
  const preset = SEQUENCER_PRESETS[presetId];
  if (!preset) throw new Error(`Unknown sequencer preset "${presetId}". Available: ${Object.keys(SEQUENCER_PRESETS).join(', ')}.`);
  return cloneSequence(preset);
}

export function listSequencerPresets() {
  return Object.entries(SEQUENCER_PRESETS).map(([id, sequence]) => ({
    id, name: sequence.name, duration: sequence.duration, fps: sequence.fps,
    tracks: sequence.tracks.length, keyframes: listKeyframes(sequence).length, loop: sequence.loop,
  }));
}

/** Attach a cloned preset onto a scene object name; returns the bound sequence. */
export function attachSequencerPreset(scene, presetId, targetName) {
  const sequence = getSequencerPreset(presetId);
  if (targetName) {
    for (const track of sequence.tracks) {
      if (track.kind === 'transform' || track.kind === 'material' || track.kind === 'bone') {
        track.targetName = String(targetName);
        track.name = String(targetName);
      }
    }
  }
  if (scene && typeof scene === 'object') {
    scene.sequences = Array.isArray(scene.sequences) ? scene.sequences : [];
    scene.sequences.push(sequence);
  }
  return sequence;
}

/** Transport helper: advance a playback state object with delta-time. */
export function createPlaybackState(sequence, options = {}) {
  return {
    sequence: normalizeTimelineSequence(sequence),
    time: clamp(finite(options.time, 0), 0, sequence.duration),
    playing: options.playing === true,
    speed: clamp(finite(options.speed, 1), 0.01, 16),
    direction: options.direction === -1 ? -1 : 1,
    finished: false,
  };
}

export function stepPlayback(state, dtSeconds, scene = null) {
  if (!state || typeof state !== 'object') throw new TypeError('Playback state required.');
  const dt = clamp(finite(dtSeconds, 0), 0, 10);
  if (state.playing) {
    state.time += dt * state.speed * state.direction;
    const duration = sequenceDuration(state.sequence);
    if (state.sequence.loop) {
      state.time = resolveSequenceTime(state.sequence, state.time);
      state.finished = false;
    } else if (state.time >= duration) {
      state.time = duration;
      state.finished = true;
      state.playing = false;
    } else if (state.time <= 0 && state.direction === -1) {
      state.time = 0;
      state.finished = true;
      state.playing = false;
    }
  }
  return sampleTimelineAtTime(state.sequence, state.time, scene);
}

export function seekPlayback(state, timeSeconds, scene = null) {
  state.time = clamp(finite(timeSeconds, 0), 0, sequenceDuration(state.sequence));
  state.finished = false;
  return sampleTimelineAtTime(state.sequence, state.time, scene);
}

export function playSequence(state) { state.playing = true; state.finished = false; return state; }
export function pauseSequence(state) { state.playing = false; return state; }
export function stopSequence(state) { state.playing = false; state.time = 0; state.finished = false; return state; }

/** Validate a sequence and report structural diagnostics. */
export function validateTimelineSequence(input) {
  const diagnostics = [];
  try {
    const sequence = normalizeTimelineSequence(input);
    if (!sequence.tracks.length) diagnostics.push({ level: 'warning', message: 'Sequence has no tracks.' });
    for (const track of sequence.tracks) {
      if (!track.channels.length) diagnostics.push({ level: 'warning', message: `Track "${track.name}" has no channels.` });
      for (const channel of track.channels) {
        for (let i = 1; i < channel.keyframes.length; i++) {
          if (channel.keyframes[i].time < channel.keyframes[i - 1].time) {
            diagnostics.push({ level: 'error', message: `Channel ${channel.property} keyframes are out of order.` });
          }
        }
      }
    }
    return { ok: !diagnostics.some((d) => d.level === 'error'), diagnostics, sequence };
  } catch (error) {
    return { ok: false, diagnostics: [{ level: 'error', message: String(error.message || error) }], sequence: null };
  }
}

export function sequenceToJson(sequence) {
  return JSON.stringify(normalizeTimelineSequence(sequence), null, 2);
}

export function sequenceFromJson(json) {
  return normalizeTimelineSequence(typeof json === 'string' ? JSON.parse(json) : json);
}
