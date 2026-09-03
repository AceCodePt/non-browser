#!/usr/bin/env node
// Fixed-layout column distribution: exact floats, controlled content.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const H = '<style>html,body{margin:0;padding:0;font-family:\'Noto Sans\';font-size:16px}</style>';
const S = 'border-collapse:separate;border-spacing:0;';

async function cols(name, html, sel = 'td') {
  await page.setContent(`<!doctype html><html><head>${H}</head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate((s) => [...document.querySelectorAll(s)].map((el) => { const r = el.getBoundingClientRect(); return [+r.x.toFixed(4), +r.width.toFixed(4)]; }), sel);
  const widths = r.map(([, w]) => w);
  console.log(name, 'x=' + r.map(([x]) => x).join(','), 'w=' + widths.join(','), 'sum=' + widths.reduce((a, b) => a + b, 0).toFixed(4));
}

// identical content, 3 autos, width 100 → assignable 100 (spacing 0)
await cols('same-content', `${H}<table style="${S}table-layout:fixed;width:100px"><tr><td style="padding:0">nn</td><td style="padding:0">nn</td><td style="padding:0">nn</td></tr></table>`);
// identical content, 3 autos, spacing 2 (assignable 94)
await cols('same-content-sp2', `${H}<table style="border-collapse:separate;table-layout:fixed;width:100px"><tr><td style="padding:0">nn</td><td style="padding:0">nn</td><td style="padding:0">nn</td></tr></table>`);
// differing content: n vs nnnn vs nn — is the split content-proportional?
await cols('diff-content', `${H}<table style="${S}table-layout:fixed;width:100px"><tr><td style="padding:0">n</td><td style="padding:0">nnnn</td><td style="padding:0">nn</td></tr></table>`);
// measure content widths
await page.setContent(`<!doctype html><html><head>${H}</head><body></body></html>`);
const cw = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('2d');
  c.font = '16px "Noto Sans"';
  return ['n', 'nn', 'nnnn', 'A', 'B', 'C', 'nnnnnnnn'].map((t) => `${t}=${c.measureText(t).width.toFixed(4)}`);
});
console.log('glyphs', cw.join(' '));
// over-constrained, empty vs content cells
await cols('over-empty', `${H}<table style="${S}table-layout:fixed;width:100px"><tr><td style="padding:0;width:50px"></td><td style="padding:0;width:80px"></td></tr></table>`);
await cols('over-content', `${H}<table style="${S}table-layout:fixed;width:100px"><tr><td style="padding:0;width:50px">nnnnnn</td><td style="padding:0;width:80px">nn</td></tr></table>`);
// over-constrained asymmetric content: wide content in the SMALLER spec cell
await cols('over-cross', `${H}<table style="${S}table-layout:fixed;width:100px"><tr><td style="padding:0;width:50px">nn</td><td style="padding:0;width:80px">nnnnnnnnnnnnnnnn</td></tr></table>`);
// under-constrained + 1 auto
await cols('under-auto', `${H}<table style="${S}table-layout:fixed;width:100px"><tr><td style="padding:0;width:50px">n</td><td style="padding:0">nnnnnnnnnnnnnnnnnnnnnnnnnnnnnn</td></tr></table>`);
await browser.close();
