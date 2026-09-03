import { chromium } from 'playwright';
import { decodePng } from '../dist/harness/png.js';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 500, height: 2400 } });

const colors = [
  ['808080', 'gray'],
  ['000000', 'black'],
  ['663399', 'rebeccapurple'],
  ['ff0000', 'red'],
  ['ffffff', 'white'],
  ['333333', 'dark'],
];
let divs = '';
for (const [hex] of colors) {
  divs += `<div class="t" style="border:6px groove #${hex}"></div>\n`;
  divs += `<div class="t" style="border:6px ridge #${hex}"></div>\n`;
  divs += `<div class="t" style="border:4px inset #${hex}"></div>\n`;
  divs += `<div class="t" style="border:4px outset #${hex}"></div>\n`;
}
const html = `<!doctype html><html><head><style>
html,body{margin:0;padding:0;background:#fff}
div{width:120px;height:60px;margin:10px 10px;box-sizing:border-box;position:relative;left:10px}
</style></head><body>
${divs}
<div id="dashR" style="border:4px dashed #000;border-radius:24px;width:160px;height:80px"></div>
<div id="dotR" style="border:6px dotted #000;border-radius:24px;width:160px;height:80px"></div>
<div id="dblR" style="border:6px double #000;border-radius:24px;width:160px;height:80px"></div>
<div id="groR" style="border:6px groove #808080;border-radius:24px;width:160px;height:80px"></div>
<div id="ridR" style="border:6px ridge #808080;border-radius:24px;width:160px;height:80px"></div>
<div id="dashR5" style="border:5px dashed #000;border-radius:16px;width:160px;height:80px"></div>
</body></html>`;
await page.setContent(html);

const shot = decodePng(await page.screenshot());
const { width, height, data } = shot;
const px = (x, y) => {
  const o = (Math.round(y) * width + Math.round(x)) * 4;
  return [data[o], data[o + 1], data[o + 2]];
};

function lum(c) {
  const f = (v) => {
    v /= 255;
    return v <= 0.023522917 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

const styleEls = await page.$$('div.t');
let i = 0;
for (const [hex, name] of colors) {
  for (const style of ['groove', 'ridge', 'inset', 'outset']) {
    const el = styleEls[i++];
    const b = await el.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    const bw = style === 'groove' || style === 'ridge' ? 6 : 4;
    const midX = b.x + b.w / 2;
    const midY = b.y + b.h / 2;
    const top = [];
    const left = [];
    const right = [];
    const bottom = [];
    for (let d = 0; d < bw; d++) {
      top.push(px(midX, b.y + d).join(','));
      bottom.push(px(midX, b.y + b.h - 1 - d).join(','));
      left.push(px(b.x + d, midY).join(','));
      right.push(px(b.x + b.w - 1 - d, midY).join(','));
    }
    const base = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    console.log(
      `${style} ${name} lum=${lum(base).toFixed(4)}\n  top [${top}]\n  bottom [${bottom}]\n  left [${left}]\n  right [${right}]`,
    );
  }
}

// rounded scans: top edge of dashR at centerline y = y + w/2
const rounded = { dashR: 4, dotR: 6, dashR5: 5 };
for (const [id, bw] of Object.entries(rounded)) {
  const b = await page.$eval(`#${id}`, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const y = Math.round(b.y + bw / 2);
  const xs = [];
  for (let x = 0; x < Math.round(b.w); x++) {
    const [r] = px(b.x + x, y);
    xs.push(r < 128 ? 1 : 0);
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
  console.log(`${id}: top-edge runs at y+${bw / 2}: ${out}`);
}

await browser.close();
