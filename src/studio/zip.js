const encoder = new TextEncoder();
const decoder = new TextDecoder();
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
export function crc32(data) { let crc = 0xffffffff; for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
const u16 = (view, offset, value) => view.setUint16(offset, value, true);
const u32 = (view, offset, value) => view.setUint32(offset, value >>> 0, true);
const get16 = (view, offset) => view.getUint16(offset, true);
const get32 = (view, offset) => view.getUint32(offset, true);
function joinBytes(parts) { const size = parts.reduce((n, p) => n + p.length, 0); const out = new Uint8Array(size); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }

/** Generate a standards-compliant, uncompressed ZIP archive. */
export function zipSync(entries) {
  const localParts = []; const centralParts = []; let offset = 0; const names = Object.keys(entries);
  if (names.length > 65535) throw new Error('ZIP export contains too many entries.');
  for (const path of names) {
    const name = encoder.encode(path.replaceAll('\\', '/'));
    if (name.length > 65535) throw new Error('ZIP file path is too long.');
    const raw = entries[path]; const data = typeof raw === 'string' ? encoder.encode(raw) : raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length); const lv = new DataView(local.buffer);
    u32(lv, 0, 0x04034b50); u16(lv, 4, 20); u16(lv, 6, 0x0800); u16(lv, 8, 0); u16(lv, 10, 0); u16(lv, 12, 0);
    u32(lv, 14, checksum); u32(lv, 18, data.length); u32(lv, 22, data.length); u16(lv, 26, name.length); u16(lv, 28, 0); local.set(name, 30);
    localParts.push(local, data);
    const central = new Uint8Array(46 + name.length); const cv = new DataView(central.buffer);
    u32(cv, 0, 0x02014b50); u16(cv, 4, 20); u16(cv, 6, 20); u16(cv, 8, 0x0800); u16(cv, 10, 0); u16(cv, 12, 0); u16(cv, 14, 0);
    u32(cv, 16, checksum); u32(cv, 20, data.length); u32(cv, 24, data.length); u16(cv, 28, name.length); u16(cv, 30, 0); u16(cv, 32, 0); u16(cv, 34, 0); u16(cv, 36, 0); u32(cv, 38, 0); u32(cv, 42, offset); central.set(name, 46);
    centralParts.push(central); offset += local.length + data.length;
  }
  const centralStart = offset; const centralBytes = joinBytes(centralParts); const localBytes = joinBytes(localParts);
  const end = new Uint8Array(22); const ev = new DataView(end.buffer); u32(ev, 0, 0x06054b50); u16(ev, 4, 0); u16(ev, 6, 0); u16(ev, 8, names.length); u16(ev, 10, names.length); u32(ev, 12, centralBytes.length); u32(ev, 16, centralStart); u16(ev, 20, 0);
  return joinBytes([localBytes, centralBytes, end]);
}

/** Read common ZIPs. Stored entries always work; DEFLATE entries use native browser streams when available. */
export async function unzip(bytes, { maxUncompressed = 20_000_000, maxEntryBytes = 2_000_000 } = {}) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const min = Math.max(0, data.length - 65557); let eocd = -1;
  for (let i = data.length - 22; i >= min; i--) { if (get32(view, i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('This does not look like a valid ZIP archive.');
  const count = get16(view, eocd + 10), centralSize = get32(view, eocd + 12), centralOffset = get32(view, eocd + 16);
  if (count > 1000) throw new Error('ZIP imports are limited to 1,000 entries.');
  if (centralOffset + centralSize > data.length) throw new Error('ZIP directory is incomplete.');
  let cursor = centralOffset, total = 0; const out = Object.create(null);
  for (let n = 0; n < count; n++) {
    if (cursor + 46 > data.length || get32(view, cursor) !== 0x02014b50) throw new Error('ZIP directory contains an invalid entry.');
    const flags = get16(view, cursor + 8), method = get16(view, cursor + 10), crc = get32(view, cursor + 16), compressedSize = get32(view, cursor + 20), uncompressedSize = get32(view, cursor + 24);
    const nameLen = get16(view, cursor + 28), extraLen = get16(view, cursor + 30), commentLen = get16(view, cursor + 32), localOffset = get32(view, cursor + 42);
    if (flags & 1) throw new Error('Password-protected ZIP files are not supported.');
    if (uncompressedSize > maxEntryBytes) throw new Error(`ZIP entries are limited to ${Math.round(maxEntryBytes / 1_000_000)} MB each.`);
    total += uncompressedSize; if (total > maxUncompressed) throw new Error(`ZIP expands beyond the ${Math.round(maxUncompressed / 1_000_000)} MB import limit.`);
    const pathBytes = data.slice(cursor + 46, cursor + 46 + nameLen); const path = decoder.decode(pathBytes);
    cursor += 46 + nameLen + extraLen + commentLen;
    if (path.endsWith('/')) continue;
    if (localOffset + 30 > data.length || get32(view, localOffset) !== 0x04034b50) throw new Error(`ZIP entry "${path}" has an invalid header.`);
    const localNameLen = get16(view, localOffset + 26), localExtraLen = get16(view, localOffset + 28);
    const contentStart = localOffset + 30 + localNameLen + localExtraLen; const compressed = data.slice(contentStart, contentStart + compressedSize);
    let content;
    if (method === 0) content = compressed;
    else if (method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot unpack DEFLATE ZIP files. Re-export as an Orvexa ZIP or use a modern Chrome/Edge browser.');
      try { const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw')); content = new Uint8Array(await new Response(stream).arrayBuffer()); }
      catch { throw new Error(`Could not decompress ZIP entry "${path}".`); }
    } else throw new Error(`ZIP compression method ${method} is not supported.`);
    if (content.length !== uncompressedSize || crc32(content) !== crc) throw new Error(`ZIP entry "${path}" failed its integrity check.`);
    out[path] = content;
  }
  return out;
}
export const zipText = (value) => encoder.encode(String(value));
export const unzipText = (value) => decoder.decode(value);
