// core/qr.js — minimal self-contained QR encoder (byte mode, EC level M, mask 0)
// Supports QR versions 1–10 (up to ~213 bytes). Enough for URLs.

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x; GF_LOG[x] = i;
    x <<= 1; if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();
const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];

// version 1..10, EC level M: ec codewords per block + block groups [count, dataCodewords]
const EC_TABLE = [
  null,
  { ec: 10, groups: [[1, 16]] },
  { ec: 16, groups: [[1, 28]] },
  { ec: 26, groups: [[1, 44]] },
  { ec: 18, groups: [[2, 32]] },
  { ec: 24, groups: [[2, 43]] },
  { ec: 16, groups: [[4, 27]] },
  { ec: 18, groups: [[4, 31]] },
  { ec: 22, groups: [[2, 38], [2, 39]] },
  { ec: 22, groups: [[3, 36], [2, 37]] },
  { ec: 26, groups: [[4, 43], [1, 44]] },
];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

const G15 = 0b10100110111, G15_MASK = 0b101010000010010;
const G18 = 0b1111100100101;
const bchDigit = (d) => { let n = 0; while (d !== 0) { n++; d >>>= 1; } return n; };
function bchTypeInfo(data) {
  let d = data << 10;
  while (bchDigit(d) - bchDigit(G15) >= 0) d ^= G15 << (bchDigit(d) - bchDigit(G15));
  return ((data << 10) | d) ^ G15_MASK;
}
function bchTypeNumber(data) {
  let d = data << 12;
  while (bchDigit(d) - bchDigit(G18) >= 0) d ^= G18 << (bchDigit(d) - bchDigit(G18));
  return (data << 12) | d;
}

// Generator polynomial ∏(x − α^i), coefficients stored descending (leading = 1).
function rsGenPoly(deg) {
  let poly = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}
function rsEncode(data, ecLen) {
  const gen = rsGenPoly(ecLen);
  const msg = data.slice();
  for (let i = 0; i < ecLen; i++) msg.push(0);
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) for (let j = 0; j < gen.length; j++) msg[i + j] ^= gfMul(gen[j], coef);
  }
  return msg.slice(data.length);
}

class BitBuf {
  constructor() { this.buf = []; this.len = 0; }
  put(num, length) {
    for (let i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1);
  }
  putBit(bit) {
    if (this.len % 8 === 0) this.buf.push(0);
    if (bit) this.buf[(this.len / 8) | 0] |= 0x80 >>> (this.len % 8);
    this.len++;
  }
}

function dataCapacityBytes(version) {
  const t = EC_TABLE[version];
  const dcw = t.groups.reduce((a, [n, sz]) => a + n * sz, 0);
  const lenBits = version >= 10 ? 16 : 8;
  return ((dcw * 8 - 4 - lenBits) / 8) | 0;
}

export function encodeMatrix(text) {
  const bytes = new TextEncoder().encode(text);
  let version = 0;
  for (let v = 1; v <= 10; v++) if (bytes.length <= dataCapacityBytes(v)) { version = v; break; }
  if (!version) throw new Error('QR data too long');
  const t = EC_TABLE[version];

  // Build data codewords
  const bb = new BitBuf();
  bb.put(0b0100, 4);                       // byte mode
  bb.put(bytes.length, version >= 10 ? 16 : 8);
  for (const b of bytes) bb.put(b, 8);
  const totalDcw = t.groups.reduce((a, [n, sz]) => a + n * sz, 0);
  const cap = totalDcw * 8;
  bb.put(0, Math.min(4, cap - bb.len));    // terminator
  while (bb.len % 8 !== 0) bb.putBit(false);
  const pads = [0xec, 0x11];
  for (let i = 0; bb.buf.length < totalDcw; i++) bb.put(pads[i % 2], 8);

  // Split into blocks, compute EC, interleave
  const blocks = [];
  let off = 0;
  for (const [count, size] of t.groups) {
    for (let i = 0; i < count; i++) {
      const data = bb.buf.slice(off, off + size);
      blocks.push({ data, ec: rsEncode(data, t.ec) });
      off += size;
    }
  }
  const codewords = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++)
    for (const b of blocks) if (i < b.data.length) codewords.push(b.data[i]);
  for (let i = 0; i < t.ec; i++)
    for (const b of blocks) codewords.push(b.ec[i]);

  // Build matrix (null = data cell, true/false = function pattern)
  const size = 17 + 4 * version;
  const m = Array.from({ length: size }, () => new Array(size).fill(null));
  const set = (r, c, v) => { if (r >= 0 && r < size && c >= 0 && c < size) m[r][c] = v; };

  // finder patterns + separators
  const finder = (r, c) => {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      const dark =
        (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) ||
        (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6)) ||
        (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
      set(rr, cc, dark);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  // alignment patterns
  const pos = ALIGN[version];
  for (const r of pos) for (const c of pos) {
    if (m[r][c] !== null) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++)
      set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }

  // timing
  for (let i = 8; i < size - 8; i++) {
    if (m[6][i] === null) m[6][i] = i % 2 === 0;
    if (m[i][6] === null) m[i][6] = i % 2 === 0;
  }

  // reserve format-info cells
  const reserveFormat = () => {
    for (let i = 0; i < 15; i++) {
      if (i < 6) { if (m[i][8] === null) m[i][8] = false; }
      else if (i < 8) { if (m[i + 1][8] === null) m[i + 1][8] = false; }
      else if (m[size - 15 + i][8] === null) m[size - 15 + i][8] = false;
      if (i < 8) { if (m[8][size - i - 1] === null) m[8][size - i - 1] = false; }
      else if (i < 9) { if (m[8][15 - i] === null) m[8][15 - i] = false; }
      else if (m[8][15 - i - 1] === null) m[8][15 - i - 1] = false;
    }
    if (m[size - 8][8] === null) m[size - 8][8] = true;
  };
  reserveFormat();

  // version info (v >= 7)
  if (version >= 7) {
    const bits = bchTypeNumber(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >> i) & 1) === 1;
      m[(i / 3) | 0][(i % 3) + size - 11] = bit;
      m[(i % 3) + size - 11][(i / 3) | 0] = bit;
    }
  }

  // place data with mask 0 ((r+c)%2==0)
  let inc = -1, row = size - 1, bitIdx = 7, byteIdx = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (m[row][cc] === null) {
          let dark = false;
          if (byteIdx < codewords.length) dark = ((codewords[byteIdx] >>> bitIdx) & 1) === 1;
          if ((row + cc) % 2 === 0) dark = !dark;
          m[row][cc] = dark;
          if (--bitIdx === -1) { byteIdx++; bitIdx = 7; }
        }
      }
      row += inc;
      if (row < 0 || row >= size) { row -= inc; inc = -inc; break; }
    }
  }

  // write format info (EC level M = 00, mask 0)
  const fmt = bchTypeInfo(0);
  const fbit = (i) => ((fmt >> i) & 1) === 1;
  for (let i = 0; i < 15; i++) {
    if (i < 6) m[i][8] = fbit(i);
    else if (i < 8) m[i + 1][8] = fbit(i);
    else m[size - 15 + i][8] = fbit(i);
    if (i < 8) m[8][size - i - 1] = fbit(i);
    else if (i < 9) m[8][15 - i] = fbit(i);
    else m[8][15 - i - 1] = fbit(i);
  }
  m[size - 8][8] = true; // dark module

  return m;
}

export function drawQr(canvas, text, { scale = 6, margin = 4 } = {}) {
  let matrix;
  try { matrix = encodeMatrix(text); }
  catch { return false; }
  const n = matrix.length;
  const px = (n + margin * 2) * scale;
  canvas.width = px; canvas.height = px;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (matrix[r][c]) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
  return true;
}
