#!/usr/bin/env node
/**
 * `npm run verify:tables`
 *
 * Renders every corpus/tables fixture with the engine, harvests the Chrome
 * oracle quantities for the same HTML, and diffs layer-by-layer:
 *   - layer-1 measureText  (candidate engine vs Chrome canvas)
 *   - layer-2 computedStyle  (empty for these fixtures — out of scope, passes)
 *   - layer-3 getBoundingClientRect  <= 0.5px per dimension
 *   - layer-4 screenshot  per-pixel delta-E <= 2 with <= 1% exceeding
 *
 * Text glyph pixels are compared under the documented text tier
 * (tolerances.json layers.screenshot.text, docs/ledgers/text-mask.md) instead
 * of being blanket-masked — each fixture reports its text-region pixels
 * compared, mean/worst ΔE, and text-pixel mask share. Only declared
 * maskRects/maskElements (e.g. the Chrome broken-image icon on <img>) stay
 * masked (mask.png). The grid geometry itself (track sizes, item placement,
 * alignment) is verified pixel-exactly by layer-3 and by the unmasked box
 * pixels on layer-4.
 *
 * Writes reference.json/reference.png/mask.png/text-mask.png (Chrome) and
 * candidate.json/candidate.png (engine) into each fixture directory, then a
 * report under docs/reports/. Exits 0 only when every fixture passes.
 */

import { resolve } from 'node:path';
import { runVerify } from './lib/runner.mjs';

await runVerify({ corpus: resolve('corpus/tables'), fixtureSet: 'corpus/tables' });