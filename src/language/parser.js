import { tokenize } from './lexer.js';

export class OrvexaSyntaxError extends Error {
  constructor(message, token) {
    super(message);
    this.name = 'OrvexaSyntaxError';
    this.line = token?.line ?? 1;
    this.column = token?.column ?? 1;
    this.offset = token?.offset ?? 0;
  }
}

const PARSE_CACHE_LIMIT = 64;
const PARSE_CACHE_MAX_SOURCE = 200_000;
const parseCache = new Map();

function freezeTree(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeTree(child);
  return Object.freeze(value);
}

/** Parse and cache recent source strings. Cached ASTs are immutable so repeated runs are safe. */
export function parse(source) {
  const text = String(source ?? '');
  if (text.length <= PARSE_CACHE_MAX_SOURCE && parseCache.has(text)) {
    const cached = parseCache.get(text);
    parseCache.delete(text); parseCache.set(text, cached);
    return cached;
  }
  const result = tokenize(text);
  if (result.errors.length) {
    const e = result.errors[0];
    throw new OrvexaSyntaxError(e.message, e);
  }
  const ast = freezeTree(new Parser(result.tokens).program());
  if (text.length <= PARSE_CACHE_MAX_SOURCE) {
    parseCache.set(text, ast);
    while (parseCache.size > PARSE_CACHE_LIMIT) parseCache.delete(parseCache.keys().next().value);
  }
  return ast;
}

export function parserCacheInfo() {
  return { entries: parseCache.size, maxEntries: PARSE_CACHE_LIMIT, maxSourceLength: PARSE_CACHE_MAX_SOURCE };
}

export function clearParserCache() { parseCache.clear(); }

class Parser {
  constructor(tokens) { this.tokens = tokens; this.i = 0; this.suppressCallBlock = 0; }
  get current() { return this.tokens[this.i] ?? this.tokens[this.tokens.length - 1]; }
  peek(n = 1) { return this.tokens[Math.min(this.i + n, this.tokens.length - 1)]; }
  is(value) { return this.current.value === value; }
  atEnd() { return this.current.type === 'eof'; }
  advance() { const token = this.current; if (!this.atEnd()) this.i++; return token; }
  match(...values) { if (values.includes(this.current.value)) return this.advance(); return null; }
  expect(value, message = `Expected '${value}'.`) { if (this.is(value)) return this.advance(); throw new OrvexaSyntaxError(message, this.current); }
  expectName(message = 'Expected an identifier.') { if (this.current.type === 'identifier') return this.advance(); throw new OrvexaSyntaxError(message, this.current); }
  skipNewlines() { while (this.current.type === 'newline' || this.is(';')) this.advance(); }
  lineBreak() { while (this.current.type === 'newline') this.advance(); }
  program() {
    const statements = []; this.skipNewlines();
    while (!this.atEnd()) {
      const before = this.i;
      statements.push(this.statement());
      if (this.i === before) throw new OrvexaSyntaxError('Parser could not advance.', this.current);
      this.skipNewlines();
    }
    return { type: 'Program', body: statements, loc: { line: 1, column: 1 } };
  }
  statement() {
    if (this.match('app')) { const token = this.tokens[this.i - 1]; const name = this.expression(); return { type: 'AppDeclaration', name, loc: token }; }
    if (this.match('import')) { const token = this.tokens[this.i - 1]; const path = this.expression(); if (path.type !== 'Literal' || typeof path.value !== 'string') throw new OrvexaSyntaxError('import expects a quoted file path, for example import \"lib.orv\".', token); return { type: 'ImportDeclaration', path: path.value, loc: token }; }
    if (this.match('state', 'let', 'const')) {
      const token = this.tokens[this.i - 1], mode = token.value, id = this.expectName();
      let annotation = null;
      if (this.match(':')) { const t = this.expectName('Expected a type name after ":".'); annotation = t.value; }
      let init = null;
      if (this.match('=')) init = this.expression();
      else if (mode === 'const') throw new OrvexaSyntaxError('Constants need an initial value.', this.current);
      else if (annotation) throw new OrvexaSyntaxError(`Typed variable '${id.value}' needs an initial value so Orvexa can check its '${annotation}' type.`, this.current);
      return { type: 'VariableDeclaration', mode, name: id.value, annotation, init, loc: token };
    }
    if (this.match('function', 'fn')) {
      const token = this.tokens[this.i - 1], name = this.expectName('Expected a function name.');
      const params = this.parameters(); let returnType = null;
      if (this.match(':')) returnType = this.expectName('Expected a return type after "function name(...):".').value;
      this.skipNewlines(); const body = this.block();
      return { type: 'FunctionDeclaration', name: name.value, params, returnType, body, loc: token };
    }
    if (this.match('page', 'scene')) {
      const token = this.tokens[this.i - 1]; this.skipNewlines();
      const name = this.expression(); this.skipNewlines(); const body = this.block();
      return { type: token.value === 'page' ? 'PageDeclaration' : 'SceneDeclaration', name, body, loc: token };
    }
    if (this.match('if')) {
      const token = this.tokens[this.i - 1]; this.match('('); this.suppressCallBlock++; const test = this.expression(); this.suppressCallBlock--; this.match(')'); this.skipNewlines();
      const consequent = this.blockOrStatement(); this.skipNewlines(); let alternate = null;
      if (this.match('else')) { this.skipNewlines(); if (this.match('if')) { this.i--; alternate = this.statement(); } else alternate = this.blockOrStatement(); }
      return { type: 'IfStatement', test, consequent, alternate, loc: token };
    }
    if (this.match('while')) {
      const token = this.tokens[this.i - 1]; this.match('('); this.suppressCallBlock++; const test = this.expression(); this.suppressCallBlock--; this.match(')'); this.skipNewlines();
      return { type: 'WhileStatement', test, body: this.blockOrStatement(), loc: token };
    }
    if (this.match('for')) {
      const token = this.tokens[this.i - 1]; this.match('(');
      let mode = 'of', name, iterable;
      if (this.match('let', 'state')) mode = this.tokens[this.i - 1].value;
      name = this.expectName('Expected a loop variable.');
      if (this.match('in')) { this.suppressCallBlock++; iterable = this.expression(); this.suppressCallBlock--; }
      else throw new OrvexaSyntaxError('Use `for item in items { ... }` for a foreach loop.', this.current);
      this.match(')'); this.skipNewlines();
      return { type: 'ForEachStatement', mode, name: name.value, iterable, body: this.blockOrStatement(), loc: token };
    }
    if (this.match('return')) {
      const token = this.tokens[this.i - 1];
      const argument = ['newline', 'eof'].includes(this.current.type) || this.is('}') || this.is(';') ? null : this.expression();
      return { type: 'ReturnStatement', argument, loc: token };
    }
    if (this.match('break')) return { type: 'BreakStatement', loc: this.tokens[this.i - 1] };
    if (this.match('continue')) return { type: 'ContinueStatement', loc: this.tokens[this.i - 1] };
    if (this.is('{')) return this.block();
    const token = this.current; const expr = this.expression();
    return { type: 'ExpressionStatement', expression: expr, loc: token };
  }
  blockOrStatement() { return this.is('{') ? this.block() : { type: 'BlockStatement', body: [this.statement()], loc: this.current }; }
  block() {
    const start = this.expect('{'); const body = []; this.skipNewlines();
    while (!this.is('}') && !this.atEnd()) { const before = this.i; body.push(this.statement()); if (before === this.i) throw new OrvexaSyntaxError('Unexpected token in block.', this.current); this.skipNewlines(); }
    this.expect('}', 'Expected "}" to close this block.');
    return { type: 'BlockStatement', body, loc: start };
  }
  parameters() {
    this.expect('('); const params = []; this.skipNewlines();
    while (!this.is(')') && !this.atEnd()) {
      const p = this.expectName('Expected a parameter name.'); let annotation = null, defaultValue = null;
      if (this.match(':')) annotation = this.expectName('Expected a type name after parameter ":".').value;
      if (this.match('=')) defaultValue = this.expression();
      params.push({ name: p.value, annotation, defaultValue, loc: p });
      this.skipNewlines(); if (!this.match(',')) break; this.skipNewlines();
    }
    this.expect(')', 'Expected ")" after parameters.'); return params;
  }
  expression(minPrec = 0) {
    this.skipExpressionNewlines();
    let left = this.prefix();
    while (true) {
      if (this.current.type === 'newline' || this.atEnd()) break;
      if (this.is('(') || this.is('.') || this.is('?.') || this.is('[')) {
        if (10 < minPrec) break;
        if (this.match('(')) {
          const args = []; this.skipNewlines();
          while (!this.is(')') && !this.atEnd()) {
            this.skipNewlines();
            if (this.current.type === 'identifier' && this.peek().value === ':') {
              const key = this.advance(); this.advance(); args.push({ type: 'NamedArgument', name: key.value, value: this.expression(), loc: key });
            } else args.push(this.expression());
            this.skipNewlines(); if (!this.match(',')) break; this.skipNewlines();
          }
          this.expect(')', 'Expected ")" after arguments.');
          const afterCall = this.i; this.skipNewlines(); let block = null;
          if (!this.suppressCallBlock && this.is('{')) block = this.block(); else this.i = afterCall;
          left = { type: 'CallExpression', callee: left, arguments: args, block, optionalChain: left.optionalChain === true, loc: left.loc ?? this.current }; continue;
        }
        if (this.match('.', '?.')) { const marker = this.tokens[this.i - 1]; const optional = marker.value === '?.'; const prop = this.expectName(`Expected a property name after "${marker.value}".`); left = { type: 'MemberExpression', object: left, property: { type: 'Literal', value: prop.value, loc: prop }, computed: false, optional, optionalChain: optional || left.optionalChain === true, loc: marker }; continue; }
        if (this.match('[')) { const property = this.expression(); this.expect(']', 'Expected "]" after index.'); left = { type: 'MemberExpression', object: left, property, computed: true, optionalChain: left.optionalChain === true, loc: left.loc }; continue; }
      }
      const op = this.current.value, prec = this.precedence(op);
      if (prec < minPrec || prec < 0) break;
      this.advance();
      if (op === '?') {
        const consequent = this.expression(); this.expect(':', 'Expected ":" in conditional expression.'); const alternate = this.expression(prec);
        left = { type: 'ConditionalExpression', test: left, consequent, alternate, loc: left.loc }; continue;
      }
      const rightAssoc = ['=', '+=', '-=', '*=', '/=', '**', '??'].includes(op);
      const right = this.expression(prec + (rightAssoc ? 0 : 1));
      if (['=', '+=', '-=', '*=', '/='].includes(op)) left = { type: 'AssignmentExpression', operator: op, left, right, loc: left.loc };
      else left = { type: 'BinaryExpression', operator: op, left, right, loc: left.loc };
    }
    return left;
  }
  skipExpressionNewlines() { while (this.current.type === 'newline') this.advance(); }
  prefix() {
    const token = this.advance();
    if (token.type === 'number' || token.type === 'string') return { type: 'Literal', value: token.value, loc: token };
    if (token.value === 'true') return { type: 'Literal', value: true, loc: token };
    if (token.value === 'false') return { type: 'Literal', value: false, loc: token };
    if (token.value === 'null') return { type: 'Literal', value: null, loc: token };
    if (token.type === 'identifier') return { type: 'Identifier', name: token.value, loc: token };
    if (['!', '-', '+', 'not'].includes(token.value)) return { type: 'UnaryExpression', operator: token.value, argument: this.expression(8), loc: token };
    if (token.value === '(') { this.skipNewlines(); const expr = this.expression(); this.skipNewlines(); this.expect(')', 'Expected ")" after expression.'); return expr; }
    if (token.value === '[') {
      const elements = []; this.skipNewlines();
      while (!this.is(']') && !this.atEnd()) { elements.push(this.expression()); this.skipNewlines(); if (!this.match(',')) break; this.skipNewlines(); }
      this.expect(']', 'Expected "]" after array items.'); return { type: 'ArrayExpression', elements, loc: token };
    }
    if (token.value === '{') {
      const properties = []; this.skipNewlines();
      while (!this.is('}') && !this.atEnd()) {
        let key;
        if (this.current.type === 'identifier' || this.current.type === 'string') key = this.advance();
        else throw new OrvexaSyntaxError('Object keys must be names or strings.', this.current);
        this.expect(':', 'Expected ":" after object key.'); const value = this.expression();
        properties.push({ key: String(key.value), value, loc: key }); this.skipNewlines(); if (!this.match(',')) break; this.skipNewlines();
      }
      this.expect('}', 'Expected "}" after object.'); return { type: 'ObjectExpression', properties, loc: token };
    }
    throw new OrvexaSyntaxError(`Expected an expression, found ${token.value ? JSON.stringify(token.value) : 'end of file'}.`, token);
  }
  precedence(op) {
    return ({ '=': 1, '+=': 1, '-=': 1, '*=': 1, '/=': 1, '?': 1, '??': 2, or: 3, '||': 3, and: 4,
      '==': 5, '===': 5, '!=': 5, '!==': 5, '<': 6, '>': 6, '<=': 6, '>=': 6, in: 6,
      '+': 7, '-': 7, '*': 8, '/': 8, '%': 8, '**': 9 })[op] ?? -1;
  }
}
