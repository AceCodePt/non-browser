import { chromium } from 'playwright';
import { createCanvas, Image } from '@napi-rs/canvas';

const W = 360, H = 240;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });

const html = (shadow, bg = '#336699') => `<!doctype html><style>html,body{margin:0;padding:0;width:${W}px;height:${H}px;background:#fff}</style>
<body><div style="position:absolute;left:120px;top:50px;width:120px;height:140px;background:${bg};box-shadow:${shadow}"></div></body>`;

async function chromeAlpha(shadow, bg) {
  await page.setContent(html(shadow, bg));
  const shot = await page.screenshot();
  const cvs = createCanvas(W, H);
  const ctx = cvs.getContext('2d');
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = shot; });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H).data;
  // profile along row y=120 (box center), left of box edge x=120; alpha = 1 - v/255
  const out = [];
  for (let d = 0; d < 70; d++) {
    const x = 120 - d;
    if (x < 0) break;
    const o = (120 * W + x) * 4;
    out.push(d === 0 ? data[o] : 1 - data[o] / 255);
  }
  return out;
}

try {
  for (const blur of [5, 10, 20, 30]) {
    const a = await chromeAlpha(`0px 0px ${blur}px 0px rgba(0,0,0,0.5)`, '#336699');
    console.log(`\n== blur ${blur} ==`);
    console.log('d:' + a.map((_, i) => String(i).padStart(3)).join(''));
    console.log('a:' + a.map((v) => (v > 1 ? v : Math.round(v * 1000))).join(','));
  }
} finally {
  await browser.close();
}
