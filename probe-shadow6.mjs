import { chromium } from 'playwright';
import { createCanvas, Image } from '@napi-rs/canvas';

const W = 320, H = 220;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });

const html = (shadow) => `<!doctype html><style>html,body{margin:0;padding:0;width:${W}px;height:${H}px;background:#fff}</style>
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

try {
  for (const blur of [0, 5, 10, 20, 30]) {
    const data = await chromePixels(`0px 0px ${blur}px 0px rgba(0,0,0,0.5)`);
    const vals = [];
    for (let x = 110 - blur - 5; x <= 110 + 5; x++) {
      const o = (110 * W + x) * 4;
      vals.push(`${x}:${data[o]},${data[o + 1]},${data[o + 2]}`);
    }
    console.log(`\n== blur ${blur} (row y=110, box left edge at x=110) ==`);
    console.log(vals.join('  '));
  }
} finally {
  await browser.close();
}
