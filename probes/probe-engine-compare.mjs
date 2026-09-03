#!/usr/bin/env node
import { renderHtml, computedStylesOf, rectsOf } from '../dist/layout/render.js';
import { chromeConfig } from '../dist/config/index.js';
import { chromium } from 'playwright';

const html = `<html><head><style>html,body{margin:0;padding:0;font-family:'Noto Sans'}</style></head><body>
<p id="p">Text with <mark id="mark">mark</mark> and <del id="del">deleted</del> and <ins id="ins">inserted</ins> and <s id="s">struck</s> and <small id="small">small</small> and x<sub id="sub">sub</sub>y<sup id="sup">sup</sup>z and <abbr id="abbr">abbr</abbr> and <q id="q">quoted</q>.</p>
<fieldset id="fs"><legend id="leg">Legend</legend><p id="fsp">field body</p></fieldset>
<details id="det"><summary id="sum">Summary</summary><p id="detp">details body</p></details>
</body></html>`;

const ids = ['p', 'mark', 'del', 'ins', 's', 'small', 'sub', 'sup', 'abbr', 'q', 'fs', 'leg', 'fsp', 'det', 'sum', 'detp'];
const props = ['display', 'font-size', 'font-weight', 'font-style', 'text-decoration-line', 'background-color', 'color', 'vertical-align', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right', 'border-top-width', 'border-top-style', 'border-top-color', 'border-bottom-width', 'line-height'];

const out = renderHtml(html, {
  width: 700,
  height: 400,
  fontFamily: chromeConfig.defaultFamily,
  fontFile: chromeConfig.defaultFile,
  browserConfig: chromeConfig,
  computedStyle: ids.map((id) => ({ id, props })),
});
const rects = rectsOf(html, {
  width: 700, height: 400,
  fontFamily: chromeConfig.defaultFamily,
  fontFile: chromeConfig.defaultFile,
  browserConfig: chromeConfig,
}).rects;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 400 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
for (const id of ids) {
  const ref = await page.evaluate(({ id, props }) => {
    const cs = getComputedStyle(document.getElementById(id));
    const o = {};
    for (const p of props) o[p] = cs.getPropertyValue(p);
    return o;
  }, { id, props });
  const cand = out.computedStyles[id];
  const mism = [];
  for (const p of props) if ((cand[p] ?? '(null)') !== (ref[p] ?? '(null)')) mism.push(`${p}: cand=${cand[p] ?? '(null)'} ref=${ref[p] ?? '(null)'}`);
  const rr = await page.$eval(`#${id}`, (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  const cr = rects[id];
  const rd = ['x', 'y', 'width', 'height'].filter((k) => Math.abs(cr[k] - rr[k]) > 0.51).map((k) => `${k}: cand=${cr[k].toFixed(3)} ref=${rr[k].toFixed(3)}`);
  console.log(`== ${id}`);
  if (mism.length) console.log('  computed MISMATCH:', mism.join(' | '));
  if (rd.length) console.log('  rect MISMATCH:', rd.join(' | '));
  if (!mism.length && !rd.length) console.log('  OK');
}
await browser.close();