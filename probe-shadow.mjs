import { chromium } from 'playwright';
import { createCanvas } from '@napi-rs/canvas';

// Render a box with box-shadow in Chrome, and with a manual gaussian-blurred
// shadow at various sigmas in @napi-rs/canvas; report per-pixel delta-E so we
// can find the sigma Chrome uses for CSS box-shadow blur.

const W = 200, H = 200;

function gaussBlur(rgba, w, h, sigma) {
  const src = new Float32Array(rgba);
  const tmp = new Float32Array(w * h * 4);
  const out = new Float32Array(w * h * 4);
  const r = Math.max(1, Math.ceil(sigma * 3));
  const weights = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const wgt = Math.exp(-(i * i) / (2 * sigma * sigma));
    weights.push(wgt); sum += wgt;
  }
  for (let i = 0; i < weights.length; i++) weights[i] /= sum;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ar = 0, ag = 0, ab = 0, aa = 0;
      for (let k = 0; k < weights.length; k++) {
        const dx = k - r;
        const xx = Math.min(w - 1, Math.max(0, x + dx));
        const o = (y * w + xx) * 4;
        const wgt = weights[k];
        ar += src[o] * wgt; ag += src[o + 1] * wgt; ab += src[o + 2] * wgt; aa += src[o + 3] * wgt;
      }
      const o = (y * w + x) * 4;
      tmp[o] = ar; tmp[o + 1] = ag; tmp[o + 2] = ab; tmp[o + 3] = aa;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ar = 0, ag = 0, ab = 0, aa = 0;
      for (let k = 0; k < weights.length; k++) {
        const dy = k - r;
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        const o = (yy * w + x) * 4;
        const wgt = weights[k];
        ar += tmp[o] * wgt; ag += tmp[o + 1] * wgt; ab += tmp[o + 2] * wgt; aa += tmp[o + 3] * wgt;
      }
      const o = (y * w + x) * 4;
      out[o] = ar; out[o + 1] = ag; out[o + 2] = ab; out[o + 3] = aa;
    }
  }
  return Buffer.from(out.buffer);
}

function makeShadow(sigma, opts) {
  const { x, y, w, h, offsetX, offsetY, spread, color, inset } = opts;
  const cv = createCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  if (inset) {
    const sx = x + offsetX + spread, sy = y + offsetY + spread;
    const sw = w - 2 * spread, sh = h - 2 * spread;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    ctx.clearRect(sx, sy, sw, sh);
    const img = ctx.getImageData(0, 0, W, H);
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      if (xx < x || xx >= x + w || yy < y || yy >= y + h) img.data[(yy * W + xx) * 4 + 3] = 0;
    }
    ctx.putImageData(img, 0, 0);
  } else {
    const sx = x + offsetX - spread, sy = y + offsetY - spread;
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, w + 2 * spread, h + 2 * spread);
  }
  const img = ctx.getImageData(0, 0, W, H);
  const blurred = gaussBlur(img.data, W, H, sigma);
  return blurred;
}

function overWhite(buf) {
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length / 4; i++) {
    const a = buf[i * 4 + 3] / 255;
    out[i * 4] = Math.round(buf[i * 4] * a + 255 * (1 - a));
    out[i * 4 + 1] = Math.round(buf[i * 4 + 1] * a + 255 * (1 - a));
    out[i * 4 + 2] = Math.round(buf[i * 4 + 2] * a + 255 * (1 - a));
    out[i * 4 + 3] = 255;
  }
  return out;
}

function deltaE(a, b) {
  // naive RGB distance as proxy here
  let sum = 0, worst = 0, over = 0;
  for (let i = 0; i < W * H; i++) {
    const dr = a[i * 4] - b[i * 4], dg = a[i * 4 + 1] - b[i * 4 + 1], db = a[i * 4 + 2] - b[i * 4 + 2];
    const d = Math.sqrt(dr * dr + dg * dg + db * db);
    sum += d;
    if (d > 2) over++;
    if (d > worst) worst = d;
  }
  return { mean: sum / (W * H), overPct: (over / (W * H)) * 100, worst };
}

const html = (shadow) => `<!doctype html><style>html,body{margin:0;padding:0;width:${W}px;height:${H}px}</style>
<body><div style="position:absolute;left:50px;top:50px;width:100px;height:100px;background:#336699;box-shadow:${shadow}"></div></body>`;

const cases = [
  { name: 'outer-offset', shadow: '10px 12px 0px 0px rgba(0,0,0,0.5)' },
  { name: 'outer-spread', shadow: '4px 4px 0px 8px rgba(0,0,0,0.5)' },
  { name: 'outer-blur10', shadow: '0px 0px 10px 0px rgba(0,0,0,0.5)' },
  { name: 'outer-blur20', shadow: '0px 0px 20px 0px rgba(0,0,0,0.5)' },
  { name: 'outer-blur30-spread8', shadow: '5px 6px 30px 8px rgba(255,0,0,0.5)' },
  { name: 'inset', shadow: 'inset 5px 5px 0px 0px rgba(0,0,0,0.5)' },
  { name: 'inset-blur', shadow: 'inset 0px 0px 15px 0px rgba(0,0,0,0.5)' },
  { name: 'inset-blur-spread', shadow: 'inset 3px 4px 12px 5px rgba(0,0,0,0.5)' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
try {
  for (const c of cases) {
    await page.setContent(html(c.shadow));
    const shot = await page.screenshot();
    const cvs = createCanvas(W, H);
    const cctx = cvs.getContext('2d');
    const img = new (await import('@napi-rs/canvas')).Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = shot; });
    cctx.drawImage(img, 0, 0);
    const ref = cctx.getImageData(0, 0, W, H).data;
    const inset = c.shadow.startsWith('inset');
    const parts = c.shadow.replace('inset', '').trim().split(/\s+/);
    const offX = parseFloat(parts[0]), offY = parseFloat(parts[1]);
    const blur = parts[2] ? parseFloat(parts[2]) : 0;
    const spread = parts[3] ? parseFloat(parts[3]) : 0;
    const color = parts[parts.length - 1];
    console.log(`\n== ${c.name} (off ${offX},${offY} blur ${blur} spread ${spread} ${inset ? 'inset' : ''}) ==`);
    await page.setContent(html('0px 0px 0px 0px transparent'));
    const shot2 = await page.screenshot();
    const img2 = new (await import('@napi-rs/canvas')).Image();
    await new Promise((res, rej) => { img2.onload = res; img2.onerror = rej; img2.src = shot2; });
    cctx.drawImage(img2, 0, 0);
    const noShadow = cctx.getImageData(0, 0, W, H).data;
    for (const sigma of [blur / 4, blur / 3, blur / 2, blur * 0.6, blur * 0.75, blur, blur * 1.25, blur * 1.5, blur * 2]) {
      if (sigma === 0) continue;
      const shadowRgba = makeShadow(sigma, { x: 50, y: 50, w: 100, h: 100, offsetX: offX, offsetY: offY, spread, color, inset });
      const cand = overWhite(shadowRgba);
      // In the region covered by the box itself, cand is wrong (box is not drawn). So
      // only compare pixels NOT inside the box rect.
      let sum = 0, worst = 0, over = 0, n = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const inside = x >= 50 && x < 150 && y >= 50 && y < 150;
        if (inside) continue;
        const o = (y * W + x) * 4;
        const dr = ref[o] - cand[o], dg = ref[o + 1] - cand[o + 1], db = ref[o + 2] - cand[o + 2];
        const d = Math.sqrt(dr * dr + dg * dg + db * db);
        sum += d; n++;
        if (d > 2) over++;
        if (d > worst) worst = d;
      }
      console.log(`  sigma=${sigma.toFixed(2)}  mean=${(sum / n).toFixed(3)} over2%=${((over / n) * 100).toFixed(3)} worst=${worst.toFixed(2)}`);
    }
  }
} finally {
  await browser.close();
}
