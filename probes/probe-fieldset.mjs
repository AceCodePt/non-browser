#!/usr/bin/env node
import { chromium } from 'playwright';

const html = `<html><head><style>html,body{margin:0;padding:0;font-family:'Noto Sans'}</style></head><body>
<fieldset id="fs1" style="margin:0"><legend id="l1">L</legend><p id="p1">content</p></fieldset>
<fieldset id="fs2" style="margin:0;border-top-width:30px"><legend id="l2">LL</legend><p id="p2">content</p></fieldset>
<fieldset id="fs3" style="margin:0"><p id="p3">no legend</p></fieldset>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);

const ids = ['fs1', 'l1', 'p1', 'fs2', 'l2', 'p2', 'fs3', 'p3'];
const rects = {};
for (const id of ids) {
  rects[id] = await page.$eval(`#${id}`, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}
console.log(JSON.stringify(rects, null, 2));
await browser.close();