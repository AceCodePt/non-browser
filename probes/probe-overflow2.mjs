#!/usr/bin/env node
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { decodePng } from '../dist/harness/png.js';

const cases = [
  { name: 'hidden', overflow: 'hidden' },
  { name: 'clip', overflow: 'clip' },
  { name: 'auto', overflow: 'auto' },
];

const browser = await chromium.launch();
for (const c of cases) {
  const html = `<div id="c" style="position:relative;left:10px;top:10px;width:120px;height:80px;background:#f0f0f0;overflow:${c.overflow}"><div style="width:200px;height:120px;background:#e06040;margin-left:40px;margin-top:30px"></div></div>`;
  const page = await browser.newPage({ viewport: { width: 300, height: 200 } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const shot = await page.screenshot();
  const png = decodePng(shot);
  console.log(`=== ${c.name} (borderless) ===`);
  // content box origin at (24,24)... wait borderless: border box = (24,24) 120x80
  for (const [label, x0, y0, x1, y1] of [
    ['right strip 120..130', 140, 24, 152, 104],
    ['below strip 80..95', 24, 96, 144, 112],
    ['corner', 140, 96, 160, 120],
    ['inside-left', 20, 50, 60, 80],
  ]) {
    const hist = new Map();
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const o = (y * png.width + x) * 4;
        const k = `${png.data[o]},${png.data[o+1]},${png.data[o+2]}`;
        hist.set(k, (hist.get(k) ?? 0) + 1);
      }
    }
    const rows = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    console.log(`  ${label} [${x0},${y0}]-[${x1},${y1}]: ` + rows.map(([k, v]) => `${k}(${v})`).join(' '));
  }
  writeFileSync(`/tmp/opencode/bl-${c.name}.png`, shot);
  await page.close();
}
await browser.close();
