import { chromium } from 'playwright';
import { createCanvas, Image } from '@napi-rs/canvas';

const W = 200, H = 200;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });

const html = (shadow, bg = 'white') => `<!doctype html><style>html,body{margin:0;padding:0;width:${W}px;height:${H}px;background:${bg}}</style>
<body><div style="position:absolute;left:50px;top:50px;width:100px;height:100px;background:#336699;box-shadow:${shadow}"></div></body>`;

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

function dumpRow(label, buf, y) {
  const vals = [];
  for (let x = 40; x < 165; x += 2) {
    const o = (y * W + x) * 4;
    vals.push(`${x}:${buf[o]}`);
  }
  console.log(label, vals.join(' '));
}

const cases = [
  { name: 'blur0-offset', shadow: '10px 12px 0px 0px rgba(0,0,0,0.5)', y: 112 },
  { name: 'blur10', shadow: '0px 0px 10px 0px rgba(0,0,0,0.5)', y: 80 },
  { name: 'blur20', shadow: '0px 0px 20px 0px rgba(0,0,0,0.5)', y: 80 },
  { name: 'blur30-spread8', shadow: '5px 6px 30px 8px rgba(255,0,0,0.5)', y: 120 },
];

try {
  for (const c of cases) {
    const ref = await shotPixels(html(c.shadow));
    // without shadow to see the box edge
    const plain = await shotPixels(html('0px 0px 0px 0px transparent'));
    console.log(`\n== ${c.name} row ${c.y} ==`);
    dumpRow('chrome', ref, c.y);
    dumpRow('noshad', plain, c.y);
    // vertical line at x=55 (5px left of box) shows blur falloff inside shadow
    const yvals = [];
    for (let yy = 40; yy < 165; yy += 2) {
      const o = (yy * W + 55) * 4;
      yvals.push(`${yy}:${ref[o]}`);
    }
    console.log('chrome col55:', yvals.join(' '));
  }
} finally {
  await browser.close();
}
