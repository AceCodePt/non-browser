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
  const text = {};
  for (const id of ids.filter((x) => x.startsWith('t'))) {
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

await probe('shrink-two-multi',
  `${H}<table style="width:150px;border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0">longer text here</td><td id="b" style="padding:0">more words here too</td></tr></table></body></html>`,
  ['a','b']);

await probe('css-anon',
  `${H}<div id="t" style="display:table;border-collapse:separate;border-spacing:0"><div id="r1" style="display:table-row"><div id="c1" style="display:table-cell;padding:0">A</div></div><div id="stray" style="display:block">stray block</div><div id="r2" style="display:table-row"><div id="c2" style="display:table-cell;padding:0">B</div></div></div></body></html>`,
  ['t','r1','c1','stray','r2','c2']);

await probe('css-anon-text',
  `${H}<div id="t" style="display:table;border-collapse:separate;border-spacing:0"><div id="r1" style="display:table-row"><div id="c1" style="display:table-cell;padding:0">A</div></div>straytext<div id="r2" style="display:table-row"><div id="c2" style="display:table-cell;padding:0">B</div></div></div></body></html>`,
  ['t','r1','c1','r2','c2']);

await probe('rowspan',
  `${H}<table style="border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0" rowspan="2">A<br>B<br>C</td><td id="b" style="padding:0">B</td></tr><tr><td id="c" style="padding:0">C</td></tr></table></body></html>`,
  ['a','b','c']);

await probe('rowspan-tall',
  `${H}<table style="border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0;height:90px" rowspan="2">A</td><td id="b" style="padding:0;height:10px">B</td></tr><tr><td id="c" style="padding:0;height:10px">C</td></tr></table></body></html>`,
  ['a','b','c']);

await probe('valign-mid',
  `${H}<table style="border-collapse:separate;border-spacing:0"><tr style="height:60px"><td id="a" style="padding:0">text</td></tr></table></body></html>`,
  ['a']);

await probe('fixed-less-content',
  `${H}<table style="width:200px;border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0;width:20px">BBBB</td><td id="b" style="padding:0">C</td></tr></table></body></html>`,
  ['a','b']);

await probe('pct-mix',
  `${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0;width:25%">A</td><td id="b" style="padding:0">BBBB</td></tr></table></body></html>`,
  ['a','b']);

await probe('auto-narrow',
  `${H}<div style="width:100px"><table style="border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0">longer text here</td></tr></table></div></body></html>`,
  ['a']);

await probe('cell-block',
  `${H}<table style="border-collapse:separate;border-spacing:0"><tr><td id="a" style="padding:0"><div id="inner" style="width:120px">block</div></td><td id="b" style="padding:0">B</td></tr></table></body></html>`,
  ['a','inner','b']);

await browser.close();
