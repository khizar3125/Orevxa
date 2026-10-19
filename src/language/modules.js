import { parse } from './parser.js';

/** Flatten .orv imports into one AST, preserving dependency-before-entry execution order. */
export function resolveModuleProgram(entry, files) {
  const visiting = new Set(); const visited = new Set(); const ordered = [];
  const normalizeRelative = (base, imported) => {
    const joined = imported.startsWith('/') ? imported.slice(1) : [...base.split('/').slice(0, -1), ...imported.split('/')].join('/');
    const parts = [];
    for (const p of joined.replaceAll('\\', '/').split('/')) {
      if (!p || p === '.') continue;
      if (p === '..') { if (!parts.length) throw new Error('Import path escapes the project root.'); parts.pop(); }
      else parts.push(p);
    }
    return parts.join('/');
  };
  const visit = (path) => {
    if (visiting.has(path)) throw new Error(`Circular import detected at "${path}".`);
    if (visited.has(path)) return;
    const source = files[path]; if (source === undefined) throw new Error(`Cannot find imported file "${path}".`);
    visiting.add(path);
    const ast = parse(source); const body = [];
    for (const statement of ast.body) {
      if (statement.type === 'ImportDeclaration') visit(normalizeRelative(path, statement.path));
      else body.push(statement);
    }
    ordered.push(...body); visiting.delete(path); visited.add(path);
  };
  visit(entry);
  return { type: 'Program', body: ordered, loc: { line: 1, column: 1 } };
}
