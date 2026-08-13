import { chromium } from 'playwright';
import { createCanvas, Image } from '@napi-rs/canvas';

const W = 320, H = 200;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });

const html = (shadow) => `<!doctype html><style>html,body{margin:0;padding:0;width:${W}px;height:${H}px;background:#fff}</style>
<body><div style="position:absolute;left:160px;top:30px;width:100px;height:140px;background:#336699;box-shadow:${shadow}"></div></body>`;

async function profile(blur, spread, offX, offY, color, label) {
  const sh = `${offX}px ${offY}px ${blur}px ${spread}px ${color}`;
  await page.setContent(html(sh));
  const shot = await page.screenshot();
  const cvs = createCanvas(W, H);
  const ctx = cvs.getContext('2d');
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = shot; });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H).data;
  const y = 100; // middle of box height (box top 30, height 140 -> 30..170), middle = 100
  const out = [];
  for (let x = 30; x <= 160; x += 1) {
    const o = (y * W + x) * 4;
    out.push({ x: x - 160, v: data[o] });
  }
  return out;
}

function fit(profileArr, wmax = 80) {
  let best = null;
  for (let w = 0.1; w <= wmax; w += 0.05) {
    let err = 0;
    for (const p of profileArr) {
      const d = -p.x;
      const c = (255 - p.v) / 127.5;
      let pred;
      if (d <= 0) pred = 0.5;
      else if (d >= w) pred = 0;
      else pred = 0.5 * (1 - d / w);
      err += (pred - c) * (pred - c);
    }
    if (!best || err < best.err) best = { w, err };
  }
  return best;
}

try {
  for (const blur of [10, 20, 30, 50]) {
    const prof = await profile(blur, 0, 0, 0, 'rgba(0,0,0,0.5)');
    const f = fit(prof);
    console.log(`blur=${blur} fit w=${f.w.toFixed(3)} err=${f.err.toFixed(6)}`);
    console.log('   ' + prof.filter((_, i) => i % 3 === 0).map((p) => `${p.x}:${p.v}`).join(' '));
  }
} finally {
  await browser.close();
}
