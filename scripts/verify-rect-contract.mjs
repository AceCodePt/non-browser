#!/usr/bin/env node
/**
 * `npm run verify:rect-contract`
 *
 * Proves the README's layer-3 rect claim: `renderHtml` maps every id present
 * in the input DOM to a border-box rect, with unrendered ids (display:none
 * elements and their descendants, id'd script/style elements) falling back to
 * an all-zero rect — the same shape Blink's getBoundingClientRect returns for
 * an unrendered box (backfillZeroRects in src/layout/render.ts). This is the
 * gate that keeps the map total: a DOM-present id may never be absent from
 * `out.rects`, so the 'no rect collected' assertion cannot regress silently.
 */

import { renderHtml } from '../dist/layout/render.js';

const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';

const ZERO = { x: 0, y: 0, width: 0, height: 0 };

// one rendered box, one display:none box, a descendant of the display:none box,
// and an id'd script — every category the total-map contract covers.
const HTML = `<!doctype html><html><head><style>
  body { font-family: 'Noto Sans'; margin: 0; }
  #shown { width: 120px; height: 40px; background: red; }
  #hidden { display: none; }
</style></head><body>
  <div id="shown">visible</div>
  <div id="hidden"><div id="desc">hidden child</div></div>
  <script id="prog">var x = 1;</script>
</body></html>`;

const opts = {
  width: 400,
  height: 200,
  fontFamily: FONT_FAMILY,
  fontFile: FONT_FILE,
};

const failures = [];

let out;
try {
  out = renderHtml(HTML, opts);
} catch (err) {
  console.error(`FAIL: renderHtml threw — 'no rect collected' must not fire for DOM-present ids: ${err.message}`);
  process.exit(1);
}

for (const id of ['shown', 'hidden', 'desc', 'prog']) {
  const rect = out.rects[id];
  if (!rect) failures.push(`id '${id}' absent from out.rects (map must be total)`);
  else if (id === 'shown') {
    if (rect.x !== 0 || rect.y !== 0 || rect.width !== 120 || rect.height !== 40) {
      failures.push(`id 'shown' has ${JSON.stringify(rect)}, expected its true border box {x:0,y:0,width:120,height:40}`);
    }
  } else if (rect.x !== 0 || rect.y !== 0 || rect.width !== 0 || rect.height !== 0) {
    failures.push(`id '${id}' has ${JSON.stringify(rect)}, expected all-zero`);
  }
}

for (const f of failures) console.error(`  FAIL ${f}`);
const ok = failures.length === 0;
console.log(ok ? 'PASS: verify-rect-contract — every DOM-present id has a rect; unrendered ids are all-zero' : `FAIL: verify-rect-contract — ${failures.length} problem(s)`);
process.exit(ok ? 0 : 1);
