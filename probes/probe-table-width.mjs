#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 200 } });
await page.setContent('<body style="margin:0;font-family:\'Noto Sans\';font-size:16px"></body>');
const widths = await page.evaluate(() => {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = "16px 'Noto Sans'";
  const out = {};
  for (const t of ['A', 'B', 'C', 'BBBB', 'CCCCCCCCCC', 'Header', 'Cell one', 'long', 'Name', 'Value', 'Alfa', 'Beta', 'Gamma']) out[t] = ctx.measureText(t).width;
  return out;
});
console.log(JSON.stringify(widths, null, 1));

// Distribution experiment: 3 cols, no widths, table width 300
const H = '<html><head><style>html,body{margin:0;padding:0}</style></head><body>';
await page.setContent(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0">A</td><td style="padding:0">BBBB</td><td style="padding:0">C</td></tr></table></body></html>`);
const r = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('td')];
  return cells.map((c) => { const b = c.getBoundingClientRect(); return +b.width.toFixed(3); });
});
console.log('distribute-300 single-row:', r);

// same but table width auto (should be max-content)
await page.setContent(`${H}<table style="border-collapse:separate;border-spacing:0"><tr><td style="padding:0">A</td><td style="padding:0">BBBB</td><td style="padding:0">C</td></tr></table></body></html>`);
const r2 = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('td')];
  return cells.map((c) => { const b = c.getBoundingClientRect(); return +b.width.toFixed(3); });
});
console.log('auto-width:', r2);

// 4 cols with content widths known, table 400
await page.setContent(`${H}<table style="width:400px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0">A</td><td style="padding:0">BBBB</td><td style="padding:0">CCCCCCCCCC</td><td style="padding:0">long</td></tr></table></body></html>`);
const r3 = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('td')];
  return cells.map((c) => { const b = c.getBoundingClientRect(); return +b.width.toFixed(3); });
});
console.log('distribute-400:', r3);

// table width LESS than sum of content: shrink behavior
await page.setContent(`${H}<table style="width:60px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0">A</td><td style="padding:0">BBBB</td><td style="padding:0">C</td></tr></table></body></html>`);
const r4 = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('td')];
  return cells.map((c) => { const b = c.getBoundingClientRect(); return +b.width.toFixed(3); });
});
console.log('shrink-60:', r4);

// min-content behavior with multiword cell
await page.setContent(`${H}<table style="width:60px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0">A</td><td style="padding:0">longer text here</td><td style="padding:0">C</td></tr></table></body></html>`);
const r5 = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('td')];
  return cells.map((c) => { const b = c.getBoundingClientRect(); return +b.width.toFixed(3); });
});
console.log('mincontent-60:', r5);

await browser.close();
