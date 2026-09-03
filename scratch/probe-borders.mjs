import { chromium } from 'playwright';
import { decodePng } from '../dist/harness/png.js';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
console.log('chrome version:', browser.version());

const html = `<!doctype html><html><head><style>
html,body{margin:0;padding:0;background:#fff}
div{width:120px;height:60px;margin:10px;box-sizing:border-box;position:relative;left:10px;top:0}
</style></head><body>
<div id="hid" style="border:4px hidden #000"></div>
<div id="non" style="border:4px none #000"></div>
<div id="dash1" style="border:1px dashed #000"></div>
<div id="dash2" style="border:2px dashed #000"></div>
<div id="dash3" style="border:3px dashed #000"></div>
<div id="dash4" style="border:4px dashed #000"></div>
<div id="dot1" style="border:1px dotted #000"></div>
<div id="dot2" style="border:2px dotted #000"></div>
<div id="dot3" style="border:3px dotted #000"></div>
<div id="dot4" style="border:4px dotted #000"></div>
<div id="dbl4" style="border:4px double #000"></div>
<div id="dbl7" style="border:7px double #000"></div>
<div id="ins4" style="border:4px inset #808080"></div>
<div id="out4" style="border:4px outset #808080"></div>
<div id="gro6" style="border:6px groove #808080"></div>
<div id="rid6" style="border:6px ridge #808080"></div>
<div id="groB" style="border:6px groove #000"></div>
<div id="groD" style="border:6px groove #663399"></div>
<div id="groR" style="border:6px groove #ff0000"></div>
<div id="groW" style="border:6px groove #ffffff"></div>
<div id="groG" style="border:6px groove #cccccc"></div>
<div id="gro33" style="border:6px groove #333333"></div>
</body></html>`;
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);

const computed = {};
for (const id of ['hid', 'non']) {
  computed[id] = await page.evaluate((i) => {
    const cs = getComputedStyle(document.getElementById(i));
    return {
      w: cs.borderTopWidth,
      s: cs.borderTopStyle,
      rect: JSON.stringify(document.getElementById(i).getBoundingClientRect()),
    };
  }, id);
}
console.log(JSON.stringify(computed, null, 1));

const shot = decodePng(await page.screenshot());
const { width, height, data } = shot;
const px = (x, y) => {
  const o = (y * width + x) * 4;
  return [data[o], data[o + 1], data[o + 2]];
};

// sample vertical strips at element mid-x for edge color profiles, and horizontal strips at mid-y
const ids = ['ins4', 'out4', 'gro6', 'rid6', 'groB', 'groD', 'groR', 'groW', 'groG', 'gro33'];
for (const id of ids) {
  const r = await page.$eval(`#${id}`, (el) => {
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, bw: getComputedStyle(el).borderTopWidth, bs: getComputedStyle(el).borderTopStyle };
  });
  const bw = parseInt(r.bw);
  const midX = Math.round(r.x + r.w / 2);
  const col = [];
  for (let y = 0; y < bw * 2 + 2; y++) col.push(px(midX, Math.round(r.y) + y).join(','));
  const midY = Math.round(r.y + r.h / 2);
  const rowL = [];
  for (let x = 0; x < bw * 2 + 2; x++) rowL.push(px(Math.round(r.x) + x, midY).join(','));
  const rowR = [];
  for (let x = 0; x < bw * 2 + 2; x++) rowR.push(px(Math.round(r.x + r.w) - 1 - x, midY).join(','));
  console.log(`${id} (${r.bs} ${bw}px): top col [${col.join(' ')}]`);
  console.log(`   left row [${rowL.join(' ')}]`);
  console.log(`   right row [${rowR.join(' ')}]`);
}

// dash pattern scan: for dash4, scan along top edge centerline y and record black runs
function runs(id, bw) {
  const r = rectOf[id];
  const y = Math.round(r.y + Math.floor(bw / 2));
  const xs = [];
  for (let x = 0; x < Math.round(r.w); x++) {
    const [rr] = px(Math.round(r.x) + x, y);
    xs.push(rr < 128 ? 1 : 0);
  }
  let out = '';
  let cur = xs[0];
  let n = 0;
  for (const v of xs) {
    if (v === cur) n++;
    else {
      out += `${cur ? 'D' : 'g'}${n} `;
      cur = v;
      n = 1;
    }
  }
  out += `${cur ? 'D' : 'g'}${n}`;
  return out;
}
const rectOf = {};
for (const id of ['dash1', 'dash2', 'dash3', 'dash4', 'dot1', 'dot2', 'dot3', 'dot4', 'dbl4', 'dbl7']) {
  rectOf[id] = await page.$eval(`#${id}`, (el) => {
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  });
}
const bwOf = { dash1: 1, dash2: 2, dash3: 3, dash4: 4, dot1: 1, dot2: 2, dot3: 3, dot4: 4, dbl4: 4, dbl7: 7 };
for (const id of Object.keys(bwOf)) {
  console.log(`${id}: top-edge runs: ${runs(id, bwOf[id])}`);
}

await browser.close();
