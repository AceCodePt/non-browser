#!/usr/bin/env node
import { chromium } from 'playwright';

const html = `<html><head><style>html,body{margin:0;padding:0}</style></head><body>
<table id="t"><tr id="r"><th id="th">Header</th><td id="td1">Cell one</td><td id="td2">B</td></tr><tr id="r2"><td id="td3">Row2</td><td id="td4">X</td><td id="td5">Y</td></tr></table>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 200 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);

const ids = ['t', 'r', 'th', 'td1', 'td2', 'td3', 'td4', 'td5'];
const props = ['display', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'vertical-align', 'text-align', 'border-collapse', 'border-spacing', 'font-weight', 'table-layout', 'caption-side', 'empty-cells', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'];

for (const id of ids) {
  const out = await page.evaluate(({ id, props }) => {
    const cs = getComputedStyle(document.getElementById(id));
    const o = {};
    for (const p of props) o[p] = cs.getPropertyValue(p);
    return o;
  }, { id, props });
  console.log(id, JSON.stringify(out));
}

const rects = {};
for (const id of ids) {
  rects[id] = await page.$eval(`#${id}`, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}
console.log('rects', JSON.stringify(rects, null, 2));
await browser.close();
