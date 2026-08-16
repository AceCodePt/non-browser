import { chromium } from 'playwright';
import { skiaCanvasFactory } from '/home/sagi/stuff/non-browser/pretext-breaker-path/dist/canvas/index.js';
import { installPretextMeasurement, prepareText, layoutLines } from '/home/sagi/stuff/non-browser/pretext-breaker-path/dist/pretext/index.js';
import { getMeasurementCanvas, initMeasurement } from '/home/sagi/stuff/non-browser/pretext-breaker-path/dist/layout/measure.js';
import { setActiveBrowserConfig } from '/home/sagi/stuff/non-browser/pretext-breaker-path/dist/config/browser-config.js';
import { chromeConfig } from '/home/sagi/stuff/non-browser/pretext-breaker-path/dist/config/chrome.js';

setActiveBrowserConfig(chromeConfig);
for (const f of chromeConfig.fonts) {
  try { skiaCanvasFactory.registerFont(f.filePath); } catch {}
}
initMeasurement({ family: chromeConfig.defaultFamily, filePath: chromeConfig.defaultFile }, skiaCanvasFactory);
installPretextMeasurement(getMeasurementCanvas());

const cases = [
  { name: 'long-word-normal', font: "16px 'Noto Sans'", width: 160, text: 'supercalifragilisticexpialidocious phenomenal', ws: 'normal' },
  { name: 'long-word-break-word', font: "16px 'Noto Sans'", width: 160, text: 'supercalifragilisticexpialidocious phenomenal', ws: 'normal', ow: 'break-word' },
  { name: 'latin-multi', font: "16px 'Noto Sans'", width: 300, text: 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.', ws: 'normal' },
  { name: 'cjk', font: "16px 'Droid Sans Fallback'", width: 160, text: '集成电路设计中的关键挑战在于功耗与性能的平衡。', ws: 'normal' },
  { name: 'cjk-2', font: "16px 'Droid Sans Fallback'", width: 160, text: '日本語テキストの折り返しテストです。これは長い文章です。', ws: 'normal' },
  { name: 'hyphen', font: "16px 'Noto Sans'", width: 260, text: 'A well-designed interface is interoperable, cross-Platform, and backward-compatible.', ws: 'normal' },
  { name: 'pre', font: "14px 'Liberation Mono'", width: 200, text: '  alpha   beta\ngamma\ndelta end', ws: 'pre' },
  { name: 'pre-wrap', font: "14px 'Liberation Mono'", width: 200, text: '  alpha   beta gamma\ngamma lineage', ws: 'pre-wrap' },
  { name: 'pre-line', font: "16px 'Noto Sans'", width: 200, text: 'alpha beta gamma\ndelta epsilon zeta eta', ws: 'pre-line' },
  { name: 'nowrap', font: "16px 'Noto Sans'", width: 80, text: 'alpha beta gamma delta', ws: 'nowrap' },
  { name: 'word-break-break-all', font: "16px 'Noto Sans'", width: 120, text: 'supercalifragilisticexpialidocious', ws: 'normal', wb: 'break-all' },
  { name: 'word-break-keep-all', font: "16px 'Droid Sans Fallback'", width: 120, text: '集成电路设计与验证', ws: 'normal', wb: 'keep-all' },
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<script>window.__r={};</script>');

for (const c of cases) {
  const ws = c.ws;
  const extra = [c.ow ? `overflow-wrap:${c.ow}` : '', c.wb ? `word-break:${c.wb}` : ''].filter(Boolean).join(';');
  const family = c.font.split("'")[1];
  const html = `<style>html,body{margin:0;padding:0}</style><div id="t" style="font-family:'${family}';font-size:16px;line-height:24px;width:${c.width}px;white-space:${ws};${extra}">${c.text}</div>`;
  await page.setContent(html);
  const info = await page.evaluate(() => {
    const el = document.getElementById('t');
    const range = document.createRange();
    range.selectNodeContents(el);
    return {
      text: el.textContent,
      frags: [...range.getClientRects()].map((r) => ({ x: r.x, width: r.width, height: r.height })),
    };
  });
  const widths = info.frags.map((f) => f.width);
  const font = c.font;
  const opts = {};
  if (c.ow === 'break-word') opts.overflowWrap = 'break-word';
  if (c.wb) opts.wordBreak = c.wb;
  if (c.ws !== 'normal' && c.ws !== 'pre-wrap') opts.whiteSpace = c.ws;
  else if (c.ws === 'pre-wrap') opts.whiteSpace = 'pre-wrap';
  const p = prepareText(c.text, font, opts);
  const res = layoutLines(p, c.width, 24);
  const pretextLines = res.lines.map((l) => l.text);
  const pretextWidths = res.lines.map((l) => l.width);

  // Greedy wrapper
  const { layoutTextLines } = await import('/home/sagi/stuff/non-browser/pretext-breaker-path/dist/layout/measure.js');
  const g = layoutTextLines({
    text: c.text, x: 0, y: 0, width: c.width, lineHeight: 24, fontSize: 16, family: c.font.split("'")[1], whiteSpace: c.ws,
    available: () => ({ x: 0, width: c.width }),
  });
  const greedyLines = g.lines.map((l) => l.text);
  const greedyWidths = g.lines.map((l) => l.width);

  console.log(`\n=== ${c.name} width=${c.width} ws=${c.ws} ow=${c.ow} wb=${c.wb}`);
  console.log('  chrome   : ' + JSON.stringify(widths.map((w) => w.toFixed(2))));
  console.log('  pretext  : ' + JSON.stringify(pretextWidths.map((w) => w.toFixed(2))));
  console.log('  greedy   : ' + JSON.stringify(greedyWidths.map((w) => w.toFixed(2))));
  console.log('  chrome-l : ' + JSON.stringify(info.frags.map((f) => f.x.toFixed(1))));
  if (pretextLines.length !== widths.length) console.log(`  *** line-count divergence: chrome=${widths.length} pretext=${pretextLines.length} greedy=${greedyLines.length} ***`);
}
await browser.close();