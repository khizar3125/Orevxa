const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const normalize = v => { const n = Math.hypot(...v) || 1; return v.map(x => x / n); };
const smoothstep = (a, b, x) => { const t = clamp((x - a) / Math.max(1e-6, b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Stable day/night lighting values for the Aetherfall realtime renderer. */
export function calculateWorldEnvironment(hour = 15.5, weather = 'clear') {
  const time = ((Number.isFinite(Number(hour)) ? Number(hour) : 15.5) % 24 + 24) % 24;
  const elevation = Math.sin(((time - 6) / 12) * Math.PI);
  const azimuth = (time / 24) * Math.PI * 2 - Math.PI * 0.5;
  const horizontal = Math.sqrt(Math.max(0, 1 - elevation * elevation));
  const sunDirection = normalize([Math.cos(azimuth) * horizontal, elevation, Math.sin(azimuth) * horizontal]);
  const daylight = smoothstep(-0.11, 0.28, elevation);
  const attenuation = weather === 'overcast' ? 0.62 : weather === 'rain' ? 0.38 : weather === 'snow' ? 0.52 : 1;
  const solarIntensity = 0.025 + daylight * attenuation * 1.08;
  const ambientIntensity = clamp(0.22 + daylight * 0.78 - (weather === 'overcast' ? 0.12 : weather === 'rain' ? 0.18 : weather === 'snow' ? 0.08 : 0), 0.12, 1);
  const sunColor = daylight < 0.18 ? [0.12, 0.20, 0.43] : daylight < 0.62 ? [1.0, 0.58 + daylight * 0.38, 0.34 + daylight * 0.52] : [1.0, 0.92, 0.78];
  const fogBoost = weather === 'rain' ? 1.9 : weather === 'snow' ? 1.5 : weather === 'overcast' ? 1.35 : 1;
  return { hour: time, elevation, daylight, sunDirection, solarIntensity, ambientIntensity, sunColor, fogBoost, weather: ['clear', 'overcast', 'rain', 'snow'].includes(weather) ? weather : 'clear' };
}

export function normalizeWeather(value) {
  return ['clear', 'overcast', 'rain', 'snow'].includes(value) ? value : 'clear';
}
