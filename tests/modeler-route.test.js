import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
test('standalone Modeler route is included in the production build and its entry assets exist', async () => {
  const html = await readFile(path.join(root, 'modeler.html'), 'utf8');
  const build = await readFile(path.join(root, 'scripts/build.mjs'), 'utf8');
  assert.match(html, /src\/modeler\.js/);
  assert.match(html, /src\/modeler\.css/);
  assert.match(build, /'modeler\.html'/);
  assert.match(html, /option value="array"/);
  assert.match(html, /option value="solidify"/);
  const studio = await readFile(path.join(root, 'src/main.js'), 'utf8');
  assert.match(studio, /href="\.\/modeler\.html"/);
  await access(path.join(root, 'src/modeler.js'));
  await access(path.join(root, 'src/modeler.css'));
});

test('Modeler direct ID selectors all exist in the matching HTML document', async () => {
  const html = await readFile(path.join(root, 'modeler.html'), 'utf8');
  const js = await readFile(path.join(root, 'src/modeler.js'), 'utf8');
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const selectors = new Set([...js.matchAll(/\$\('#([^']+)'\)/g)].map(match => match[1]));
  const missing = [...selectors].filter(id => !ids.has(id));
  assert.deepEqual(missing, [], `Missing DOM id(s): ${missing.join(', ')}`);
  const allIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(allIds).size, allIds.length, 'HTML id attributes must be unique');
});
