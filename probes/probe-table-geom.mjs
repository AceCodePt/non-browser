#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch();

async function probe(name, html, ids) {
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const rects = {};
  for (const id of ids) {
    rects[id] = await page.$eval(`#${id}`, (el) => {
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(4), y: +r.y.toFixed(4), width: +r.width.toFixed(4), height: +r.height.toFixed(4) };
    });
  }
  console.log(`=== ${name} ===`);
  console.log(JSON.stringify(rects, null, 1));
  await page.close();
}

const H = '<html><head><style>html,body{margin:0;padding:0}</style></head><body>';

await probe('row-heights',
  `${H}<table id="t" style="border-collapse:separate;border-spacing:0"><tr id="r1"><td id="a" style="padding:0;height:30px">A</td><td id="b" style="padding:0">B long text here</td></tr><tr id="r2"><td id="c" style="padding:0">C</td><td id="d" style="padding:0;height:50px">D</td></tr></table></body></html>`,
  ['t','r1','a','b','r2','c','d']);

await probe('table-width',
  `${H}<table id="t" style="width:300px;border-collapse:separate;border-spacing:0"><tr id="r1"><td id="a" style="padding:0">A</td><td id="b" style="padding:0">BBBB</td><td id="c" style="padding:0">C</td></tr></table></body></html>`,
  ['t','r1','a','b','c']);

await probe('percent-cols',
  `${H}<table id="t" style="width:300px;border-collapse:separate;border-spacing:0"><tr id="r1"><td id="a" style="padding:0;width:25%">A</td><td id="b" style="padding:0;width:75%">B</td></tr></table></body></html>`,
  ['t','r1','a','b']);

await probe('colspan',
  `${H}<table id="t" style="border-collapse:separate;border-spacing:0"><tr id="r1"><td id="a" style="padding:0">A</td><td id="b" style="padding:0">BBBB</td></tr><tr id="r2"><td id="c" colspan="2" style="padding:0">CCCCCCCCCC</td></tr></table></body></html>`,
  ['t','r1','a','b','r2','c']);

await probe('border-collapse',
  `${H}<table id="t" style="border-collapse:collapse;border:1px solid #000"><tr id="r1"><td id="a" style="padding:0;border:1px solid #f00;width:60px">A</td><td id="b" style="padding:0;border:1px solid #00f">B</td></tr><tr id="r2"><td id="c" style="padding:0;border:1px solid #0f0">C</td><td id="d" style="padding:0;border:1px solid #000">D</td></tr></table></body></html>`,
  ['t','r1','a','b','r2','c','d']);

await probe('anonymous',
  `${H}<table id="t" style="border-collapse:separate;border-spacing:0"><tr id="r1"><td id="a" style="padding:0">A</td></tr>stray text<tr id="r2"><td id="b" style="padding:0">B</td></tr></table></body></html>`,
  ['t','r1','a','r2','b']);

await probe('valign',
  `${H}<table id="t" style="border-collapse:separate;border-spacing:0"><tr id="r1" style="height:60px"><td id="a" style="padding:0;vertical-align:middle">A</td><td id="b" style="padding:0;vertical-align:top">B</td><td id="c" style="padding:0;vertical-align:bottom">C</td></tr></table></body></html>`,
  ['t','r1','a','b','c']);

await probe('caption',
  `${H}<table id="t" style="border-collapse:separate;border-spacing:0"><caption id="cap">Cap</caption><tr id="r1"><td id="a" style="padding:0">A</td></tr></table></body></html>`,
  ['t','cap','r1','a']);

await probe('colspan-shrink',
  `${H}<table id="t" style="width:120px;border-collapse:separate;border-spacing:0"><tr id="r1"><td id="a" style="padding:0;width:20px">A</td><td id="b" style="padding:0;width:20px">B</td></tr><tr id="r2"><td id="c" colspan="2" style="padding:0">CCCCCCCCCCCCCCCCCCCC</td></tr></table></body></html>`,
  ['t','r1','a','b','r2','c']);

await browser.close();
