/**
 * Orvexa RealmScript: a world-authoring language intentionally unlike general-purpose
 * brace/statement languages. Each glyph starts a world directive; directives are
 * data-only and are validated before a world is constructed.
 */
export const DEFAULT_REALM_SOURCE = `⟦ REALM: AETHERFALL ⟧
☼ SKY: copper-dawn
▧ LAND: highlands | span 280 | detail 160 | seed 7412
⌖ ENTRY: 0, 0, 14
✧ SCATTER: elderpine × 185 | radius 128 | seed 704
✧ SCATTER: moonbloom × 42 | radius 92 | seed 991
✧ SCATTER: sunshard × 18 | radius 108 | seed 802
⌂ SETTLEMENT: windmere | at -48, 0, 18 | houses 8
⌂ SETTLEMENT: stoneveil | at 62, 0, -18 | houses 6
≋ WATERS: moonwater | at -32, -1.9, 34 | radius 25
✦ BEACON: firstlight | at 18, 0, -64 | unlock 7
⚙ RULES: explore, collect, sprint, jump, interact`;

const defaults = () => ({
  name: 'Aetherfall', sky: 'copper-dawn',
  land: { type: 'highlands', span: 280, detail: 160, seed: 7412 },
  entry: { x: 0, y: 0, z: 14 }, scatters: [], settlements: [], waters: [],
  beacon: { name: 'firstlight', x: 18, y: 0, z: -64, unlock: 7 },
  rules: ['explore', 'collect', 'sprint', 'jump', 'interact'],
});
const number = (v, label, min, max, line) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Line ${line}: ${label} must be between ${min} and ${max}.`);
  return n;
};
const coordinates = (raw, line) => {
  const bits = raw.split(',').map(s => s.trim());
  if (bits.length !== 3) throw new Error(`Line ${line}: expected three coordinates (x, y, z).`);
  return { x: number(bits[0], 'x coordinate', -500, 500, line), y: number(bits[1], 'y coordinate', -100, 100, line), z: number(bits[2], 'z coordinate', -500, 500, line) };
};
const field = (line, key, fallback = null) => {
  const match = line.match(new RegExp(`(?:^|\\|)\\s*${key}\\s+([^|]+)`, 'i'));
  return match ? match[1].trim() : fallback;
};

export function parseRealmSource(source = DEFAULT_REALM_SOURCE) {
  const text = String(source ?? '');
  if (text.length > 24_000) throw new Error('RealmScript is limited to 24,000 characters.');
  const config = defaults();
  const errors = [];
  const seen = new Set();
  const lines = text.split(/\r?\n/);
  let declaredName = false;
  for (let i = 0; i < lines.length; i++) {
    const original = lines[i], line = original.trim(), n = i + 1;
    if (!line || line.startsWith('//') || line.startsWith('※')) continue;
    let m;
    try {
      if ((m = line.match(/^⟦\s*REALM\s*:\s*([^⟧]+)\s*⟧$/i))) {
        if (declaredName) throw new Error(`Line ${n}: a realm can only be declared once.`);
        config.name = m[1].trim().replace(/^['"]|['"]$/g, '').slice(0, 64) || 'Aetherfall'; declaredName = true; continue;
      }
      if ((m = line.match(/^☼\s*SKY\s*:\s*([\w-]+)$/i))) { const sky = m[1].toLowerCase(); if (!['copper-dawn','azure','moonlit','violet-dusk','emberfall'].includes(sky)) throw new Error(`Line ${n}: unknown sky '${sky}'. Choose copper-dawn, azure, moonlit, violet-dusk or emberfall.`); config.sky = sky; continue; }
      if ((m = line.match(/^▧\s*LAND\s*:\s*([\w-]+)\s*\|\s*span\s+(\d+(?:\.\d+)?)\s*\|\s*detail\s+(\d+)\s*\|\s*seed\s+(-?\d+)$/i))) {
        const biome = m[1].toLowerCase(); if (!['highlands','alpine','evergreen','goldenwood','moonfen','emberfall'].includes(biome)) throw new Error(`Line ${n}: unknown biome '${biome}'. Choose highlands, alpine, evergreen, goldenwood, moonfen or emberfall.`);
        config.land = { type: biome, span: number(m[2], 'land span', 100, 500, n), detail: Math.round(number(m[3], 'terrain detail', 48, 220, n)), seed: Math.trunc(number(m[4], 'terrain seed', -2_147_483_648, 2_147_483_647, n)) }; continue;
      }
      if ((m = line.match(/^⌖\s*ENTRY\s*:\s*(.+)$/i))) { config.entry = coordinates(m[1], n); continue; }
      if ((m = line.match(/^✧\s*SCATTER\s*:\s*([\w-]+)\s*×\s*(\d+)\s*\|\s*radius\s+(\d+(?:\.\d+)?)\s*\|\s*seed\s+(-?\d+)$/i))) {
        const type = m[1].toLowerCase(); if (!['elderpine','moonbloom','sunshard','boulder'].includes(type)) throw new Error(`Line ${n}: unknown scatter '${type}'. Choose elderpine, moonbloom, sunshard or boulder.`); const count = Math.round(number(m[2], 'scatter count', 1, type === 'sunshard' ? 200 : 500, n));
        config.scatters.push({ type, count, radius: number(m[3], 'scatter radius', 10, 240, n), seed: Math.trunc(number(m[4], 'scatter seed', -2_147_483_648, 2_147_483_647, n)) });
        if (config.scatters.length > 12) throw new Error(`Line ${n}: at most 12 scatter directives are allowed.`);
        continue;
      }
      if ((m = line.match(/^⌂\s*SETTLEMENT\s*:\s*([\w-]+)\s*\|\s*at\s+(-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)\s*\|\s*houses\s+(\d+)$/i))) {
        config.settlements.push({ name: m[1], ...coordinates(m[2], n), houses: Math.round(number(m[3], 'house count', 1, 18, n)) });
        if (config.settlements.length > 8) throw new Error(`Line ${n}: at most 8 settlements are allowed.`);
        continue;
      }
      if ((m = line.match(/^≋\s*WATERS\s*:\s*([\w-]+)\s*\|\s*at\s+(-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)\s*\|\s*radius\s+(\d+(?:\.\d+)?)$/i))) {
        config.waters.push({ name: m[1], ...coordinates(m[2], n), radius: number(m[3], 'water radius', 4, 60, n) });
        if (config.waters.length > 6) throw new Error(`Line ${n}: at most 6 water regions are allowed.`);
        continue;
      }
      if ((m = line.match(/^✦\s*BEACON\s*:\s*([\w-]+)\s*\|\s*at\s+(-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?)\s*\|\s*unlock\s+(\d+)$/i))) {
        config.beacon = { name: m[1], ...coordinates(m[2], n), unlock: Math.round(number(m[3], 'beacon unlock count', 0, 200, n)) }; continue;
      }
      if ((m = line.match(/^⚙\s*RULES\s*:\s*(.+)$/i))) {
        const values = m[1].split(',').map(v => v.trim().toLowerCase());
        const supported = new Set(['explore', 'collect', 'sprint', 'jump', 'interact']);
        const invalid = values.find(v => !supported.has(v));
        if (invalid) throw new Error(`Line ${n}: unknown rule '${invalid}'. Supported: ${[...supported].join(', ')}.`);
        config.rules = [...new Set(values)]; continue;
      }
      throw new Error(`Line ${n}: unknown RealmScript directive. Start each line with a world glyph such as ☼, ▧, ⌖, ✧, ⌂, ≋, ✦ or ⚙.`);
    } catch (error) { errors.push({ line: n, message: error.message }); }
  }
  if (errors.length) {
    const error = new Error(errors.map(e => e.message).join('\n'));
    error.name = 'RealmScriptError'; error.diagnostics = errors; throw error;
  }
  const scatterCount = config.scatters.reduce((sum, s) => sum + s.count, 0);
  if (scatterCount > 900) throw new Error('RealmScript: combined scatter count exceeds 900 objects; lower one or more × counts.');
  if (!config.scatters.some(s => s.type === 'sunshard')) config.scatters.push({ type: 'sunshard', count: 18, radius: 108, seed: 802 });
  if (!config.settlements.length) config.settlements = [{ name: 'windmere', x: -48, y: 0, z: 18, houses: 8 }];
  if (!config.waters.length) config.waters = [{ name: 'moonwater', x: -32, y: -1.9, z: 34, radius: 25 }];
  return config;
}

export function validateRealmSource(source) {
  try { const realm = parseRealmSource(source); return { ok: true, realm, errors: [], stats: { directives: String(source).split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('//')).length, scatterCount: realm.scatters.reduce((s, x) => s + x.count, 0), terrainVertices: (realm.land.detail + 1) ** 2 } }; }
  catch (error) { return { ok: false, realm: null, errors: error.diagnostics || [{ line: 1, message: error.message }], stats: null }; }
}
