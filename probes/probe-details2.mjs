#!/usr/bin/env node
import { chromium } from 'playwright';

const html = `<html><head><style>html,body{margin:0;padding:0;font-family:'Noto Sans'}</style></head><body>
<div id="d1" style="line-height:40px">line <mark id="m1">M</mark> end</div>
<div id="d2" style="font-size:24px">a<small id="s1">small</small>b<sub id="s2">sub</sub>c</div>
<div id="d3">x<q id="q1">quoted</q>y</div>
<div id="d4">x<del id="de1">del</del><ins id="in1">ins</ins><s id="st1">s</s>y</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 300 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);

const ids = ['d1', 'm1', 's1', 's2', 'q1', 'de1', 'in1', 'st1'];
const rects = {};
for (const id of ids) {
  rects[id] = await page.$eval(`#${id}`, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}
console.log('rects', JSON.stringify(rects, null, 2));

for (const id of ['m1', 's1', 's2', 'q1']) {
  const cs = await page.evaluate((id) => {
    const el = document.getElementById(id);
    const c = getComputedStyle(el);
    return { fontSize: c.fontSize, lineHeight: c.lineHeight, verticalAlign: c.verticalAlign, display: c.display };
  }, id);
  console.log(id, JSON.stringify(cs));
}

const shot = await page.screenshot();
const { decodePng } = await import('../dist/harness/png.js');
const img = decodePng(shot);
// examine mark bg in d1: line at y0, line-height 40. mark bg region
const m = rects.m1;
for (let y = Math.floor(m.y) - 1; y < Math.floor(m.y + m.height) + 2; y++) {
  let row = [];
  for (let x = Math.floor(m.x); x < Math.floor(m.x + m.width); x++) {
    const o = (y * img.width + x) * 4;
    row.push(`${img.data[o]},${img.data[o+1]},${img.data[o+2]}`);
  }
  console.log('m1 y=' + y, row.join(' '));
}
await browser.close();