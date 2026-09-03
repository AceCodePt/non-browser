#!/usr/bin/env node
import { chromium } from 'playwright';

const html = `<html><head><style>html,body{margin:0;padding:0;font-family:'Noto Sans'}</style></head><body>
<p id="p">Text with <mark id="mark">mark</mark> and <del id="del">deleted</del> and <ins id="ins">inserted</ins> and <s id="s">struck</s> and <small id="small">small</small> and x<sub id="sub">sub</sub>y<sup id="sup">sup</sup>z and <abbr id="abbr" title="t">abbr</abbr> and <q id="q">quoted</q>.</p>
<fieldset id="fs"><legend id="leg">Legend</legend><p id="fsp">field body</p></fieldset>
<details id="det"><summary id="sum">Summary</summary><p id="detp">details body</p></details>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 400 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);

const ids = ['p', 'mark', 'del', 'ins', 's', 'small', 'sub', 'sup', 'abbr', 'q', 'fs', 'leg', 'fsp', 'det', 'sum', 'detp'];
const props = ['display', 'font-size', 'font-weight', 'font-style', 'font-family', 'text-decoration-line', 'text-decoration-style', 'text-decoration-color', 'text-decoration-thickness', 'background-color', 'color', 'vertical-align', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right', 'border-top-width', 'border-top-style', 'border-top-color', 'border-bottom-width', 'line-height'];

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

// summary marker presence
console.log('summaryMarker', await page.evaluate(() => {
  const s = document.getElementById('sum');
  const p = getComputedStyle(s, '::marker');
  return { content: p.content, display: p.display };
}));

// rect of the summary triangle? try marker box
console.log('summaryTriRect', await page.evaluate(() => {
  const s = document.getElementById('sum');
  const m = document.createElement('div');
  // no direct API; report the ::marker computed only
  return null;
}));

await browser.close();