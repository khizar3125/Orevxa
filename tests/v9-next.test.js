import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('v9 content: 24 games, 18 webs, 24 blocks — new ids present and runnable', async () => {
  const t = await import('../src/studio/templates.js');
  const { OrvexaInterpreter } = await import('../src/language/interpreter.js');
  assert.equal(t.GAME_BLUEPRINTS.length, 24);
  assert.equal(t.WEB_APP_TEMPLATES.length, 18);
  assert.equal(t.VISUAL_UI_BLOCKS.length, 24);
  for (const id of ['chef-rush-3d','pet-rescue-adventure','castle-builder-tycoon','submarine-treasure-hunt','wizard-spell-arena','delivery-dash-city'])
    assert.ok(t.GAME_BLUEPRINTS.some(b => b.id === id), id);
  for (const id of ['tutor-marketplace','music-festival','real-estate-tour','charity-fundraiser'])
    assert.ok(t.WEB_APP_TEMPLATES.some(b => b.id === id), id);
  for (const id of ['app-download','feature-compare','how-to-video','winner-spotlight','daily-quest-card','friend-invite'])
    assert.ok(t.VISUAL_UI_BLOCKS.some(b => b.id === id), id);
  for (const bp of [...t.GAME_BLUEPRINTS, ...t.WEB_APP_TEMPLATES]) {
    assert.ok(new OrvexaInterpreter().run(bp.source).ok, bp.id);
    assert.ok(bp.source.split('\n').length >= 70, bp.id);
  }
  assert.equal(t.listTemplateMetas().length, 42);
  assert.equal(t.searchTemplates('').length, 24 + 18 + 12 + 8);
});

test('v9 quests.js: daily quests deterministic, XP, streak, achievements, purity', async () => {
  const q = await import('../src/studio/quests.js');
  assert.equal(q.DAILY_QUEST_POOL.length, 10);
  assert.equal(q.ACHIEVEMENTS.length, 10);
  let s = q.createQuestState();
  const d1 = q.getDailyQuests(s, '2026-10-18');
  assert.equal(d1.length, 3);
  assert.deepEqual(q.getDailyQuests(s, '2026-10-18').map(x => x.id), d1.map(x => x.id)); // deterministic
  // completes today's template quest by recording actions generically
  for (let i = 0; i < 6; i++) for (const a of q.CREATOR_ACTIONS) s = q.recordCreatorAction(s, a, 3, '2026-10-18').state;
  const done = q.getDailyQuests(s, '2026-10-18');
  assert.ok(done.every(x => x.completed), 'all 3 daily quests completable in one day');
  assert.ok(s.totalXp > 100, `xp ${s.totalXp}`);
  assert.ok(q.creatorLevel(s.totalXp).level >= 2);
  assert.ok(s.unlockedAchievements.includes('first-launch'));
  assert.ok(s.unlockedAchievements.length >= 5, s.unlockedAchievements.join(','));
  // streak: next day continues, gap resets
  s = q.recordCreatorAction(s, 'run-pressed', 1, '2026-10-19').state;
  assert.equal(s.currentStreak, 2);
  const snapshot = JSON.stringify(s);
  q.recordCreatorAction(s, 'run-pressed', 1, '2026-10-20');
  assert.equal(JSON.stringify(s), snapshot); // input never mutated
  assert.throws(() => q.recordCreatorAction(s, 'bogus', 1, '2026-10-20'), /Unknown creator action/);
  // storage roundtrip with injected store
  const mem = {}; const store = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  q.saveQuestProgress(s, store);
  assert.equal(q.loadQuestProgress(store).totalXp, s.totalXp);
  const line = q.questSummaryLine(s, '2026-10-19');
  assert.match(line.lineHi, /Level/); assert.equal(line.badgesTotal, 10);
});

test('v9 aiAgent variations: 3 interpreter-safe versions, smart names, suggestions', async () => {
  const a = await import('../src/studio/aiAgent.js');
  const t = await import('../src/studio/templates.js');
  const { OrvexaInterpreter } = await import('../src/language/interpreter.js');
  assert.equal(a.VARIATION_THEMES.length, 4);
  const src = t.GAME_BLUEPRINTS.find(b => b.id === 'kart-racing-cup').source;
  const vars = a.generateProjectVariations(src);
  assert.equal(vars.length, 3);
  assert.equal(new Set(vars.map(v => v.source)).size, 3);
  for (const v of vars) { assert.ok(new OrvexaInterpreter().run(v.source).ok, v.theme); assert.match(v.name, /—/); }
  const namedGame = a.autoNameProject(src);
  assert.equal(namedGame.kind, 'game'); assert.ok(namedGame.taglineHi.includes('counter'));
  assert.equal(a.autoNameProject(t.WEB_APP_TEMPLATES[0].source).kind, 'web');
  const pick = a.suggestTemplateForPrompt('mujhe ek race game banana hai');
  assert.ok(pick.length >= 1 && pick.length <= 3);
  assert.ok(pick[0].score >= pick[pick.length - 1].score);
  assert.equal(a.listOmniAgentTools().length, 20); // tool roster untouched
});

test('v9 engine presets round 2: sequencer clips, terrain worlds, materials', async () => {
  const sq = await import('../src/studio/sequencer.js');
  const tr = await import('../src/studio/terrainLab.js');
  const mg = await import('../src/studio/materialGraph.js');
  assert.equal(Object.keys(sq.SEQUENCER_PRESETS).length, 8);
  const boss = sq.getSequencerPreset('boss-fight-intro');
  assert.ok(boss.markers.length >= 3);
  const fanfare = sq.getSequencerPreset('victory-celebration-fanfare');
  assert.equal(fanfare.loop, true);
  assert.equal(Object.keys(tr.TERRAIN_PRESETS).length, 8);
  for (const id of ['volcanic-isles', 'desert-dunes-oasis']) {
    const scene = tr.buildTerrainFromPreset(id, { size: 20 });
    assert.ok(scene.mesh && scene.geometry && scene.statistics, id);
  }
  assert.equal(Object.keys(mg.MATERIAL_GRAPH_PRESETS).length, 18);
  for (const id of ['hologram-glass', 'candy-gloss-pop']) {
    const graph = mg.buildPresetMaterialGraph(id);
    assert.equal(mg.validateMaterialGraph(graph).ok, true, id);
    const compiled = mg.compileMaterialGraphToPBR(graph, { resolution: 8 });
    assert.match(compiled.baseColorImage, /^data:image\/png;base64,/);
  }
});

test('v9 UI wiring in main.js + modeler magic + blessings anchors', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for (const needle of ['quests.js', 'recordCreatorAction', 'bumpQuest(', 'launchpadSortSelect', 'launchpadSurprise',
    'magicSceneButton', 'magicSceneCombo', 'aiVariationsButton', 'generateProjectVariations', 'creatorLevelBadge',
    'getDailyQuests', 'Aaj ke Creator Quests']) assert.ok(main.includes(needle), needle);
  const modeler = readFileSync(new URL('../src/modeler.js', import.meta.url), 'utf8');
  const modelerHtml = readFileSync(new URL('../modeler.html', import.meta.url), 'utf8');
  assert.ok(modeler.includes("$('#magicModelButton')"));
  assert.ok(modelerHtml.includes('id="magicModelButton"'));
  assert.ok(modeler.includes('MAGIC_MODELS'));
  const game = readFileSync(new URL('../src/studio/aetherfall-game.js', import.meta.url), 'utf8');
  assert.ok(game.includes('GUARDIAN_BLESSINGS'));
  assert.ok(game.includes('blessingFor(discoveredLore.size)'));
  assert.equal((game.match(/vec3 windDeform\(vec3 p, vec3 color\)/g) || []).length, 2);
});

test('v9 package tracks the current v10 release and PLAN.md stays the sole markdown file', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, '10.0.0');
  const mds = readdirSync(new URL('..', import.meta.url)).filter(f => f.endsWith('.md'));
  assert.deepEqual(mds, ['PLAN.md']);
});
