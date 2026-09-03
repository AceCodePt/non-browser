#!/usr/bin/env node
// Dev parity loop: engine rects vs Chrome getBoundingClientRect for the table
// behaviors probed earlier. Reports per-case worst |dx|/|dy|/|dw|/|dh|.
import { chromium } from 'playwright';
import { renderHtml } from '../dist/layout/render.js';

const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';

const H = '<style>html,body{margin:0;padding:0;font-family:\'Noto Sans\';font-size:16px}</style>';
const S = 'border-collapse:separate;border-spacing:0';

const cases = {
  'auto-shrink': `<div id=a style="display:inline-block">${H}<table style="${S}"><tr><td style="padding:0">AAA</td><td style="padding:0">BBBB</td></tr></table></div>`,
  'auto-dist-300': `${H}<table id=t style="${S};width:300px"><tr><td id=c1 style="padding:0">A</td><td id=c2 style="padding:0">BBBB</td><td id=c3 style="padding:0">CC</td></tr></table>`,
  'auto-fullwidth': `${H}<table id=t style="${S}"><tr><td id=c1 style="padding:0">A</td><td id=c2 style="padding:0">BBBB</td></tr></table>`,
  'fixed-two-spec': `${H}<table id=t style="${S};table-layout:fixed;width:100px"><tr><td id=c1 style="padding:0;width:50px">A</td><td id=c2 style="padding:0;width:80px">B</td></tr></table>`,
  'fixed-under': `${H}<table id=t style="${S};table-layout:fixed;width:300px"><tr><td id=c1 style="padding:0;width:100px">A</td><td id=c2 style="padding:0;width:100px">B</td></tr></table>`,
  'fixed-autos': `${H}<table id=t style="${S};table-layout:fixed;width:100px"><tr><td id=c1 style="padding:0">A</td><td id=c2 style="padding:0">B</td><td id=c3 style="padding:0">C</td></tr></table>`,
  'fixed-cols': `${H}<table id=t style="${S};table-layout:fixed;width:300px"><col style="width:180px"><col style="width:120px"><tr><td id=c1 style="padding:0;width:20px">A</td><td id=c2 style="padding:0;width:30px">B</td></tr></table>`,
  'fixed-nowrap': `${H}<table id=t style="${S};table-layout:fixed;width:100px"><tr><td id=c1 style="padding:0">AAAAAAAAAAAAAAAAAAAA</td><td id=c2 style="padding:0">B</td></tr></table>`,
  'colspan-dist': `${H}<table id=t style="${S};width:300px"><tr><td id=c1 colspan="2" style="padding:0">AB</td></tr><tr><td id=c2 style="padding:0">A</td><td id=c3 style="padding:0">BBBB</td></tr></table>`,
  'rowspan-A': `${H}<table style="${S}"><tr><td id=c0 rowspan="3" style="padding:0">A<br>B<br>C<br>D<br>E<br>F</td><td id=r0 style="padding:0">one</td></tr><tr><td id=r1 style="padding:0">two</td></tr><tr><td id=r2 style="padding:0">three</td></tr></table>`,
  'rowspan-B': `${H}<table style="${S}"><tr><td id=c0 rowspan="2" style="padding:0">A<br>B<br>C<br>D<br>E<br>F</td><td id=r0 style="padding:0">one</td></tr><tr><td id=r1 rowspan="2" style="padding:0">x<br>y</td></tr><tr><td id=r2 style="padding:0">three</td></tr></table>`,
  'spacing': `${H}<table id=t style="border-spacing:5px"><tr><td id=c1 style="padding:0;width:40px">A</td><td id=c2 style="padding:0;width:60px">B</td></tr><tr><td id=r1 style="padding:0">two</td></tr></table>`,
  'caption': `${H}<table id=t style="${S}"><caption id=cap>Caption text</caption><tr><td id=c1 style="padding:0">A</td></tr></table>`,
  'caption-bottom-margin': `${H}<table id=t style="${S}"><caption id=cap style="caption-side:bottom;margin:10px 4px">Cap</caption><tr><td id=c1 style="padding:0">A</td></tr></table>`,
  'table-center': `${H}<table id=t style="${S};width:100px;margin:0 auto"><tr><td id=c1 style="padding:0;width:40px">A</td></tr></table>`,
  'valign-mid': `${H}<table id=t style="${S};width:100px;height:100px"><tr><td id=c1 style="padding:0">A</td></tr></table>`,
  'valign-baseline': `${H}<table id=t style="${S}"><tr><td id=c1 style="padding:0;font-size:32px">big</td><td id=c2 style="padding:0;vertical-align:baseline">small</td></tr></table>`,
  'hoist': `${H}<table id=t>stray<div>hoisted block</div><tr><td id=c1 style="padding:0">A</td></tr></table>`,
  'anon-cell': `${H}<div id=t style="display:table;border-spacing:0">stray text<div style="display:table-row"><div id=c1 style="display:table-cell">cell</div></div></div>`,
  'anon-row': `${H}<table id=t style="${S}"><td id=c1 style="padding:0">direct</td></table>`,
  'empty-hide': `${H}<table id=t style="${S};empty-cells:hide"><tr><td id=c1 style="border:3px solid red;background:lime">A</td><td id=c2 style="border:3px solid red;background:lime"></td></tr></table>`,
  'nested-table': `${H}<table id=t style="${S};width:200px"><tr><td id=c1 style="padding:0"><table style="${S}"><tr><td style="padding:0">inner</td></tr></table></td></tr></table>`,
  'inline-table': `${H}<div>before<table id=t style="${S};display:inline-table;vertical-align:baseline"><tr><td id=c1 style="padding:0">cell</td></tr></table>after</div>`,
  'th-defaults': `${H}<table style="${S}"><tr><th id=c1>Head</th></tr></table>`,
  'min-width-cell': `${H}<table id=t style="${S};width:50px"><tr><td id=c1 style="padding:0;min-width:100px">A</td></tr></table>`,
  'pct-cell': `${H}<table id=t style="${S};width:200px"><tr><td id=c1 style="padding:0;width:50%">A</td><td id=c2 style="padding:0">B</td></tr></table>`,
};

const IDS = Object.values(cases).join('|');
const ids = [...new Set([...IDS.matchAll(/id=([a-zA-Z0-9]+)/g)].map((m) => m[1]))];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

let worst = 0;
let worstCase = '';
for (const [name, html] of Object.entries(cases)) {
  const full = `<!doctype html><html><head><meta charset="utf-8">${H}</head><body>${html}</body></html>`;
  await page.setContent(full);
  await page.evaluate(() => document.fonts.ready);
  const chrome = await page.evaluate((sel) => {
    const out = {};
    for (const id of sel) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      out[id] = { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) };
    }
    return out;
  }, ids);
  const eng = renderHtml(full, { width: 800, height: 600, fontFamily: FONT_FAMILY, fontFile: FONT_FILE });
  const diffs = [];
  for (const [id, r] of Object.entries(chrome)) {
    const c = eng.rects[id];
    if (!c) {
      diffs.push(`${id}: MISSING`);
      continue;
    }
    const d = Math.max(Math.abs(c.x - r.x), Math.abs(c.y - r.y), Math.abs(c.width - r.w), Math.abs(c.height - r.h));
    if (d > 0.5) diffs.push(`${id}: d=${d.toFixed(2)} eng=(${c.x.toFixed(1)},${c.y.toFixed(1)},${c.width.toFixed(1)},${c.height.toFixed(1)}) chrome=(${r.x},${r.y},${r.w},${r.h})`);
    if (d > worst) {
      worst = d;
      worstCase = `${name}/${id}`;
    }
  }
  console.log(diffs.length === 0 ? `PASS ${name}` : `FAIL ${name}\n  ${diffs.join('\n  ')}`);
}
await browser.close();
console.log(`\nworst: ${worst.toFixed(2)} @ ${worstCase}`);
