/**
 * Dependency-free QR code generator (byte mode) → SVG data-URL.
 *
 * We render the TOTP otpauth URI server-side as a scannable QR so the admin
 * needs NO new browser dependency (a `qrcode` npm dep would require a `bun
 * install` the sandbox cannot run, and would risk the admin build). This is a
 * small, auditable ISO/IEC 18004 implementation over `node:crypto`-free math:
 * Reed-Solomon over GF(256), byte-mode encoding, versions 1..10, and the four
 * mask patterns evaluated by the standard penalty score.
 *
 * Scope is deliberately narrow: byte mode only, error-correction level M (the
 * authenticator-app default trade-off). otpauth URIs are ASCII and comfortably
 * fit inside version ≤10 at level M (up to ~271 bytes), so this covers every
 * OB-CMS otpauth payload with headroom.
 */

// -- Galois field GF(256) tables (generator 0x11d) --------------------------
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

const gfMul = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];

/** Build the Reed-Solomon generator polynomial for `degree` EC codewords. */
function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Compute EC codewords for a data block. */
function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGeneratorPoly(ecLen);
  const res = new Array<number>(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < ecLen; i += 1) res[i] ^= gfMul(gen[i], factor);
  }
  return res;
}

// -- Version parameters (level M): total data codewords, EC per block, block split
// [dataCodewordsTotal, ecPerBlock, group1Blocks, group1DataPerBlock, group2Blocks, group2DataPerBlock]
const VERSION_M: Record<number, [number, number, number, number, number, number]> = {
  1: [16, 10, 1, 16, 0, 0],
  2: [28, 16, 1, 28, 0, 0],
  3: [44, 26, 1, 44, 0, 0],
  4: [64, 18, 2, 32, 0, 0],
  5: [86, 24, 2, 43, 0, 0],
  6: [108, 16, 4, 27, 0, 0],
  7: [124, 18, 4, 31, 0, 0],
  8: [154, 22, 2, 38, 2, 39],
  9: [182, 22, 3, 36, 2, 37],
  10: [216, 26, 4, 43, 1, 44],
};

// Alignment-pattern center coords per version (versions 1..10).
const ALIGN: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

/** Format-info bits (15) per mask for EC level M (already BCH-encoded + masked). */
const FORMAT_M: number[] = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
];

const size = (v: number): number => 17 + v * 4;

/** Choose the smallest version (1..10) whose data capacity fits the payload. */
function pickVersion(byteLen: number): number {
  for (let v = 1; v <= 10; v += 1) {
    const dataCw = VERSION_M[v][0];
    // 4 mode bits + count bits (8 for v1-9, 16 for v10) + terminator budget.
    const countBits = v >= 10 ? 16 : 8;
    const needBits = 4 + countBits + byteLen * 8;
    if (needBits <= dataCw * 8) return v;
  }
  throw new Error("QR payload too large for supported versions (<=10, level M)");
}

/** Encode payload → interleaved data+EC codewords (final bit stream). */
function buildCodewords(text: string, version: number): number[] {
  const [dataCw, ecPerBlock, g1, g1n, g2, g2n] = VERSION_M[version];
  const bytes = Array.from(new TextEncoder().encode(text));

  // Bit buffer.
  const bits: number[] = [];
  const push = (value: number, len: number): void => {
    for (let i = len - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, version >= 10 ? 16 : 8);
  for (const b of bytes) push(b, 8);
  // Terminator (up to 4 zero bits).
  const cap = dataCw * 8;
  for (let i = 0; i < 4 && bits.length < cap; i += 1) bits.push(0);
  // Pad to byte boundary.
  while (bits.length % 8 !== 0) bits.push(0);
  // Pad bytes 0xEC / 0x11 alternating.
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }
  const padBytes = [0xec, 0x11];
  let pi = 0;
  while (data.length < dataCw) {
    data.push(padBytes[pi % 2]);
    pi += 1;
  }

  // Split into blocks.
  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  const layout: Array<[number, number]> = [];
  for (let i = 0; i < g1; i += 1) layout.push([g1n, ecPerBlock]);
  for (let i = 0; i < g2; i += 1) layout.push([g2n, ecPerBlock]);
  for (const [n] of layout) {
    const block = data.slice(offset, offset + n);
    offset += n;
    blocks.push(block);
    ecBlocks.push(rsEncode(block, ecPerBlock));
  }

  // Interleave data codewords.
  const result: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxData; i += 1) {
    for (const block of blocks) if (i < block.length) result.push(block[i]);
  }
  // Interleave EC codewords.
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (const ec of ecBlocks) result.push(ec[i]);
  }
  return result;
}

type Matrix = Int8Array[]; // -1 unset, 0/1 module; function-pattern flag tracked separately.

function newMatrix(n: number): { m: Matrix; fn: boolean[][] } {
  const m: Matrix = Array.from({ length: n }, () => new Int8Array(n).fill(-1));
  const fn = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  return { m, fn };
}

function placeFinder(m: Matrix, fn: boolean[][], r: number, c: number): void {
  for (let dr = -1; dr <= 7; dr += 1) {
    for (let dc = -1; dc <= 7; dc += 1) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
      const inRing =
        dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
          ? dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)
          : false;
      m[rr][cc] = inRing ? 1 : 0;
      fn[rr][cc] = true;
    }
  }
}

function buildMatrix(codewords: number[], version: number, mask: number): Matrix {
  const n = size(version);
  const { m, fn } = newMatrix(n);

  // Finder patterns + separators.
  placeFinder(m, fn, 0, 0);
  placeFinder(m, fn, 0, n - 7);
  placeFinder(m, fn, n - 7, 0);

  // Timing patterns.
  for (let i = 0; i < n; i += 1) {
    if (!fn[6][i]) {
      m[6][i] = i % 2 === 0 ? 1 : 0;
      fn[6][i] = true;
    }
    if (!fn[i][6]) {
      m[i][6] = i % 2 === 0 ? 1 : 0;
      fn[i][6] = true;
    }
  }

  // Alignment patterns. Skip only the three centers that collide with the
  // finder patterns (top-left/top-right/bottom-left corners); alignment on the
  // timing line is legal and takes precedence there per ISO/IEC 18004.
  const centers = ALIGN[version];
  const last = n - 7;
  const collidesFinder = (ar: number, ac: number): boolean =>
    (ar === 6 && ac === 6) || (ar === 6 && ac === last) || (ar === last && ac === 6);
  for (const ar of centers) {
    for (const ac of centers) {
      if (collidesFinder(ar, ac)) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc));
          m[ar + dr][ac + dc] = ring === 1 ? 0 : 1;
          fn[ar + dr][ac + dc] = true;
        }
      }
    }
  }

  // Dark module.
  m[n - 8][8] = 1;
  fn[n - 8][8] = true;

  // Reserve format-info areas (filled later).
  for (let i = 0; i < 9; i += 1) {
    if (!fn[8][i]) fn[8][i] = true;
    if (!fn[i][8]) fn[i][8] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    fn[8][n - 1 - i] = true;
    fn[n - 1 - i][8] = true;
  }

  // Data placement (zig-zag, upward/downward columns, skipping the timing col).
  const bits: number[] = [];
  for (const cw of codewords) for (let b = 7; b >= 0; b -= 1) bits.push((cw >> b) & 1);

  let bitIdx = 0;
  let upward = true;
  for (let col = n - 1; col > 0; col -= 2) {
    const c = col === 6 ? col - 1 : col; // skip timing column
    for (let row = 0; row < n; row += 1) {
      const r = upward ? n - 1 - row : row;
      for (let k = 0; k < 2; k += 1) {
        const cc = c - k;
        if (fn[r][cc]) continue;
        let bit = bitIdx < bits.length ? bits[bitIdx] : 0;
        bitIdx += 1;
        // Apply mask.
        let inv = false;
        switch (mask) {
          case 0: inv = (r + cc) % 2 === 0; break;
          case 1: inv = r % 2 === 0; break;
          case 2: inv = cc % 3 === 0; break;
          case 3: inv = (r + cc) % 3 === 0; break;
          case 4: inv = (Math.floor(r / 2) + Math.floor(cc / 3)) % 2 === 0; break;
          case 5: inv = ((r * cc) % 2) + ((r * cc) % 3) === 0; break;
          case 6: inv = (((r * cc) % 2) + ((r * cc) % 3)) % 2 === 0; break;
          case 7: inv = (((r + cc) % 2) + ((r * cc) % 3)) % 2 === 0; break;
          default: inv = false;
        }
        if (inv) bit ^= 1;
        m[r][cc] = bit;
      }
    }
    upward = !upward;
  }

  // Format info (15 bits, two copies). Placement follows the qrcode-generator
  // reference (Arase); the dark module at (n-8, 8) is set separately above.
  const fmt = FORMAT_M[mask];
  for (let i = 0; i < 15; i += 1) {
    const bit = (fmt >> i) & 1;
    // Vertical copy: down col 8 (top-left) then up col 8 (bottom-left).
    if (i < 6) m[i][8] = bit;
    else if (i < 8) m[i + 1][8] = bit;
    else m[n - 15 + i][8] = bit;
    // Horizontal copy: along row 8 (top-right) then along row 8 (top-left).
    if (i < 8) m[8][n - 1 - i] = bit;
    else if (i < 9) m[8][15 - i] = bit;
    else m[8][14 - i] = bit;
  }

  return m;
}

/** Standard mask-penalty score (lower is better). */
function penalty(m: Matrix): number {
  const n = m.length;
  let score = 0;
  // Rule 1: runs of 5+ same-color in row/col.
  const runScore = (line: number[]): number => {
    let s = 0;
    let run = 1;
    for (let i = 1; i < line.length; i += 1) {
      if (line[i] === line[i - 1]) {
        run += 1;
        if (run === 5) s += 3;
        else if (run > 5) s += 1;
      } else run = 1;
    }
    return s;
  };
  for (let r = 0; r < n; r += 1) score += runScore(Array.from(m[r]));
  for (let c = 0; c < n; c += 1) score += runScore(m.map((row) => row[c]));
  // Rule 2: 2x2 blocks.
  for (let r = 0; r < n - 1; r += 1)
    for (let c = 0; c < n - 1; c += 1)
      if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) score += 3;
  // Rule 3: finder-like patterns.
  const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const match = (line: number[], start: number, pat: number[]): boolean => {
    for (let k = 0; k < pat.length; k += 1) if (line[start + k] !== pat[k]) return false;
    return true;
  };
  for (let r = 0; r < n; r += 1) {
    const row = Array.from(m[r]);
    const col = m.map((rr) => rr[r]);
    for (let c = 0; c <= n - 11; c += 1) {
      if (match(row, c, pat1) || match(row, c, pat2)) score += 40;
      if (match(col, c, pat1) || match(col, c, pat2)) score += 40;
    }
  }
  // Rule 4: dark/light balance.
  let dark = 0;
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (m[r][c] === 1) dark += 1;
  const ratio = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return score;
}

/**
 * Render `text` as a QR code and return an SVG `data:` URL (module-crisp, 4-unit
 * quiet zone). Suitable for `<img src=...>` in the admin — no client-side dep.
 */
export function qrSvgDataUri(text: string): string {
  const version = pickVersion(new TextEncoder().encode(text).length);
  const codewords = buildCodewords(text, version);

  // Try all 8 masks, keep the lowest-penalty matrix.
  let best: Matrix | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const m = buildMatrix(codewords, version, mask);
    const s = penalty(m);
    if (s < bestScore) {
      bestScore = s;
      best = m;
    }
  }
  const m = best as Matrix;
  const n = m.length;
  const quiet = 4;
  const dim = n + quiet * 2;

  let rects = "";
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (m[r][c] === 1) {
        rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`;
      }
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>` +
    `<g fill="#000000">${rects}</g>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
