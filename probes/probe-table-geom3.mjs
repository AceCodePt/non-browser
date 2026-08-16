#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
const H = '<html><head><style>html,body{margin:0;padding:0;font-family:\'Noto Sans\';font-size:16px}</style></head><body>';

async function probe(name, html, ids, textIds = []) {
  await page.setContent(html);
  const rects = {};
  for (const id of ids) {
    rects[id] = await page.$eval(`#${id}`, (el) => {
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(3), y: +r.y.toFixed(3), width: +r.width.toFixed(3), height: +r.height.toFixed(3) };
    });
  }
  const text = {};
  for (const id of textIds) {
    text[id] = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const range = document.createRange();
      range.selectNodeContents(el);
      const out = [];
      for (const r of range.getClientRects()) out.push({ x: +r.x.toFixed(3), y: +r.y.toFixed(3), width: +r.width.toFixed(3), height: +r.height.toFixed(3) });
      return out;
    }, id);
  }
  console.log(`=== ${name} ===`);
  console.log(JSON.stringify(rects, null, 1));
  console.log('text:', JSON.stringify(text));
}

await probe('rowspan-unequal',
  `${H}<table style="border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0" rowspan="2"><br><br></td><td id="b" style="padding:0;height:10px">B</td></tr><tr><td id="c" style="padding:0;height:50px">C</td></tr></table></body></html>`,
  ['a','b','c']);

await probe('colspan-min',
  `${H}<table style="width:80px;border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0">AA</td><td id="b" style="padding:0">BB</td></tr><tr><td id="c" colspan="2" style="padding:0">longer text here</td></tr></table></body></html>`,
  ['a','b','c']);

await probe('textalign-center',
  `${H}<table id="t" style="text-align:center;border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0">A</td></tr></table></body></html>`,
  ['t','a'], ['a']);

await probe('valign-mid-text',
  `${H}<table style="border-collapse:separate;border-spacing:0"><tr style="height:60px"><td id="a" style="padding:0">text</td></tr></table></body></html>`,
  ['a'], ['a']);

await probe('valign-tb',
  `${H}<table style="border-collapse:separate;border-spacing:0"><tr style="height:60px"><td id="a" style="padding:0;vertical-align:top">text</td><td id="b" style="padding:0;vertical-align:bottom">text</td></tr></table></body></html>`,
  ['a','b'], ['a','b']);

await probe('cell-height-mid',
  `${H}<table style="border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0;height:80px">text</td></tr></table></body></html>`,
  ['a'], ['a']);

await probe('separate-border',
  `${H}<table id="t" style="border-collapse:separate;border-spacing:2px;border:1px solid #000"><tr><td id="a" style="padding:0;border:1px solid #f00">A</td><td id="b" style="padding:0;border:1px solid #00f">B</td></tr></table></body></html>`,
  ['t','a','b']);

await probe('collapse-width',
  `${H}<table id="t" style="border-collapse:collapse;border:1px solid #000;width:100px"><tr><td id="a" style="padding:0;border:1px solid #f00;width:40px">A</td><td id="b" style="padding:0;border:1px solid #00f">B</td></tr></table></body></html>`,
  ['t','a','b']);

await browser.close();
