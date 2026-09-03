import { chromium } from 'playwright';
import { decodePng } from '../dist/harness/png.js';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 3200 } });

const colors = [
  [153, 153, 153],
  [153, 0, 0],
  [0, 153, 0],
  [0, 0, 153],
  [102, 51, 153],
  [51, 102, 153],
  [200, 100, 50],
  [100, 150, 200],
  [1, 2, 3],
  [30, 30, 30],
  [32, 32, 32],
  [235, 235, 235],
  [240, 240, 240],
  [128, 0, 128],
  [250, 240, 230],
  [0, 128, 128],
  [192, 192, 192],
  [105, 105, 105],
];
const divs = colors
  .map(
    (c, i) =>
      `<div class="t" style="border:6px groove rgb(${c[0]},${c[1]},${c[2]});top:${i * 80}px"></div>`,
  )
  .join('\n');
const html = `<!doctype html><html><head><style>
html,body{margin:0;padding:0;background:#fff}
div.t{position:absolute;left:20px;width:120px;height:60px;box-sizing:border-box}
</style></head><body>
${divs}
</body></html>`;
await page.setContent(html);

const shot = decodePng(await page.screenshot());
const { width, height, data } = shot;
const px = (x, y) => {
  const o = (y * width + x) * 4;
  return [data[o], data[o + 1], data[o + 2]];
};

function lum(c) {
  const f = (v) => {
    v /= 255;
    return v <= 0.023522917 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

colors.forEach((c, i) => {
  const y = i * 80;
  const outer = px(80, y + 1);
  const inner = px(80, y + 4);
  console.log(
    `rgb(${c}) lum=${lum(c).toFixed(5)} outer=${outer} inner=${inner}`,
  );
});

await browser.close();
