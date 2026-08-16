import { chromium } from 'playwright';
import { renderHtml } from '/home/sagi/stuff/non-browser/pretext-breaker-path/dist/layout/render.js';
import { setActiveBrowserConfig } from '/home/sagi/stuff/non-browser/pretext-breaker-path/dist/config/browser-config.js';
import { chromeConfig } from '/home/sagi/stuff/non-browser/pretext-breaker-path/dist/config/chrome.js';

setActiveBrowserConfig(chromeConfig);
const html = `<html><head><style>html,body{margin:0;padding:0}</style></head><body><div id="t" style="font-family:'Noto Sans';font-size:16px;line-height:24px;width:300px;text-align:left">The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
const chromeFrags = await page.evaluate(() => {
  const el = document.getElementById('t');
  const range = document.createRange();
  range.selectNodeContents(el);
  return [...range.getClientRects()].map((r) => ({ x: r.x, width: r.width }));
});
// measure the stripped text width for line1 in Chrome
const strippedL1 = await page.evaluate(() => {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = "16px 'Noto Sans'";
  return { full: ctx.measureText('The quick brown fox jumps over the ').width, stripped: ctx.measureText('The quick brown fox jumps over the').width, space: ctx.measureText(' ').width };
});
await browser.close();

const out = renderHtml(html, { width: 460, height: 160, fontFamily: 'Noto Sans', fontFile: '/usr/share/fonts/google-noto/NotoSans-Regular.ttf', textElements: ['t'] });
console.log('chrome frags:', chromeFrags.map((f) => f.width.toFixed(2)));
console.log('measureText full="...the " =', strippedL1.full.toFixed(3), ' stripped="...the" =', strippedL1.stripped.toFixed(3), ' space =', strippedL1.space.toFixed(3));
console.log('engine textFragments:', out.textFragments['t'].map((f) => ({ x: f.x.toFixed(2), width: f.width.toFixed(2) })));