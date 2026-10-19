import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_REALM_SOURCE, parseRealmSource, validateRealmSource } from '../src/language/realm.js';
import { highlightRealmScript } from '../src/language/lexer.js';

test('RealmScript default world compiles from glyph-first directives', () => {
  const result = validateRealmSource(DEFAULT_REALM_SOURCE);
  assert.equal(result.ok, true);
  assert.equal(result.realm.name, 'AETHERFALL');
  assert.equal(result.realm.land.span, 280);
  assert.equal(result.realm.land.detail, 160);
  assert.equal(result.realm.beacon.unlock, 7);
  assert.equal(result.realm.rules.includes('interact'), true);
  assert.equal(result.stats.terrainVertices, 25921);
  assert.equal(result.stats.scatterCount, 245);
});

test('RealmScript edits are reflected in the parsed playable world configuration', () => {
  const source = DEFAULT_REALM_SOURCE
    .replace('⟦ REALM: AETHERFALL ⟧', '⟦ REALM: DUSKVALE ⟧')
    .replace('span 280 | detail 160 | seed 7412', 'span 220 | detail 72 | seed 99')
    .replace('unlock 7', 'unlock 4');
  const realm = parseRealmSource(source);
  assert.equal(realm.name, 'DUSKVALE');
  assert.equal(realm.land.span, 220);
  assert.equal(realm.land.detail, 72);
  assert.equal(realm.land.seed, 99);
  assert.equal(realm.beacon.unlock, 4);
});

test('RealmScript rejects unknown directives with line diagnostics', () => {
  const result = validateRealmSource(`${DEFAULT_REALM_SOURCE}\n@magic: do-everything`);
  assert.equal(result.ok, false);
  assert.equal(result.errors.at(-1).line, 13);
  assert.match(result.errors.at(-1).message, /unknown RealmScript directive/i);
});

test('RealmScript rejects out-of-range terrain density and runaway scatter counts', () => {
  assert.throws(() => parseRealmSource(DEFAULT_REALM_SOURCE.replace('detail 160', 'detail 900')), /terrain detail must be between 48 and 220/);
  assert.throws(() => parseRealmSource(DEFAULT_REALM_SOURCE.replace('× 185', '× 500').replace('× 42', '× 500')), /combined scatter count exceeds 900/);
  assert.throws(() => parseRealmSource('x'.repeat(24_001)), /limited to 24,000 characters/);
});

test('RealmScript highlighter uses distinct glyph, directive and value classes', () => {
  const html = highlightRealmScript('☼ SKY: copper-dawn\n▧ LAND: highlands | span 280 | detail 160 | seed 7412');
  assert.match(html, /tok-realm-glyph/);
  assert.match(html, /tok-realm-key/);
  assert.match(html, /tok-realm-value/);
  assert.match(html, /tok-realm-number/);
});


test('RealmScript biome and sky words select implemented rendering presets and reject typos', () => {
  const biomes = ['highlands', 'alpine', 'evergreen', 'goldenwood', 'moonfen', 'emberfall'];
  const skies = ['copper-dawn', 'azure', 'moonlit', 'violet-dusk', 'emberfall'];
  for (const biome of biomes) {
    const realm = parseRealmSource(DEFAULT_REALM_SOURCE.replace('LAND: highlands', `LAND: ${biome}`));
    assert.equal(realm.land.type, biome);
  }
  for (const sky of skies) {
    const realm = parseRealmSource(DEFAULT_REALM_SOURCE.replace('SKY: copper-dawn', `SKY: ${sky}`));
    assert.equal(realm.sky, sky);
  }
  assert.throws(() => parseRealmSource(DEFAULT_REALM_SOURCE.replace('SKY: copper-dawn', 'SKY: not-a-sky')), /unknown sky/i);
  assert.throws(() => parseRealmSource(DEFAULT_REALM_SOURCE.replace('LAND: highlands', 'LAND: no-such-biome')), /unknown biome/i);
  assert.throws(() => parseRealmSource(DEFAULT_REALM_SOURCE.replace('SCATTER: elderpine', 'SCATTER: no-such-tree')), /unknown scatter/i);
});


test('checked-in Aetherfall RealmScript example is valid and matches the playable default', async () => {
  const example = await readFile(new URL('../examples/aetherfall.realm', import.meta.url), 'utf8');
  assert.equal(validateRealmSource(example).ok, true);
  assert.equal(parseRealmSource(example).name, parseRealmSource(DEFAULT_REALM_SOURCE).name);
  assert.equal(example.trim(), DEFAULT_REALM_SOURCE.trim());
});
