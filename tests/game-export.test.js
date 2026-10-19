import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildStandaloneGame, buildAndroidProjectZip } from '../src/studio/gameExport.js';
import { unzip, unzipText } from '../src/studio/zip.js';

test('standalone game export contains self-contained WebGL runtime and scene data', async () => {
  const scene = { name: 'Tiny Arena', simulation: { gravity: 9.81 }, objects: [
    { engineId: 'floor', type: 'plane', name: 'Floor', position: { x: 0, y: -1, z: 0 }, size: 8 },
    { engineId: 'hero', type: 'sphere', name: 'Hero', position: { x: 0, y: 1, z: 0 }, size: 0.5, color: '#ffcc66', rigidBody: { enabled: true, bodyType: 'dynamic', velocity: {x:0,y:0,z:0} }, controller: { speed: 3, jumpSpeed: 5 } },
    { type: 'camera', name: 'Camera', position: {x:0,y:2,z:7} },
  ] };
  const blob = buildStandaloneGame(scene, 'Tiny Game');
  const entries = await unzip(new Uint8Array(await blob.arrayBuffer()));
  const html = unzipText(entries['index.html']);
  assert.match(html, /Playable Orvexa Forge 3D game/i);
  assert.match(html, /ORVEXA_SCENE=/);
  assert.match(html, /stepPhysics/);
  assert.match(html, /o\.position\.x\+=\(Number\(b\.velocity\.x\)\|\|0\)\*dt/);
  assert.match(html, /keydown/);
  assert.match(html, /data-key="w"/);
  assert.match(html, /data-key="space"/);
  assert.match(html, /pointercancel/);
  assert.match(html, /aNormal/);
  assert.match(html, /Dggx/);
  assert.match(html, /visibleSphere/);
  assert.match(html, /adaptiveScale/);
  const runtimeScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(runtimeScript, 'standalone runtime script exists');
  assert.doesNotThrow(() => new vm.Script(runtimeScript), 'generated standalone runtime must parse');
  assert.equal(JSON.parse(unzipText(entries['scene.json'])).objects.find(o => o.name === 'Hero').controller.speed, 3);
  assert.match(unzipText(entries['README-GAME.txt']), /not a native APK build/i);
});


test('standalone game carries render settings, authored UVs and embedded base-colour textures', async () => {
  const scene = { name: 'Texture Lab', renderSettings: { exposure: 1.8, fog: true, fogDensity: 0.02, fogColor: '#445566', vignette: 0.3 }, objects: [{ engineId: 'hero', type: 'mesh', name: 'Textured', geometry: [0,0,0,1,0,0,0,1,0], uvs: [0,0,1,0,0,1], material: { baseColorImage: 'data:image/png;base64,iVBORw0KGgo=' } }] };
  const entries = await unzip(new Uint8Array(await buildStandaloneGame(scene).arrayBuffer()));
  const payload = JSON.parse(unzipText(entries['scene.json']));
  assert.equal(payload.renderSettings.exposure, 1.8);
  assert.equal(payload.renderSettings.environmentStrength, 1);
  assert.equal(payload.renderSettings.performanceMode, 'balanced');
  assert.equal(payload.objects[0].uvs.length, 6);
  assert.match(unzipText(entries['index.html']), /uBaseMap/);
  assert.match(unzipText(entries['index.html']), /uFogDensity/);
});

test('Android wrapper export is a single importable source-project ZIP', async () => {
  const scene = { name: 'APK Proof', objects: [{ type: 'cube', name: 'Box', position: {x:0,y:0,z:0}, size: 1 }] };
  const entries = await unzip(new Uint8Array(await (await buildAndroidProjectZip(scene, 'APK Proof')).arrayBuffer()), { maxUncompressed: 24_000_000, maxEntryBytes: 20_000_000 });
  assert.ok(entries['OrvexaGame/app/src/main/java/com/orvexa/game/MainActivity.java']);
  assert.equal(Boolean(entries['OrvexaGame/app/src/main/java/com/orvexa/game/MainActivity.kt']), false);
  assert.ok(entries['OrvexaGame/app/src/main/assets/index.html']);
  const readme = unzipText(entries['OrvexaGame/README-BUILD-APK.txt']);
  assert.match(readme, /not (itself )?a compiled APK/i);
  assert.match(readme, /GitHub Actions/i);
  assert.ok(entries['OrvexaGame/.github/workflows/build-android-apk.yml']);
  assert.ok(entries['OrvexaGame/scripts/build-apk.sh']);
  assert.ok(entries['OrvexaGame/scripts/setup-android-sdk.sh']);
  assert.match(unzipText(entries['OrvexaGame/scripts/build-apk.sh']), /api\.adoptium\.net\/v3\/binary\/latest\/17\/ga\/linux\/x64/);
  assert.match(unzipText(entries['OrvexaGame/scripts/build-apk.sh']), /gradle-\$GRADLE_VERSION-bin\.zip/);
  assert.match(unzipText(entries['OrvexaGame/scripts/build-apk.sh']), /Always use the project's pinned Gradle version/);
  assert.match(unzipText(entries['OrvexaGame/scripts/build-apk.sh']), /-gt 21/);
  const workflow = unzipText(entries['OrvexaGame/.github/workflows/build-android-apk.yml']);
  assert.match(workflow, /actions\/checkout@v7/);
  assert.match(workflow, /actions\/setup-java@v6/);
  assert.match(workflow, /assembleDebug/);
  assert.match(workflow, /upload-artifact@v4/);
});


test('standalone game carries metallic-roughness, AO and emissive textures into the live shader', async () => {
  const pixel = 'data:image/png;base64,iVBORw0KGgo=';
  const scene = { name: 'PBR channels', objects: [{ type: 'mesh', name: 'Surface', geometry: [0,0,0,1,0,0,0,1,0], material: { metallic: 0.5, roughness: 0.4, aoStrength: 0.3, normalScale: 1.7, emissive: 0.9, emissiveTint: [1, 0.5, 0.25], metallicRoughnessImage: pixel, aoImage: pixel, emissiveImage: pixel, normalImage: pixel } }] };
  const entries = await unzip(new Uint8Array(await buildStandaloneGame(scene).arrayBuffer()));
  const html = unzipText(entries['index.html']);
  const object = JSON.parse(unzipText(entries['scene.json'])).objects[0];
  assert.equal(object.material.metallicRoughnessImage, pixel);
  assert.equal(object.material.aoImage, pixel);
  assert.equal(object.material.emissiveImage, pixel);
  assert.equal(object.material.normalImage, pixel);
  assert.equal(object.material.aoStrength, 0.3);
  assert.equal(object.material.normalScale, 1.7);
  assert.equal(object.material.emissive, 0.9);
  assert.deepEqual(object.material.emissiveTint, [1, 0.5, 0.25]);
  assert.equal(object.material.emissiveUsesAlbedo, false);
  assert.match(html, /uMetalRoughMap/);
  assert.match(html, /uAOMap/);
  assert.match(html, /uEmissiveMap/);
  assert.match(html, /uNormalMap/);
  assert.match(html, /uAOStrength/);
  assert.match(html, /uNormalScale/);
  assert.match(html, /uEmissiveTint/);
  assert.match(html, /uEmissiveUsesAlbedo/);
  assert.match(html, /applyNormalMap/);
  assert.match(html, /textureFor\(o,'metallicRoughnessImage'\)/);
  assert.match(html, /textureFor\(o,'normalImage'\)/);
});
