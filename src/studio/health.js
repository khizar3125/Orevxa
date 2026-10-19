/**
 * Orvexa Project Health — a deterministic, explainable audit of user projects.
 *
 * Everything here is pure: given the same project it returns the same score and
 * issue list. The Studio surfaces it on Home and in the Project Health dialog.
 */
import { normalizePath } from './project.js';

export const SEVERITY_WEIGHTS = Object.freeze({ error: 18, warning: 7, info: 1 });
export const HEALTH_GRADES = Object.freeze([
  { min: 90, grade: 'A', label: 'Ship-ready', tone: 'excellent' },
  { min: 80, grade: 'B', label: 'Healthy', tone: 'good' },
  { min: 70, grade: 'C', label: 'Needs polish', tone: 'fair' },
  { min: 60, grade: 'D', label: 'Fragile', tone: 'weak' },
  { min: 0, grade: 'F', label: 'Needs repair', tone: 'critical' },
]);

const MAX_SOURCE_CHECK_BYTES = 512 * 1024;
const LARGE_FILE_BYTES = 240 * 1024;
const LONG_LINE = 240;

export function auditProject(project, { activeFile = null } = {}) {
  const files = project?.files && typeof project.files === 'object' && !Array.isArray(project.files) ? project.files : {};
  const paths = Object.keys(files).sort();
  const issues = [];
  const stats = {
    name: String(project?.name || '').trim() || 'Untitled project',
    files: paths.length,
    sourceFiles: 0,
    lines: 0,
    bytes: 0,
    folders: Array.isArray(project?.folders) ? project.folders.length : 0,
    images: 0,
    todos: 0,
    largestFile: null,
    entryPoints: [],
  };

  if (!paths.length) {
    issues.push(issue('project-empty', 'error', 'Project is empty', 'Create a file or launch a template to get started.', null, null, 'Open Quick Create or press Ctrl/Cmd+K → New file.'));
    return finish(stats, issues);
  }

  if (!stats.name || stats.name === 'Untitled project') {
    issues.push(issue('project-name', 'warning', 'Project has no name', 'A clear name appears on share cards and exports.', null, null, 'Click the project name in the top bar to rename it.'));
  }

  const contentHashes = new Map();
  const imports = [];
  const appNames = new Map();
  const sourceFiles = [];

  for (const path of paths) {
    const value = files[path];
    if (typeof value !== 'string') {
      issues.push(issue('file-not-text', 'error', 'File content is not text', 'Only text sources can be stored in a project.', path, null, 'Delete and recreate the file.'));
      continue;
    }
    const bytes = byteSize(value);
    stats.bytes += bytes;
    if (/\.(png|jpe?g|webp|gif|svg)$/i.test(path) && /^data:image\//.test(value)) stats.images += 1;
    if (!isSourceFile(path)) {
      if (bytes > LARGE_FILE_BYTES && !/^data:image\//.test(value)) {
        issues.push(issue('large-asset', 'warning', 'Large non-source file', `${path} is ${formatBytes(bytes)}.`, path, null, 'Keep project backups below browser storage quota; compress or remove large assets.'));
      }
      continue;
    }
    stats.sourceFiles += 1;
    sourceFiles.push(path);
    const analysis = analyzeSource(value);
    stats.lines += analysis.lines;
    stats.todos += analysis.todos.length;
    if (!stats.largestFile || bytes > stats.largestFile.bytes) stats.largestFile = { path, bytes, lines: analysis.lines };
    if (/\bapp\s+["']/.test(value)) stats.entryPoints.push(path);

    if (bytes > LARGE_FILE_BYTES) {
      issues.push(issue('large-source', 'warning', 'Very large source file', `${path} is ${formatBytes(bytes)} (${analysis.lines} lines). Consider splitting reusable parts into modules.`, path, null, 'Use import "./module.orv" to split helpers.'));
    }
    if (analysis.empty) {
      issues.push(issue('empty-file', 'info', 'Empty file', `${path} has no content.`, path, 1, 'Add code, or delete the file to keep the project tidy.'));
    }
    if (analysis.crlf) {
      issues.push(issue('crlf', 'info', 'Windows line endings', 'CRLF line endings can confuse error line numbers.', path, null, 'Run Auto-Fix to normalise.'));
    }
    if (analysis.smartQuotes > 0) {
      issues.push(issue('smart-quotes', 'warning', 'Smart quotes detected', `${analysis.smartQuotes} curly quote(s) are not valid Orvexa string delimiters.`, path, analysis.firstSmartQuoteLine, 'Run Auto-Fix with AI to replace them.'));
    }
    if (analysis.unbalanced) {
      issues.push(issue('unbalanced-brackets', 'warning', 'Unbalanced brackets', 'A brace, bracket or parenthesis may be unclosed.', path, analysis.unbalancedLine, 'Run Auto-Fix or check the Problems panel after Run.'));
    }
    for (const todo of analysis.todos.slice(0, 4)) {
      issues.push(issue(`todo-${path}-${todo.line}`, 'info', 'TODO left in project', todo.text.slice(0, 90), path, todo.line, 'Finish the task or turn it into a documented limitation.'));
    }
    for (const longLine of analysis.longLines.slice(0, 2)) {
      issues.push(issue(`long-line-${path}-${longLine.line}`, 'info', 'Very long line', `Line ${longLine.line} has ${longLine.length} characters.`, path, longLine.line, 'Break it into readable statements.'));
    }
    for (const statement of analysis.imports) {
      imports.push({ from: path, ...statement });
    }
    for (const appName of analysis.appDeclarations) {
      if (!appNames.has(appName)) appNames.set(appName, []);
      appNames.get(appName).push(path);
    }
    if (analysis.hasScene && !analysis.hasLight) {
      issues.push(issue(`no-light-${path}`, 'info', 'Scene has no light', 'The scene may render almost black.', path, null, 'Add light("Sun", type: "directional") to the scene.'));
    }
    if (analysis.hasPage && !analysis.hasTitle) {
      issues.push(issue(`no-title-${path}`, 'info', 'Page has no title', 'A title helps users understand the page immediately.', path, null, 'Add title("Welcome", size: 32) inside the page.'));
    }
    if (analysis.tabIndentation > 0 && analysis.spaceIndentation > 0) {
      issues.push(issue(`mixed-indent-${path}`, 'info', 'Mixed tabs and spaces', 'Consistent indentation keeps diffs readable.', path, null, 'Use Format or your editor preference to standardise.'));
    }

    if (bytes < MAX_SOURCE_CHECK_BYTES) {
      const hash = contentHash(value);
      if (!contentHashes.has(hash)) contentHashes.set(hash, []);
      contentHashes.get(hash).push(path);
    }
  }

  if (!stats.entryPoints.length) {
    issues.push(issue('no-entry', 'warning', 'No app entry point', 'No source file declares app "Name". The preview will still run statements, but the project has no clear name.', activeFile || paths[0] || null, null, 'Add app "My Project" at the top of main.orv.'));
  }

  for (const group of contentHashes.values()) {
    if (group.length > 1) {
      issues.push(issue(`duplicate-${group[0]}`, 'warning', 'Duplicate file contents', `${group.join(', ')} are byte-identical.`, group[1], null, 'Delete the extra copy or make it genuinely different.'));
    }
  }

  for (const statement of imports) {
    const resolved = resolveImport(statement.from, statement.path);
    if (!resolved) {
      issues.push(issue(`import-invalid-${statement.from}-${statement.line}`, 'error', 'Import escapes the project root', statement.path, statement.from, statement.line, 'Use a relative path inside the project, for example "./helpers.orv".'));
    } else if (!(resolved in files)) {
      issues.push(issue(`import-missing-${statement.from}-${statement.line}`, 'error', 'Imported file is missing', `${statement.from} imports "${statement.path}", but ${resolved} does not exist.`, statement.from, statement.line, `Create ${resolved} or fix the import path.`));
    }
  }

  for (const [name, group] of appNames) {
    if (group.length > 1) {
      issues.push(issue(`duplicate-app-${name}`, 'info', 'Duplicate app name', `${group.join(', ')} all declare app "${name}".`, group[1], null, 'Only the running file matters, but unique names avoid confusion.'));
    }
  }

  const orphanEntryPoints = stats.entryPoints.filter((path) => path !== 'main.orv' && path !== activeFile && !imports.some((entry) => entry.from === path) && !path.startsWith('examples/'));
  if (orphanEntryPoints.length > 1) {
    issues.push(issue('orphan-entries', 'info', 'Several unrelated entry files', `${orphanEntryPoints.length} app files are not imported anywhere and are not main.orv.`, null, null, 'Keep one main.orv and move experiments into examples/.'));
  }

  if (stats.sourceFiles > 0 && stats.lines < 3) {
    issues.push(issue('tiny-project', 'info', 'Project is just getting started', 'Launch a template or ask the AI Agent to scaffold a full project.', activeFile || sourceFiles[0], null, 'Press Ctrl/Cmd+K → Launch a template.'));
  }

  return finish(stats, issues);
}

export function analyzeSource(source) {
  const text = String(source ?? '');
  const lines = text.length ? text.split('\n') : [];
  const result = {
    lines: lines.length,
    bytes: byteSize(text),
    empty: text.trim().length === 0,
    crlf: text.includes('\r\n'),
    smartQuotes: (text.match(/[“”‘’]/g) || []).length,
    firstSmartQuoteLine: null,
    todos: [],
    longLines: [],
    imports: [],
    appDeclarations: [...text.matchAll(/\bapp\s+["']([^"']+)["']/g)].map((match) => match[1]),
    hasPage: /\bpage\s+["']/.test(text),
    hasScene: /\bscene\s+["']/.test(text),
    hasLight: /\blight\s*\(/.test(text),
    hasTitle: /\btitle\s*\(/.test(text),
    tabIndentation: 0,
    spaceIndentation: 0,
    unbalanced: false,
    unbalancedLine: null,
  };
  let open = 0;
  let inBlockComment = false;
  let quote = '';
  let line = 1;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '\n') { line += 1; if (!inBlockComment && !quote) { /* keep scanning */ } }
    if (inBlockComment) {
      if (char === '*' && next === '/') { inBlockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (char === '\\') { index += 1; continue; }
      if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') {
      const end = text.indexOf('\n', index);
      index = end === -1 ? text.length : end - 1;
      continue;
    }
    if (char === '/' && next === '*') { inBlockComment = true; index += 1; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '{' || char === '[' || char === '(') open += 1;
    if (char === '}' || char === ']' || char === ')') {
      open -= 1;
      if (open < 0 && !result.unbalanced) { result.unbalanced = true; result.unbalancedLine = line; }
    }
  }
  if (quote || inBlockComment || open !== 0) {
    result.unbalanced = true;
    if (!result.unbalancedLine) result.unbalancedLine = Math.max(1, lines.length);
  }

  lines.forEach((raw, index) => {
    const lineNumber = index + 1;
    if (/^\t+/.test(raw)) result.tabIndentation += 1;
    if (/^ +/.test(raw)) result.spaceIndentation += 1;
    if (raw.length > LONG_LINE) result.longLines.push({ line: lineNumber, length: raw.length });
    const todo = raw.match(/\b(TODO|FIXME|XXX)\b[:\s-]*(.*)$/i);
    if (todo) result.todos.push({ line: lineNumber, text: `${todo[1]}: ${todo[2] || 'no description'}`.trim() });
    if (result.firstSmartQuoteLine === null && /[“”‘’]/.test(raw)) result.firstSmartQuoteLine = lineNumber;
    for (const match of raw.matchAll(/\bimport\s+["']([^"']+)["']/g)) {
      result.imports.push({ path: match[1], line: lineNumber });
    }
  });
  return result;
}

export function resolveImport(fromPath, importPath) {
  const from = normalizePath(fromPath);
  const raw = String(importPath || '').replace(/\\/g, '/').trim();
  if (!raw || raw.startsWith('/') || /^[a-z]+:/i.test(raw)) return null;
  const base = from.split('/').slice(0, -1);
  const parts = [...base, ...raw.split('/')];
  const stack = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!stack.length) return null;
      stack.pop();
    } else stack.push(part);
  }
  return stack.length ? stack.join('/') : null;
}

export function healthGrade(score) {
  const safe = Math.min(100, Math.max(0, Math.round(Number(score) || 0)));
  return HEALTH_GRADES.find((entry) => safe >= entry.min) || HEALTH_GRADES[HEALTH_GRADES.length - 1];
}

export function healthSummary(audit) {
  const counts = countSeverities(audit?.issues || []);
  const score = audit?.score ?? 0;
  const grade = healthGrade(score);
  return {
    ...audit,
    score,
    grade,
    counts,
    headline: counts.error
      ? `${counts.error} blocking issue${counts.error === 1 ? '' : 's'} need a fix`
      : counts.warning
        ? `${counts.warning} warning${counts.warning === 1 ? '' : 's'} worth polishing`
        : counts.info
          ? 'Healthy — only optional polish suggestions'
          : 'Perfect — no issues found',
  };
}

export function topIssues(audit, limit = 3) {
  const order = { error: 0, warning: 1, info: 2 };
  return [...(audit?.issues || [])]
    .sort((a, b) => (order[a.severity] - order[b.severity]) || String(a.title).localeCompare(String(b.title)))
    .slice(0, Math.max(0, limit));
}

export function issueCounts(audit) { return countSeverities(audit?.issues || []); }

export function formatAuditForClipboard(audit) {
  const summary = healthSummary(audit);
  const lines = [
    `${summary.stats?.name || 'Orvexa Project'} — Health ${summary.score}/100 (${summary.grade.grade} ${summary.grade.label})`,
    `${summary.stats?.files || 0} files · ${summary.stats?.lines || 0} lines · ${formatBytes(summary.stats?.bytes || 0)}`,
    '',
    ...summary.issues.map((entry) => `[${entry.severity.toUpperCase()}] ${entry.title}${entry.file ? ` — ${entry.file}${entry.line ? `:${entry.line}` : ''}` : ''}\n  ${entry.detail}\n  Fix: ${entry.fix}`),
  ];
  return lines.join('\n');
}

function finish(stats, issues) {
  const counts = countSeverities(issues);
  const penalty = issues.reduce((total, entry) => total + (SEVERITY_WEIGHTS[entry.severity] || 1), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  return { stats, issues, counts, score, grade: healthGrade(score) };
}

function countSeverities(issues) {
  return issues.reduce((counts, entry) => {
    counts[entry.severity] = (counts[entry.severity] || 0) + 1;
    return counts;
  }, { error: 0, warning: 0, info: 0 });
}

function issue(id, severity, title, detail, file = null, line = null, fix = '') {
  return { id, severity, title, detail, file, line, fix };
}

function isSourceFile(path) { return /\.(orv|realm)$/i.test(path); }

function byteSize(text) {
  const value = String(text ?? '');
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
  return unescape(encodeURIComponent(value)).length;
}

function contentHash(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}-${(hash >>> 0).toString(36)}`;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
