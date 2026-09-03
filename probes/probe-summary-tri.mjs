#!/usr/bin/env node
import { chromium } from 'playwright';
import { decodePng } from '../dist/harness/png.js';

const html = `<html><head><style>html,body{margin:0;padding:0;font-family:'Noto Sans'}</style></head><body>
<details id="det"><summary id="sum">Summary</summary><p id="detp">details body</p></details>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 120 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);

const sum = await page.$eval('#sum', (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
console.log('sum rect', JSON.stringify(sum));

const frags = await page.evaluate(() => {
  const el = document.getElementById('sum');
  const range = document.createRange();
  range.selectNodeContents(el);
  const out = [];
  for (const r of range.getClientRects()) out.push({ x: r.x, y: r.y, width: r.width, height: r.height });
  return out;
});
console.log('sum text frags', JSON.stringify(frags));

const shot = await page.screenshot();
const img = decodePng(shot);
const { width, height } = img;

const x0 = 0, y0 = Math.floor(sum.y) - 1, x1 = 30, y1 = Math.floor(sum.y + sum.height) + 2;
for (let y = y0; y < y1; y++) {
  let row = '';
  for (let x = x0; x < x1; x++) {
    const o = (y * width + x) * 4;
    const [r, g, b] = [img.data[o], img.data[o+1], img.data[o+2]];
    const lum = 0.299*r + 0.587*g + 0.114*b;
    row += lum < 100 ? '#' : lum < 200 ? '+' : '.';
  }
  console.log(String(y).padStart(3), row);
}

// exact pixel values in the triangle box
const xs = 0, ys = Math.floor(sum.y);
for (let y = ys; y < ys + 18; y++) {
  let row = [];
  for (let x = xs; x < xs + 14; x++) {
    const o = (y * width + x) * 4;
    row.push(`(${img.data[o]},${img.data[o+1]},${img.data[o+2]})`);
  }
  console.log('pix y=' + y, row.join(' '));
}

await browser.close();