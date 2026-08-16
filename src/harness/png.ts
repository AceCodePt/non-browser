import { deflateSync, inflateSync } from 'node:zlib';

export interface PngImage {
  width: number;
  height: number;
  data: Buffer;
}

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

let crcTable: Uint32Array | null = null;

function crc32(buf: Buffer): number {
  if (crcTable === null) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    crcTable = table;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * Decode an 8-bit, non-interlaced PNG (color types 0, 2, 3, 4, 6) to RGBA.
 * Chrome oracle screenshots are always in this class.
 */
export function decodePng(buf: Buffer): PngImage {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('not a PNG');
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let seenIhdr = false;
  const idat: Buffer[] = [];
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;

  while (pos < buf.length) {
    if (pos + 8 > buf.length) throw new Error('truncated PNG chunk header');
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    if (pos + 12 + len > buf.length) throw new Error('truncated PNG chunk data');
    const data = buf.subarray(pos + 8, pos + 8 + len);
    const storedCrc = buf.readUInt32BE(pos + 8 + len);
    if (crc32(buf.subarray(pos + 4, pos + 8 + len)) !== storedCrc) {
      throw new Error(`PNG CRC mismatch in ${type}`);
    }
    if (type === 'IHDR') {
      if (len !== 13) throw new Error('malformed IHDR');
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      const compression = data[10];
      const filterMethod = data[11];
      interlace = data[12];
      if (compression !== 0 || filterMethod !== 0) {
        throw new Error('unsupported PNG compression/filter method');
      }
      seenIhdr = true;
    } else if (type === 'PLTE') {
      palette = Buffer.from(data);
    } else if (type === 'tRNS') {
      trns = Buffer.from(data);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (!seenIhdr) throw new Error('missing IHDR');
  if (interlace !== 0) throw new Error('interlaced PNG unsupported');
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);

  const channels = [1, 0, 3, 1, 2, 0, 4][colorType];
  if (channels === undefined) throw new Error(`unsupported color type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const expected = (stride + 1) * height;
  if (raw.length !== expected) {
    throw new Error(`PNG raw length mismatch: ${raw.length} != ${expected}`);
  }

  const recon = Buffer.alloc(stride * height);
  let prev: Buffer | null = null;
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const rowOut = recon.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[y * (stride + 1) + 1 + x];
      const a = x >= channels ? rowOut[x - channels] : 0;
      const b = prev !== null ? prev[x] : 0;
      const c = x >= channels && prev !== null ? prev[x - channels] : 0;
      let val: number;
      switch (filter) {
        case 0:
          val = rawByte;
          break;
        case 1:
          val = (rawByte + a) & 0xff;
          break;
        case 2:
          val = (rawByte + b) & 0xff;
          break;
        case 3:
          val = (rawByte + ((a + b) >> 1)) & 0xff;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          val = (rawByte + pr) & 0xff;
          break;
        }
        default:
          throw new Error(`unknown PNG filter ${filter}`);
      }
      rowOut[x] = val;
    }
    prev = rowOut;
  }

  if (colorType === 3 && palette === null) throw new Error('palette PNG without PLTE');

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const off = i * channels;
    let r: number;
    let g: number;
    let b: number;
    let a: number;
    switch (colorType) {
      case 0:
        r = g = b = recon[off];
        a = 255;
        break;
      case 2:
        r = recon[off];
        g = recon[off + 1];
        b = recon[off + 2];
        a = 255;
        break;
      case 3: {
        const idx = recon[off];
        const pe = idx * 3;
        r = palette![pe];
        g = palette![pe + 1];
        b = palette![pe + 2];
        a = trns !== null && idx < trns.length ? trns[idx] : 255;
        break;
      }
      case 4:
        r = g = b = recon[off];
        a = recon[off + 1];
        break;
      case 6:
        r = recon[off];
        g = recon[off + 1];
        b = recon[off + 2];
        a = recon[off + 3];
        break;
      default:
        throw new Error('unreachable color type');
    }
    const o = i * 4;
    rgba[o] = r;
    rgba[o + 1] = g;
    rgba[o + 2] = b;
    rgba[o + 3] = a;
  }
  return { width, height, data: rgba };
}

export function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const stride = width * 4;
  if (rgba.length !== stride * height) {
    throw new Error(`encodePng buffer size mismatch: ${rgba.length} != ${stride * height}`);
  }
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
