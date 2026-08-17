#!/usr/bin/env node
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { decodePng } from '../dist/harness/png.js';

function summarize(path, pixels) {
  const names = ['w','r','g','b'];
  const counts = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    const key = `${pixels[i]},${pixels[i+1]},${pixels[i+2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log(`  ${path}: ${pixels.length / 4}px top colors: ${rows.map(([k, v]) => `${k}(${v})`).join(' ')}`);
}

function regionStats(name, png, x0, y0, x1, y1) {
  const w = png.width;
  let histBins = new Map();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * w + x) * 4;
      const key = `${png.data[o]},${png.data[o+1]},${png.data[o+2]}`;
      histBins.set(key, (histBins.get(key) ?? 0) + 1);
    }
  }
  const rows = [...histBins.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`  ${name} region [${x0},${y0}]-[${x1},${y1}]: ` + rows.map(([k, v]) => `${k}(${v})`).join(' '));
}

const cases = [
  {
    name: 'hidden-square',
    html: `<div id="c" style="position:relative;left:10px;top:10px;width:120px;height:80px;background:#f0f0f0;overflow:hidden;border:6px solid #222"><div style="width:200px;height:120px;background:#e06040;margin-left:40px;margin-top:30px"></div></div>`,
  },
  {
    name: 'clip-square',
    html: `<div id="c" style="position:relative;left:10px;top:10px;width:120px;height:80px;background:#f0f0f0;overflow:clip;border:6px solid #222"><div style="width:200px;height:120px;background:#e06040;margin-left:40px;margin-top:30px"></div></div>`,
  },
  {
    name: 'auto-overflow',
    html: `<div id="c" style="position:relative;left:10px;top:10px;width:120px;height:80px;background:#f0f0f0;overflow:auto;border:6px solid #222"><div style="width:200px;height:120px;background:#e06040;margin-left:40px;margin-top:30px"></div></div>`,
  },
  {
    name: 'auto-fit',
    html: `<div id="c" style="position:relative;left:10px;top:10px;width:120px;height:80px;background:#f0f0f0;overflow:auto;border:6px solid #222"><div style="width:60px;height:40px;background:#e06040;margin:10px"></div></div>`,
  },
  {
    name: 'hidden-negative-margin',
    html: `<div id="c" style="position:relative;left:10px;top:10px;width:120px;height:80px;background:#f0f0f0;overflow:hidden;border:6px solid #222"><div style="width:60px;height:40px;background:#e06040;margin:-20px"></div></div>`,
  },
  {
    name: 'clip-negative-margin',
    html: `<div id="c" style="position:relative;left:10px;top:10px;width:120px;height:80px;background:#f0f0f0;overflow:clip;border:6px solid #222"><div style="width:60px;height:40px;background:#e06040;margin:-20px"></div></div>`,
  },
  {
    name: 'clip-with-radius',
    html: `<div id="c" style="position:relative;left:10px;top:10px;width:120px;height:80px;background:#f0f0f0;overflow:clip;border-radius:24px;border:6px solid #222"><div style="width:200px;height:120px;background:#e06040;margin-left:40px;margin-top:30px"></div></div>`,
  },
  {
    name: 'hidden-absolute-child',
    html: `<div id="c" style="position:relative;left:10px;top:10px;width:120px;height:80px;background:#f0f0f0;overflow:hidden;border:6px solid #222"><div style="position:absolute;left:-30px;top:-20px;width:200px;height:120px;background:#e06040"></div></div>`,
  },
];

const browser = await chromium.launch();
for (const c of cases) {
  const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
  await page.setContent(c.html);
  await page.evaluate(() => document.fonts.ready);
  const info = await page.evaluate(() => {
    const el = document.getElementById('c');
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      overflow: cs.getPropertyValue('overflow'),
      overflowX: cs.getPropertyValue('overflow-x'),
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      scrollbars: {
        h: el.scrollWidth > el.clientWidth,
        v: el.scrollHeight > el.clientHeight,
      },
    };
  });
  const shot = await page.screenshot();
  const png = decodePng(shot);
  console.log(`=== ${c.name} ===`);
  console.log(JSON.stringify(info));
  // content box is at (24,24) size 120x80; border box at (18,18)
  writeFileSync(`/tmp/opencode/probe-${c.name}.png`, shot);
  // region right of content box, above border: [144,24]-[~162,80]: should be white if clipped at content box, red if clipped at border box
  regionStats(`${c.name} rightstrip`, png, 142, 24, 170, 90);
  regionStats(`${c.name} below`, png, 24, 90, 144, 150);
  regionStats(`${c.name} corner`, png, 142, 90, 170, 150);
  await page.close();
}
await browser.close();
