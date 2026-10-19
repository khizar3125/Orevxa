/**
 * Unit tests for src/studio/health.js — deterministic project audit, grades,
 * summaries and clipboard export.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEALTH_GRADES, SEVERITY_WEIGHTS, analyzeSource, auditProject, formatAuditForClipboard,
  healthGrade, healthSummary, issueCounts, resolveImport, topIssues,
} from '../src/studio/health.js';

const cleanProject = (overrides = {}) => ({
  name: 'Aetherfall Demo',
  files: {
    'main.orv': 'app "Demo" {\n  page "Home" {\n    title("Demo")\n    text("Hello world")\n  }\n}\n',
  },
  folders: [],
  ...overrides,
});

const issueIds = (audit) => audit.issues.map((issue) => issue.id);

test('an empty project is a single blocking error', () => {
  const audit = auditProject({ name: '', files: {} });
  assert.equal(audit.stats.files, 0);
  assert.equal(audit.score, 100 - SEVERITY_WEIGHTS.error);
  assert.equal(audit.counts.error, 1);
  assert.deepEqual(issueIds(audit), ['project-empty']);
  assert.equal(audit.issues[0].file, null);
  assert.match(audit.issues[0].fix, /Quick Create/);
  assert.equal(auditProject(null).score, 82, 'missing projects are treated as empty');
});

test('a clean, named project grades A with no issues', () => {
  const audit = auditProject(cleanProject());
  assert.deepEqual(audit.issues, []);
  assert.equal(audit.score, 100);
  assert.equal(audit.grade.grade, 'A');
  assert.equal(audit.grade.label, 'Ship-ready');
  assert.equal(audit.stats.files, 1);
  assert.equal(audit.stats.sourceFiles, 1);
  assert.ok(audit.stats.lines >= 5);
  assert.ok(audit.stats.bytes > 0);
  assert.equal(audit.stats.entryPoints.length, 1);
});

test('unnamed projects warn without blocking', () => {
  const audit = auditProject(cleanProject({ name: '' }));
  assert.ok(issueIds(audit).includes('project-name'));
  assert.equal(audit.counts.warning, 1);
  assert.equal(audit.score, 100 - SEVERITY_WEIGHTS.warning);
});

test('source analysis detects quotes, endings, TODOs, long lines and brackets', () => {
  const analysis = analyzeSource([
    'app "Demo" {',
    '  text(“curly”)',
    '  // TODO: write the intro',
  ].join('\n'));
  assert.equal(analysis.smartQuotes, 2);
  assert.equal(analysis.firstSmartQuoteLine, 2);
  assert.equal(analysis.todos.length, 1);
  assert.match(analysis.todos[0].text, /TODO: write the intro/);
  assert.equal(analysis.unbalanced, true, 'the opening brace is never closed');
  assert.equal(analysis.unbalancedLine, 3);
  assert.equal(analysis.empty, false);
  assert.equal(analysis.hasPage, false);

  const crlf = analyzeSource('app "X" {\r\n}\r\n');
  assert.equal(crlf.crlf, true);
  const long = analyzeSource(`text "${'x'.repeat(260)}"`);
  assert.equal(long.longLines.length, 1);
  assert.ok(long.longLines[0].length > 240);
  assert.equal(analyzeSource('').empty, true);
  assert.equal(analyzeSource(null).lines, 0);
  assert.equal(analyzeSource('app "A" { page "P" { title("T") } }').hasTitle, true);
});

test('comments and strings never confuse bracket balance', () => {
  const analysis = analyzeSource('// { [ (\n/* } ] ) */\nconst x = "{"\n');
  assert.equal(analysis.unbalanced, false);
});

test('project audit flags common source problems with line numbers', () => {
  const audit = auditProject({
    name: 'Messy',
    files: {
      'a.orv': 'app "A" {\n  text(“hi”)\n}\n',
      'b.orv': '',
      'c.orv': 'import "./missing.orv"\napp "C" { }\n',
      'notes.txt': 'x'.repeat(250 * 1024),
      'crlf.orv': 'app "D" {\r\n}\r\n',
    },
  });
  const ids = issueIds(audit);
  assert.ok(ids.includes('smart-quotes'));
  assert.ok(ids.includes('empty-file'));
  assert.ok(ids.some((id) => id.startsWith('import-missing')));
  assert.ok(ids.includes('crlf'));
  assert.ok(ids.includes('large-asset'));
  const smart = audit.issues.find((issue) => issue.id === 'smart-quotes');
  assert.equal(smart.file, 'a.orv');
  assert.equal(smart.line, 2);
  assert.ok(audit.score < 100);
  assert.ok(audit.counts.error >= 1);
});

test('missing imports are errors; resolvable local and remote imports are not', () => {
  const present = auditProject({
    name: 'Imports',
    files: {
      'main.orv': 'import "./lib/helper.orv"\nimport "https://example.com/x.orv"\napp "M" { }',
      'lib/helper.orv': 'export function helper() { }',
    },
  });
  assert.ok(!issueIds(present).some((id) => id.startsWith('import-missing')), JSON.stringify(issueIds(present)));
  const absent = auditProject({
    name: 'Imports',
    files: { 'main.orv': 'import "./lib/nope.orv"\napp "M" { }' },
  });
  const missing = absent.issues.find((issue) => issue.id.startsWith('import-missing'));
  assert.ok(missing);
  assert.equal(missing.severity, 'error');
  assert.equal(missing.line, 1);
});

test('duplicate files are reported once per duplicate copy', () => {
  const body = 'app "Copy" {\n  text("same")\n}\n';
  const audit = auditProject({ name: 'Duplicates', files: { 'one.orv': body, 'two.orv': body, 'three.orv': body } });
  const duplicates = audit.issues.filter((issue) => /^duplicate-(one|two|three)\.orv$/.test(issue.id));
  assert.equal(duplicates.length, 1, 'one report for the whole identical group');
  assert.equal(duplicates[0].severity, 'warning');
  assert.match(duplicates[0].detail, /one\.orv/);
  assert.ok(audit.issues.some((issue) => issue.id === 'duplicate-app-Copy'), 'shared app names get a separate informational note');
});

test('non-text files are refused instead of crashing the audit', () => {
  const audit = auditProject({ name: 'Binary', files: { 'image.png': { data: true }, 'ok.orv': 'app "A" { }' } });
  assert.ok(issueIds(audit).includes('file-not-text'));
});

test('healthGrade boundaries are exact', () => {
  assert.deepEqual(healthGrade(100), HEALTH_GRADES[0]);
  assert.equal(healthGrade(90).grade, 'A');
  assert.equal(healthGrade(89).grade, 'B');
  assert.equal(healthGrade(80).grade, 'B');
  assert.equal(healthGrade(79).grade, 'C');
  assert.equal(healthGrade(70).grade, 'C');
  assert.equal(healthGrade(69).grade, 'D');
  assert.equal(healthGrade(60).grade, 'D');
  assert.equal(healthGrade(59).grade, 'F');
  assert.equal(healthGrade(-5).grade, 'F');
  assert.equal(healthGrade(999).grade, 'A');
  assert.equal(healthGrade(Number.NaN).grade, 'F');
});

test('healthSummary adds counts, grade and a truthful headline', () => {
  const perfect = healthSummary(auditProject(cleanProject()));
  assert.deepEqual(perfect.counts, { error: 0, warning: 0, info: 0 });
  assert.equal(perfect.headline, 'Perfect — no issues found');

  const warnOnly = healthSummary(auditProject(cleanProject({ name: '' })));
  assert.equal(warnOnly.counts.warning, 1);
  assert.equal(warnOnly.headline, '1 warning worth polishing');

  const blocked = healthSummary(auditProject({ name: '', files: {} }));
  assert.equal(blocked.headline, '1 blocking issue need a fix');

  const empty = healthSummary(null);
  assert.equal(empty.score, 0);
  assert.equal(empty.grade.grade, 'F');
});

test('topIssues sorts errors before warnings before info and honours the limit', () => {
  const audit = {
    issues: [
      { id: 'i1', severity: 'info', title: 'Zeta' },
      { id: 'w1', severity: 'warning', title: 'Beta' },
      { id: 'e1', severity: 'error', title: 'Gamma' },
      { id: 'e2', severity: 'error', title: 'Alpha' },
    ],
  };
  const top = topIssues(audit, 3);
  assert.deepEqual(top.map((issue) => issue.id), ['e2', 'e1', 'w1'], 'errors are title-sorted first');
  assert.deepEqual(topIssues(audit, 0), []);
  assert.deepEqual(topIssues(null), []);
  assert.deepEqual(issueCounts(audit), { error: 2, warning: 1, info: 1 });
});

test('formatAuditForClipboard is a readable, complete report', () => {
  const text = formatAuditForClipboard(auditProject(cleanProject({ name: '' })));
  assert.match(text, /Untitled project — Health \d+\/100 \([A-F] /);
  assert.match(text, /1 files · \d+ lines/);
  assert.match(text, /\[WARNING\] Project has no name/);
  assert.match(text, /Fix:/);
});

test('resolveImport normalises local paths and rejects escapes/URLs', () => {
  assert.equal(resolveImport('main.orv', './lib/helper.orv'), 'lib/helper.orv');
  assert.equal(resolveImport('src/main.orv', './lib/helper.orv'), 'src/lib/helper.orv');
  assert.equal(resolveImport('src/main.orv', '../lib/helper.orv'), 'lib/helper.orv');
  assert.equal(resolveImport('main.orv', '../../../etc/passwd'), null, 'paths may not escape the project');
  assert.equal(resolveImport('main.orv', '/absolute/path.orv'), null);
  assert.equal(resolveImport('main.orv', 'https://example.com/a.orv'), null);
  assert.equal(resolveImport('main.orv', ''), null);
  assert.equal(resolveImport('main.orv', './a/../b.orv'), 'b.orv');
});
