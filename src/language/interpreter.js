import { parse } from './parser.js';

export class OrvexaRuntimeError extends Error {
  constructor(message, loc, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'OrvexaRuntimeError';
    this.line = loc?.line ?? 1;
    this.column = loc?.column ?? 1;
    this.offset = loc?.offset ?? 0;
  }
}

class Environment {
  constructor(parent = null, stateStore = new Map(), stateNames = new Set()) {
    this.parent = parent; this.values = new Map(); this.constants = new Set(); this.types = new Map();
    this.stateStore = stateStore; this.stateNames = stateNames;
  }
  define(name, value, mode = 'let', annotation = null, loc = null) {
    if (mode === 'const') this.constants.add(name);
    if (mode === 'state') {
      this.stateNames.add(name);
      if (this.stateStore.has(name)) value = this.stateStore.get(name);
    }
    assertType(name, value, annotation, loc);
    this.values.set(name, value);
    if (annotation) this.types.set(name, annotation);
    if (mode === 'state') this.stateStore.set(name, value);
    return value;
  }
  owner(name) { for (let scope = this; scope; scope = scope.parent) if (scope.values.has(name)) return scope; return null; }
  get(name, loc) {
    const owner = this.owner(name);
    if (!owner) {
      const names = new Set(); for (let scope = this; scope; scope = scope.parent) for (const key of scope.values.keys()) names.add(key);
      const closest = [...names].map((candidate) => [candidate, nameDistance(name, candidate)]).sort((a, b) => a[1] - b[1])[0];
      const hint = closest && closest[1] <= Math.max(1, Math.floor(name.length * 0.3)) ? ` Did you mean '${closest[0]}'?` : '';
      throw new OrvexaRuntimeError(`Unknown name '${name}'.${hint}`, loc);
    }
    return owner.values.get(name);
  }
  set(name, value, loc) {
    const owner = this.owner(name);
    if (!owner) throw new OrvexaRuntimeError(`Cannot assign to unknown name '${name}'.`, loc);
    if (owner.constants.has(name)) throw new OrvexaRuntimeError(`Cannot change constant '${name}'.`, loc);
    assertType(name, value, owner.types.get(name), loc);
    owner.values.set(name, value);
    if (owner.stateNames.has(name)) owner.stateStore.set(name, value);
    return value;
  }
}

class ReturnSignal extends Error { constructor(value, loc) { super('A return statement is only valid inside a function.'); this.name = 'ReturnSignal'; this.value = value; this.loc = loc; } }
class BreakSignal extends Error { constructor(loc) { super('A break statement is only valid inside a loop.'); this.name = 'BreakSignal'; this.loc = loc; } }
class ContinueSignal extends Error { constructor(loc) { super('A continue statement is only valid inside a loop.'); this.name = 'ContinueSignal'; this.loc = loc; } }
const isNode = (v) => v && (v.__orvUi === true || v.__orvScene === true);
const isObject = (v) => v !== null && typeof v === 'object';
const toNumber = (v, loc) => { const n = Number(v); if (!Number.isFinite(n)) throw new OrvexaRuntimeError(`Expected a finite number, received ${String(v)}.`, loc); return n; };
const typeOfValue = (v) => v === null ? 'null' : Array.isArray(v) ? 'array' : v?.__orvFunction || v?.__orvNative || typeof v === 'function' ? 'function' : v?.__orvUi ? 'ui' : v?.__orvScene ? 'scene' : typeof v;
const safeString = (v) => {
  if (typeof v === 'string') return v;
  if (v === null) return 'null';
  if (typeof v !== 'object') return String(v);
  const seen = new WeakSet();
  try { return JSON.stringify(v, (_key, value) => { if (value && typeof value === 'object') { if (seen.has(value)) return '[Circular]'; seen.add(value); } return value; }) ?? String(v); }
  catch { return '[Unserializable value]'; }
};
const assertType = (name, value, annotation, loc) => {
  if (!annotation || annotation === 'any') return value;
  const actual = typeOfValue(value);
  const valid = ({
    number: () => typeof value === 'number' && Number.isFinite(value),
    integer: () => Number.isInteger(value), int: () => Number.isInteger(value),
    string: () => typeof value === 'string', boolean: () => typeof value === 'boolean',
    array: () => Array.isArray(value), object: () => value !== null && typeof value === 'object' && !Array.isArray(value) && !isNode(value),
    function: () => actual === 'function', callable: () => actual === 'function',
    vec2: () => value !== null && typeof value === 'object' && typeof value.x === 'number' && typeof value.y === 'number',
    vec3: () => value !== null && typeof value === 'object' && typeof value.x === 'number' && typeof value.y === 'number' && typeof value.z === 'number',
    null: () => value === null,
  })[annotation];
  if (!valid) throw new OrvexaRuntimeError(`Unknown type '${annotation}' for '${name}'. Use number, integer, string, boolean, array, object, function, vec2, vec3, null, or any.`, loc);
  if (!valid()) throw new OrvexaRuntimeError(`Type mismatch for '${name}': expected ${annotation}, received ${actual}.`, loc);
  return value;
};
const nameDistance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let prev = row[0]; row[0] = i; for (let j = 1; j <= b.length; j++) { const old = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = old; } }
  return row[b.length];
};
const namedArgs = (raw) => {
  const positional = []; const named = {};
  for (const item of raw) {
    if (item?.__orvNamed === true) named[item.name] = item.value;
    else positional.push(item);
  }
  return { positional, named };
};
const ui = (component, props = {}, children = [], extra = {}) => ({ __orvUi: true, component, props, children, ...extra });
const sceneItem = (type, name, props = {}) => ({ __orvScene: true, type, name, ...props });

export class OrvexaInterpreter {
  constructor(options = {}) {
    this.stateStore = options.stateStore ?? new Map();
    this.maxSteps = options.maxSteps ?? 100_000;
    this.maxCallDepth = options.maxCallDepth ?? 128;
    this.callDepth = 0;
    this.steps = 0; this.callDepth = 0; this.logs = []; this.pages = []; this.scenes = []; this.appName = 'Orvexa App';
    this.ast = null; this.global = null; this.env = null;
  }
  tick(loc) {
    this.steps++;
    if (this.steps > this.maxSteps) throw new OrvexaRuntimeError(`Execution stopped after ${this.maxSteps.toLocaleString()} steps. Check for an infinite loop.`, loc);
  }
  log(level, ...values) { this.logs.push({ level, text: values.map(safeString).join(' '), at: Date.now() }); }
  run(sourceOrAst) {
    this.steps = 0; this.callDepth = 0; this.logs = []; this.pages = []; this.scenes = []; this.appName = 'Orvexa App';
    try {
      this.ast = typeof sourceOrAst === 'string' ? parse(sourceOrAst) : sourceOrAst;
      const stateNames = new Set(this.stateStore.keys());
      this.global = new Environment(null, this.stateStore, stateNames);
      this.installBuiltins(this.global);
      this.env = this.global;
      for (const statement of this.ast.body) this.execute(statement, this.global, null);
      return { ok: true, appName: this.appName, pages: this.pages, scenes: this.scenes, logs: this.logs, steps: this.steps, ast: this.ast };
    } catch (error) {
      const errorLoc = error.loc ?? (error.line ? { line: error.line, column: error.column, offset: error.offset } : undefined);
      const runtime = error instanceof OrvexaRuntimeError ? error : new OrvexaRuntimeError(error.message || String(error), errorLoc, error);
      this.logs.push({ level: 'error', text: runtime.message, line: runtime.line, column: runtime.column, at: Date.now() });
      return { ok: false, appName: this.appName, pages: this.pages, scenes: this.scenes, logs: this.logs, steps: this.steps,
        error: { name: runtime.name, message: runtime.message, line: runtime.line, column: runtime.column } };
    }
  }
  installBuiltins(env) {
    const native = (name, call) => ({ __orvNative: true, name, call });
    const define = (name, call) => env.define(name, native(name, call), 'const');
    const component = (name, transform = (p) => p) => define(name, (args, block, loc) => {
      const { positional, named } = namedArgs(args);
      const props = { ...named };
      if (positional.length) props.label = positional[0];
      if (positional.length > 1) props.value = positional[1];
      if (name === 'list' && Array.isArray(positional[0])) props.items = positional[0];
      if (name === 'image' && positional[0] !== undefined) { props.src = positional[0]; if (positional[1] !== undefined) props.alt = positional[1]; }
      const children = block && !['button', 'link'].includes(name) ? block() : [];
      if (name === 'button' && block) props.onClick = block;
      if (name === 'button' && !block && typeof positional[1] === 'function') props.onClick = positional[1];
      return ui(name, transform(props), children, props.onClick ? { onClick: props.onClick } : {});
    });
    define('print', (args) => { this.log('info', ...namedArgs(args).positional); return null; });
    define('log', (args) => { this.log('info', ...namedArgs(args).positional); return null; });
    define('warn', (args) => { this.log('warning', ...namedArgs(args).positional); return null; });
    define('error', (args) => { this.log('error', ...namedArgs(args).positional); return null; });
    define('vec2', (args, _block, loc) => { const [x = 0, y = 0] = namedArgs(args).positional; return { x: toNumber(x, loc), y: toNumber(y, loc) }; });
    define('vec3', (args, _block, loc) => { const [x = 0, y = 0, z = 0] = namedArgs(args).positional; return { x: toNumber(x, loc), y: toNumber(y, loc), z: toNumber(z, loc) }; });
    define('rgb', (args, _block, loc) => { const [r = 0, g = 0, b = 0] = namedArgs(args).positional; return `rgb(${toNumber(r, loc)}, ${toNumber(g, loc)}, ${toNumber(b, loc)})`; });
    define('clamp', (args, _block, loc) => { const [v, min = 0, max = 1] = namedArgs(args).positional; return Math.min(toNumber(max, loc), Math.max(toNumber(min, loc), toNumber(v, loc))); });
    define('range', (args, _block, loc) => { const ps = namedArgs(args).positional; const start = ps.length > 1 ? toNumber(ps[0], loc) : 0; const end = toNumber(ps.length > 1 ? ps[1] : ps[0], loc); const step = ps.length > 2 ? toNumber(ps[2], loc) : 1; if (step === 0) throw new OrvexaRuntimeError('range() step cannot be 0.', loc); const out = []; for (let n = start; step > 0 ? n < end : n > end; n += step) { if (out.length >= 10_000) throw new OrvexaRuntimeError('range() is limited to 10,000 items.', loc); out.push(n); } return out; });
    define('len', (args) => { const v = namedArgs(args).positional[0]; return v == null ? 0 : v.length ?? Object.keys(v).length; });
    define('str', (args) => safeString(namedArgs(args).positional[0]));
    define('num', (args, _block, loc) => toNumber(namedArgs(args).positional[0], loc));
    define('typeOf', (args) => typeOfValue(namedArgs(args).positional[0]));
    define('keys', (args, _block, loc) => { const value = namedArgs(args).positional[0]; if (!isObject(value)) throw new OrvexaRuntimeError('keys() expects an object or array.', loc); return Object.keys(value); });
    define('values', (args, _block, loc) => { const value = namedArgs(args).positional[0]; if (!isObject(value)) throw new OrvexaRuntimeError('values() expects an object or array.', loc); return Object.values(value); });
    define('has', (args) => { const [value, key] = namedArgs(args).positional; return isObject(value) && Object.hasOwn(value, key); });
    define('first', (args) => { const value = namedArgs(args).positional[0]; return value == null ? null : value[0] ?? null; });
    define('last', (args) => { const value = namedArgs(args).positional[0]; return value == null ? null : value[value.length - 1] ?? null; });
    define('sum', (args, _block, loc) => { const value = namedArgs(args).positional[0]; if (!Array.isArray(value)) throw new OrvexaRuntimeError('sum() expects an array of numbers.', loc); return value.reduce((total, item) => total + toNumber(item, loc), 0); });
    define('average', (args, _block, loc) => { const value = namedArgs(args).positional[0]; if (!Array.isArray(value)) throw new OrvexaRuntimeError('average() expects an array of numbers.', loc); return value.length ? value.reduce((total, item) => total + toNumber(item, loc), 0) / value.length : 0; });
    define('unique', (args, _block, loc) => { const value = namedArgs(args).positional[0]; if (!Array.isArray(value)) throw new OrvexaRuntimeError('unique() expects an array.', loc); return [...new Set(value)]; });
    define('sorted', (args, _block, loc) => { const [value, direction = 'asc'] = namedArgs(args).positional; if (!Array.isArray(value)) throw new OrvexaRuntimeError('sorted() expects an array.', loc); const copy = [...value]; return copy.sort((a, b) => typeof a === 'number' && typeof b === 'number' ? (a - b) * (direction === 'desc' ? -1 : 1) : String(a).localeCompare(String(b)) * (direction === 'desc' ? -1 : 1)); });
    define('upper', (args, _block, loc) => { const v = namedArgs(args).positional[0]; if (typeof v !== 'string') throw new OrvexaRuntimeError('upper() expects a string.', loc); return v.toUpperCase(); });
    define('lower', (args, _block, loc) => { const v = namedArgs(args).positional[0]; if (typeof v !== 'string') throw new OrvexaRuntimeError('lower() expects a string.', loc); return v.toLowerCase(); });
    define('trim', (args, _block, loc) => { const v = namedArgs(args).positional[0]; if (typeof v !== 'string') throw new OrvexaRuntimeError('trim() expects a string.', loc); return v.trim(); });
    define('assert', (args, _block, loc) => { const [condition, message = 'Assertion failed.'] = namedArgs(args).positional; if (!condition) throw new OrvexaRuntimeError(safeString(message), loc); return true; });
    define('vec', (args) => { const [x = 0, y = 0, z = 0] = namedArgs(args).positional; return { x: Number(x), y: Number(y), z: Number(z) }; });
    const math = Object.freeze({ abs: Math.abs, ceil: Math.ceil, floor: Math.floor, round: Math.round, min: Math.min, max: Math.max,
      sqrt: Math.sqrt, pow: Math.pow, sin: Math.sin, cos: Math.cos, tan: Math.tan, PI: Math.PI, E: Math.E, random: Math.random });
    env.define('math', math, 'const'); env.define('Math', math, 'const');
    env.define('true', true, 'const'); env.define('false', false, 'const'); env.define('null', null, 'const');
    const identity = (p) => p;
    component('column', identity); component('row', identity); component('card', identity); component('panel', identity);
    component('title', identity); component('text', identity); component('paragraph', identity); component('button', identity);
    component('input', identity); component('textarea', identity); component('badge', identity); component('divider', identity);
    component('spacer', identity); component('image', identity); component('link', identity); component('list', identity);
    define('camera', (args) => { const { positional, named } = namedArgs(args); return sceneItem('camera', 'Camera', { ...named, position: named.position ?? positional[0] ?? { x: 0, y: 2, z: 6 } }); });
    for (const primitive of ['cube', 'sphere', 'plane', 'cylinder', 'torus', 'cone', 'pyramid', 'capsule', 'light']) {
      define(primitive, (args) => { const { positional, named } = namedArgs(args); const name = String(positional[0] ?? `${primitive[0].toUpperCase()}${primitive.slice(1)} ${this.scenes.length + 1}`); return sceneItem(primitive, name, { ...named, position: named.position ?? { x: 0, y: 0, z: 0 }, color: named.color ?? '#7c5cff' }); });
    }
    define('rigidbody', (args) => { const { positional, named } = namedArgs(args); const target = String(positional[0] ?? named.target ?? ''); return sceneItem('rigidbody', `Body ${target}`, { ...named, target }); });
    define('material', (args) => { const { positional, named } = namedArgs(args); const target = String(positional[0] ?? named.target ?? ''); return sceneItem('material', `Material ${target}`, { ...named, target }); });
    define('materialGraph', (args) => { const { positional, named } = namedArgs(args); const target = String(positional[0] ?? named.target ?? ''); const preset = String(positional[1] ?? named.preset ?? 'arcane-crystal'); return sceneItem('materialGraph', `MaterialGraph ${target}`, { ...named, target, preset }); });
    define('vfx', (args) => { const { positional, named } = namedArgs(args); const name = String(positional[0] ?? named.name ?? 'Campfire Sparks'); const preset = String(positional[1] ?? named.preset ?? 'campfire-sparks'); return sceneItem('vfx', name, { ...named, preset, position: named.position ?? { x: 0, y: 0, z: 0 } }); });
    define('geometryNodes', (args) => { const { positional, named } = namedArgs(args); const name = String(positional[0] ?? named.name ?? 'Procedural Crystal'); const preset = String(positional[1] ?? named.preset ?? 'crystal-cluster'); return sceneItem('geometryNodes', name, { ...named, preset, position: named.position ?? { x: 0, y: 0, z: 0 } }); });
    define('environment', (args) => { const { positional, named } = namedArgs(args); const preset = String(positional[0] ?? named.preset ?? 'studio'); return sceneItem('environment', `Env ${preset}`, { ...named, preset }); });
    define('controller', (args) => { const { positional, named } = namedArgs(args); const target = String(positional[0] ?? named.target ?? ''); return sceneItem('controller', `Controller ${target}`, { ...named, target, speed: named.speed ?? 3, jumpSpeed: named.jumpSpeed ?? 5 }); });
    define('animate', (args) => { const { positional, named } = namedArgs(args); return sceneItem('animation', String(positional[0] ?? named.target ?? 'Object'), { ...named, speed: named.speed ?? 1 }); });
  }
  execute(node, env, collection) {
    this.tick(node?.loc);
    switch (node.type) {
      case 'AppDeclaration': this.appName = safeString(this.evaluate(node.name, env)); return null;
      case 'ImportDeclaration': throw new OrvexaRuntimeError(`Unresolved import '${node.path}'. Run this file through Orvexa Studio's project module loader.`, node.loc);
      case 'VariableDeclaration': {
        const initial = node.mode === 'state' && this.stateStore.has(node.name) ? this.stateStore.get(node.name) : (node.init ? this.evaluate(node.init, env) : null);
        return env.define(node.name, initial, node.mode, node.annotation, node.loc);
      }
      case 'FunctionDeclaration': return env.define(node.name, { __orvFunction: true, name: node.name, params: node.params, returnType: node.returnType, body: node.body, closure: env }, 'const');
      case 'ExpressionStatement': {
        const value = this.evaluate(node.expression, env);
        if (collection && value != null && isNode(value)) collection.push(value);
        return value;
      }
      case 'BlockStatement': return this.executeBlock(node, env, collection);
      case 'PageDeclaration': {
        const name = safeString(this.evaluate(node.name, env)); const children = this.executeBlock(node.body, env, []);
        this.pages.push({ name, children, kind: 'page' }); return null;
      }
      case 'SceneDeclaration': {
        const name = safeString(this.evaluate(node.name, env)); const children = this.executeBlock(node.body, env, []);
        this.scenes.push({ name, objects: children.filter((x) => x?.__orvScene), kind: 'scene' }); return null;
      }
      case 'IfStatement': return this.evaluate(node.test, env) ? this.executeBlock(node.consequent, env, collection) : node.alternate ? this.execute(node.alternate, env, collection) : null;
      case 'WhileStatement': {
        let count = 0;
        while (this.evaluate(node.test, env)) {
          if (++count > 20_000) throw new OrvexaRuntimeError('Loop stopped after 20,000 iterations.', node.loc);
          try { this.executeBlock(node.body, env, collection); } catch (signal) { if (signal instanceof BreakSignal) break; if (!(signal instanceof ContinueSignal)) throw signal; }
        } return null;
      }
      case 'ForEachStatement': {
        const iterable = this.evaluate(node.iterable, env);
        if (iterable == null || (typeof iterable[Symbol.iterator] !== 'function')) throw new OrvexaRuntimeError('The value in a `for ... in` loop must be iterable.', node.loc);
        let count = 0;
        for (const value of iterable) {
          if (++count > 20_000) throw new OrvexaRuntimeError('Loop stopped after 20,000 iterations.', node.loc);
          const child = new Environment(env, this.stateStore, env.stateNames); child.define(node.name, value, node.mode === 'const' ? 'const' : 'let');
          try { this.executeBlock(node.body, child, collection); } catch (signal) { if (signal instanceof BreakSignal) break; if (!(signal instanceof ContinueSignal)) throw signal; }
        } return null;
      }
      case 'ReturnStatement': throw new ReturnSignal(node.argument ? this.evaluate(node.argument, env) : null, node.loc);
      case 'BreakStatement': throw new BreakSignal(node.loc);
      case 'ContinueStatement': throw new ContinueSignal(node.loc);
      default: throw new OrvexaRuntimeError(`Unsupported statement type '${node.type}'.`, node.loc);
    }
  }
  executeBlock(block, parentEnv, collection = null) {
    const env = new Environment(parentEnv, this.stateStore, parentEnv.stateNames);
    for (const statement of block.body) this.execute(statement, env, collection);
    return collection;
  }
  evaluate(node, env) {
    this.tick(node?.loc);
    switch (node.type) {
      case 'Literal': return node.value;
      case 'Identifier': return env.get(node.name, node.loc);
      case 'NamedArgument': return { __orvNamed: true, name: node.name, value: this.evaluate(node.value, env) };
      case 'ArrayExpression': return node.elements.map((item) => this.evaluate(item, env));
      case 'ObjectExpression': { const out = Object.create(null); for (const p of node.properties) out[p.key] = this.evaluate(p.value, env); return out; }
      case 'UnaryExpression': {
        const value = this.evaluate(node.argument, env);
        if (node.operator === '!') return !value; if (node.operator === 'not') return !value;
        if (node.operator === '-') return -toNumber(value, node.loc); if (node.operator === '+') return toNumber(value, node.loc);
        throw new OrvexaRuntimeError(`Unknown unary operator '${node.operator}'.`, node.loc);
      }
      case 'BinaryExpression': {
        const left = this.evaluate(node.left, env);
        if (['and', '&&'].includes(node.operator)) return left && this.evaluate(node.right, env);
        if (['or', '||'].includes(node.operator)) return left || this.evaluate(node.right, env);
        if (node.operator === '??') return left == null ? this.evaluate(node.right, env) : left;
        const right = this.evaluate(node.right, env);
        switch (node.operator) {
          case '+': return typeof left === 'string' || typeof right === 'string' ? safeString(left) + safeString(right) : toNumber(left, node.loc) + toNumber(right, node.loc);
          case '-': return toNumber(left, node.loc) - toNumber(right, node.loc); case '*': return toNumber(left, node.loc) * toNumber(right, node.loc);
          case '/': if (Number(right) === 0) throw new OrvexaRuntimeError('Cannot divide by zero.', node.loc); return toNumber(left, node.loc) / toNumber(right, node.loc);
          case '%': if (Number(right) === 0) throw new OrvexaRuntimeError('Cannot use remainder with zero.', node.loc); return toNumber(left, node.loc) % toNumber(right, node.loc);
          case '**': return toNumber(left, node.loc) ** toNumber(right, node.loc);
          case '==': case '===': return left === right; case '!=': case '!==': return left !== right;
          case '<': return left < right; case '>': return left > right; case '<=': return left <= right; case '>=': return left >= right;
          case 'in': return Array.isArray(right) ? right.includes(left) : isObject(right) ? Object.hasOwn(right, left) : false;
          default: throw new OrvexaRuntimeError(`Unknown operator '${node.operator}'.`, node.loc);
        }
      }
      case 'ConditionalExpression': return this.evaluate(node.test, env) ? this.evaluate(node.consequent, env) : this.evaluate(node.alternate, env);
      case 'AssignmentExpression': {
        const current = this.readAssignable(node.left, env);
        const right = this.evaluate(node.right, env); let value = right;
        if (node.operator === '+=') value = typeof current === 'string' || typeof right === 'string' ? safeString(current) + safeString(right) : toNumber(current, node.loc) + toNumber(right, node.loc);
        if (node.operator === '-=') value = toNumber(current, node.loc) - toNumber(right, node.loc);
        if (node.operator === '*=') value = toNumber(current, node.loc) * toNumber(right, node.loc);
        if (node.operator === '/=') { if (Number(right) === 0) throw new OrvexaRuntimeError('Cannot divide by zero.', node.loc); value = toNumber(current, node.loc) / toNumber(right, node.loc); }
        if (node.left.type === 'Identifier') return env.set(node.left.name, value, node.loc);
        const object = this.evaluate(node.left.object, env), key = node.left.computed ? this.evaluate(node.left.property, env) : node.left.property.value;
        if (!isObject(object) || ['__proto__', 'prototype', 'constructor'].includes(String(key))) throw new OrvexaRuntimeError('This property cannot be assigned.', node.loc);
        object[key] = value; return value;
      }
      case 'MemberExpression': {
        const object = this.evaluate(node.object, env); const key = node.computed ? this.evaluate(node.property, env) : node.property.value;
        if (object == null) { if (node.optionalChain || node.optional) return null; throw new OrvexaRuntimeError(`Cannot read '${String(key)}' from ${object}. Use ?. for safe optional access or ?? to provide a fallback.`, node.loc); }
        if (['__proto__', 'prototype', 'constructor'].includes(String(key))) throw new OrvexaRuntimeError('Access to this property is blocked.', node.loc);
        if (Array.isArray(object)) {
          if (key === 'length') return object.length;
          const methods = {
            push: (...items) => object.push(...items), pop: () => object.pop(), slice: (a, b) => object.slice(a, b),
            includes: (item) => object.includes(item), indexOf: (item) => object.indexOf(item), join: (sep = ',') => object.join(sep),
            map: (fn) => object.map((item, index) => this.call(fn, [item, index], null, node.loc)),
            filter: (fn) => object.filter((item, index) => this.call(fn, [item, index], null, node.loc)),
            find: (fn) => object.find((item, index) => this.call(fn, [item, index], null, node.loc)) ?? null,
            some: (fn) => object.some((item, index) => this.call(fn, [item, index], null, node.loc)),
            every: (fn) => object.every((item, index) => this.call(fn, [item, index], null, node.loc)),
            concat: (...items) => object.concat(...items), reverse: () => object.reverse(),
            sort: (fn) => object.sort((a, b) => fn ? toNumber(this.call(fn, [a, b], null, node.loc), node.loc) : String(a).localeCompare(String(b))),
            at: (index) => object.at(toNumber(index, node.loc)),
          };
          if (methods[key]) return { __orvNative: true, name: `array.${key}`, call: (args) => methods[key](...namedArgs(args).positional) };
        }
        if (typeof object === 'string') {
          if (key === 'length') return object.length;
          const methods = { upper: () => object.toUpperCase(), toUpperCase: () => object.toUpperCase(), lower: () => object.toLowerCase(), toLowerCase: () => object.toLowerCase(), trim: () => object.trim(), includes: (part) => object.includes(part), startsWith: (part) => object.startsWith(part), endsWith: (part) => object.endsWith(part), indexOf: (part) => object.indexOf(part), split: (sep) => object.split(sep), replace: (from, to) => object.replace(from, to), slice: (a, b) => object.slice(a, b) };
          if (Object.hasOwn(methods, key)) return { __orvNative: true, name: `string.${key}`, call: (args) => methods[key](...namedArgs(args).positional) };
        }
        return object[key];
      }
      case 'CallExpression': {
        const callee = this.evaluate(node.callee, env);
        if (callee == null && node.optionalChain) return null;
        const args = node.arguments.map((a) => this.evaluate(a, env));
        const block = node.block ? () => { const closure = { __orvFunction: true, __orvBlock: true, name: '<block>', params: [], body: node.block, closure: env }; return this.call(closure, [], null, node.loc); } : null;
        return this.call(callee, args, block, node.loc);
      }
      default: throw new OrvexaRuntimeError(`Unsupported expression type '${node.type}'.`, node.loc);
    }
  }
  readAssignable(node, env) {
    if (node.type === 'Identifier') return env.get(node.name, node.loc);
    if (node.type === 'MemberExpression') {
      const object = this.evaluate(node.object, env); const key = node.computed ? this.evaluate(node.property, env) : node.property.value;
      if (object == null) throw new OrvexaRuntimeError('Cannot assign a property of null.', node.loc);
      return object[key];
    }
    throw new OrvexaRuntimeError('The left side of an assignment must be a variable or property.', node.loc);
  }
  call(callee, args, block, loc) {
    try {
      if (callee?.__orvNative) return callee.call(args, block, loc);
      if (typeof callee === 'function') return callee(...namedArgs(args).positional);
      if (callee?.__orvFunction) {
        if (this.callDepth >= this.maxCallDepth) throw new OrvexaRuntimeError(`Maximum function call depth (${this.maxCallDepth}) reached. Check for runaway recursion.`, loc);
        this.callDepth++;
        try {
          const env = new Environment(callee.closure, this.stateStore, callee.closure.stateNames);
          for (let i = 0; i < callee.params.length; i++) {
            const p = callee.params[i];
            const value = i < args.length ? args[i] : (p.defaultValue ? this.evaluate(p.defaultValue, env) : null);
            env.define(p.name, value, 'let', p.annotation, p.loc);
          }
          let returned = null;
          try { returned = this.executeBlock(callee.body, env, callee.__orvBlock ? [] : null); }
          catch (signal) { if (signal instanceof ReturnSignal) returned = signal.value; else throw signal; }
          assertType(`${callee.name} return value`, returned, callee.returnType, loc);
          return returned;
        } finally { this.callDepth--; }
      }
      throw new OrvexaRuntimeError('This value is not callable.', loc);
    } catch (error) {
      if (error instanceof OrvexaRuntimeError || error instanceof ReturnSignal || error instanceof BreakSignal || error instanceof ContinueSignal) throw error;
      throw new OrvexaRuntimeError(error.message || String(error), loc, error);
    }
  }
}

export function executeOrvexa(source, options = {}) {
  const engine = new OrvexaInterpreter(options);
  const result = engine.run(source);
  return { ...result, interpreter: engine };
}
