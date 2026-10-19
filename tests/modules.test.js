import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveModuleProgram } from '../src/language/modules.js';
import { OrvexaInterpreter } from '../src/language/interpreter.js';

test('resolves relative imports before running entry code', () => {
  const files = {
    'examples/main.orv': 'import "./math.orv"\napp "Module Test"\nprint(square(7))',
    'examples/math.orv': 'function square(n) { return n * n }',
  };
  const ast = resolveModuleProgram('examples/main.orv', files);
  const result = new OrvexaInterpreter().run(ast);
  assert.equal(result.ok, true, result.error?.message);
  assert.equal(result.appName, 'Module Test');
  assert.equal(result.logs[0].text, '49');
});

test('rejects missing and cyclic imports', () => {
  assert.throws(() => resolveModuleProgram('main.orv', { 'main.orv': 'import "missing.orv"' }), /Cannot find imported/i);
  assert.throws(() => resolveModuleProgram('a.orv', { 'a.orv': 'import "b.orv"', 'b.orv': 'import "a.orv"' }), /Circular import/i);
});

test('rejects import paths that escape the project root', () => {
  assert.throws(() => resolveModuleProgram('main.orv', { 'main.orv': 'import "../secret.orv"' }), /escapes the project root/i);
});

test('included module example from starter project runs end-to-end', async () => {
  const { createStarterProject } = await import('../src/studio/project.js');
  const project = createStarterProject();
  const ast = resolveModuleProgram('examples/module-demo.orv', project.files);
  const result = new OrvexaInterpreter().run(ast);
  assert.equal(result.ok, true, result.error?.message);
  assert.equal(result.logs[0].text, 'square(9) = 81');
});
