#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
const H = '<html><head><style>html,body{margin:0;padding:0;font-family:\'Noto Sans\';font-size:16px}</style></head><body>';

async function probe(name, html, ids) {
  await page.setContent(html);
  const rects = {};
  for (const id of ids) {
    rects[id] = await page.$eval(`#${id}`, (el) => {
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(3), y: +r.y.toFixed(3), width: +r.width.toFixed(3), height: +r.height.toFixed(3) };
    });
  }
  console.log(`=== ${name} ===`);
  console.log(JSON.stringify(rects, null, 1));
}

// thick collapse borders: table border 3, cell borders 2
await probe('collapse-thick',
  `${H}<table id="t" style="border-collapse:collapse;border:3px solid #000;border-spacing:0"><tr><td id="a" style="padding:0;border:2px solid #f00;width:40px">A</td><td id="b" style="padding:0;border:2px solid #00f">B</td></tr></table></body></html>`,
  ['t','a','b']);

// collapse: cell border only on some sides
await probe('collapse-asym',
  `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="padding:0;border:2px solid #f00;width:30px">A</td><td id="b" style="padding:0;border:0">B</td></tr></table></body></html>`,
  ['t','a','b']);

// rowspan: spanning cell taller than rows sum
await probe('rowspan-overflow',
  `${H}<table style="border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0;height:90px" rowspan="2">A</td><td id="b" style="padding:0;height:10px"></td></tr><tr><td id="c" style="padding:0;height:50px"></td></tr></table></body></html>`,
  ['a','b','c']);

// colspan min-content with unequal min/max columns
await probe('colspan-min-uneq',
  `${H}<table style="width:80px;border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0">longer text here</td><td id="b" style="padding:0">BB</td></tr><tr><td id="c" colspan="2" style="padding:0">longer text here</td></tr></table></body></html>`,
  ['a','b','c']);

// table margin
await probe('table-margin',
  `${H}<table id="t" style="margin:5px 7px;border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0">A</td></tr></table></body></html>`,
  ['t','a']);

// collapse: row height driven by padding
await probe('collapse-pad',
  `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="padding:5px;border:1px solid #000">A</td></tr></table></body></html>`,
  ['t','a']);

// nested table
await probe('nested',
  `${H}<table id="t" style="border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0">Outer<table id="inner" style="border-collapse:separate;border-spacing:0"><tr><td id="x" style="padding:0">IN</td></tr></table></td></tr></table></body></html>`,
  ['t','a','inner','x']);

await browser.close();
