import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [main, styles, renderer] = await Promise.all([
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/studio/scene3d.js', import.meta.url), 'utf8'),
]);

test('Forge keeps everyday actions visible and groups advanced actions accessibly', () => {
  assert.match(main, /id="sceneUndoButton"/);
  assert.match(main, /id="importAssetButton"/);
  assert.match(main, /forge-export-accordion/);
  assert.match(main, /forge-model-accordion/);
  assert.match(main, /forge-render-accordion/);
  assert.match(main, /forge-sim-accordion/);
  assert.match(main, /<summary>/);
});

test('scene hierarchy has a live accessible search that filters by object name/type', () => {
  assert.match(main, /id="sceneObjectSearch"/);
  assert.match(main, /aria-label="Search scene objects"/);
  assert.match(main, /data-object-search=/);
  assert.match(main, /row\.hidden = !row\.dataset\.objectSearch\.includes\(query\)/);
  assert.match(main, /data-scene-multi-select/);
  assert.match(main, /joinSelectedSceneObjects/);
  assert.match(main, /applySelectedObjectTransform/);
  assert.match(main, /preservedAccordions/);
  assert.match(main, /preservedObjectSearch/);
});

test('Forge UI styles include touch-friendly controls, visible keyboard focus and mobile layouts', () => {
  assert.match(styles, /\.scene-action\s*\{[^}]*min-height:32px/s);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media\(max-width:650px\)/);
  assert.match(styles, /\.forge-accordion > summary/);
});


test('modeling workspace exposes touch-friendly multi-select and apply-transform operations', () => {
  assert.match(main, /class="scene-object-entry"/);
  assert.match(main, /class="scene-multi-select"/);
  assert.match(main, /Join selected meshes/);
  assert.match(main, /Apply rotation & scale/);
  assert.match(styles, /\.scene-object-entry\s*\{/);
  assert.match(styles, /\.scene-multi-select\s*\{/);
});


test('viewport offers direct Move, Rotate and Scale gizmos with touch-sized controls', () => {
  assert.match(main, /data-gizmo-mode="move"/);
  assert.match(main, /data-gizmo-mode="rotate"/);
  assert.match(main, /data-gizmo-mode="scale"/);
  assert.match(main, /<ellipse class="forge-gizmo-hit"/);
  assert.match(main, /screenDelta \/ 105/);
  assert.match(main, /recordSceneEdit\(scene, `Before \$\{mode\} gizmo`\)/);
  assert.match(styles, /\.forge-gizmo-mode-group/);
  assert.match(styles, /\.gizmo-mode-button\.active/);
  assert.match(styles, /\.forge-view-row \.gizmo-mode-button \{[^}]*min-height:40px/s);
});


test('Studio exposes the immersive world player and dedicated RealmScript compile route', () => {
  assert.match(main, /data-right-tab="game"/);
  assert.match(main, /id="playWorldButton"/);
  assert.match(main, /mountAetherfallGame/);
  assert.match(main, /endsWith\('\.realm'\)/);
  assert.match(styles, /world-immersive/);
});

test('Aetherfall includes gameplay, pause/resume, restart, render quality and touch controls', async () => {
  const game = await readFile(new URL('../src/studio/aetherfall-game.js', import.meta.url), 'utf8');
  const gameCss = await readFile(new URL('../src/studio/aetherfall-game.css', import.meta.url), 'utf8');
  assert.match(game, /data-action="pause"/);
  assert.match(game, /data-action="resume"/);
  assert.match(game, /data-action="restart"/);
  assert.match(game, /data-quality/);
  assert.match(game, /data-joystick/);
  assert.match(game, /Collect the Sunshards|Find the Sunshards/);
  assert.match(game, /uShadowEnabled/);
  assert.match(game, /Compile & Rebuild World/);
  assert.match(gameCss, /\.aether-touch-ui/);
  assert.match(gameCss, /\.aether-pause-screen/);
});


test('Aetherfall has real sky palettes, biome-specific world materials and a direct play page', async () => {
  const [game, play, build, playerEntry] = await Promise.all([
    readFile(new URL('../src/studio/aetherfall-game.js', import.meta.url), 'utf8'),
    readFile(new URL('../play.html', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../src/play.js', import.meta.url), 'utf8'),
  ]);
  assert.match(game, /BIOME_OVERRIDES/);
  assert.match(game, /function skySettingsFor/);
  assert.match(game, /uSkyHorizon/);
  assert.match(play, /src="\.\/src\/play\.js"/);
  assert.match(playerEntry, /mountAetherfallGame/);
  assert.match(playerEntry, /orvexa-exit-world/);
  assert.match(build, /'play\.html'/);
});


test('Aetherfall uses procedural material detail, richer volumetric-style cloud layers and cinematic quality profile', async () => {
  const game = await readFile(new URL('../src/studio/aetherfall-game.js', import.meta.url), 'utf8');
  assert.match(game, /float fbm21\(vec2 p\)/);
  assert.match(game, /groundMask/);
  assert.match(game, /dFdx\(grain\)/);
  assert.match(game, /float cloudLight/);
  assert.match(game, /starCell/);
  assert.match(game, /value=\"cinematic\">Cinematic/);
  assert.match(game, /cinematic:\{scale:1\.24,shadow:2048,shadows:true\}/);
});


test('Forge exposes editable real-time light types and GPU-capped shadow-map quality', () => {
  assert.match(main, /id="lightType"/);
  assert.match(main, /value="directional"/);
  assert.match(main, /value="spot"/);
  assert.match(main, /id="lightDirectionX"/);
  assert.match(main, /id="lightIntensity"/);
  assert.match(main, /id="renderShadowResolution"/);
  assert.match(main, /id="renderShadowCaster"/);
  assert.match(main, /copy\.lightType=/);
  assert.match(main, /copy\.range=/);
  assert.match(main, /copy\.innerCone=/);
  assert.match(main, /if\(obj\.direction&&typeof obj\.direction==='object'\)copy\.direction=/);
  assert.match(main, /shadowCasterId:String\(scene\.renderSettings\?\.shadowCasterId/);
  assert.match(main, /orvexa-render-settings-change/);
  assert.match(renderer, /orvexa-render-settings-change/);
  assert.match(renderer, /selectRenderLights\(objects,settings\.shadowCasterId/);
  assert.match(renderer, /spotFov=Math\.max/);
  assert.match(renderer, /primary\.outerCone/);
  assert.match(main, /shadowResolution:\[512,1024,2048\]/);
});


test('Forge PBR texture channels are editable, persisted, and wired to the actual renderer', () => {
  assert.match(main, /data-load-material-map="\$\{field\}"/);
  assert.match(main, /data-clear-material-map/);
  assert.match(main, /metallicRoughnessImage/);
  assert.match(main, /aoImage/);
  assert.match(main, /emissiveImage/);
  assert.match(main, /normalImage/);
  assert.match(main, /set to 1|intensity 1/i);
  assert.match(renderer, /uMetalRoughMap/);
  assert.match(renderer, /uAOMap/);
  assert.match(renderer, /uEmissiveMap/);
  assert.match(renderer, /mrSample\.g/);
  assert.match(renderer, /mrSample\.b/);
  assert.match(renderer, /texture2D\(uAOMap,vUV\)\.r/);
  assert.match(renderer, /uNormalMap/);
  assert.match(renderer, /applyNormalMap/);
  assert.match(renderer, /OES_standard_derivatives/);
  assert.match(renderer, /uAOStrength/);
  assert.match(renderer, /uNormalScale/);
  assert.match(renderer, /uEmissiveTint/);
  assert.match(renderer, /uEmissiveUsesAlbedo/);
  assert.match(main, /materialAOStrength/);
  assert.match(main, /materialNormalScale/);
  const materialUpdateStart = main.indexOf('const updateMaterial=()=>');
  const materialUpdateEnd = main.indexOf("$('#loadMaterialImage')", materialUpdateStart);
  assert.match(main.slice(materialUpdateStart, materialUpdateEnd), /orvexa-render-settings-change/);
});


test('Modeler offers working mesh component selection, translation, extrusion and inset controls', async () => {
  const [html, js, meshEdit, css] = await Promise.all([
    readFile(new URL('../modeler.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/modeler.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/studio/meshEdit.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/modeler.css', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="elementSelectionMode"/);
  assert.match(html, /id="moveSelectedElementsButton"/);
  assert.match(html, /id="extrudeFacesButton"/);
  assert.match(html, /id="insetFacesButton"/);
  assert.match(html, /<option value="bevel">Bevel<\/option>/);
  assert.match(js, /m\.type === 'bevel'/);
  assert.match(js, /selectMeshElement\(hit, event\.clientX, event\.clientY/);
  assert.match(js, /uniqueMeshVertexCount/);
  assert.match(js, /extrudeTriangleFaces/);
  assert.match(js, /insetTriangleFaces/);
  assert.match(meshEdit, /export function translateMeshElements/);
  assert.match(meshEdit, /export function extrudeTriangleFaces/);
  assert.match(meshEdit, /export function insetTriangleFaces/);
  assert.match(css, /\.selected-face/);
  assert.match(css, /\.selected-edge/);
  assert.match(css, /\.selected-vertex/);
});

test('Forge light inspector persists source radius for path-traced soft shadows', () => {
  assert.match(main, /id="lightRadius"/);
  assert.match(main, /selected\.radius=Math\.max\(0,Math\.min\(10/);
  assert.match(main, /copy\.radius=Math\.max\(0,Math\.min\(10/);
  assert.match(main, /\'lightRadius\'/);
});

test('Orvexa Modeler publishes selected meshes into the same Aetherfall world asset package', async () => {
  const [game, modeler, html] = await Promise.all([
    readFile(new URL('../src/studio/aetherfall-game.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/modeler.js', import.meta.url), 'utf8'),
    readFile(new URL('../modeler.html', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="publishToWorldButton"/);
  assert.match(modeler, /createWorldAssetPackage\(scene\.objects, selectedIds\)/);
  assert.match(modeler, /WORLD_ASSETS_STORAGE_KEY/);
  assert.match(game, /normalizeWorldAssetPackage\(raw\)/);
  assert.match(game, /transformWorldAssetVertex\(/);
  assert.match(game, /data-action="sync-assets"/);
  assert.match(game, /data-authored-model-count/);
});

test('Aetherfall animates green canopy vertices and matches the same wind deformation in shadow depth', async () => {
  const game = await readFile(new URL('../src/studio/aetherfall-game.js', import.meta.url), 'utf8');
  assert.match(game, /vec3 windDeform\(vec3 p, vec3 color\)/);
  assert.equal((game.match(/vec3 windDeform\(vec3 p, vec3 color\)/g) || []).length, 2);
  assert.match(game, /uniform float uWindStrength/);
  assert.match(game, /uniforms\(shadowProgram,'uWindStrength'\),windStrength/);
  assert.match(game, /terrainMesh=packGpuMesh\(gl,worldData\.terrain\)/);
  assert.match(game, /drawMesh\(terrainMesh\);gl\.uniform1f\(uniforms\(mainProgram,'uWindStrength'\),windStrength\);drawMesh\(staticMesh\)/);
});

test('Aetherfall open world includes animated low-cost wildlife, bird flocks and night fireflies', async () => {
  const game = await readFile(new URL('../src/studio/aetherfall-game.js', import.meta.url), 'utf8');
  assert.match(game, /function updateDynamicWildlife\(force=false\)/);
  assert.match(game, /birdCount=quality===/);
  assert.match(game, /if\(environment\.daylight<\.24&&worldWeather!=='rain'\)/);
  assert.match(game, /addSphere\(b,x,y,z,\.055,\.08,\.055,\[1\.65,\.92,\.24\]/);
  assert.match(game, /drawMesh\(weatherMesh\);drawMesh\(wildlifeMesh\)/);
});

test('Aetherfall saves restore zero-valued coordinates and midnight instead of treating them as missing', async () => {
  const game = await readFile(new URL('../src/studio/aetherfall-game.js', import.meta.url), 'utf8');
  assert.match(game, /Number\.isFinite\(Number\(save\.player\?\.x\)\)\?Number\(save\.player\.x\):player\.x/);
  assert.match(game, /Number\.isFinite\(Number\(save\.player\?\.z\)\)\?Number\(save\.player\.z\):player\.z/);
  assert.match(game, /Number\.isFinite\(Number\(save\.timeOfDay\)\)\?Number\(save\.timeOfDay\):15\.5/);
});

test('Aetherfall settings expose quality-scaled world detail, day/night and weather controls', async () => {
  const game = await readFile(new URL('../src/studio/aetherfall-game.js', import.meta.url), 'utf8');
  assert.match(game, /data-time-of-day/);
  assert.match(game, /data-day-cycle/);
  assert.match(game, /data-weather/);
  assert.match(game, /function updateDynamicWeather\(force=false\)/);
  assert.match(game, /vegetationScale/);
  assert.match(game, /quality==='cinematic'\?1\.28/);
});


test('Aetherfall applies weather-responsive wet ground, snow accumulation and varied canopy silhouettes', async () => {
  const game = await readFile(new URL('../src/studio/aetherfall-game.js', import.meta.url), 'utf8');
  assert.match(game, /float rainWet=smoothstep\(1\.55,2\.05,uWeather\)/);
  assert.match(game, /float snowWeather=smoothstep\(2\.75,3\.0,uWeather\)/);
  assert.match(game, /base=mix\(base,vec3\(\.72,\.79,\.84\).*snowMask/);
  assert.match(game, /roughness=mix\(roughness,\.19,rainWet\*\.82\)/);
  assert.match(game, /for\(let branch=0;branch<7;branch\+\+\)/);
});

test('Aetherfall includes Guardian NPCs, Lore Waystones, Wayfarer Journal & Inventory, and Resonance Pulse', async () => {
  const game = await readFile(new URL('../src/studio/aetherfall-game.js', import.meta.url), 'utf8');
  assert.match(game, /Elder Lyra · Windmere Keeper/);
  assert.match(game, /Warden Kael · Spire Sentinel/);
  assert.match(game, /Waystone of the First Road/);
  assert.match(game, /data-journal-panel/);
  assert.match(game, /triggerResonancePulse/);
  assert.match(game, /discoveredLore/);
});

