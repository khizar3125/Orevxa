const KEYWORDS = new Set([
  'app', 'state', 'let', 'const', 'function', 'fn', 'page', 'scene', 'import', 'if', 'else',
  'while', 'for', 'in', 'return', 'true', 'false', 'null', 'and', 'or', 'not', 'break', 'continue',
]);

/** Tokenize Orvexa source. Newlines are meaningful statement separators. */
export function tokenize(source) {
  const text = String(source ?? '');
  const tokens = [];
  const errors = [];
  let i = 0, line = 1, column = 1;
  const at = () => ({ line, column, offset: i });
  const advance = () => {
    const ch = text[i++];
    if (ch === '\n') { line++; column = 1; } else column++;
    return ch;
  };
  const push = (type, value, start, raw = value) => tokens.push({ type, value, raw, line: start.line, column: start.column, offset: start.offset });
  while (i < text.length) {
    const ch = text[i];
    if (ch === ' ' || ch === '\t' || ch === '\r') { advance(); continue; }
    if (ch === '\n') { const start = at(); advance(); push('newline', '\n', start); continue; }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') advance();
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const start = at(); advance(); advance(); let closed = false;
      while (i < text.length) {
        if (text[i] === '*' && text[i + 1] === '/') { advance(); advance(); closed = true; break; }
        advance();
      }
      if (!closed) errors.push({ message: 'Unterminated block comment.', ...start });
      continue;
    }
    if (ch === '"' || ch === "'") {
      const start = at(), quote = advance(); let value = '', closed = false;
      while (i < text.length) {
        const c = advance();
        if (c === quote) { closed = true; break; }
        if (c === '\n') { errors.push({ message: 'String literals cannot cross a line without an escape.', ...start }); break; }
        if (c === '\\') {
          if (i >= text.length) break;
          const esc = advance();
          const map = { n: '\n', r: '\r', t: '\t', '\\': '\\', '"': '"', "'": "'", '0': '\0' };
          value += Object.hasOwn(map, esc) ? map[esc] : esc;
        } else value += c;
      }
      if (!closed && text[i - 1] !== '\n') errors.push({ message: 'Unterminated string literal.', ...start });
      push('string', value, start, text.slice(start.offset, i));
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(text[i + 1] || ''))) {
      const start = at(); let raw = '';
      while (/[0-9]/.test(text[i] || '')) raw += advance();
      if (text[i] === '.' && /[0-9]/.test(text[i + 1] || '')) {
        raw += advance(); while (/[0-9]/.test(text[i] || '')) raw += advance();
      }
      if (/[eE]/.test(text[i] || '')) {
        raw += advance(); if (/[+-]/.test(text[i] || '')) raw += advance();
        const exponentStart = i;
        while (/[0-9]/.test(text[i] || '')) raw += advance();
        if (i === exponentStart) errors.push({ message: 'Malformed number: an exponent marker must be followed by a digit (for example, 1e3 or 1e-3).', ...start });
      }
      const numericValue = Number(raw);
      if (!Number.isFinite(numericValue)) errors.push({ message: `Invalid or out-of-range number ${JSON.stringify(raw)}.`, ...start });
      push('number', numericValue, start, raw); continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const start = at(); let raw = '';
      while (/[A-Za-z0-9_$]/.test(text[i] || '')) raw += advance();
      push(KEYWORDS.has(raw) ? 'keyword' : 'identifier', raw, start, raw); continue;
    }
    const start = at();
    const multi = ['===', '!==', '??', '?.', '==', '!=', '<=', '>=', '&&', '||', '=>', '+=', '-=', '*=', '/=', '**'];
    const op = multi.find((candidate) => text.startsWith(candidate, i));
    if (op) { for (let n = 0; n < op.length; n++) advance(); push('operator', op, start, op); continue; }
    if ('+-*/%=<>!?:.'.includes(ch)) { advance(); push('operator', ch, start, ch); continue; }
    if ('(){}[],:;'.includes(ch)) { advance(); push('punctuation', ch, start, ch); continue; }
    advance(); errors.push({ message: `Unexpected character ${JSON.stringify(ch)}.`, ...start });
  }
  tokens.push({ type: 'eof', value: '', raw: '', line, column, offset: i });
  return { tokens, errors };
}

export function highlightOrvexa(source) {
  const text = String(source ?? '');
  const { tokens } = tokenize(text);
  const escaped = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  let output = '';
  let cursor = 0;
  for (const token of tokens) {
    if (token.type === 'eof') break;
    // Preserve every character not represented by a token, including indentation and comments.
    if (token.offset > cursor) output += escaped(text.slice(cursor, token.offset));
    const raw = token.raw ?? String(token.value);
    if (token.type === 'newline') {
      output += '\n';
    } else {
      const classes = {
        keyword: 'tok-keyword',
        string: 'tok-string',
        number: 'tok-number',
        identifier: 'tok-identifier',
        operator: 'tok-operator',
        punctuation: 'tok-punctuation',
      };
      const cls = classes[token.type];
      const safeRaw = escaped(raw);
      output += cls ? `<span class="${cls}">${safeRaw}</span>` : safeRaw;
    }
    cursor = token.offset + raw.length;
  }
  if (cursor < text.length) output += escaped(text.slice(cursor));
  return output;
}


/** Highlight the glyph-driven RealmScript format without routing it through the general Orvexa lexer. */
export function highlightRealmScript(source) {
  const escape = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return String(source ?? '').split('\n').map((line) => {
    const trim = line.trim();
    if (!trim) return '';
    if (trim.startsWith('//') || trim.startsWith('※')) return `<span class="tok-realm-comment">${escape(line)}</span>`;
    const directive = trim.match(/^(⟦[^⟧]+⟧|[☼▧⌖✧⌂≋✦⚙])(?:\s*([A-Za-z-]+))?/u);
    let out = escape(line);
    if (directive) {
      const start = line.indexOf(trim);
      const glyph = directive[1];
      out = `${escape(line.slice(0, start))}<span class="tok-realm-glyph">${escape(glyph)}</span>`;
      const consumed = glyph.length;
      const rest = trim.slice(consumed);
      const key = rest.match(/^\s*([A-Za-z-]+)/);
      if (key) {
        const leading = rest.slice(0, key.index + key[0].indexOf(key[1]));
        out += escape(leading) + `<span class="tok-realm-key">${escape(key[1])}</span>` + highlightRealmValues(rest.slice(key[0].length));
      } else out += highlightRealmValues(rest);
    }
    return out;
  }).join('\n');
}
function highlightRealmValues(text) {
  const escape = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return String(text).split(/(-?\b\d+(?:\.\d+)?\b|[×|,:=]|[\w-]+)/g).map((part) => {
    if (/^-?\b\d+(?:\.\d+)?\b$/.test(part)) return `<span class="tok-realm-number">${escape(part)}</span>`;
    if (/^[×|,:=]$/.test(part)) return `<span class="tok-realm-symbol">${escape(part)}</span>`;
    if (/^[\w-]+$/.test(part)) return `<span class="tok-realm-value">${escape(part)}</span>`;
    return escape(part);
  }).join('');
}
