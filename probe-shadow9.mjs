import { chromium } from 'playwright';
import { createCanvas, Image } from '@napi-rs/canvas';

const W = 220, H = 160;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });

const html = (bg) => `<!doctype html><style>html,body{margin:0;padding:0;width:${W}px;height:${H}px;background:#fff}</style>
<body><div style="position:absolute;left:60px;top:40px;width:100px;height:100px;background:${bg};box-shadow:8px 8px 0px 0px rgba(0,0,0,0.5)"></div></body>`;

async function shotPixels(htmlStr) {
  await page.setContent(htmlStr);
  const shot = await page.screenshot();
  const cvs = createCanvas(W, H);
  const ctx = cvs.getContext('2d');
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = shot; });
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, W, H).data;
}

try {
  for (const [label, bg] of [['opaque', '#336699'], ['transparent', 'transparent'], ['rgba-translucent', 'rgba(51,102,153,0.4)']]) {
    const data = await shotPixels(html(bg));
    console.log(`\n== ${label} bg ==`);
    const pts = {
      'shadow region (160,140)': (160 * W + 160) * 4,
      'shadow under-right of box (155,140)': (140 * W + 155) * 4,
      'box interior (80,60)': (60 * W + 80) * 4,
      'box interior (90,50)': (50 * W + 90) * 4,
      'outside far (10,10)': (10 * W + 10) * 4,
    };
    for (const [name, o] of Object.entries(pts)) {
      console.log(`  ${name}: rgba(${data[o]},${data[o + 1]},${data[o + 2]},${data[o + 3]})`);
    }
  }
} finally {
  await browser.close();
}
