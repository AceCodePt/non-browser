import { chromium } from 'playwright';

const cases = [
  { html: `<div id="t" style="font-family:'Noto Sans';font-size:16px;line-height:24px;width:300px;text-align:right">The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.</div>` },
  { html: `<div id="t" style="font-family:'Noto Sans';font-size:16px;line-height:24px;width:300px;text-align:center">The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.</div>` },
  { html: `<div id="t" style="font-family:'Noto Sans';font-size:16px;line-height:24px;width:300px;text-align:justify">The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.</div>` },
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const c of cases) {
  await page.setContent(c.html);
  const info = await page.evaluate(() => {
    const el = document.getElementById('t');
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].map((r) => ({ x: r.x, width: r.width }));
    const cs = getComputedStyle(el);
    return { rects, w: el.clientWidth };
  });
  console.log('align ' + (c.html.match(/text-align:(\w+)/)[1]) + ' clientWidth=' + info.w);
  for (const r of info.rects) console.log(`   x=${r.x.toFixed(2)} w=${r.width.toFixed(2)}`);
}
await browser.close();