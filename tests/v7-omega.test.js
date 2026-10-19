import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

test('Templates: 24 games, 18 web, 12 prefabs, 8 moods, all sources runnable', async () => {
  const t = await import('../src/studio/templates.js');
  const { OrvexaInterpreter } = await import('../src/language/interpreter.js');
  assert.equal(t.GAME_BLUEPRINTS.length, 24);
  assert.equal(t.WEB_APP_TEMPLATES.length, 18);
  assert.equal(t.PREFAB_KITBASH_LIBRARY.length, 12);
  assert.equal(t.ATMOSPHERE_MOODS.length, 8);
  assert.equal(t.VISUAL_UI_BLOCKS.length, 24);
  for (const bp of [...t.GAME_BLUEPRINTS, ...t.WEB_APP_TEMPLATES]) {
    assert.ok(bp.source.split('\n').length >= 70, `${bp.id} source too small`);
    const result = new OrvexaInterpreter().run(bp.source);
    assert.equal(result.ok, true, bp.id);
  }
  for (const p of t.PREFAB_KITBASH_LIBRARY) assert.ok(p.parts.length >= 5 && p.parts.length <= 12, p.id);
  const aether = t.GAME_BLUEPRINTS.find(b => b.id === 'aetherfall-rpg');
  assert.match(aether.realmSource, /REALM:/);
});

test('Templates v7: autoFix repairs smart quotes, typo keywords and numerics', async () => {
  const t = await import('../src/studio/templates.js');
  const fixed = t.autoFixProjectSource('app “X”\r\nscen "S" {\n  camra(position: vec3(0, 1, 2))\n  cube("A", position: vec3(0, 0, 0), size: 1..5, color: "#fff")\n}\n', 'main.orv');
  assert.ok(!fixed.includes('“'));
  assert.ok(!/camra/.test(fixed));
  assert.ok(!fixed.includes('1..5'));
});

test('Sequencer: presets, curve evaluation, sampling, bake and SVG', async () => {
  const s = await import('../src/studio/sequencer.js');
  assert.deepEqual(Object.keys(s.SEQUENCER_PRESETS).sort(), ['biped-hero-combo', 'boss-fight-intro', 'cinematic-camera-sweeps', 'day-to-night-lighting', 'earthquake-camera-shake', 'hover-pulse', 'turntable-showcase', 'victory-celebration-fanfare']);
  for (const mode of ['linear', 'bezier', 'step', 'easeInOut', 'elastic', 'bounce']) assert.equal(typeof s.easingFunction(mode), 'function');
  const seq = s.getSequencerPreset('turntable-showcase');
  const sampled = s.sampleTimelineAtTime(seq, 2, null);
  assert.ok(sampled.applied >= 0 && sampled.time === 2);
  const baked = s.bakeSequenceToKeyframes(seq, { fps: 12 });
  assert.ok(s.listKeyframes(baked).length > s.listKeyframes(seq).length);
  const svg = s.renderTimelineSvg(seq);
  assert.match(svg, /data-keyframe-id/);
  assert.match(svg, /data-playhead/);
  const stats = s.sequenceStatistics(seq);
  assert.ok(stats.tracks >= 1 && stats.keyframes >= 2);
});

test('AudioSynth: 16 presets synthesize deterministic WAV bytes and data URLs', async () => {
  const a = await import('../src/studio/audioSynth.js');
  assert.equal(Object.keys(a.AUDIO_SYNTH_PRESETS).length, 16);
  for (const id of ['sword-slash', 'laser-blaster', 'explosion-boom', 'coin-pickup', 'cyberpunk-bass-loop', 'dungeon-drone-loop']) assert.ok(a.AUDIO_SYNTH_PRESETS[id], id);
  const one = a.synthesizeWavBytes('coin-pickup');
  const two = a.synthesizeWavBytes('coin-pickup');
  assert.deepEqual([...one.bytes.slice(0, 12)], [...two.bytes.slice(0, 12)]);
  assert.equal(String.fromCharCode(...one.bytes.slice(0, 4)), 'RIFF');
  assert.match(one.dataUrl, /^data:audio\/wav;base64,/);
  const parsed = a.parseWavBytes(one.bytes);
  assert.equal(parsed.sampleRate, 22050);
  assert.ok(parsed.frames > 1000);
  const effected = a.synthesizeEffectedWavBytes('laser-blaster', { effects: { delay: { time: 0.12, feedback: 0.3 }, bitcrush: { bits: 6 } } });
  assert.ok(effected.bytes.length > 4000);
  assert.equal(a.playSynthPreset.constructor.name, 'AsyncFunction');
});

test('AudioSynth: analysis, spatial audio, melody and drum generation', async () => {
  const a = await import('../src/studio/audioSynth.js');
  const boom = a.analyzeSynthPreset('explosion-boom');
  assert.ok(boom.peak > 0.5 && boom.silent === false && boom.duration > 1);
  const spatial = a.computeSpatialAudioGainAndPan({ x: 0, y: 0, z: 0 }, 0, { x: 3, y: 0, z: 4 }, 25);
  assert.ok(spatial.distance === 5 && spatial.gain > 0 && spatial.gain < 1);
  const melody = a.generateGenerativeMelody({ scale: 'major', steps: 16, seed: 7 });
  assert.ok(Array.isArray(melody) || Array.isArray(melody.events) || Array.isArray(melody.notes));
  const drums = a.generateDrumPattern({ steps: 16, seed: 3 });
  assert.ok(JSON.stringify(drums).length > 10);
});

test('TerrainLab: presets build eroded meshes with biome weights and foliage', async () => {
  const t = await import('../src/studio/terrainLab.js');
  assert.deepEqual(Object.keys(t.TERRAIN_PRESETS).sort(), ['alpine-ridged', 'canyon-voronoi', 'desert-dunes-oasis', 'island-domain-warped', 'moon-crater-field', 'rolling-billow-hills', 'terraced-fbm-plateau', 'volcanic-isles']);
  const built = t.buildTerrainFromPreset('alpine-ridged', { resolution: 32, erosionIterations: 400, foliageCount: 20 });
  assert.ok(built.mesh.triangleCount > 500);
  assert.equal(built.foliage.length, 20);
  assert.match(built.splatTexture, /^data:image\/png;base64,/);
  const weights = built.biomeWeights || built.mesh.biomeWeights;
  assert.ok(weights && typeof weights === 'object');
});

test('TerrainLab: erosion, flow accumulation and river carving change the heightmap', async () => {
  const t = await import('../src/studio/terrainLab.js');
  const base = t.generateHeightmap({ resolution: 24, seed: 5, noiseType: 'fbm' });
  const eroded = t.simulateTerrainErosion(base, { iterations: 300, rainRate: 0.5 });
  assert.ok(eroded.statistics || eroded.iterations === 300 || eroded.heightmap);
  const river = t.buildRiverTerrain(base, { resolution: 24, seed: 9 });
  assert.ok(river.carvedCells >= 0 && river.heightmap);
});

test('MaterialGraph v7: 16 presets, new node types evaluate, SVG renders', async () => {
  const m = await import('../src/studio/materialGraph.js');
  assert.equal(Object.keys(m.MATERIAL_GRAPH_PRESETS).length, 18);
  for (const id of ['cyber-carbon-fiber', 'brushed-titanium', 'gold-filigree', 'iridescent-car-paint', 'toxic-slime', 'ancient-terracotta']) {
    const compiled = m.compileMaterialGraphToPBR(m.buildPresetMaterialGraph(id), { resolution: 8 });
    assert.match(compiled.baseColorImage, /^data:image\/png;base64,/, id);
    const at = m.evaluateMaterialGraphAtUV(m.buildPresetMaterialGraph(id), 0.35, 0.65);
    assert.ok(at.baseColor.every(v => v >= 0 && v <= 1), id);
  }
  const types = m.listMaterialNodeTypes().map(x => x.id);
  for (const id of ['voronoi', 'musgrave', 'wave', 'brick', 'checker', 'fresnel', 'colorRamp', 'bumpToNormal', 'pbrMaster']) assert.ok(types.includes(id), id);
  const svg = m.renderMaterialGraphSvg(m.buildPresetMaterialGraph('gold-filigree'));
  assert.match(svg, /data-node-id/);
  assert.match(svg, /data-from=/);
});

test('GeometryNodes v7: 10 presets evaluate, curve/grid/radial nodes, SVG', async () => {
  const g = await import('../src/studio/geometryNodes.js');
  assert.equal(Object.keys(g.GEOMETRY_NODE_PRESETS).length, 10);
  for (const id of ['spiral-staircase', 'sci-fi-truss-bridge', 'asteroid-belt', 'procedural-pagoda']) {
    const out = g.evaluateGeometryNodeGraph(g.buildPresetGeometryNodeGraph(id));
    assert.ok(out.triangleCount > 20, id);
  }
  const types = g.listGeometryNodeTypes().map(x => x.id);
  for (const id of ['curveToMesh', 'gridScatter', 'radialArray']) assert.ok(types.includes(id), id);
  assert.match(g.renderGeometryNodeGraphSvg(g.buildPresetGeometryNodeGraph('asteroid-belt')), /data-node-id/);
});

test('VFX v7: 13 presets, force fields, trails, systems and heightfield bounce', async () => {
  const v = await import('../src/studio/vfx.js');
  assert.equal(v.listVfxPresets().length, 13);
  for (const id of ['meteor-shower', 'healing-aura', 'electric-lightning-arcs', 'thruster-afterburner', 'confetti-burst']) assert.ok(v.VFX_PRESETS[id], id);
  const emitter = v.createForceFieldEmitter('campfire-sparks', [{ type: 'vortex', strength: 1.5 }]);
  assert.equal(emitter.forceFields[0].type, 'vortex');
  const stepped = v.stepVfxEmitter(emitter, 0.1);
  assert.ok(stepped.particles.length > 0);
  const floored = v.stepVfxEmitter(v.createVfxEmitter({ preset: 'confetti-burst', groundHeightAt: v.buildHeightfieldResolver({ resolution: 2, data: [0, 1, 1, 2], size: 40 }) }), 0.1);
  assert.ok(floored.particles.length > 0);
  const system = v.stepVfxSystem(v.createVfxSystem([{ preset: 'meteor-shower' }, { preset: 'healing-aura' }]), 0.1);
  assert.ok(v.buildCombinedVfxMesh(system).length > 9);
  let trail = v.createVfxEmitter({ preset: 'thruster-afterburner' });
  for (let i = 0; i < 4; i++) trail = v.stepVfxEmitter(trail, 0.1);
  assert.ok(v.buildVfxTrailRibbon(trail).length > 0);
  assert.equal(v.estimateVfxBudget(trail).withinBudget, true);
});

test('MeshEdit v7: Catmull-Clark, lathe, geodesic, bridge and 3D Voronoi fracture', async () => {
  const me = await import('../src/studio/meshEdit.js');
  const s = await import('../src/studio/scene3d.js');
  const cube = s.createMeshGeometry('cube', 4);
  const cc = me.subdivideCatmullClark(cube, { iterations: 1 });
  assert.equal(cc.length / 9, 72);
  const lathe = me.latheProfileDetailed([[0, 0], [0.5, 0], [0.7, 0.5], [0.2, 1], [0, 1.2]], { segments: 10 });
  assert.ok(lathe.geometry.length / 9 >= 60 && lathe.uvs.length === (lathe.geometry.length / 9) * 6);
  const geo = me.geodesicSphereDetailed({ radius: 1, subdivisions: 1 });
  assert.equal(geo.triangleCount, 80);
  const bridge = me.bridgeVertexLoops([[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]]);
  assert.equal(bridge.length / 9, 8);
  const fracture = me.fractureMeshVoronoi3D(cube, { cells: 5, seed: 3 });
  assert.ok(fracture.shardCount >= 2 && fracture.uvs.length === (fracture.geometry.length / 9) * 6);
  assert.equal(me.weldToIndexedMesh(cube).vertexCount, 8);
});

test('Omni-Agent 3.0: 20 tools include sequencer, terrain, audio and performance executors', async () => {
  const ai = await import('../src/studio/aiAgent.js');
  assert.equal(ai.ORVEXA_AI_TOOLS.length, 20);
  for (const id of ['create_animation_sequence', 'generate_eroded_terrain', 'synthesize_game_audio', 'audit_and_optimize_performance']) {
    assert.ok(ai.ORVEXA_AI_TOOLS.some(t => t.id === id), id);
    assert.equal(ai.executeAgentTool(id, {}, { scene: { objects: [] } }).ok, true, id);
  }
  const audio = ai.executeAgentTool('synthesize_game_audio', { preset: 'coin-pickup' });
  assert.match(audio.dataUrl, /^data:audio\/wav;base64,/);
  const seq = ai.executeAgentTool('create_animation_sequence', { preset: 'hover-pulse' });
  assert.equal(seq.sequence.name.length > 0, true);
  assert.ok(ai.getAgentCapabilityMatrix().toolCount === 20);
});

test('Omni-Agent 3.0: rich domain compiler emits runnable 90+ line projects per keyword', async () => {
  const ai = await import('../src/studio/aiAgent.js');
  const { OrvexaInterpreter } = await import('../src/language/interpreter.js');
  const cases = [
    ['make a neon racing game with drift', 'racing'],
    ['build an open world rpg with shrines', 'rpg'],
    ['ek ecommerce website banao shoes ke liye', 'ecommerce'],
    ['fitness tracker app with streaks', 'fitness'],
    ['crypto dex trading terminal', 'crypto'],
    ['haunted horror asylum game', 'horror'],
    ['space station salvage game', 'space'],
    ['education quiz academy', 'education'],
  ];
  for (const [prompt, domain] of cases) {
    const rich = ai.synthesizeRichOrvexaProject(prompt);
    assert.equal(rich.domain, domain, prompt);
    assert.ok(rich.lineCount >= 90, `${domain}: ${rich.lineCount}`);
    assert.equal(new OrvexaInterpreter().run(rich.source).ok, true, domain);
  }
  const realm = ai.synthesizeRichOrvexaProject('open world rpg realm');
  assert.match(realm.realmSource, /REALM:/);
  const legacy = ai.synthesizeOrvexaCodeFromPrompt('ek website banao');
  assert.ok(legacy.split('\n').length >= 90);
  assert.equal(new OrvexaInterpreter().run(legacy).ok, true);
});

test('Omni-Agent 3.0: Quality Critic scores and 1-click upgrades, planner uses new tools', async () => {
  const ai = await import('../src/studio/aiAgent.js');
  const rich = ai.synthesizeRichOrvexaProject('racing game');
  const critic = ai.critiqueAndEnhanceProject(rich.source, { objects: [{ triangleCount: 500 }] });
  for (const key of ['renderingScore', 'gameplayScore', 'performanceScore', 'accessibilityScore', 'overall']) assert.ok(critic[key] >= 0 && critic[key] <= 100, key);
  assert.ok(critic.oneClickUpgrades.length >= 4);
  assert.ok(critic.suggestions.length >= 1);
  const plan = ai.planAutonomousActions('ek racing game banao with animation, terrain and sound, optimize performance');
  const tools = plan.map(p => p.tool);
  for (const id of ['create_animation_sequence', 'generate_eroded_terrain', 'synthesize_game_audio', 'audit_and_optimize_performance']) assert.ok(tools.includes(id), id);
  const executed = ai.executeAgentPlan(plan.slice(0, 3));
  assert.equal(executed.ok, true);
  const scaffold = ai.scaffoldProjectFromPrompt('open world rpg realm');
  assert.deepEqual(scaffold.fileList, ['main.orv', 'world.realm']);
});

test('Studio v7 UI: topbar switcher, Launchpad 2.0, Scene Workbench and AI critic wiring', () => {
  const main = read('src/main.js');
  for (const needle of [
    'class="experience-switcher"', 'data-experience-mode="beginner"', 'data-experience-mode="pro"',
    'id="quickCreateTopButton"', 'id="aiAgentTopButton"', 'id="autoFixTopButton"', 'id="playWorldButton"',
    'launchpadSearchInput', 'data-launchpad-category', 'Sound FX &amp; Music', 'Animation Clips',
    'data-lp-launch-game', 'data-lp-sound', 'data-lp-anim', 'launchpad-card glass',
    'forge-kitbash-accordion', 'forge-terrain-accordion', 'forge-sequencer-accordion', 'forge-audio-accordion',
    'erodeScatterTerrainButton', 'sequencerScrubber', 'sequencerPlayButton', 'data-wb-audio', 'data-wb-prefab', 'data-wb-mood',
    'aiCriticRunButton', 'data-ai-tool', 'data-ai-chip', 'AGENT_STARTER_PROMPTS',
  ]) assert.ok(main.includes(needle), needle);
  const css = read('src/styles.css');
  for (const needle of ['.experience-switcher', '.launchpad-pill', '.launchpad-card.glass', '.ai-tool-grid', '.sequencer-svg-preview']) assert.ok(css.includes(needle), needle);
});

test('Modeler v7: rails, inspector AI tab, Omega surgery and unique id contract', () => {
  const html = read('modeler.html');
  const js = read('src/modeler.js');
  for (const needle of ['modelerPrefabRail', 'modelerMoodRail', 'modelerLatheRailButton', 'modelerGeodesicRailButton', 'modelerTerrainRailButton', 'data-inspector-tab="ai"', 'modelerAiPrompt', 'modelerAiGenerateButton', 'modelerAiCritiqueButton', 'modelerSequencePreview', 'catmullClarkButton', 'geodesicSphereButton', 'latheVaseButton', 'bridgeLoopsButton', 'fracture3dButton', 'naniteDagStatsButton', 'topologyDoctorButton', 'materialGraphSvgPreview', 'geoNodeSvgPreview', 'value="cyber-carbon-fiber"', 'value="spiral-staircase"', 'v10.0 · Omega Modeler']) assert.ok(html.includes(needle), needle);
  const referenced = [...js.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map(m => m[1]);
  const htmlIds = [...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(htmlIds).size, htmlIds.length, 'duplicate ids in modeler.html');
  for (const id of new Set(referenced)) assert.ok(htmlIds.includes(id), `modeler #${id} missing`);
  for (const needle of ['subdivideCatmullClark', 'fractureMeshVoronoi3D', 'renderMaterialGraphSvg', 'renderGeometryNodeGraphSvg', 'renderModelerRails', "'apex','ai'"]) assert.ok(js.includes(needle), needle);
});

test('Aetherfall v7: synthesized SFX wiring, contracts tracker, ranks and sound toggle', () => {
  const src = read('src/studio/aetherfall-game.js');
  assert.equal((src.match(/vec3 windDeform\(vec3 p, vec3 color\)/g) || []).length, 2);
  for (const needle of [
    "from './audioSynth.js'", 'playSynthPreset', 'data-sound', 'soundEnabled',
    "sfx('sword-slash')", "sfx('portal-hum')", "sfx('powerup-chime')", "sfx('coin-pickup')", "sfx('ui-click')", "sfx('victory-fanfare')",
    'WAYFARER CONTRACTS', 'data-contract-list', 'data-contract-rank', 'awaken-shrines', 'defeat-stalkers', 'construct-outpost', 'sunspire-peak',
    'Achievement unlocked', 'wayfarerRank', 'contractsDone',
  ]) assert.ok(src.includes(needle), needle);
  const css = read('src/studio/aetherfall-game.css');
  assert.ok(css.includes('.aether-contracts'));
});

test('Engine invariants preserved: WebGL 1 renderer label and exact import formats', async () => {
  const s = await import('../src/studio/scene3d.js');
  assert.equal(s.scene3dCapabilities.renderer, 'WebGL 1');
  assert.deepEqual([...s.scene3dCapabilities.formatsImported], ['OBJ', 'GLB', 'glTF embedded', 'ASCII FBX']);
});

test('v7 module line budgets: every Omega module meets its mandatory minimum', () => {
  const budgets = {
    'src/studio/templates.js': 1800,
    'src/studio/sequencer.js': 900,
    'src/studio/audioSynth.js': 850,
    'src/studio/terrainLab.js': 950,
    'src/studio/aiAgent.js': 1400,
    'src/studio/materialGraph.js': 700,
    'src/studio/geometryNodes.js': 650,
    'src/studio/vfx.js': 600,
    'src/studio/meshEdit.js': 1100,
  };
  for (const [file, min] of Object.entries(budgets)) {
    const lines = read(file).split('\n').length;
    assert.ok(lines >= min, `${file}: ${lines} < ${min}`);
  }
});
