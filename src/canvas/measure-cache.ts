/**
 * Measurement memoization for the canvas seam, invalidated as one epoch on any
 * browser-config or font-registration change.
 *
 * A measured width for a (font shorthand, text) pair is a pure function of the
 * registered font set and the active browser-config; both only change through
 * `setActiveBrowserConfig` (src/config/browser-config.ts) and `registerFont`
 * (src/canvas/skia.ts), each of which bumps the epoch via
 * `invalidateMeasureCache` — but only on a genuine change, so a repeated
 * render of the same HTML with the same config and fonts keeps the memo warm
 * across renders instead of wiping it at the start of every prepare().
 * `cachedFamilyHas` memoizes the seam's native `GlobalFonts.has` probe for the
 * same epoch (font registration is the only thing that flips its answer), so
 * the per-grapheme hasFamily calls inside resolveFallbackRuns stop paying a
 * native round-trip each.
 *
 * Both caches are capped: Pretext's repeated break-candidate re-measures fill
 * the width cache with a working set, never unbounded growth.
 */

import type { CanvasTextMetrics } from './interface.js';

const WIDTH_CAP = 2048;
const FAMILY_CAP = 256;

const widths = new Map<string, CanvasTextMetrics>();
const families = new Map<string, boolean>();
let misses = 0;

function setBounded<V>(map: Map<string, V>, cap: number, key: string, value: V): void {
  if (map.size >= cap) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}

/** Full metrics for `text` at `font`, computing on first touch only. */
export function cachedMetrics(font: string, text: string, compute: () => CanvasTextMetrics): CanvasTextMetrics {
  const key = `${font}\u0000${text}`;
  const hit = widths.get(key);
  if (hit !== undefined) return hit;
  misses++;
  const metrics = compute();
  setBounded(widths, WIDTH_CAP, key, metrics);
  return metrics;
}

/** Whether `family` is measurable through the current canvas, per epoch. */
export function cachedFamilyHas(family: string, probe: (family: string) => boolean): boolean {
  const hit = families.get(family);
  if (hit !== undefined) return hit;
  const present = probe(family);
  setBounded(families, FAMILY_CAP, family, present);
  return present;
}

/** Drop every cached width and family probe (new browser-config or font set). */
export function invalidateMeasureCache(): void {
  widths.clear();
  families.clear();
}

/** How many widths were computed since the last reset (one native canvas
 * measure per miss). The measure-persist gate reads this to prove repeated
 * renders stop re-measuring the working set. */
export function getMeasureCacheMisses(): number {
  return misses;
}

export function resetMeasureCacheMisses(): void {
  misses = 0;
}