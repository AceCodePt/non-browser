#!/usr/bin/env node
/**
 * Smoke test for the declared public entry (dist/index.js) as a library
 * consumer would import it: render a minimal fixture through the documented
 * option shape and assert the output format. Not a parity test — those are
 * scripts/verify-*.mjs against the Chrome oracle.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHtml, getBrowserConfig, firefoxConfig, chromeConfig } from '../dist/index.js';

const HTML = `<!doctype html><html><head><style>
  body { font-family: 'Noto Sans'; margin: 0; }
  #box { width: 120px; height: 30px; background: #1a73e8; color: white; }
</style></head><body><div id="box">hello</div></body></html>`;

test('renderHtml renders a minimal fixture to a PNG buffer', () => {
  const out = renderHtml(HTML, {
    width: 200,
    height: 120,
    fontFamily: 'Noto Sans',
    fontFile: '/usr/share/fonts/google-noto/NotoSans-Regular.ttf',
  });

  assert.equal(out.width, 200);
  assert.equal(out.height, 120);
  assert.ok(Buffer.isBuffer(out.rgba));
  assert.deepEqual([...out.rgba.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'layer-4 output is a PNG-encoded buffer');
  assert.equal(out.rects['box'].width, 120, 'layer-3 border-box rect width');
  assert.equal(out.rects['box'].height, 30, 'layer-3 border-box rect height');
});

test('the browser-config selection (charter §4) is part of the public surface', () => {
  assert.equal(chromeConfig.browser, 'chrome');
  assert.equal(firefoxConfig.browser, 'firefox');
  assert.equal(getBrowserConfig('chrome').browser, 'chrome');
  assert.equal(getBrowserConfig('firefox').browser, 'firefox');
  assert.equal(getBrowserConfig().browser, 'chrome', 'default target is chrome');
});