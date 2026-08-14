import { chromium } from 'playwright';
import { createCanvas, Image } from '@napi-rs/canvas';

const W = 360, H = 240;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });

const html = (shadow) => `<!doctype html><style>html,body{margin:0;padding:0;width:${W}px;height:${H}px;background:#fff}</style>
<body><div style="position:absolute;left:120px;top:50px;width:120px;height:140px;background:#336699;box-shadow:${shadow}"></div></body>`;

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

// canvas shadowBlur recipe: shadow behind, then box background on top
function napiShadowBlur(blur, color = 'rgba(0,0,0,0.5)') {
  const cvs = createCanvas(W, H);
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.shadowColor = color;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillRect(120, 50, 120, 140);
  ctx.fillStyle = '#336699';
  ctx.fillRect(120, 50, 120, 140);
  return ctx.getImageData(0, 0, W, H).data;
}

// manual reproduction of Chrome's algorithm: box-blur^3 kernel (Skia mask blur),
// sigma = blur/2, over the rect, clipped to outside the box
function cubicProfile(d, blur) {
  // units of 2*sigma; sigma = blur/2 so 2*sigma = blur
  const u = d / blur;
  const gi = (x) => {
    if (x > 1.5) return 0;
    if (x < -1.5) return 1;
    const x2 = x * x, x3 = x2 * x;
    if (x > 0.5) return 0.5625 - (x3 / 6 - 3 * x2 * 0.25 + 1.125 * x);
    if (x > -0.5) return 0.5 - (0.75 * x - x3 / 3);
    return 0.4375 + (-x3 / 6 - 3 * x2 * 0.25 - 1.125 * x);
  };
  return 0.5 * gi(u);
}

function rowAlpha(data, x0, x1, y) {
  const out = [];
  for (let x = x0; x <= x1; x++) {
    const o = (y * W + x) * 4;
    const v = data[o];
    out.push(x === 120 ? 1 : 1 - v / 255);
  }
  return out;
}

try {
  for (const blur of [5, 10, 20]) {
    const ref = await chromePixels(`0px 0px ${blur}px 0px rgba(0,0,0,0.5)`);
    const napi = napiShadowBlur(blur);
    console.log(`\n== blur ${blur} (row y=120, box left edge x=120, d = distance left of edge) ==`);
    console.log('d  chrome   napi-sb  cubic-model');
    for (let d = 0; d <= 3 * blur + 3; d++) {
      const x = 120 - d;
      const o = (120 * W + x) * 4;
      const cv = 1 - ref[o] / 255;
      const nv = 1 - napi[o] / 255;
      if (d % 2 !== 0) continue;
      console.log(`${String(d).padStart(2)}  ${cv.toFixed(3)}   ${nv.toFixed(3)}    ${cubicProfile(d, blur).toFixed(3)}`);
    }
  }
} finally {
  await browser.close();
}
