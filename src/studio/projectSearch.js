/**
 * Project-wide literal search (Ctrl/Cmd+Shift+F).
 * Pure and deterministic; the UI layer only renders the result objects.
 */
export const SEARCH_LIMITS = Object.freeze({
  minQuery: 2,
  maxQuery: 120,
  maxResults: 250,
  maxPerFile: 50,
  maxFileBytes: 1024 * 1024,
  previewRadius: 58,
});

export function normalizeSearchQuery(query) {
  return String(query ?? '').slice(0, SEARCH_LIMITS.maxQuery);
}

export function countProjectMatches(files, query, options = {}) {
  return searchProject(files, query, options).total;
}

export function searchProject(files, query, {
  caseSensitive = false,
  wholeWord = false,
  maxResults = SEARCH_LIMITS.maxResults,
  maxPerFile = SEARCH_LIMITS.maxPerFile,
  maxFileBytes = SEARCH_LIMITS.maxFileBytes,
  previewRadius = SEARCH_LIMITS.previewRadius,
} = {}) {
  const rawQuery = normalizeSearchQuery(query);
  if (!files || typeof files !== 'object') return emptyResult(rawQuery);
  if (rawQuery.length < SEARCH_LIMITS.minQuery) return emptyResult(rawQuery);
  const needle = caseSensitive ? rawQuery : rawQuery.toLowerCase();
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(wholeWord ? `(?<![\\w$])${escaped}(?![\\w$])` : escaped, caseSensitive ? 'g' : 'gi');
  const groups = [];
  let total = 0;
  let truncated = false;
  let scannedFiles = 0;
  let skippedFiles = 0;

  for (const path of Object.keys(files).sort()) {
    const content = files[path];
    if (typeof content !== 'string') { skippedFiles += 1; continue; }
    if (content.length > maxFileBytes) { skippedFiles += 1; continue; }
    scannedFiles += 1;
    const matches = [];
    matcher.lastIndex = 0;
    let match;
    while ((match = matcher.exec(content)) !== null) {
      if (!match[0].length) { matcher.lastIndex += 1; continue; }
      if (matches.length >= maxPerFile || total >= maxResults) { truncated = true; break; }
      const start = match.index;
      const lineInfo = lineColumnAt(content, start);
      const radius = Math.max(10, Math.min(160, Number(previewRadius) || 58));
      const previewStart = Math.max(0, start - radius);
      const previewEnd = Math.min(content.length, start + match[0].length + radius);
      matches.push({
        index: start,
        length: match[0].length,
        line: lineInfo.line,
        column: lineInfo.column,
        text: match[0],
        preview: content.slice(previewStart, previewEnd).replace(/\s+/g, ' '),
        previewOffset: start - previewStart,
        previewLength: match[0].length,
        lineText: content.split('\n')[lineInfo.line - 1]?.slice(0, 240) || '',
      });
      total += 1;
      if (match.index === matcher.lastIndex) matcher.lastIndex += 1;
    }
    if (matches.length) groups.push({ path, matches });
    if (truncated) break;
  }

  groups.sort((a, b) => b.matches.length - a.matches.length || a.path.localeCompare(b.path));
  return {
    query: rawQuery,
    total,
    truncated,
    groups,
    filesWithMatches: groups.length,
    scannedFiles,
    skippedFiles,
    limits: { maxResults, maxPerFile },
  };
}

export function lineColumnAt(text, index) {
  const safeIndex = Math.max(0, Math.min(String(text).length, Number(index) || 0));
  const before = String(text).slice(0, safeIndex);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

export function replaceInProject(files, query, replacement, { caseSensitive = false, wholeWord = false, path = null } = {}) {
  const rawQuery = normalizeSearchQuery(query);
  if (rawQuery.length < SEARCH_LIMITS.minQuery) throw new Error(`Search needs at least ${SEARCH_LIMITS.minQuery} characters.`);
  if (!files || typeof files !== 'object') throw new Error('Project files are unavailable.');
  const escaped = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(wholeWord ? `(?<![\\w$])${escaped}(?![\\w$])` : escaped, caseSensitive ? 'g' : 'gi');
  const next = {};
  let replacements = 0;
  let affectedFiles = 0;
  for (const [file, content] of Object.entries(files)) {
    if (path && file !== path) { next[file] = content; continue; }
    if (typeof content !== 'string') { next[file] = content; continue; }
    const updated = content.replace(matcher, () => { replacements += 1; return replacement; });
    if (updated !== content) affectedFiles += 1;
    next[file] = updated;
  }
  return { files: next, replacements, affectedFiles };
}

export function toSearchCsv(result) {
  const rows = [['file', 'line', 'column', 'match']];
  for (const group of result?.groups || []) {
    for (const match of group.matches) rows.push([group.path, match.line, match.column, match.text]);
  }
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
}

function emptyResult(query) {
  return { query, total: 0, truncated: false, groups: [], filesWithMatches: 0, scannedFiles: 0, skippedFiles: 0, limits: {} };
}
