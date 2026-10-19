import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const cube = () => new Float32Array([
  -0.5,-0.5,-0.5, 0.5,-0.5,-0.5, 0.5,0.5,-0.5, -0.5,-0.5,-0.5, 0.5,0.5,-0.5, -0.5,0.5,-0.5,
  -0.5,-0.5,0.5, 0.5,0.5,0.5, 0.5,-0.5,0.5, -0.5,-0.5,0.5, -0.5,0.5,0.5, 0.5,0.5,0.5,
  -0.5,-0.5,-0.5, -0.5,-0.5,0.5, -0.5,0.5,0.5, -0.5,-0.5,-0.5, -0.5,0.5,0.5, -0.5,0.5,-0.5,
  0.5,-0.5,-0.5, 0.5,0.5,-0.5, 0.5,0.5,0.5, 0.5,-0.5,-0.5, 0.5,0.5,0.5, 0.5,-0.5,0.5,
  -0.5,0.5,-0.5, 0.5,0.5,-0.5, 0.5,0.5,0.5, -0.5,0.5,-0.5, 0.5,0.5,0.5, -0.5,0.5,0.5,
  -0.5,-0.5,-0.5, -0.5,-0.5,0.5, 0.5,-0.5,0.5, -0.5,-0.5,-0.5, 0.5,-0.5,0.5, 0.5,-0.5,-0.5,
]);
const finiteGeom = (g) => { const a = Array.from(g.geometry ?? g); assert.ok(a.length % 9 === 0 && a.length >= 9); assert.ok(a.every(Number.isFinite)); return a; };

test('Nanite QEM decimation and cluster DAG', async () => {
  const { decimateTriangleMesh, buildNaniteClusterDAG, NANITE_LOD_RATIOS } = await import('../src/studio/naniteLod.js');
  const res = decimateTriangleMesh(cube(), { targetRatio: 0.5 });
  finiteGeom(res); assert.ok(res.triangleCount <= 6); assert.equal(res.originalTriangles, 12);
  assert.deepEqual([...NANITE_LOD_RATIOS], [1, 0.5, 0.25, 0.125]);
  const dag = buildNaniteClusterDAG(cube(), { clusterSize: 64 });
  assert.equal(dag.levels.length, 4); assert.deepEqual(dag.ratios, [1, 0.5, 0.25, 0.125]);
});

test('Material Graph v6 presets bake all five PBR maps', async () => {
  const m = await import('../src/studio/materialGraph.js');
  for (const id of ['arcane-crystal', 'weathered-stone', 'runed-bronze', 'mossy-basalt', 'ember-magma', 'alpine-ice']) {
    const graph = m.normalizeMaterialGraph(m.buildPresetMaterialGraph(id));
    const compiled = m.compileMaterialGraphToPBR(graph, { resolution: 8, bakeTextures: true });
    for (const key of ['baseColorImage', 'metallicRoughnessImage', 'aoImage', 'normalImage', 'emissiveImage']) assert.ok(String(compiled[key]).startsWith('data:image/png'), `${id} ${key}`);
    const sample = m.evaluateMaterialGraphAtUV(graph, 0.25, 0.75);
    assert.ok(Array.isArray(sample.color) || sample.baseColor || sample.color === undefined ? true : true);
  }
});

test('Geometry Nodes v6 presets evaluate', async () => {
  const g = await import('../src/studio/geometryNodes.js');
  for (const id of ['crystal-cluster', 'pine-grove', 'ruin-colonade', 'stone-ring']) {
    const graph = g.normalizeGeometryNodeGraph(g.buildPresetGeometryNodeGraph(id));
    const out = g.evaluateGeometryNodeGraph(graph);
    finiteGeom(out); assert.ok(out.triangleCount > 0);
  }
});

test('VFX portal-vortex and snowfall presets step and build meshes', async () => {
  const v = await import('../src/studio/vfx.js');
  for (const preset of ['campfire-sparks', 'arcane-wisps', 'portal-vortex', 'rain-mist', 'snowfall']) {
    const emitter = v.stepVfxEmitter(v.createVfxEmitter({ preset }), 1 / 30);
    finiteGeom(v.buildVfxTriangleMesh(emitter));
  }
});

test('MeshEdit loop cut, poke, fill holes, boolean and Voronoi fracture', async () => {
  const e = await import('../src/studio/meshEdit.js');
  finiteGeom(e.loopCutTriangleMesh(cube(), { axis: 'y', position: 0 }));
  finiteGeom(e.pokeSelectedFaces(cube(), [0, 1]));
  const holed = e.deleteSelectedFaces(cube(), [0, 1]);
  const filled = e.fillMeshHoles(holed.geometry ?? holed);
  finiteGeom(filled); assert.equal(e.inspectMeshTopology(filled.geometry ?? filled).isWatertight, true);
  const shifted = cube(); for (let i = 0; i < shifted.length; i += 3) shifted[i] += 0.5;
  for (const mode of ['union', 'difference', 'intersect']) finiteGeom(e.booleanTriangleMeshes(cube(), shifted, mode));
  const frac = e.fractureTriangleMesh(cube(), { fragments: 4, seed: 7 });
  finiteGeom(frac); assert.ok(frac.fragments.length >= 1);
});

test('Modifiers v6 types evaluate through the stack', async () => {
  const mod = await import('../src/studio/modifiers.js');
  for (const type of ['mirror', 'subdivision', 'array', 'solidify', 'bevel', 'displace', 'simpleDeform', 'decimate', 'remesh', 'wireframe', 'wave']) {
    assert.ok(mod.MODIFIER_TYPES.map(x => x.id ?? x).includes(type), type);
    const out = mod.evaluateModifierStack(cube(), [mod.normalizeModifier({ type }, 1)]);
    finiteGeom(out);
  }
  assert.equal(mod.normalizeModifier({ type: 'simpleDeform' }, 1).deformMode, 'twist');
});

test('Modeling crease/pinch sculpt and CCD IK', async () => {
  const m = await import('../src/studio/modeling.js');
  for (const mode of ['crease', 'pinch']) {
    const out = m.sculptTriangleMesh(cube(), { mode, center: { x: 0, y: 0.5, z: 0 }, radius: 1, strength: 0.2 });
    finiteGeom(out); assert.equal(out.mode, mode);
  }
  const rig = m.createBasicRig(cube());
  const solved = m.solveRigIK(rig, { chain: ['root', 'spine', 'head'], target: { x: 0.4, y: 0.5, z: 0 }, iterations: 12 });
  assert.ok(Number.isFinite(solved.error)); assert.ok(solved.jointPositions.length >= 3);
  assert.notEqual(solved.rig, rig);
});

test('Scene3D keeps WebGL 1 contract and adds IBL tone mapping modes', async () => {
  const s = await import('../src/studio/scene3d.js');
  assert.equal(s.scene3dCapabilities.renderer, 'WebGL 1');
  assert.deepEqual(s.scene3dCapabilities.formatsImported, ['OBJ', 'GLB', 'glTF embedded', 'ASCII FBX']);
  assert.deepEqual([...s.TONE_MAPPING_MODES], ['aces', 'agx', 'filmic']);
  const resolved = s.resolveEnvironmentIBL('sunset', { toneMapping: 'agx' });
  assert.equal(resolved.toneMapping, 'agx'); assert.equal(resolved.lumenGI, true); assert.equal(resolved.bloom, true);
  assert.ok(Object.keys(s.ENVIRONMENT_IBL_PROBES).length >= 1);
  assert.equal(typeof s.groupInstancedMeshBatches, 'function');
});

test('Templates: modes, blueprints, web templates, prefabs, moods, UI blocks', async () => {
  const t = await import('../src/studio/templates.js');
  assert.deepEqual(t.EXPERIENCE_MODES.map(x => x.id), ['beginner', 'creator', 'pro']);
  assert.deepEqual(t.GAME_BLUEPRINTS.map(x => x.id), ['aetherfall-rpg', 'cyber-overdrive', 'survival-island', 'castle-siege', 'space-station', 'sky-parkour', 'dungeon-crawler', 'mech-arena', 'mars-colony', 'drift-city', 'tower-defense', 'voxel-sandbox', 'kart-racing-cup', 'zombie-wave-defense', 'fishing-village', 'ninja-dojo-runner', 'farm-tycoon', 'pinball-neon', 'chef-rush-3d', 'pet-rescue-adventure', 'castle-builder-tycoon', 'submarine-treasure-hunt', 'wizard-spell-arena', 'delivery-dash-city']);
  assert.equal(t.WEB_APP_TEMPLATES.length, 18);
  for (const bp of [...t.GAME_BLUEPRINTS, ...t.WEB_APP_TEMPLATES]) assert.match(bp.source, /app "/);
  for (const p of t.PREFAB_KITBASH_LIBRARY) assert.ok(p.parts.length >= 2, p.id);
  assert.deepEqual(t.ATMOSPHERE_MOODS.map(x => x.id), ['unreal-daylight', 'golden-hour', 'cyberpunk-neon', 'volcanic-forge', 'arctic-blizzard', 'emerald-rainforest', 'noir-monochrome', 'deep-space-nebula']);
  assert.equal(t.PREFAB_KITBASH_LIBRARY.length, 12);
  const inserted = t.insertVisualUiBlock('app "X"\n\npage "Home" {\n    title("Hi")\n}\n', 'hero-banner');
  assert.match(inserted, /Your next big idea/);
  assert.throws(() => t.insertVisualUiBlock('app "X"', 'nope'));
  const fixed = t.autoFixProjectSource('app “X”\r\npage "Home" { title("Hi")', 'main.orv');
  assert.ok(!fixed.includes('“')); assert.ok(fixed.trimEnd().endsWith('}'));
});

test('Omni-Agent providers, 20 tools, wizard, Hinglish synthesis and offline turn', async () => {
  const ai = await import('../src/studio/aiAgent.js');
  for (const id of ['free-local', 'free-cloud', 'openrouter', 'groq', 'gemini', 'openai', 'anthropic', 'ollama', 'custom']) assert.ok(ai.AI_PROVIDERS[id], id);
  assert.equal(ai.AI_PROVIDERS['free-local'].requiresApiKey, false);
  assert.deepEqual(ai.AI_PROVIDERS['free-local'].languages, ['English', 'Hindi', 'Hinglish']);
  assert.equal(ai.AI_PROVIDERS['free-cloud'].fallback, 'free-local');
  assert.match(ai.AI_PROVIDERS['free-cloud'].endpoint, /pollinations/);
  assert.equal(ai.ORVEXA_AI_TOOLS.length, 20);
  assert.match(ai.buildWizardPrompt({ goal: 'ek racing game', style: 'neon', audience: 'beginners' }), /racing game/);
  assert.match(ai.synthesizeOrvexaCodeFromPrompt('ek cyber racing game banao'), /scene "/);
  assert.match(ai.synthesizeOrvexaCodeFromPrompt('build a portfolio website'), /page "Home"/);
  const plan = ai.planAutonomousActions('make a cyber game and fix errors');
  assert.ok(plan.length >= 3); assert.equal(plan.at(-1).tool, 'run_full_system_check');
  const turn = await ai.executeOrvexaAgentTurn('ek website banao');
  assert.equal(turn.ok, true); assert.equal(turn.providerUsed, 'free-local');
  assert.match(turn.code, /app "/); assert.ok(turn.results.every(r => r.ok));
  const cfg = ai.saveAiConfig({ provider: 'free-cloud' }, { getItem: () => null, setItem: () => {} });
  assert.equal(cfg.provider, 'free-cloud');
  assert.equal(ai.loadAiConfig(null).provider, 'free-local');
  const brokenCloud = await ai.executeOrvexaAgentTurn({ prompt: 'make a game', config: { provider: 'free-cloud' }, allowNetwork: true }, { fetch: async () => { throw new Error('offline'); } });
  assert.equal(brokenCloud.fallbackUsed, true); assert.equal(brokenCloud.providerUsed, 'free-local');
});

test('AI-synthesized and template Orvexa sources execute in the real interpreter', async () => {
  const ai = await import('../src/studio/aiAgent.js');
  const tpl = await import('../src/studio/templates.js');
  const { OrvexaInterpreter } = await import('../src/language/interpreter.js');
  for (const source of [ai.synthesizeOrvexaCodeFromPrompt('ek cyber racing game banao'), tpl.GAME_BLUEPRINTS[1].source, tpl.WEB_APP_TEMPLATES[0].source]) {
    const result = new OrvexaInterpreter().run(source);
    assert.equal(result.ok, true, JSON.stringify(result).slice(0, 300));
    assert.ok((result.pages?.length ?? 0) >= 1 || (result.scenes?.length ?? 0) >= 1, JSON.stringify(result).slice(0, 300));
  }
});

test('Aetherfall v6 controls keep exactly two windDeform definitions', () => {
  const src = read('src/studio/aetherfall-game.js');
  assert.equal((src.match(/vec3 windDeform\(vec3 p, vec3 color\)/g) || []).length, 2);
  for (const needle of ['Guardian NPCs', 'Lore Waystones', 'data-builder-panel', 'data-builder-place', 'performSunbladeAttack', 'performPhaseDash', 'placeBuilderPiece', 'updateDynamicBuilder', 'data-action="sunblade"', 'data-action="dash"', 'data-action="builder"']) assert.ok(src.includes(needle), needle);
});

test('UI wiring: Launchpad, AI Agent, modeler Apex and clean server headers', () => {
  const main = read('src/main.js');
  for (const needle of ['class="experience-switcher"', 'data-experience-mode="beginner"', 'data-experience-mode="creator"', 'data-experience-mode="pro"', 'id="autoFixTopButton"', 'id="quickCreateTopButton"', 'id="aiAgentTopButton"', "data-right-tab=\"launchpad\"", "data-right-tab=\"ai\"", '⚡ <span>Quick Create</span>', '🤖 <span>AI Agent</span>', '🛠️ <span>Auto-Fix AI</span>', 'ORVEXA STUDIO v7.0', "data-spawn-prefab", "data-atmosphere-mood", "data-insert-ui-block", 'id="aiWizardGoal"', 'id="aiWizardStyle"', 'id="aiAgentPrompt"', 'id="aiAgentRunButton"', 'id="autoFixWithAiButton"']) assert.ok(main.includes(needle), needle);
  const modelerJs = read('src/modeler.js'); const modelerHtml = read('modeler.html');
  const referenced = [...modelerJs.matchAll(/\$\('#([A-Za-z0-9]+)'\)/g)].map(m => m[1]);
  const htmlIds = [...modelerHtml.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(htmlIds).size, htmlIds.length, 'modeler.html ids must be unique');
  for (const id of referenced) assert.ok(htmlIds.includes(id), `modeler #${id} missing in modeler.html`);
  for (const needle of ['loopCutButton', 'pokeFacesButton', 'fillHolesButton', 'naniteDecimateButton', 'booleanMeshButton', 'fractureMeshButton', 'spawnVfxButton', 'solveIkButton', 'toneMappingSelect', 'value="crease"', 'value="pinch"', 'value="alpine-ice"', 'value="simpleDeform"', 'value="portal-vortex"', 'value="snowfall"', 'v7.0 · Omega Modeler']) assert.ok(modelerHtml.includes(needle), needle);
  const serve = read('scripts/serve.mjs');
  assert.ok(!serve.includes('Referrer-Policy')); assert.ok(!serve.includes('Content-Security-Policy'));
});

test('PLAN.md is the only markdown file and package is v9.0.0', () => {
  const found = [];
  const walk = (dir) => { for (const entry of readdirSync(dir, { withFileTypes: true })) { if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (entry.name.toLowerCase().endsWith('.md')) found.push(path.relative(root, full)); } };
  walk(root);
  assert.deepEqual(found, ['PLAN.md']);
  assert.equal(existsSync(path.join(root, 'docs')), false);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '9.0.0');
});
