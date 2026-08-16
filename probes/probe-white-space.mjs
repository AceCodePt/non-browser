#!/usr/bin/env node
/**
 * Probe: Chrome's white-space line-box behavior that the engine matches
 * (documented in docs/ledgers/white-space.md). Renders each value and prints
 * the Range.getClientRects() fragments + element rects:
 *   - pre      preserves runs/indent, newlines are forced breaks, trailing
 *              spaces stay in the line box
 *   - nowrap   collapses (newlines become spaces) and never wraps
 *   - pre-wrap preserves spaces and wraps; a wrap point keeps one hung space
 *              (a 3.64px box with no ink) and drops the rest of the run
 *   - pre-line collapses runs but keeps newlines as breaks
 *   - empty segments: a trailing newline's final empty segment is dropped,
 *     interior empty segments are full-height empty line boxes
 */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 500 } });
await page.setContent(`<html><head><style>html,body{margin:0;padding:0}</style></head><body>
<div id="pre" style="font-family:'Noto Sans';font-size:14px;line-height:22px;width:200px;white-space:pre">first  line
   indented  second
third</div>
<div id="nowrap" style="font-family:'Noto Sans';font-size:14px;line-height:22px;width:120px;white-space:nowrap">a very long single line label that overflows the box</div>
<div id="prewrap" style="font-family:'Noto Sans';font-size:14px;line-height:22px;width:150px;white-space:pre-wrap">one   two   three   four five six</div>
<div id="preline" style="font-family:'Noto Sans';font-size:14px;line-height:22px;width:200px;white-space:pre-line">alpha   beta gamma delta epsilon
  zeta   eta</div>
<div id="blank" style="font-family:'Noto Sans';font-size:14px;line-height:22px;width:200px;white-space:pre">

  blank lines above and below

</div>
</body></html>`);
await page.evaluate(() => document.fonts.ready);
for (const id of ['pre', 'nowrap', 'prewrap', 'preline', 'blank']) {
  const info = await page.evaluate((id) => {
    const el = document.getElementById(id);
    const r = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const frags = [...range.getClientRects()].map((f) => ({ x: +f.x.toFixed(2), y: +f.y.toFixed(2), width: +f.width.toFixed(2) }));
    return { rect: { height: +r.height.toFixed(1) }, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, frags, text: JSON.stringify(el.textContent) };
  }, id);
  console.log(`=== ${id} ===`);
  console.log(JSON.stringify(info, null, 1));
}
await browser.close();
