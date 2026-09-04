#!/usr/bin/env node
/**
 * `npm run verify:tables-collapse`
 *
 * Renders every corpus/tables-collapse fixture with the engine, harvests the
 * Chrome oracle quantities for the same HTML, and diffs layer-by-layer:
 *   - layer-1 measureText  (candidate engine vs Chrome canvas)
 *   - layer-2 computedStyle  exact string equality (border-collapse model
 *     flags, collapsed-table used padding, specified cell border longhands)
 *   - layer-3 getBoundingClientRect  <= 0.5px per dimension
 *   - layer-4 screenshot  per-pixel delta-E <= 2 with <= 1% exceeding
 *
 * The screenshot band gates the collapsed-border raster: shared borders paint
 * centered on the grid line (half inside each neighbor), the table's outer
 * border stays flush with its border box, conflict winners paint their full
 * style (double stripes, ridge/groove shading), and hidden edges paint
 * nothing. Text glyph pixels compare under the documented text tier
 * (tolerances.json layers.screenshot.text, docs/ledgers/text-mask.md).
 *
 * Writes reference.json/reference.png/mask.png/text-mask.png (Chrome) and
 * candidate.json/candidate.png (engine) into each fixture directory, then a
 * report under docs/reports/. Exits 0 only when every fixture passes.
 */

import { resolve } from 'node:path';
import { runVerify } from './lib/runner.mjs';

await runVerify({ corpus: resolve('corpus/tables-collapse'), fixtureSet: 'corpus/tables-collapse' });