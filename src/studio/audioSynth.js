/**
 * Orvexa AudioSynth — procedural WebAudio sound FX, chiptune / ambient music
 * synthesis, 3D spatial audio math and deterministic offline PCM WAV export.
 *
 * Zero external audio files: every preset is synthesized from oscillators,
 * filtered noise, envelopes and note sequences. The offline renderer mixes
 * the same event graphs into a 16-bit PCM RIFF/WAVE buffer, so it produces a
 * real .wav in headless Node tests and in the browser alike.
 */
export const AUDIO_SYNTH_VERSION = 1;
export const AUDIO_SAMPLE_RATE = 22050;
export const AUDIO_MAX_DURATION = 12;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;

function seededNoiseState(seed = 1337) {
  let state = (Math.trunc(finite(seed, 1337)) || 1337) >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) >>> 0);
    state = (state ^ (state >>> 13)) >>> 0;
    return ((state >>> 0) / 4294967296) * 2 - 1;
  };
}

export const NOTE_FREQUENCIES = Object.freeze({
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, F6: 1396.91, G6: 1567.98, A6: 1760.0,
});

export function noteToFrequency(note) {
  if (typeof note === 'number') return clamp(note, 10, 16000);
  const found = NOTE_FREQUENCIES[String(note || '').toUpperCase()];
  if (found) return found;
  const match = String(note || '').match(/^([A-G])(#|b)?(-?\d)$/i);
  if (!match) return 440;
  const semitoneMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let semitone = semitoneMap[match[1].toUpperCase()];
  if (match[2] === '#') semitone += 1;
  if (match[2] === 'b') semitone -= 1;
  const octave = Number(match[3]);
  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function frequencyToNote(freq) {
  const f = clamp(finite(freq, 440), 10, 16000);
  const midi = Math.round(69 + 12 * Math.log2(f / 440));
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return { name: `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`, midi, cents: Math.round((69 + 12 * Math.log2(f / 440) - midi) * 100) };
}

const ev = (time, note, duration, type = 'sine', gain = 0.5, options = {}) => ({
  time, freq: typeof note === 'string' ? noteToFrequency(note) : note, note: typeof note === 'string' ? note : null,
  duration, type, gain, slideTo: options.slideTo ? (typeof options.slideTo === 'string' ? noteToFrequency(options.slideTo) : options.slideTo) : null,
  attack: options.attack ?? 0.005, decay: options.decay ?? 0.08, sustain: options.sustain ?? 0.6, release: options.release ?? 0.08,
  filterFreq: options.filterFreq ?? 8000, detune: options.detune ?? 0, pan: options.pan ?? 0,
});
const noiseEv = (time, duration, gain = 0.4, options = {}) => ({
  time, freq: 0, note: null, duration, type: 'noise', gain,
  attack: options.attack ?? 0.003, decay: options.decay ?? 0.1, sustain: options.sustain ?? 0.4, release: options.release ?? 0.1,
  filterFreq: options.filterFreq ?? 3000, slideTo: null, detune: 0, pan: options.pan ?? 0,
});
const arp = (start, notes, step, type = 'triangle', gain = 0.32, noteDur = null) => notes.map((n, i) => ev(start + i * step, n, noteDur ?? step * 1.8, type, gain));
const bassLine = (start, notes, step, gain = 0.42) => notes.map((n, i) => ev(start + i * step, n, step * 0.95, 'sawtooth', gain, { filterFreq: 900 }));
const drumHit = (time, kind = 'kick') => {
  if (kind === 'kick') return ev(time, 120, 0.22, 'sine', 0.85, { slideTo: 42, attack: 0.002, decay: 0.16, sustain: 0.1, release: 0.05 });
  if (kind === 'snare') return noiseEv(time, 0.16, 0.55, { filterFreq: 5200, decay: 0.1 });
  if (kind === 'hat') return noiseEv(time, 0.06, 0.3, { filterFreq: 11000, decay: 0.04, sustain: 0.15 });
  return noiseEv(time, 0.2, 0.4, { filterFreq: 2600 });
};
const beat = (start, bars = 2, bpm = 132) => {
  const step = 60 / bpm / 2; const out = [];
  for (let i = 0; i < bars * 8; i++) {
    const t = start + i * step;
    if (i % 4 === 0) out.push(drumHit(t, 'kick'));
    if (i % 8 === 4) out.push(drumHit(t, 'snare'));
    out.push(drumHit(t, 'hat'));
  }
  return out;
};

export const AUDIO_SYNTH_PRESETS = Object.freeze({
  'sword-slash': {
    label: 'Sword Slash', category: 'sfx', duration: 0.55, masterGain: 0.8,
    description: 'A bright steel whoosh with a metallic ring tail.',
    events: [
      noiseEv(0, 0.34, 0.65, { filterFreq: 6200, decay: 0.2, sustain: 0.25 }),
      ev(0.02, 'E6', 0.3, 'sawtooth', 0.22, { slideTo: 'A4', filterFreq: 7000, decay: 0.22 }),
      ev(0.05, 'B5', 0.22, 'triangle', 0.28, { slideTo: 'E5' }),
      ev(0.18, 'A5', 0.3, 'sine', 0.16, { decay: 0.25, sustain: 0.2 }),
    ],
  },
  'laser-blaster': {
    label: 'Laser Blaster', category: 'sfx', duration: 0.5, masterGain: 0.75,
    description: 'Classic descending zap with a square-wave bite.',
    events: [
      ev(0, 'A5', 0.34, 'square', 0.4, { slideTo: 'E3', filterFreq: 5000, decay: 0.26 }),
      ev(0.02, 'E6', 0.24, 'sawtooth', 0.2, { slideTo: 'A3', filterFreq: 6000 }),
      noiseEv(0, 0.1, 0.15, { filterFreq: 9000 }),
      ev(0.3, 'C5', 0.14, 'square', 0.14, { slideTo: 'G3' }),
    ],
  },
  'explosion-boom': {
    label: 'Explosion Boom', category: 'sfx', duration: 1.6, masterGain: 1,
    description: 'Sub-bass thump, debris noise and a long rumble tail.',
    events: [
      ev(0, 92, 0.9, 'sine', 0.95, { slideTo: 30, attack: 0.004, decay: 0.55, sustain: 0.25, release: 0.4 }),
      noiseEv(0, 1.15, 0.7, { filterFreq: 2400, decay: 0.6, sustain: 0.2, release: 0.4 }),
      noiseEv(0.08, 0.7, 0.4, { filterFreq: 5200, decay: 0.35 }),
      ev(0.05, 'C2', 0.8, 'triangle', 0.4, { slideTo: 'C1' in NOTE_FREQUENCIES ? 'C2' : 33, decay: 0.5 }),
      ev(0.5, 48, 0.8, 'sine', 0.25, { slideTo: 28, decay: 0.6, sustain: 0.12 }),
    ],
  },
  'coin-pickup': {
    label: 'Coin Pickup', category: 'sfx', duration: 0.5, masterGain: 0.65,
    description: 'Two-note arcade coin chirp with a sparkle tail.',
    events: [
      ev(0, 'B5', 0.09, 'square', 0.32, { decay: 0.06 }),
      ev(0.08, 'E6', 0.32, 'square', 0.3, { decay: 0.22, sustain: 0.25 }),
      ev(0.08, 'E6', 0.28, 'sine', 0.18, { decay: 0.2 }),
      ev(0.22, 'G6', 0.16, 'triangle', 0.1, { decay: 0.12 }),
    ],
  },
  'jump-boing': {
    label: 'Jump Boing', category: 'sfx', duration: 0.45, masterGain: 0.7,
    description: 'Springy upward pitch bend, cartoon platformer style.',
    events: [
      ev(0, 'C3', 0.36, 'sine', 0.6, { slideTo: 'C5', attack: 0.004, decay: 0.25, sustain: 0.3 }),
      ev(0, 'G3', 0.3, 'triangle', 0.24, { slideTo: 'G4' }),
      ev(0.26, 'E5', 0.12, 'sine', 0.14, { decay: 0.08 }),
    ],
  },
  'powerup-chime': {
    label: 'Power-Up Chime', category: 'sfx', duration: 0.9, masterGain: 0.7,
    description: 'Rising major arpeggio with shimmering harmonics.',
    events: [
      ...arp(0, ['C5', 'E5', 'G5', 'C6'], 0.09, 'triangle', 0.34),
      ...arp(0.05, ['E5', 'G5', 'C6', 'E6'], 0.09, 'sine', 0.16),
      ev(0.4, 'C6', 0.4, 'sine', 0.2, { decay: 0.3, sustain: 0.25 }),
      ev(0.4, 'G5', 0.35, 'triangle', 0.12, { decay: 0.28 }),
    ],
  },
  'footstep-stone': {
    label: 'Footstep on Stone', category: 'sfx', duration: 0.28, masterGain: 0.55,
    description: 'Short gritty stone tap with a low heel thud.',
    events: [
      noiseEv(0, 0.09, 0.5, { filterFreq: 1500, decay: 0.06, sustain: 0.2 }),
      ev(0.005, 95, 0.1, 'sine', 0.42, { slideTo: 55, decay: 0.08 }),
      noiseEv(0.03, 0.05, 0.22, { filterFreq: 3600, decay: 0.04 }),
    ],
  },
  'portal-hum': {
    label: 'Portal Hum', category: 'sfx', duration: 2.4, masterGain: 0.6,
    description: 'Detuned arcane drone with slow beating and a shimmer partial.',
    events: [
      ev(0, 'A2', 2.3, 'sine', 0.4, { attack: 0.25, decay: 0.4, sustain: 0.75, release: 0.5 }),
      ev(0, 'A2', 2.3, 'sine', 0.34, { attack: 0.3, decay: 0.4, sustain: 0.75, release: 0.5, detune: 9 }),
      ev(0.1, 'E3', 2.1, 'triangle', 0.2, { attack: 0.35, sustain: 0.7, release: 0.5 }),
      ev(0.2, 'C5', 1.8, 'sine', 0.08, { attack: 0.5, sustain: 0.6, release: 0.6 }),
      ev(1.2, 'E5', 1, 'sine', 0.06, { attack: 0.3, sustain: 0.5, release: 0.4 }),
    ],
  },
  'thunder-crack': {
    label: 'Thunder Crack', category: 'sfx', duration: 2.2, masterGain: 0.95,
    description: 'Lightning crack transient into rolling low thunder.',
    events: [
      noiseEv(0, 0.16, 0.9, { filterFreq: 10000, decay: 0.1, sustain: 0.3 }),
      noiseEv(0.02, 1.8, 0.55, { filterFreq: 900, decay: 0.9, sustain: 0.25, release: 0.6 }),
      ev(0.02, 64, 1.4, 'sine', 0.55, { slideTo: 30, decay: 0.8, sustain: 0.25, release: 0.5 }),
      noiseEv(0.35, 0.9, 0.3, { filterFreq: 600, decay: 0.5 }),
    ],
  },
  'ui-click': {
    label: 'UI Click', category: 'sfx', duration: 0.16, masterGain: 0.5,
    description: 'Crisp interface tick for buttons and menus.',
    events: [
      ev(0, 'E6', 0.07, 'square', 0.24, { decay: 0.05, sustain: 0.15 }),
      noiseEv(0, 0.035, 0.2, { filterFreq: 8000, decay: 0.03 }),
    ],
  },
  'victory-fanfare': {
    label: 'Victory Fanfare', category: 'music', duration: 2.6, masterGain: 0.75,
    description: 'Brass-style major fanfare with a timpani roll.',
    events: [
      ...arp(0, ['C4', 'E4', 'G4'], 0.14, 'sawtooth', 0.3),
      ev(0.45, 'C5', 0.55, 'sawtooth', 0.36, { decay: 0.35, sustain: 0.5, filterFreq: 3800 }),
      ev(0.45, 'G4', 0.55, 'square', 0.18, { decay: 0.35, filterFreq: 3000 }),
      ...arp(1.15, ['F4', 'A4', 'C5'], 0.12, 'sawtooth', 0.28),
      ev(1.55, 'G4', 0.3, 'sawtooth', 0.3),
      ev(1.9, 'C5', 0.62, 'sawtooth', 0.38, { decay: 0.4, sustain: 0.4, filterFreq: 4000 }),
      ev(1.9, 'E5', 0.5, 'triangle', 0.2, { decay: 0.35 }),
      drumHit(0, 'kick'), drumHit(1.9, 'kick'), drumHit(1.95, 'snare'),
    ],
  },
  'game-over-dirge': {
    label: 'Game Over Dirge', category: 'music', duration: 3, masterGain: 0.65,
    description: 'Slow descending minor dirge for defeat screens.',
    events: [
      ev(0, 'A3', 0.65, 'triangle', 0.36, { attack: 0.02, decay: 0.4, sustain: 0.5, release: 0.2 }),
      ev(0.65, 'F3', 0.65, 'triangle', 0.34, { attack: 0.02, decay: 0.4, sustain: 0.5, release: 0.2 }),
      ev(1.3, 'D3', 0.65, 'triangle', 0.32, { attack: 0.02, decay: 0.4, sustain: 0.5, release: 0.25 }),
      ev(1.95, 'A2', 0.95, 'triangle', 0.36, { attack: 0.02, decay: 0.6, sustain: 0.4, release: 0.35 }),
      ev(1.95, 'E3', 0.9, 'sine', 0.18, { sustain: 0.4, release: 0.35 }),
      noiseEv(0, 2.8, 0.05, { filterFreq: 500, sustain: 0.6 }),
    ],
  },
  'ambient-wind-pad': {
    label: 'Ambient Wind Pad', category: 'music', duration: 6, masterGain: 0.55, loop: true,
    description: 'Breathing major pad under slow filtered wind noise.',
    events: [
      ev(0, 'C3', 5.6, 'triangle', 0.26, { attack: 1.2, decay: 1, sustain: 0.7, release: 1.4 }),
      ev(0, 'G3', 5.6, 'triangle', 0.2, { attack: 1.4, sustain: 0.65, release: 1.4 }),
      ev(0.4, 'E4', 5, 'sine', 0.12, { attack: 1.6, sustain: 0.6, release: 1.4 }),
      noiseEv(0, 5.8, 0.12, { filterFreq: 700, attack: 1, sustain: 0.7, release: 1.4 }),
      noiseEv(2.5, 3, 0.08, { filterFreq: 1200, attack: 0.8, sustain: 0.6, release: 1 }),
      ev(3, 'A3', 2.6, 'sine', 0.1, { attack: 0.9, sustain: 0.5, release: 0.9 }),
    ],
  },
  'cyberpunk-bass-loop': {
    label: 'Cyberpunk Bass Loop', category: 'music', duration: 4.4, masterGain: 0.8, loop: true,
    description: 'Driving saw bass, four-on-the-floor drums and neon arp stabs.',
    events: [
      ...beat(0, 2, 132),
      ...bassLine(0, ['A2', 'A2', 'C3', 'A2', 'A2', 'A2', 'G2', 'E2'], 60 / 132),
      ...bassLine(2.18, ['F2', 'F2', 'A2', 'F2', 'G2', 'G2', 'B2', 'D3'], 60 / 132),
      ...arp(0.9, ['A4', 'C5', 'E5', 'A5'], 0.115, 'square', 0.13),
      ...arp(3.1, ['F4', 'A4', 'C5', 'F5'], 0.115, 'square', 0.13),
    ],
  },
  'fantasy-harp-arpeggio': {
    label: 'Fantasy Harp Arpeggio', category: 'music', duration: 5, masterGain: 0.6, loop: true,
    description: 'Gentle plucked harp arpeggios over a warm tonic pad.',
    events: [
      ...arp(0, ['C4', 'E4', 'G4', 'C5', 'E5', 'G4', 'E4', 'C4'], 0.24, 'triangle', 0.3, 0.5),
      ...arp(2, ['A3', 'C4', 'E4', 'A4', 'C5', 'E4', 'C4', 'A3'], 0.24, 'triangle', 0.27, 0.5),
      ev(0, 'C3', 4.6, 'sine', 0.16, { attack: 0.4, sustain: 0.6, release: 0.8 }),
      ev(2, 'A2', 2.7, 'sine', 0.14, { attack: 0.4, sustain: 0.55, release: 0.8 }),
      ev(4.1, 'G4', 0.7, 'sine', 0.1, { decay: 0.5, sustain: 0.2 }),
    ],
  },
  'dungeon-drone-loop': {
    label: 'Dungeon Drone Loop', category: 'music', duration: 6, masterGain: 0.62, loop: true,
    description: 'Minor drone, distant bell tolls and subterranean rumble.',
    events: [
      ev(0, 'D2', 5.8, 'sawtooth', 0.2, { attack: 0.6, sustain: 0.7, release: 1, filterFreq: 500 }),
      ev(0, 'D2', 5.8, 'sine', 0.3, { attack: 0.5, sustain: 0.75, release: 1, detune: 6 }),
      ev(0.3, 'A2', 5.2, 'triangle', 0.12, { attack: 0.8, sustain: 0.6, release: 1 }),
      ev(1.5, 'D4', 1.6, 'sine', 0.14, { attack: 0.01, decay: 1.1, sustain: 0.1, release: 0.5 }),
      ev(3.8, 'C4', 1.7, 'sine', 0.11, { attack: 0.01, decay: 1.2, sustain: 0.1, release: 0.5 }),
      noiseEv(0, 5.8, 0.06, { filterFreq: 300, sustain: 0.7, release: 1 }),
      ev(5, 'F3', 0.9, 'triangle', 0.08, { decay: 0.6, sustain: 0.2 }),
    ],
  },
});

export function getAudioSynthPreset(presetId) {
  const preset = AUDIO_SYNTH_PRESETS[presetId];
  if (!preset) throw new Error(`Unknown audio synth preset "${presetId}". Available: ${Object.keys(AUDIO_SYNTH_PRESETS).join(', ')}.`);
  return preset;
}

export function listAudioSynthPresets() {
  return Object.entries(AUDIO_SYNTH_PRESETS).map(([id, preset]) => ({
    id, label: preset.label, category: preset.category, duration: preset.duration,
    events: preset.events.length, loop: Boolean(preset.loop), description: preset.description,
  }));
}

export function normalizeSynthEvent(raw, index = 0) {
  if (!raw || typeof raw !== 'object') throw new TypeError(`Synth event ${index + 1} is not an object.`);
  return {
    time: Math.max(0, finite(raw.time, 0)),
    freq: raw.note ? noteToFrequency(raw.note) : clamp(finite(raw.freq, 440), 0, 16000),
    note: raw.note || null,
    duration: clamp(finite(raw.duration, 0.25), 0.01, AUDIO_MAX_DURATION),
    type: ['sine', 'square', 'triangle', 'sawtooth', 'noise'].includes(raw.type) ? raw.type : 'sine',
    gain: clamp(finite(raw.gain, 0.4), 0, 1.5),
    slideTo: raw.slideTo ? clamp(finite(typeof raw.slideTo === 'string' ? noteToFrequency(raw.slideTo) : raw.slideTo, 440), 10, 16000) : null,
    attack: clamp(finite(raw.attack, 0.005), 0, 4),
    decay: clamp(finite(raw.decay, 0.08), 0, 6),
    sustain: clamp(finite(raw.sustain, 0.6), 0, 1),
    release: clamp(finite(raw.release, 0.08), 0, 6),
    filterFreq: clamp(finite(raw.filterFreq, 8000), 40, 18000),
    detune: clamp(finite(raw.detune, 0), -1200, 1200),
    pan: clamp(finite(raw.pan, 0), -1, 1),
  };
}

export function normalizeSynthPreset(input = {}) {
  if (typeof input === 'string') return getAudioSynthPreset(input);
  if (!input || typeof input !== 'object') throw new TypeError('Synth preset object required.');
  return {
    label: String(input.label || 'Custom Synth'),
    category: String(input.category || 'custom'),
    duration: clamp(finite(input.duration, 2), 0.05, AUDIO_MAX_DURATION),
    masterGain: clamp(finite(input.masterGain, 0.7), 0.01, 1.5),
    loop: input.loop === true,
    description: String(input.description || ''),
    events: (input.events || []).map((e, i) => normalizeSynthEvent(e, i)),
  };
}

function oscillatorSample(type, phase) {
  const p = phase - Math.floor(phase);
  switch (type) {
    case 'square': return p < 0.5 ? 1 : -1;
    case 'sawtooth': return 2 * p - 1;
    case 'triangle': return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
    case 'sine': default: return Math.sin(2 * Math.PI * p);
  }
}

function adsrGain(localTime, duration, attack, decay, sustain, release) {
  const t = Math.max(0, localTime);
  const releaseStart = Math.max(attack + decay, duration - release);
  if (t >= duration) return 0;
  if (t < attack) return attack <= 0 ? 1 : t / attack;
  if (t < attack + decay) {
    const k = decay <= 0 ? 1 : (t - attack) / decay;
    return 1 + (sustain - 1) * k;
  }
  if (t < releaseStart) return sustain;
  const k = release <= 0 ? 1 : clamp((t - releaseStart) / release, 0, 1);
  return sustain * (1 - k);
}

/**
 * Render a preset (id or object) into a mono Float32Array PCM buffer.
 * Deterministic: the same preset always renders bit-identical samples
 * (seeded noise), which makes it safe for tests and caching.
 */
export function renderSynthPcm(presetInput, options = {}) {
  const preset = normalizeSynthPreset(presetInput);
  const sampleRate = Math.round(clamp(finite(options.sampleRate, AUDIO_SAMPLE_RATE), 4000, 48000));
  const duration = clamp(finite(options.duration, preset.duration), 0.05, AUDIO_MAX_DURATION);
  const total = Math.max(1, Math.round(sampleRate * duration));
  const mix = new Float32Array(total);
  const master = clamp(finite(options.masterGain, preset.masterGain), 0.01, 1.5);
  const noise = seededNoiseState(options.seed ?? 20240);
  const noiseBuffer = new Float32Array(total);
  for (let i = 0; i < total; i++) noiseBuffer[i] = noise();
  for (const rawEvent of preset.events) {
    const event = normalizeSynthEvent(rawEvent);
    const start = Math.round(event.time * sampleRate);
    if (start >= total) continue;
    const length = Math.min(total - start, Math.round(event.duration * sampleRate));
    const detuneFactor = Math.pow(2, event.detune / 1200);
    let phase = 0;
    let filterState = 0;
    const filterAlpha = clamp(1 - Math.exp((-2 * Math.PI * event.filterFreq) / sampleRate), 0.001, 1);
    for (let i = 0; i < length; i++) {
      const local = i / sampleRate;
      const slideK = event.duration > 0 ? clamp(local / event.duration, 0, 1) : 0;
      const freq = (event.slideTo ? event.freq + (event.slideTo - event.freq) * slideK : event.freq) * detuneFactor;
      phase += freq / sampleRate;
      let sample = event.type === 'noise' ? noiseBuffer[start + i] : oscillatorSample(event.type, phase);
      filterState += filterAlpha * (sample - filterState);
      sample = filterState;
      const gain = adsrGain(local, event.duration, event.attack, event.decay, event.sustain, event.release) * event.gain;
      const panGain = 1 - Math.abs(event.pan) * 0.25;
      mix[start + i] += sample * gain * panGain;
    }
  }
  let peak = 0;
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(mix[i]));
  const normalise = peak > 0.99 ? 0.99 / peak : 1;
  for (let i = 0; i < total; i++) mix[i] = clamp(mix[i] * master * normalise, -1, 1);
  return { samples: mix, sampleRate, duration: total / sampleRate, frames: total, peak };
}

export function encodeWavBytes(samples, sampleRate = AUDIO_SAMPLE_RATE, options = {}) {
  const frames = samples.length;
  const channels = options.stereo ? 2 : 1;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const buffer = new Uint8Array(44 + dataSize);
  const view = new DataView(buffer.buffer);
  const writeAscii = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    const value = Math.round(clamp(finite(samples[i], 0), -1, 1) * 32767);
    view.setInt16(offset, value, true); offset += 2;
    if (channels === 2) { view.setInt16(offset, value, true); offset += 2; }
  }
  return buffer;
}

export function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function wavBytesToDataUrl(bytes) {
  return `data:audio/wav;base64,${bytesToBase64(bytes)}`;
}

/**
 * synthesizeWavBytes(preset, options) -> { bytes, dataUrl, sampleRate,
 * duration, frames, presetId } — a complete valid RIFF/WAVE export.
 */
export function synthesizeWavBytes(presetInput, options = {}) {
  const presetId = typeof presetInput === 'string' ? presetInput : null;
  const rendered = renderSynthPcm(presetInput, options);
  const bytes = encodeWavBytes(rendered.samples, rendered.sampleRate, options);
  return {
    bytes,
    dataUrl: wavBytesToDataUrl(bytes),
    sampleRate: rendered.sampleRate,
    duration: rendered.duration,
    frames: rendered.frames,
    peak: rendered.peak,
    presetId,
    mimeType: 'audio/wav',
    byteLength: bytes.length,
  };
}

export function analyzePcm(samples, sampleRate = AUDIO_SAMPLE_RATE) {
  let peak = 0; let sumSquares = 0; let zeroCrossings = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i];
    peak = Math.max(peak, Math.abs(value));
    sumSquares += value * value;
    if (i > 0 && ((samples[i - 1] < 0 && value >= 0) || (samples[i - 1] >= 0 && value < 0))) zeroCrossings++;
  }
  const rms = samples.length ? Math.sqrt(sumSquares / samples.length) : 0;
  const duration = samples.length / Math.max(1, sampleRate);
  return {
    frames: samples.length, duration, peak, rms,
    estimatedHz: duration > 0 ? zeroCrossings / 2 / duration : 0,
    decibels: rms > 0 ? 20 * Math.log10(rms) : -Infinity,
    silent: peak < 0.001,
  };
}

export function analyzeSynthPreset(presetInput, options = {}) {
  const rendered = renderSynthPcm(presetInput, options);
  return { ...analyzePcm(rendered.samples, rendered.sampleRate), presetId: typeof presetInput === 'string' ? presetInput : null };
}

/**
 * 3D spatial audio: inverse-distance gain + equal-power stereo pan +
 * simple air-absorption lowpass estimate, from listener/source positions.
 */
export function computeSpatialAudioGainAndPan(listenerPos = {}, listenerYaw = 0, sourcePos = {}, maxDistance = 40) {
  const lx = finite(listenerPos.x, 0); const ly = finite(listenerPos.y, 0); const lz = finite(listenerPos.z, 0);
  const sx = finite(sourcePos.x, 0); const sy = finite(sourcePos.y, 0); const sz = finite(sourcePos.z, 0);
  const dx = sx - lx; const dy = sy - ly; const dz = sz - lz;
  const distance = Math.hypot(dx, dy, dz);
  const maxDist = clamp(finite(maxDistance, 40), 1, 1000);
  const gain = distance <= 1 ? 1 : clamp(1 / distance, 0, 1) * clamp(1 - Math.max(0, distance - maxDist * 0.7) / (maxDist * 0.6), 0, 1);
  const angleToSource = Math.atan2(dx, dz);
  let relative = angleToSource - finite(listenerYaw, 0);
  while (relative > Math.PI) relative -= Math.PI * 2;
  while (relative < -Math.PI) relative += Math.PI * 2;
  const pan = clamp(Math.sin(relative), -1, 1);
  const leftGain = Math.cos(((pan + 1) * Math.PI) / 4);
  const rightGain = Math.sin(((pan + 1) * Math.PI) / 4);
  return {
    gain: clamp(gain, 0, 1),
    pan,
    leftGain: clamp(leftGain * gain, 0, 1),
    rightGain: clamp(rightGain * gain, 0, 1),
    distance,
    relativeAngle: relative,
    behind: Math.abs(relative) > Math.PI / 2,
    lowpassHz: Math.round(clamp(16000 - distance * 260, 900, 16000)),
    delaySeconds: Number((distance / 343).toFixed(4)),
  };
}

export function spatializePresetEvents(presetInput, listenerPos, listenerYaw, sourcesByEventIndex = {}) {
  const preset = normalizeSynthPreset(presetInput);
  return preset.events.map((event, index) => {
    const source = sourcesByEventIndex[index] || sourcesByEventIndex.default || null;
    if (!source) return event;
    const spatial = computeSpatialAudioGainAndPan(listenerPos, listenerYaw, source.position || source, source.maxDistance);
    return {
      ...event,
      gain: clamp(event.gain * spatial.gain, 0, 1.5),
      pan: spatial.pan,
      filterFreq: Math.min(event.filterFreq || 8000, spatial.lowpassHz),
      spatial,
    };
  });
}

let sharedAudioContext = null;
export function getOrCreateAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioContext) sharedAudioContext = new Ctor();
  if (sharedAudioContext.state === 'suspended') sharedAudioContext.resume().catch(() => {});
  return sharedAudioContext;
}

export function stopSharedAudioContext() {
  if (sharedAudioContext) {
    sharedAudioContext.close().catch(() => {});
    sharedAudioContext = null;
  }
}

/**
 * Play a preset through WebAudio in the browser (no-op returning null in
 * headless environments). Uses an OfflineAudioContext when available to
 * render the exact offline graph, then plays the resulting buffer — this
 * keeps browser playback identical to synthesizeWavBytes output.
 */
export async function playSynthPreset(presetInput, options = {}) {
  const context = options.context || getOrCreateAudioContext();
  if (!context) return null;
  const rendered = renderSynthPcm(presetInput, options);
  const buffer = context.createBuffer(1, rendered.samples.length, rendered.sampleRate);
  buffer.copyToChannel(Float32Array.from(rendered.samples), 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = Boolean(options.loop ?? normalizeSynthPreset(presetInput).loop);
  const gainNode = context.createGain();
  gainNode.gain.value = clamp(finite(options.gain, 1), 0, 2);
  let head = source;
  if (options.spatial && typeof context.createStereoPanner === 'function') {
    const panner = context.createStereoPanner();
    panner.pan.value = clamp(finite(options.spatial.pan, 0), -1, 1);
    gainNode.gain.value *= clamp(finite(options.spatial.gain, 1), 0, 1);
    head.connect(panner);
    head = panner;
  }
  head.connect(gainNode);
  gainNode.connect(options.destination || context.destination);
  source.start(options.when || 0);
  return { context, source, gainNode, buffer, stop: () => { try { source.stop(); } catch { /* already stopped */ } } };
}

export function playSpatialSynthPreset(presetInput, listenerPos, listenerYaw, sourcePos, options = {}) {
  const spatial = computeSpatialAudioGainAndPan(listenerPos, listenerYaw, sourcePos, options.maxDistance);
  return playSynthPreset(presetInput, { ...options, spatial });
}

/** Build a tiny chiptune loop from a note string like "C5 E5 G5 - A4". */
export function chiptuneFromNotes(noteString, options = {}) {
  const tokens = String(noteString || '').trim().split(/\s+/).filter(Boolean);
  const step = clamp(finite(options.step, 0.16), 0.04, 2);
  const events = [];
  tokens.forEach((token, i) => {
    if (token !== '-' && token !== '_') events.push(ev(i * step, token, step * 1.7, options.type || 'square', clamp(finite(options.gain, 0.3), 0.05, 1)));
  });
  return normalizeSynthPreset({
    label: String(options.label || 'Custom Chiptune'),
    category: 'music', duration: Math.max(0.5, tokens.length * step + 0.3),
    masterGain: 0.7, loop: Boolean(options.loop), events,
  });
}

export function harmonizePreset(presetInput, transposeSemitones = 0) {
  const preset = normalizeSynthPreset(presetInput);
  const ratio = Math.pow(2, clamp(finite(transposeSemitones, 0), -24, 24) / 12);
  return {
    ...preset,
    events: preset.events.map((event) => ({
      ...event,
      freq: event.type === 'noise' ? event.freq : clamp(event.freq * ratio, 10, 16000),
      slideTo: event.slideTo ? clamp(event.slideTo * ratio, 10, 16000) : null,
    })),
  };
}

export function stretchPreset(presetInput, factor = 1) {
  const preset = normalizeSynthPreset(presetInput);
  const scale = clamp(finite(factor, 1), 0.25, 4);
  return {
    ...preset,
    duration: clamp(preset.duration * scale, 0.05, AUDIO_MAX_DURATION),
    events: preset.events.map((event) => ({ ...event, time: event.time * scale, duration: clamp(event.duration * scale, 0.01, AUDIO_MAX_DURATION) })),
  };
}

export const AUDIO_PRESET_CATEGORIES = Object.freeze(['sfx', 'music', 'custom']);

export function presetsByCategory(category) {
  return listAudioSynthPresets().filter((p) => p.category === category);
}

/* ------------------------------------------------------------------ */
/* Offline DSP effects chain, WAV parsing and generative composition   */
/* ------------------------------------------------------------------ */

export function applyDelayPcm(samples, sampleRate, options = {}) {
  const out = Float32Array.from(samples);
  const delaySamples = Math.max(1, Math.round(clamp(finite(options.delaySeconds, 0.18), 0.01, 2) * sampleRate));
  const feedback = clamp(finite(options.feedback, 0.35), 0, 0.92);
  const wet = clamp(finite(options.wet, 0.3), 0, 1);
  for (let i = delaySamples; i < out.length; i++) {
    out[i] += out[i - delaySamples] * feedback * wet;
  }
  return out;
}

export function applyDistortionPcm(samples, options = {}) {
  const drive = clamp(finite(options.drive, 2.2), 0.1, 40);
  const mixAmount = clamp(finite(options.mix, 0.7), 0, 1);
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const shaped = Math.tanh(samples[i] * drive);
    out[i] = samples[i] * (1 - mixAmount) + shaped * mixAmount;
  }
  return out;
}

export function applyBitcrushPcm(samples, options = {}) {
  const bits = Math.round(clamp(finite(options.bits, 8), 2, 16));
  const hold = Math.max(1, Math.round(finite(options.downsample, 2)));
  const levels = Math.pow(2, bits) - 1;
  const out = new Float32Array(samples.length);
  let held = 0;
  for (let i = 0; i < samples.length; i++) {
    if (i % hold === 0) held = Math.round(((samples[i] + 1) / 2) * levels) / levels * 2 - 1;
    out[i] = held;
  }
  return out;
}

export function applyChorusPcm(samples, sampleRate, options = {}) {
  const out = Float32Array.from(samples);
  const depth = clamp(finite(options.depthMs, 7), 0.5, 30) / 1000 * sampleRate;
  const rate = clamp(finite(options.rateHz, 0.8), 0.05, 12);
  const wet = clamp(finite(options.wet, 0.35), 0, 1);
  for (let i = 0; i < out.length; i++) {
    const mod = Math.sin((2 * Math.PI * rate * i) / sampleRate) * depth;
    const index = Math.max(0, Math.min(out.length - 1, Math.round(i - 12 - mod)));
    out[i] = samples[i] * (1 - wet) + samples[index] * wet;
  }
  return out;
}

export function applyLowpassPcm(samples, sampleRate, cutoffHz = 6000) {
  const alpha = clamp(1 - Math.exp((-2 * Math.PI * clamp(finite(cutoffHz, 6000), 40, 18000)) / sampleRate), 0.001, 1);
  const out = new Float32Array(samples.length);
  let state = 0;
  for (let i = 0; i < samples.length; i++) { state += alpha * (samples[i] - state); out[i] = state; }
  return out;
}

export function applyHighpassPcm(samples, sampleRate, cutoffHz = 220) {
  const low = applyLowpassPcm(samples, sampleRate, cutoffHz);
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] - low[i];
  return out;
}

export function generateImpulseResponsePcm(sampleRate, options = {}) {
  const duration = clamp(finite(options.duration, 1.4), 0.05, 6);
  const frames = Math.round(sampleRate * duration);
  const out = new Float32Array(frames);
  const noise = seededNoiseState(options.seed ?? 777);
  const decay = clamp(finite(options.decay, 3.2), 0.5, 12);
  for (let i = 0; i < frames; i++) out[i] = noise() * Math.pow(1 - i / frames, decay);
  return out;
}

export function applyReverbPcm(samples, sampleRate, options = {}) {
  const impulse = generateImpulseResponsePcm(sampleRate, options);
  const wet = clamp(finite(options.wet, 0.3), 0, 1);
  const out = Float32Array.from(samples);
  const stride = Math.max(1, Math.round(finite(options.densityStride, 3)));
  for (let i = 0; i < out.length; i += stride) {
    let acc = 0;
    const taps = Math.min(impulse.length, 2200);
    for (let j = 0; j < taps; j += 7) {
      const source = i - j;
      if (source >= 0) acc += samples[source] * impulse[j];
    }
    out[i] += acc * wet * 0.4;
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 1) for (let i = 0; i < out.length; i++) out[i] /= peak;
  return out;
}

export function renderSynthWithEffects(presetInput, options = {}) {
  const rendered = renderSynthPcm(presetInput, options);
  let samples = rendered.samples;
  const fx = options.effects || {};
  if (fx.lowpassHz) samples = applyLowpassPcm(samples, rendered.sampleRate, fx.lowpassHz);
  if (fx.highpassHz) samples = applyHighpassPcm(samples, rendered.sampleRate, fx.highpassHz);
  if (fx.distortion) samples = applyDistortionPcm(samples, fx.distortion === true ? {} : fx.distortion);
  if (fx.bitcrush) samples = applyBitcrushPcm(samples, fx.bitcrush === true ? {} : fx.bitcrush);
  if (fx.chorus) samples = applyChorusPcm(samples, rendered.sampleRate, fx.chorus === true ? {} : fx.chorus);
  if (fx.delay) samples = applyDelayPcm(samples, rendered.sampleRate, fx.delay === true ? {} : fx.delay);
  if (fx.reverb) samples = applyReverbPcm(samples, rendered.sampleRate, fx.reverb === true ? {} : fx.reverb);
  return { ...rendered, samples };
}

export function synthesizeEffectedWavBytes(presetInput, options = {}) {
  const rendered = renderSynthWithEffects(presetInput, options);
  const bytes = encodeWavBytes(rendered.samples, rendered.sampleRate, options);
  return { bytes, dataUrl: wavBytesToDataUrl(bytes), sampleRate: rendered.sampleRate, duration: rendered.duration, frames: rendered.frames, presetId: typeof presetInput === 'string' ? presetInput : null };
}

/** Parse a 16-bit PCM WAV (as produced by encodeWavBytes) back to samples. */
export function parseWavBytes(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset, length) => Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('');
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WAVE') throw new Error('Not a RIFF/WAVE file.');
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bits = view.getUint16(34, true);
  if (bits !== 16) throw new Error(`Only 16-bit PCM WAV supported (got ${bits}).`);
  let offset = 36;
  while (offset + 8 <= bytes.length && ascii(offset, 4) !== 'data') offset += 8 + view.getUint32(offset + 4, true);
  if (offset + 8 > bytes.length) throw new Error('WAV data chunk not found.');
  const dataSize = view.getUint32(offset + 4, true);
  const frames = Math.floor(dataSize / (2 * channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) samples[i] = view.getInt16(offset + 8 + i * 2 * channels, true) / 32767;
  return { samples, sampleRate, channels, frames, duration: frames / sampleRate };
}

export function resamplePcm(samples, fromRate, toRate) {
  const ratio = clamp(finite(toRate, AUDIO_SAMPLE_RATE) / Math.max(1, finite(fromRate, AUDIO_SAMPLE_RATE)), 0.05, 20);
  const outLength = Math.max(1, Math.round(samples.length * ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const source = i / ratio;
    const index = Math.floor(source);
    const frac = source - index;
    const a = samples[Math.min(index, samples.length - 1)] || 0;
    const b = samples[Math.min(index + 1, samples.length - 1)] || 0;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

export function fadePcm(samples, sampleRate, options = {}) {
  const out = Float32Array.from(samples);
  const fadeIn = Math.round(clamp(finite(options.fadeInSeconds, 0.02), 0, 5) * sampleRate);
  const fadeOut = Math.round(clamp(finite(options.fadeOutSeconds, 0.05), 0, 5) * sampleRate);
  for (let i = 0; i < Math.min(fadeIn, out.length); i++) out[i] *= i / Math.max(1, fadeIn);
  for (let i = 0; i < Math.min(fadeOut, out.length); i++) out[out.length - 1 - i] *= i / Math.max(1, fadeOut);
  return out;
}

export function reversePcm(samples) {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[samples.length - 1 - i];
  return out;
}

export function mixPcmBuffers(buffers, options = {}) {
  const length = Math.max(0, ...buffers.map((b) => (b.samples ? b.samples.length : b.length) + Math.round(finite(b.offsetSeconds, 0) * finite(options.sampleRate, AUDIO_SAMPLE_RATE))));
  const out = new Float32Array(length);
  for (const buffer of buffers) {
    const samples = buffer.samples || buffer;
    const offset = Math.round(finite(buffer.offsetSeconds, 0) * finite(options.sampleRate, AUDIO_SAMPLE_RATE));
    const gain = clamp(finite(buffer.gain, 1), 0, 2);
    for (let i = 0; i < samples.length && offset + i < out.length; i++) out[offset + i] += samples[i] * gain;
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0.99) for (let i = 0; i < out.length; i++) out[i] *= 0.99 / peak;
  return out;
}

export function mixSynthPresets(presetIds, options = {}) {
  const rendered = presetIds.map((id, i) => {
    const part = renderSynthPcm(id, options);
    return { samples: part.samples, offsetSeconds: i * clamp(finite(options.staggerSeconds, 0), 0, 4), gain: 0.8 };
  });
  const sampleRate = Math.round(clamp(finite(options.sampleRate, AUDIO_SAMPLE_RATE), 4000, 48000));
  return { samples: mixPcmBuffers(rendered, { sampleRate }), sampleRate };
}

export const MUSICAL_SCALES = Object.freeze({
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  wholeTone: [0, 2, 4, 6, 8, 10],
});

export function scaleNoteFrequency(rootNote, scaleName, degree, octaveOffset = 0) {
  const scale = MUSICAL_SCALES[scaleName] || MUSICAL_SCALES.pentatonic;
  const root = noteToFrequency(rootNote);
  const wraps = Math.floor(degree / scale.length);
  const semitone = scale[((degree % scale.length) + scale.length) % scale.length] + wraps * 12 + octaveOffset * 12;
  return root * Math.pow(2, semitone / 12);
}

/** Deterministic generative melody in any scale — great for game loops. */
export function generateGenerativeMelody(options = {}) {
  const random = seededNoiseState(options.seed ?? 4242);
  const steps = Math.round(clamp(finite(options.steps, 16), 1, 256));
  const stepSeconds = clamp(finite(options.stepSeconds, 0.22), 0.05, 2);
  const root = options.root || 'C4';
  const scale = MUSICAL_SCALES[options.scale] ? options.scale : 'pentatonic';
  const events = [];
  let degree = Math.round(clamp(finite(options.startDegree, 4), 0, 14));
  for (let i = 0; i < steps; i++) {
    degree = clamp(degree + Math.round(random() * 4 - 2), 0, 14);
    if (random() > -0.72) {
      events.push(ev(i * stepSeconds, scaleNoteFrequency(root, scale, degree), stepSeconds * 1.7, options.type || 'triangle', 0.3));
    }
    if (i % 8 === 0) events.push(ev(i * stepSeconds, scaleNoteFrequency(root, scale, 0, -1), stepSeconds * 6, 'sine', 0.18, { sustain: 0.55 }));
  }
  return normalizeSynthPreset({
    label: String(options.label || `Generative ${scale} Melody`), category: 'music',
    duration: steps * stepSeconds + 0.6, masterGain: 0.65, loop: options.loop !== false, events,
  });
}

export function generateDrumPattern(options = {}) {
  const bpm = clamp(finite(options.bpm, 120), 40, 240);
  const bars = Math.round(clamp(finite(options.bars, 2), 1, 16));
  const events = beat(0, bars, bpm);
  if (options.bassNote) events.push(...bassLine(0, Array.from({ length: bars * 8 }, (_, i) => (i % 4 === 2 ? options.altBassNote || options.bassNote : options.bassNote)), 60 / bpm / 2));
  return normalizeSynthPreset({
    label: String(options.label || `${bpm} BPM Drum Pattern`), category: 'music',
    duration: bars * 8 * (60 / bpm / 2) + 0.25, masterGain: 0.8, loop: true, events,
  });
}

export function presetDurationSeconds(presetInput) {
  return normalizeSynthPreset(presetInput).duration;
}

export function estimatePresetLoudness(presetInput, options = {}) {
  const analysis = analyzeSynthPreset(presetInput, options);
  return { ...analysis, loudnessLabel: analysis.rms > 0.25 ? 'loud' : analysis.rms > 0.1 ? 'balanced' : 'quiet' };
}
