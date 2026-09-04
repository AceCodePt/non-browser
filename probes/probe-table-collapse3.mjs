#!/usr/bin/env node
// Dev probe 3: isolate the hidden-border width anomaly (case 6 gave +2/+2
// insets on hidden-won edges; case 7 gave 0). Vary one ingredient at a time.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 900 } });
const H = "<html><head><style>html,body{margin:0;padding:0;font-family:'Noto Sans';font-size:16px}</style></head><body>";

async function probe(name, html, ids) {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const rects = {};
  for (const id of ids) {
    rects[id] = await page.$eval(`#${id}`, (el) => {
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(3), y: +r.y.toFixed(3), width: +r.width.toFixed(3), height: +r.height.toFixed(3) };
    });
  }
  console.log(`${name}: ${JSON.stringify(rects)}`);
}

const cell = (id, style, text) => `<td id="${id}" style="width:100px;height:30px;padding:10px;background:#ffffff;${style}">${text}</td>`;

// V1 = original case 6: a hidden-all, b solid-all, c none-all, d solid-all, table green 4.
await probe('V1-full', `${H}<table id="t" style="border-collapse:collapse;border:4px solid #00aa00"><tr>${cell('a', 'border:4px hidden #ff0000', 'A')}${cell('b', 'border:4px solid #0000ff', 'B')}</tr><tr>${cell('c', 'border:4px none #ff0000', 'C')}${cell('d', 'border:4px solid #0000ff', 'D')}</tr></table></body></html>`, ['t', 'a', 'b', 'c', 'd']);

// V2: no table border.
await probe('V2-notable', `${H}<table id="t" style="border-collapse:collapse"><tr>${cell('a', 'border:4px hidden #ff0000', 'A')}${cell('b', 'border:4px solid #0000ff', 'B')}</tr><tr>${cell('c', 'border:4px none #ff0000', 'C')}${cell('d', 'border:4px solid #0000ff', 'D')}</tr></table></body></html>`, ['t', 'a', 'b', 'c', 'd']);

// V3: one row only (a hidden-all, b solid-all).
await probe('V3-onerow', `${H}<table id="t" style="border-collapse:collapse;border:4px solid #00aa00"><tr>${cell('a', 'border:4px hidden #ff0000', 'A')}${cell('b', 'border:4px solid #0000ff', 'B')}</tr></table></body></html>`, ['t', 'a', 'b']);

// V4: a hidden-right only (not all sides), rest as V1.
await probe('V4-a-right-hidden', `${H}<table id="t" style="border-collapse:collapse;border:4px solid #00aa00"><tr>${cell('a', 'border-right:4px hidden #ff0000', 'A')}${cell('b', 'border:4px solid #0000ff', 'B')}</tr><tr>${cell('c', 'border:4px none #ff0000', 'C')}${cell('d', 'border:4px solid #0000ff', 'D')}</tr></table></body></html>`, ['t', 'a', 'b', 'c', 'd']);

// V5: both cells hidden (no solid, no table border).
await probe('V5-both-hidden', `${H}<table id="t" style="border-collapse:collapse"><tr>${cell('a', 'border:4px hidden #ff0000', 'A')}${cell('b', 'border:4px hidden #0000ff', 'B')}</tr></table></body></html>`, ['t', 'a', 'b']);

// V6: a hidden-all, b solid-left-only, one row, no table border.
await probe('V6-b-left-only', `${H}<table id="t" style="border-collapse:collapse"><tr>${cell('a', 'border:4px hidden #ff0000', 'A')}${cell('b', 'border-left:4px solid #0000ff', 'B')}</tr></table></body></html>`, ['t', 'a', 'b']);

// V7: V1 but c/d solid too (no none cell).
await probe('V7-cd-solid', `${H}<table id="t" style="border-collapse:collapse;border:4px solid #00aa00"><tr>${cell('a', 'border:4px hidden #ff0000', 'A')}${cell('b', 'border:4px solid #0000ff', 'B')}</tr><tr>${cell('c', 'border:4px solid #00ff00', 'C')}${cell('d', 'border:4px solid #0000ff', 'D')}</tr></table></body></html>`, ['t', 'a', 'b', 'c', 'd']);

// V8: single cell hidden-all + table green 4 (isolate table-vs-hidden outer edge).
await probe('V8-one-hidden-cell-table', `${H}<table id="t" style="border-collapse:collapse;border:4px solid #00aa00"><tr>${cell('a', 'border:4px hidden #ff0000', 'A')}</tr></table></body></html>`, ['t', 'a']);

// V9: single cell hidden-all, no table border (baseline: expect 120).
await probe('V9-one-hidden-cell', `${H}<table id="t" style="border-collapse:collapse"><tr>${cell('a', 'border:4px hidden #ff0000', 'A')}</tr></table></body></html>`, ['t', 'a']);

// V10: single cell solid-all + table green 4 (baseline +2s).
await probe('V10-one-solid-cell-table', `${H}<table id="t" style="border-collapse:collapse;border:4px solid #00aa00"><tr>${cell('a', 'border:4px solid #ff0000', 'A')}</tr></table></body></html>`, ['t', 'a']);

// V11: computed style for hidden border width.
await page.setContent(`${H}<div id="h" style="border:4px hidden #ff0000;display:inline-block"></div></body></html>`);
const cs = await page.evaluate(() => {
  const s = getComputedStyle(document.getElementById('h'));
  return { width: s.borderTopWidth, style: s.borderTopStyle };
});
console.log(`V11-computed-hidden: ${JSON.stringify(cs)}`);

await browser.close();
