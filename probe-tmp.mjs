import { chromium } from 'playwright';
import { createCanvas } from '@napi-rs/canvas';
import { decodePng } from './dist/harness/png.js';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 200, height: 60 } });
await p.setContent(`<html><head><style>body{margin:0}div{margin:0}</style></head><body>
<div style="font:20px 'Noto Sans';line-height:normal;color:#000;background:#fff">Ag</div></body></html>`);
await p.evaluate(() => document.fonts.ready);
const ref = decodePng(await p.screenshot());
await b.close();

const cv = createCanvas(200, 60);
const ctx = cv.getContext('2d');
ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 200, 60);
ctx.font = `20px 'Noto Sans'`;
ctx.fillStyle = '#000';
ctx.textBaseline = 'alphabetic';
ctx.fillText('Ag', 0, 21);
const cand = decodePng(cv.toBuffer('image/png'));

for (const col of [4, 12, 20, 21, 36, 37]) {
  let c = [], n = [];
  for (let y = 0; y < 30; y++) {
    const o = (y * ref.width + col) * 4;
    c.push(ref.data[o]); n.push(cand.data[o]);
  }
  console.log('col ' + col + ' chrome:' + c.join(' ') + '\n        napi :' + n.join(' '));
}
