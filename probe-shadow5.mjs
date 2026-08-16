import { chromium } from 'playwright';
import { createCanvas, Image } from '@napi-rs/canvas';

// Find the sigma relationship between Chrome's CSS box-shadow blur and
// @napi-rs/canvas's shadowBlur (standard deviation = shadowBlur/2) by fitting.

const W = 320, H = 220;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });

const html = (shadow, bg = '#fff') => `<!doctype html><style>html,body{margin:0;padding:0;width:${W}px;height:${H}px;background:${bg}</style>
<body><div style="position:absolute;left:110px;top:40px;width:100px;height:140px;background:#336699;box-shadow:${shadow}"></div></body>`;

async function chromePixels(shadow) {
  await page.setContent(html(shadow));
  const shot = await page.screenshot();
  const cvs = createCanvas(W, H);
  const ctx = cvs.getContext('2d');
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = shot; });
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, W, H).data;
}

function napiShadow(offX, offY, blurSigma, color, spread = 0) {
  const cvs = createCanvas(W, H);
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.shadowColor = color;
  ctx.shadowOffsetX = offX;
  ctx.shadowOffsetY = offY;
  ctx.shadowBlur = blurSigma * 2;
  const x = 110 - spread, y = 40 - spread, w = 100 + 2 * spread, h = 140 + 2 * spread;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  return ctx.getImageData(0, 0, W, H).data;
}

function diffProfile(ref, cand, region) {
  let sum = 0, worst = 0, over = 0, n = 0;
  const [x0, y0, x1, y1] = region;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * W + x) * 4;
      const dr = ref[o] - cand[o], dg = ref[o + 1] - cand[o + 1], db = ref[o + 2] - cand[o + 2];
      const d = Math.sqrt(dr * dr + dg * dg + db * db);
      sum += d; n++;
      if (d > 2) over++;
      if (d > worst) worst = d;
    }
  }
  return { mean: sum / n, overPct: (over / n) * 100, worst };
}

// Also compare on the whole frame but with the box region included where both
// paint the box (shadow layer is drawn behind; box covers it in both).
function diffFull(ref, cand) {
  return diffProfile(ref, cand, [0, 0, W, H]);
}

const cases = [
  { name: 'blur0-offset', shadow: '10px 12px 0px 0px rgba(0,0,0,0.5)', offX: 10, offY: 12, blur: 0, region: [20, 20, 300, 200] },
  { name: 'blur5', shadow: '0px 0px 5px 0px rgba(0,0,0,0.5)', offX: 0, offY: 0, blur: 5, region: [0, 0, W, 40] },
  { name: 'blur10', shadow: '0px 0px 10px 0px rgba(0,0,0,0.5)', offX: 0, offY: 0, blur: 10, region: [0, 0, W, 40] },
  { name: 'blur20', shadow: '0px 0px 20px 0px rgba(0,0,0,0.5)', offX: 0, offY: 0, blur: 20, region: [0, 0, W, 40] },
  { name: 'blur30-spread8', shadow: '5px 6px 30px 8px rgba(255,0,0,0.5)', offX: 5, offY: 6, blur: 30, spread: 8, region: [20, 20, 300, 200] },
];

try {
  for (const c of cases) {
    const ref = await chromePixels(c.shadow);
    console.log(`\n== ${c.name} (blur ${c.blur}) ==`);
    for (const mult of [0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 2.0]) {
      if (c.blur === 0) break;
      const sigma = c.blur * mult;
      const cand = napiShadow(c.offX, c.offY, sigma, 'rgba(0,0,0,0.5)', c.spread ?? 0);
      const d = diffProfile(ref, cand, c.region);
      console.log(`  sigma=${sigma.toFixed(2)} (x${mult}) mean=${d.mean.toFixed(3)} over2=${d.overPct.toFixed(2)}% worst=${d.worst.toFixed(2)}`);
    }
    if (c.blur === 0) {
      const cand = napiShadow(c.offX, c.offY, 1e-6, 'rgba(0,0,0,0.5)', c.spread ?? 0);
      const d = diffProfile(ref, cand, c.region);
      console.log(`  hard edge mean=${d.mean.toFixed(3)} over2=${d.overPct.toFixed(2)}% worst=${d.worst.toFixed(2)}`);
    }
  }
} finally {
  await browser.close();
}
