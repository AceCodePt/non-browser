import { chromium } from 'playwright';
import { createCanvas, Image } from '@napi-rs/canvas';

const W = 320, H = 200;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });

// Chrome box-shadow profile
async function boxShadowProfile(blur) {
  const html = `<!doctype html><style>html,body{margin:0;padding:0;width:${W}px;height:${H}px;background:#fff}</style>
  <body><div style="position:absolute;left:160px;top:30px;width:100px;height:140px;background:#336699;box-shadow:0px 0px ${blur}px 0px rgba(0,0,0,0.5)"></div></body>`;
  await page.setContent(html);
  const shot = await page.screenshot();
  const cvs = createCanvas(W, H);
  const ctx = cvs.getContext('2d');
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = shot; });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H).data;
  const y = 100, out = [];
  for (let x = 30; x <= 158; x += 1) {
    const o = (y * W + x) * 4;
    out.push({ x: x - 160, v: data[o] });
  }
  return out;
}

// Chrome canvas filter blur profile
async function canvasFilterProfile(blur) {
  const html = `<!doctype html><style>html,body{margin:0;padding:0;background:#fff}</style>
  <body><canvas id="c" width="${W}" height="${H}"></canvas>
  <script>
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    ctx.filter = 'blur(${blur}px)';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(160, 30, 100, 140);
  </script></body>`;
  await page.setContent(html);
  const shot = await page.screenshot();
  const cvs = createCanvas(W, H);
  const ctx = cvs.getContext('2d');
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = shot; });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H).data;
  const y = 100, out = [];
  for (let x = 30; x <= 158; x += 1) {
    const o = (y * W + x) * 4;
    out.push({ x: x - 160, v: data[o] });
  }
  return out;
}

// @napi-rs/canvas filter blur profile
function napiFilterProfile(blur) {
  const cvs = createCanvas(W, H);
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.filter = `blur(${blur}px)`;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(160, 30, 100, 140);
  const data = ctx.getImageData(0, 0, W, H).data;
  const y = 100, out = [];
  for (let x = 30; x <= 158; x += 1) {
    const o = (y * W + x) * 4;
    out.push({ x: x - 160, v: data[o] });
  }
  return out;
}

function cmp(a, b, label) {
  let max = 0, sum = 0, over2 = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i].v - b[i].v);
    sum += d;
    if (d > max) max = d;
    if (d > 2) over2++;
  }
  console.log(`${label}: mean=${(sum / a.length).toFixed(3)} max=${max} over2=${over2}/${a.length}`);
}

try {
  for (const blur of [5, 10, 20, 30, 50]) {
    const bs = await boxShadowProfile(blur);
    const cf = await canvasFilterProfile(blur);
    const nf = napiFilterProfile(blur);
    console.log(`\n== blur ${blur} ==`);
    cmp(bs, cf, 'chrome-boxshadow vs chrome-canvas-filter');
    cmp(cf, nf, 'chrome-canvas-filter vs napi-canvas-filter');
    cmp(bs, nf, 'chrome-boxshadow vs napi-canvas-filter');
  }
} finally {
  await browser.close();
}
