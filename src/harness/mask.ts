import { decodePng } from './png.js';

/**
 * Load a PNG mask and reduce it to a per-pixel boolean bitmap
 * (1 = excluded from the pixel diff). A pixel is excluded iff it is opaque
 * (alpha > 0), so masks are authored as an opaque shape over a transparent
 * background.
 */
export function loadMask(buf: Buffer, width: number, height: number): Uint8Array {
  const img = decodePng(buf);
  if (img.width !== width || img.height !== height) {
    throw new Error(
      `mask dimensions ${img.width}x${img.height} do not match buffers ${width}x${height}`,
    );
  }
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (img.data[i * 4 + 3] > 0) mask[i] = 1;
  }
  return mask;
}
