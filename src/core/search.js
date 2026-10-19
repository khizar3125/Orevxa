/**
 * Deterministic fuzzy matching used by the command palette and quick open.
 * No external dependency, no locale surprises, fully unit-tested.
 */
export function normalizeSearchText(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Score a query against a text.
 * Returns null when the query is not a subsequence of the text.
 * Higher scores are better; exact and word-boundary matches dominate.
 */
export function fuzzyScore(query, text) {
  const needle = normalizeSearchText(query);
  const haystack = String(text ?? '');
  const lower = haystack.toLowerCase();
  if (!needle) return { score: 0, positions: [] };
  if (!lower) return null;

  const exactIndex = lower.indexOf(needle);
  if (exactIndex !== -1) {
    const boundary = exactIndex === 0 || /[\s/._:-]/.test(haystack[exactIndex - 1] || '');
    return {
      score: 1000 + needle.length * 12 + (exactIndex === 0 ? 120 : 0) + (boundary ? 60 : 0) - exactIndex,
      positions: Array.from({ length: needle.length }, (_, index) => exactIndex + index),
    };
  }

  const positions = [];
  let position = 0;
  let score = 0;
  let previous = -2;
  for (const char of needle) {
    if (char === ' ') continue;
    const found = lower.indexOf(char, position);
    if (found === -1) return null;
    const gap = found - previous - 1;
    const boundary = found === 0 || /[\s/._:-]/.test(haystack[found - 1] || '');
    const camelBoundary = found > 0 && /[a-z]/.test(haystack[found - 1] || '') && /[A-Z]/.test(haystack[found]);
    score += 18 + (boundary ? 24 : 0) + (camelBoundary ? 18 : 0) + (gap === 0 ? 14 : Math.max(0, 8 - gap));
    positions.push(found);
    previous = found;
    position = found + 1;
  }
  score -= Math.max(0, haystack.length - needle.length) * 0.35;
  return { score, positions };
}

export function rankItems(items, query, { getText = (item) => String(item ?? ''), limit = 50, getKeywords = null } = {}) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const needle = normalizeSearchText(query);
  const scored = [];
  list.forEach((item, index) => {
    const text = String(getText(item) ?? '');
    const primary = fuzzyScore(needle, text);
    let best = primary;
    if (getKeywords) {
      for (const keyword of getKeywords(item) || []) {
        const candidate = fuzzyScore(needle, keyword);
        if (candidate && (!best || candidate.score > best.score)) best = { ...candidate, keyword };
      }
    }
    if (!best) return;
    scored.push({
      item,
      index,
      score: best.score,
      positions: best.positions,
      keyword: best.keyword || null,
      text,
    });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return (limit > 0 ? scored.slice(0, limit) : scored);
}

/** Convert match positions into renderable segments. */
export function highlightSegments(text, positions = []) {
  const value = String(text ?? '');
  const marks = new Set((positions || []).filter((position) => Number.isInteger(position) && position >= 0 && position < value.length));
  if (!marks.size) return [{ text: value, match: false }];
  const segments = [];
  let buffer = '';
  let bufferMatch = marks.has(0);
  for (let index = 0; index < value.length; index += 1) {
    const match = marks.has(index);
    if (match !== bufferMatch && buffer) {
      segments.push({ text: buffer, match: bufferMatch });
      buffer = '';
    }
    bufferMatch = match;
    buffer += value[index];
  }
  if (buffer) segments.push({ text: buffer, match: bufferMatch });
  return segments;
}

export function escapeHighlightHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function highlightHtml(text, positions = []) {
  return highlightSegments(text, positions)
    .map((segment) => segment.match ? `<mark>${escapeHighlightHtml(segment.text)}</mark>` : escapeHighlightHtml(segment.text))
    .join('');
}
