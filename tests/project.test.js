import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject, validateProject, normalizePath, exportProjectZip, importProjectFile, buildStaticWebsite, loadProject, PROJECT_STORAGE_KEY } from '../src/studio/project.js';
import { zipSync, unzip, unzipText, zipText, crc32 } from '../src/studio/zip.js';
import { OrvexaInterpreter } from '../src/language/interpreter.js';

test('normalizes file paths and rejects traversal', () => {
  assert.equal(normalizePath('examples\\hello.orv'), 'examples/hello.orv');
  assert.throws(() => normalizePath('../outside.orv'), /unsafe/i);
  assert.throws(() => normalizePath(''), /unsafe/i);
});

test('validates project manifest and defaults active source', () => {
  const project = validateProject({ name: 'Demo', files: { 'src/main.orv': 'print("hi")' } });
  assert.equal(project.activeFile, 'src/main.orv');
  assert.equal(project.format, 'orvexa-studio-project');
  assert.throws(() => validateProject({ files: { 'a.orv': 42 } }), /text/i);
});

test('ZIP writer emits a valid archive and reader checks entries', async () => {
  const bytes = zipSync({ 'a.txt': zipText('hello'), 'nested/b.orv': zipText('print(3)') });
  assert.equal(new DataView(bytes.buffer).getUint32(0, true), 0x04034b50);
  const unpacked = await unzip(bytes);
  assert.equal(unzipText(unpacked['a.txt']), 'hello');
  assert.equal(unzipText(unpacked['nested/b.orv']), 'print(3)');
  assert.equal(crc32(zipText('123456789')), 0xcbf43926);
});

test('complete project export can be re-imported without executing its source', async () => {
  const project = createStarterProject();
  const blob = exportProjectZip(project);
  const file = new File([blob], 'my-project.zip', { type: 'application/zip' });
  const restored = await importProjectFile(file);
  assert.equal(restored.name, project.name);
  assert.equal(restored.files['main.orv'], project.files['main.orv']);
  assert.ok(restored.files['examples/scene.orv']);
});

test('static site builder creates a standalone readable HTML snapshot', async () => {
  const project = createStarterProject();
  const result = new OrvexaInterpreter().run(project.files['main.orv']);
  const blob = buildStaticWebsite(project, result);
  const entries = await unzip(new Uint8Array(await blob.arrayBuffer()));
  const html = unzipText(entries['index.html']);
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Welcome to Orvexa/);
  assert.match(html, /snapshot/);
});


test('Part 2 migrates saved Part 1 projects additively and preserves user files', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  const storage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage });
    values.set(PROJECT_STORAGE_KEY, JSON.stringify({
      format: 'orvexa-studio-project', version: 1, name: 'My existing work', activeFile: 'main.orv',
      files: { 'main.orv': 'print("my work")', 'custom/important.orv': 'let value = 7' }, folders: ['custom'],
    }));
    const migrated = loadProject();
    assert.equal(migrated.version, 7);
    assert.equal(migrated.files['main.orv'], 'print("my work")');
    assert.equal(migrated.files['custom/important.orv'], 'let value = 7');
    assert.ok(migrated.files['examples/types.orv']);
    assert.ok(migrated.files['examples/null-safe.orv']);
    assert.ok(migrated.files['examples/data-toolkit.orv']);
    assert.ok(migrated.files['examples/scene-lab.orv']);
    assert.ok(migrated.files['examples/forge-game.orv']);
    assert.ok(migrated.files['examples/forge-quality.orv']);
    assert.ok(migrated.files['examples/aetherfall.realm']);
    assert.ok(values.get(PROJECT_STORAGE_KEY).includes('"version":7'));
  } finally {
    if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
    else delete globalThis.localStorage;
  }
});

test('project manifest round-trips persistent scene inspector overrides and OBJ source assets', async () => {
  const project = validateProject({
    name: 'Scene project', activeFile: 'main.orv',
    files: { 'main.orv': 'scene "Lab" { cube("Hero") }', 'assets/hero.obj': 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3' },
    sceneOverrides: { 'Lab::0': { name: 'Hero Updated', position: { x: 1, y: 2, z: 3 }, size: 1.5, color: '#123456' } },
    sceneState: { Lab: { additions: [{ engineId: 'added:test', type: 'cube', name: 'Persisted' }], deleted: ['source:1'] } },
  });
  assert.equal(project.version, 7);
  assert.equal(project.sceneOverrides['Lab::0'].position.y, 2);
  const blob = exportProjectZip(project);
  const entries = await unzip(new Uint8Array(await blob.arrayBuffer()));
  const manifest = JSON.parse(unzipText(entries['orvexa.project.json']));
  assert.equal(manifest.files['assets/hero.obj'].includes('f 1 2 3'), true);
  assert.equal(manifest.sceneOverrides['Lab::0'].name, 'Hero Updated');
  assert.equal(manifest.sceneState.Lab.additions[0].name, 'Persisted');
  assert.deepEqual(manifest.sceneState.Lab.deleted, ['source:1']);
});
