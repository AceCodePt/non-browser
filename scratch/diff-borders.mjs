import { chromium } from 'playwright';
import { decodePng, encodePng } from '../dist/harness/png.js';
import { renderHtml } from '../dist/layout/render.js';
import { writeFileSync } from 'node:fs';

const FONT_FILE = '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = 'Noto Sans';

function deltaE(a, b) {
  // simple lab-ish deltaE via the harness would be better; use per-channel max diff proxy first
  let worst = 0;
  let count = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    if (d > worst) worst = d;
    if (d > 2) count++;
  }
  return { worst, exceeding: count / (a.length / 4) };
}

const cases = process.argv[2] ?? 'straight';
const boxDefs = {
  straight: [
    ['dash1', 'border:1px dashed #000'],
    ['dash2', 'border:2px dashed #000'],
    ['dash3', 'border:3px dashed #000'],
    ['dash4', 'border:4px dashed #000'],
    ['dash8', 'border:8px dashed #000'],
    ['dot1', 'border:1px dotted #000'],
    ['dot2', 'border:2px dotted #000'],
    ['dot3', 'border:3px dotted #000'],
    ['dot4', 'border:4px dotted #000'],
    ['dot6', 'border:6px dotted #000'],
    ['dbl4', 'border:4px double #000'],
    ['dbl7', 'border:7px double #000'],
    ['gro3', 'border:3px groove #808080'],
    ['gro6', 'border:6px groove #808080'],
    ['rid3', 'border:3px ridge #808080'],
    ['rid6', 'border:6px ridge #808080'],
    ['groP', 'border:6px groove #663399'],
    ['ridP', 'border:6px ridge #663399'],
    ['ins4', 'border:4px inset #808080'],
    ['out4', 'border:4px outset #808080'],
    ['insB', 'border:4px inset #000'],
    ['mixA', 'border-style:dashed dotted double groove;border-width:5px;border-color:#000'],
    ['hid', 'border:4px hidden #000'],
  ],
  rounded: [
    ['dashR2', 'border:2px dashed #000;border-radius:20px'],
    ['dashR4', 'border:4px dashed #000;border-radius:24px'],
    ['dashR6', 'border:6px dashed #000;border-radius:24px'],
    ['dotR2', 'border:2px dotted #000;border-radius:16px'],
    ['dotR6', 'border:6px dotted #000;border-radius:24px'],
    ['dblR4', 'border:4px double #000;border-radius:18px'],
    ['dblR6', 'border:6px double #000;border-radius:24px'],
    ['groR6', 'border:6px groove #808080;border-radius:20px'],
    ['ridR6', 'border:6px ridge #808080;border-radius:20px'],
    ['groRP', 'border:6px groove #663399;border-radius:20px'],
    ['dashR10', 'border:10px dashed #000;border-radius:22px'],
  ],
};

const defs = boxDefs[cases];
const html = `<!doctype html><html><head><style>
html,body{margin:0;padding:0;background:#fff}
div{position:absolute;left:20px;width:180px;height:80px}
</style></head><body>
${defs.map(([id, style], i) => `<div id="${id}" style="${style};top:${i * 100}px"></div>`).join('\n')}
</body></html>`;

const W = 240;
const H = defs.length * 100 + 20;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(html);
const shot = decodePng(await page.screenshot());
await browser.close();

const out = renderHtml(html, { width: W, height: H, fontFamily: FONT_FAMILY, fontFile: FONT_FILE });
const cand = decodePng(out.rgba);

writeFileSync(`scratch/ref-${cases}.png`, encodePng(shot.width, shot.height, shot.data));
writeFileSync(`scratch/cand-${cases}.png`, encodePng(cand.width, cand.height, cand.data));

console.log(`size: ref ${shot.width}x${shot.height} cand ${cand.width}x${cand.height}`);
const { worst, exceeding } = deltaE(shot.data, cand.data);
console.log(`straight-channel diff: worst=${worst} exceeding=${(exceeding * 100).toFixed(3)}%`);

// per-element diff: report worst row/col region
for (const [id] of defs) {
  const idx = defs.findIndex(([i]) => i === id);
  const y0 = idx * 100;
  let worstLocal = 0;
  let nLocal = 0;
  for (let y = y0; y < y0 + 100 && y < shot.height; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * shot.width + x) * 4;
      const d = Math.max(Math.abs(shot.data[o] - cand.data[o]), Math.abs(shot.data[o + 1] - cand.data[o + 1]), Math.abs(shot.data[o + 2] - cand.data[o + 2]));
      if (d > worstLocal) worstLocal = d;
      if (d > 2) nLocal++;
    }
  }
  if (worstLocal > 2) console.log(`  ${id}: worst=${worstLocal} exceeding=${nLocal} px`);
}
await browser.close();
