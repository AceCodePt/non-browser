import { chromium } from 'playwright';
import { skiaCanvasFactory } from '/home/sagi/stuff/non-browser/pretext-breaker-path/dist/canvas/index.js';
import { installPretextMeasurement, prepareText, layoutLines } from '/home/sagi/stuff/non-browser/pretext-breaker-path/dist/pretext/index.js';
import { getMeasurementCanvas, initMeasurement, layoutTextLines } from '/home/sagi/stuff/non-browser/pretext-breaker-path/dist/layout/measure.js';
import { setActiveBrowserConfig } from '/home/sagi/stuff/non-browser/pretext-breaker-path/dist/config/browser-config.js';
import { chromeConfig } from '/home/sagi/stuff/non-browser/pretext-breaker-path/dist/config/chrome.js';

setActiveBrowserConfig(chromeConfig);
for (const f of chromeConfig.fonts) {
  try { skiaCanvasFactory.registerFont(f.filePath); } catch {}
}
initMeasurement({ family: chromeConfig.defaultFamily, filePath: chromeConfig.defaultFile }, skiaCanvasFactory);
installPretextMeasurement(getMeasurementCanvas());
const font = "16px 'Noto Sans'";

const cases = [
  ['hello  world foo', 70, 'pre-wrap'],
  ['hello   world foo', 60, 'pre-wrap'],
  ['a  very long sentence that wraps somewhere', 100, 'pre-wrap'],
  ['alpha beta gamma', 100, 'pre-wrap'],
  ['  alpha   beta gamma\ngamma lineage', 200, 'pre-wrap'],
  ['now the quick brown fox jumps over the lazy dog again', 160, 'pre-wrap'],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [text, width, ws] of cases) {
  const html = `<style>html,body{margin:0;padding:0}</style><div id="t" style="font-family:'Noto Sans';font-size:16px;line-height:24px;width:${width}px;white-space:${ws}">${text}</div>`;
  await page.setContent(html);
  const frags = await page.evaluate(() => {
    const el = document.getElementById('t');
    const range = document.createRange();
    range.selectNodeContents(el);
    const byY = {};
    for (const r of range.getClientRects()) {
      const y = Math.round(r.y * 10);
      byY[y] = (byY[y] ?? 0) + r.width;
    }
    return Object.values(byY).map((w) => w);
  });
  const p = prepareText(text, font, { whiteSpace: 'pre-wrap' });
  const res = layoutLines(p, width, 24);
  const g = layoutTextLines({
    text, x: 0, y: 0, width, lineHeight: 24, fontSize: 16, family: 'Noto Sans', whiteSpace: ws,
    available: () => ({ x: 0, width }),
  });
  console.log(`\n=== "${text}" w=${width}`);
  console.log('  chrome  : ' + JSON.stringify(frags.map((w) => w.toFixed(2))));
  console.log('  pretext : ' + res.lines.map((l) => `${l.width.toFixed(2)} ${JSON.stringify(l.text)}`).join(' | '));
  console.log('  greedy  : ' + g.lines.map((l) => `${l.width.toFixed(2)} ${JSON.stringify(l.text)}`).join(' | '));
}
await browser.close();