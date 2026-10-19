import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, highlightOrvexa } from '../src/language/lexer.js';
import { parse, OrvexaSyntaxError } from '../src/language/parser.js';
import { OrvexaInterpreter } from '../src/language/interpreter.js';
import { STARTER_SOURCE, EXAMPLE_FILES } from '../src/studio/project.js';

function run(source, options) { return new OrvexaInterpreter(options).run(source); }

test('lexer preserves token locations and handles strings/comments/newlines', () => {
  const { tokens, errors } = tokenize('// note\nlet word = "hello\\nworld" /* ok */\nprint(2)');
  assert.equal(errors.length, 0);
  assert.ok(tokens.some((t) => t.type === 'newline' && t.line === 1));
  assert.ok(tokens.some((t) => t.type === 'string' && t.value === 'hello\nworld'));
  assert.ok(tokens.some((t) => t.type === 'number' && t.value === 2));
});

test('syntax highlighter safely escapes source HTML', () => {
  const html = highlightOrvexa('let name = "Orvexa"\nprint("<script>")');
  assert.match(html, /tok-keyword/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<span class="tok-keyword">let<\/span> <span class="tok-identifier">name<\/span> <span class="tok-operator">=<\/span>/);
  assert.match(html, /<span class="tok-identifier">print<\/span><span class="tok-punctuation">\(<\/span>/);
});

test('parses and evaluates math, variables, functions, and return values', () => {
  const result = run(`app "Math Test"\nfunction double(n) { return n * 2 }\nlet x = double(21)\nprint(x)`);
  assert.equal(result.ok, true, result.error?.message);
  assert.equal(result.appName, 'Math Test');
  assert.equal(result.logs[0].text, '42');
});

test('supports conditionals, foreach loops, and array values', () => {
  const result = run(`let total = 0\nfor i in range(1, 5) {\n total += i\n}\nif total == 10 { print("yes") } else { print("no") }`);
  assert.equal(result.ok, true, result.error?.message);
  assert.equal(result.logs.at(-1).text, 'yes');
});

test('function recursion and numeric helpers work', () => {
  const result = run(`function factorial(n) {\n if n <= 1 { return 1 }\n return n * factorial(n - 1)\n}\nprint(factorial(5), math.sqrt(81))`);
  assert.equal(result.ok, true, result.error?.message);
  assert.equal(result.logs[0].text, '120 9');
});

test('variables have scope and constants cannot be reassigned', () => {
  const bad = run(`const score = 1\nscore = 2`);
  assert.equal(bad.ok, false);
  assert.match(bad.error.message, /constant 'score'/);
  const scope = run(`if true { let hidden = 2 }\nprint(hidden)`);
  assert.equal(scope.ok, false);
  assert.match(scope.error.message, /Unknown name 'hidden'/);
});

test('UI pages build component trees and button blocks update persistent state', () => {
  const source = `app "Counter"\nstate clicks = 0\npage "Home" {\n column(gap: 16) {\n  title("Clicks: " + clicks, size: 30)\n  button("Add " + clicks) { clicks = clicks + 1 }\n }\n}`;
  const stateStore = new Map(); const first = new OrvexaInterpreter({ stateStore }).run(source);
  assert.equal(first.ok, true, first.error?.message);
  assert.equal(first.pages.length, 1);
  const col = first.pages[0].children[0];
  assert.equal(col.component, 'column');
  assert.equal(col.children[1].component, 'button');
  assert.equal(col.children[1].props.label, 'Add 0');
  col.children[1].onClick();
  const second = new OrvexaInterpreter({ stateStore }).run(source);
  assert.equal(second.pages[0].children[0].children[0].props.label, 'Clicks: 1');
  assert.equal(second.pages[0].children[0].children[1].props.label, 'Add 1');
});

test('3D declarations produce camera, primitive, and animation metadata', () => {
  const result = run(EXAMPLE_FILES['examples/scene.orv']);
  assert.equal(result.ok, true, result.error?.message);
  assert.equal(result.scenes.length, 1);
  assert.ok(result.scenes[0].objects.some((x) => x.type === 'camera'));
  assert.ok(result.scenes[0].objects.some((x) => x.type === 'cube' && x.name === 'Hero'));
  assert.ok(result.scenes[0].objects.some((x) => x.type === 'animation'));
});

test('execution budget stops an accidental infinite loop', () => {
  const result = run('while true { let x = 1 }', { maxSteps: 100 });
  assert.equal(result.ok, false);
  assert.match(result.error.message, /steps|iterations/i);
});

test('division by zero and malformed syntax return helpful errors', () => {
  const result = run('let answer = 8 / 0');
  assert.equal(result.ok, false);
  assert.match(result.error.message, /divide by zero/i);
  assert.throws(() => parse('let = 3'), OrvexaSyntaxError);
});

test('starter program and every included runnable example parse and execute', () => {
  const all = { 'main.orv': STARTER_SOURCE, ...EXAMPLE_FILES };
  for (const [filename, source] of Object.entries(all)) {
    if (filename.endsWith('.realm')) continue; // RealmScript is compiled by its dedicated domain-specific parser.
    if (source.includes('import \"')) continue; // Imports are compiled by the project module loader.
    const result = run(source);
    assert.equal(result.ok, true, `${filename}: ${result.error?.message}`);
  }
});

test('condition calls do not swallow their branch blocks', () => {
  const result = run(`function ready() { return true }\nif ready() { print("branch ran") }`);
  assert.equal(result.ok, true, result.error?.message);
  assert.equal(result.logs[0].text, 'branch ran');
});

test('default parameters can refer to earlier parameters', () => {
  const result = run(`function add(a, b = a + 1) { return a + b }\nprint(add(3))`);
  assert.equal(result.ok, true, result.error?.message);
  assert.equal(result.logs[0].text, '7');
});

test('parser diagnostics preserve source line and column', () => {
  const result = run(`let good = 1\n\nlet = 2`);
  assert.equal(result.ok, false);
  assert.equal(result.error.line, 3);
  assert.ok(result.error.column > 0);
});

test('runtime type contracts validate variables, assignments, parameters, and return values', () => {
  const success = run(`let score: number = 10\nscore = score + 5\nfunction double(value: number): number { return value * 2 }\nprint(double(score))`);
  assert.equal(success.ok, true, success.error?.message);
  assert.equal(success.logs[0].text, '30');

  const badAssignment = run(`let score: number = 10\nscore = "ten"`);
  assert.equal(badAssignment.ok, false);
  assert.match(badAssignment.error.message, /expected number, received string/i);

  const badParameter = run(`function double(value: number): number { return value * 2 }\nprint(double("10"))`);
  assert.equal(badParameter.ok, false);
  assert.match(badParameter.error.message, /expected number, received string/i);

  const badReturn = run(`function broken(): string { return 123 }\nprint(broken())`);
  assert.equal(badReturn.ok, false);
  assert.match(badReturn.error.message, /return value.*expected string/i);
});

test('null-coalescing and optional chaining safely handle missing data', () => {
  const result = run(`let profile = null\nprint(profile?.account?.name ?? "Guest")\nprint(false ?? true, 0 ?? 7, "" ?? "fallback")`);
  assert.equal(result.ok, true, result.error?.message);
  assert.equal(result.logs[0].text, 'Guest');
  assert.equal(result.logs[1].text, 'false 0 ');
  const indexed = run(`let profile = null\nprint(profile?.items[0] ?? "empty")\nprint(profile?.getName() ?? "none")`);
  assert.equal(indexed.ok, true, indexed.error?.message);
  assert.equal(indexed.logs[0].text, 'empty');
  assert.equal(indexed.logs[1].text, 'none');
  const strict = run(`let profile = null\nprint(profile.account.name)`);
  assert.equal(strict.ok, false);
  assert.match(strict.error.message, /Use \?\./);
});

test('data and text helpers produce predictable results', () => {
  const result = run(`let scores = [18, 7, 24, 18, 11]\nprint(sum(scores), average(scores), sorted(scores), unique(scores))\nprint(typeOf(scores), first(scores), last(scores), upper("orvexa"))\nprint(keys({ name: "Ada", role: "Builder" }), has({ name: "Ada" }, "name"))`);
  assert.equal(result.ok, true, result.error?.message);
  assert.equal(result.logs[0].text, '78 15.6 [7,11,18,18,24] [18,7,24,11]');
  assert.equal(result.logs[1].text, 'array 18 11 ORVEXA');
  assert.equal(result.logs[2].text, '["name","role"] true');
});

test('unknown names suggest a likely intended identifier', () => {
  const result = run(`let username = "Ada"\nprint(usernmae)`);
  assert.equal(result.ok, false);
  assert.match(result.error.message, /Did you mean 'username'/);
});

test('runaway recursion returns a controlled depth diagnostic', () => {
  const result = run(`function repeatForever(n) { return repeatForever(n + 1) }\nrepeatForever(0)`, { maxCallDepth: 12 });
  assert.equal(result.ok, false);
  assert.match(result.error.message, /Maximum function call depth/);
});

test('parser caches immutable ASTs and rejects malformed numeric exponents', async () => {
  const { clearParserCache, parserCacheInfo } = await import('../src/language/parser.js');
  clearParserCache();
  const first = parse('let amount = 1e3');
  const second = parse('let amount = 1e3');
  assert.equal(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.ok(parserCacheInfo().entries >= 1);
  assert.throws(() => parse('let amount = 1e+'), /exponent marker must be followed by a digit/i);
  assert.throws(() => parse('let amount = 9e999'), /Invalid or out-of-range number/i);
});

test('cycle-safe logging does not crash when a data structure refers to itself', () => {
  const result = run(`let data = []\ndata.push(data)\nprint(data)`);
  assert.equal(result.ok, true, result.error?.message);
  assert.match(result.logs[0].text, /Circular/);
});


test('power operators have conventional precedence over multiplication and unary minus', () => {
  const result = run(`print(2 * 3 ** 2)\nprint(-2 ** 2)\nprint(2 ** 3 ** 2)`);
  assert.equal(result.ok, true, result.error?.message);
  assert.deepEqual(result.logs.map((line) => line.text), ['18', '-4', '512']);
  assert.throws(() => parse('let score: number'), /needs an initial value/i);
});


test('a failed typed state initialization does not poison the state store', () => {
  const stateStore = new Map();
  const failed = run('state count: number = "not a number"', { stateStore });
  assert.equal(failed.ok, false);
  assert.equal(stateStore.has('count'), false);
  const repaired = run('state count: number = 2\nprint(count)', { stateStore });
  assert.equal(repaired.ok, true, repaired.error?.message);
  assert.equal(repaired.logs[0].text, '2');
});

test('numeric operand errors retain source locations', () => {
  const result = run(`let okay = 1\nlet answer = okay - "not a number"`);
  assert.equal(result.ok, false);
  assert.equal(result.error.line, 2);
  assert.ok(result.error.column > 0);
});


test('Orvexa Forge code can declare materials, rigid bodies, and player controllers', () => {
  const result = run(EXAMPLE_FILES['examples/forge-game.orv']);
  assert.equal(result.ok, true, result.error?.message);
  const nodes = result.scenes[0].objects;
  assert.ok(nodes.some(node => node.type === 'rigidbody' && node.target === 'Physics Ball'));
  assert.ok(nodes.some(node => node.type === 'material' && node.target === 'Chrome Crate'));
  assert.ok(nodes.some(node => node.type === 'controller' && node.target === 'Physics Ball'));
  assert.ok(nodes.some(node => node.type === 'capsule' || node.type === 'torus'));
});

test('Orvexa Script Lab supports materialGraph, vfx, geometryNodes, and environment scene declarations', () => {
  const source = `
    scene "Procedural Sanctuary" {
      environment("sunset", 1.35, 1.15)
      cube("Altar", 0, 0.5, 0, 1.5, "#d8dee9")
      materialGraph("Altar", "emerald-crystal", 16)
      geometryNodes("Crystal Ring", "crystal-sanctuary", 0, 0, 0, 1.0, "#66e3c4")
      vfx("Sanctuary Sparks", "arcane-fountain", 0, 1.2, 0, 64)
    }
  `;
  const result = run(source);
  assert.equal(result.ok, true, result.error?.message);
  const objects = result.scenes[0].objects;
  assert.ok(objects.some(o => o.type === 'environment' && o.preset === 'sunset'));
  assert.ok(objects.some(o => o.type === 'materialGraph' && o.target === 'Altar' && o.preset === 'emerald-crystal'));
  assert.ok(objects.some(o => o.type === 'geometryNodes' && o.name === 'Crystal Ring' && o.preset === 'crystal-sanctuary'));
  assert.ok(objects.some(o => o.type === 'vfx' && o.name === 'Sanctuary Sparks' && o.preset === 'arcane-fountain'));
});

