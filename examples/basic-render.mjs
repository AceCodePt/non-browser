#!/usr/bin/env node
/**
 * Minimal honest demo of what feeding this library an HTML/CSS string produces.
 * Run: node examples/basic-render.mjs
 */

import { writeFileSync } from 'node:fs';
import { renderHtml } from '../dist/index.js';
import { measureTextWidth } from '../dist/layout/measure.js';

const HTML = `<!doctype html><html><head><style>
  body { font: 16px 'Noto Sans'; color: #222; margin: 0; }
  #header { background: #1a73e8; color: white; padding: 16px 20px; font-size: 20px; }
  .row { display: flex; gap: 12px; padding: 20px; }
  .card { flex: 1; border: 2px solid #ccc; border-radius: 8px; padding: 12px; box-sizing: border-box; }
  #card-a { background: #f0f4ff; }
  #card-b { background: #fff8f0; }
  .dim { color: #666; font-size: 12px; }
</style></head><body>
  <div id="header">Order summary</div>
  <div class="row">
    <div id="card-a" class="card">Subtotal<div class="dim">$128.42</div></div>
    <div id="card-b" class="card">Tax<div class="dim">$10.27</div></div>
  </div>
</body></html>`;

const out = renderHtml(HTML, {
  width: 640,
  height: 300,
  fontFamily: 'Noto Sans',
  fontFile: '/usr/share/fonts/google-noto/NotoSans-Regular.ttf',
  computedStyle: [
    { id: 'header', props: ['display', 'font-size', 'background-color', 'color', 'padding-top', 'height'] },
    { id: 'card-a', props: ['display', 'width', 'padding-left', 'border-left-width', 'background-color'] },
  ],
  textElements: ['header', 'card-a'],
});

console.log('## input');
console.log(HTML);
console.log('\n## layer 1 — text measurement (measureTextWidth, after layout)');
for (const s of ['abcdefghijklmnopqrstuvwxyz', 'Order summary', 'The quick brown fox', '128.42', '中文测试 日本語']) {
  console.log(`  measureTextWidth(${JSON.stringify(s)}, 16, 'Noto Sans') = ${measureTextWidth(s, 16, 'Noto Sans').toFixed(4)}px`);
}
console.log(`  measureTextWidth(..., ls=1.5)                    = ${measureTextWidth('Order summary', 16, 'Noto Sans', 1.5).toFixed(4)}px`);

console.log('\n## layer 2 — computed style');
for (const [id, props] of Object.entries(out.computedStyles)) {
  console.log(`  #${id}`);
  for (const [prop, value] of Object.entries(props)) {
    if (value != null) console.log(`    ${prop}: ${value}`);
  }
}

console.log('\n## layer 3 — element rects (border box)');
for (const [id, r] of Object.entries(out.rects)) {
  console.log(`  #${id}  x=${r.x} y=${r.y} w=${r.width} h=${r.height}`);
}

console.log('\n## layer 4 — paint (PNG-encoded buffer -> file)');
writeFileSync(new URL('./output.png', import.meta.url), out.rgba);
console.log('  wrote examples/output.png');
console.log(`  buffer: ${out.width}x${out.height}, ${out.rgba.length} PNG bytes, rendered in-process (no browser)`);