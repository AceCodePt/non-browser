import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng } from './png.js';
import { loadMask } from './mask.js';
import { mergeTolerances, type LayerTolerances, type Tolerances } from './tolerances.js';

export type LayerName = 'measureText' | 'computedStyle' | 'rect' | 'screenshot';

/** Typed gap declaration: a layer that is expected to fail must carry an owner (reason) and an expiry (sunset). */
export interface GapDeclaration {
  result: 'fail';
  /** why the layer is expected to fail — references the fixture note and/or ledger. */
  reason: string;
  /** the condition under which the gap is expected to close: a commit, a date, or a spec feature landing. */
  sunset: string;
}

/** A layer expectation is either 'pass' or a typed gap declaration — nothing else. */
export type LayerExpectation = 'pass' | GapDeclaration;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayerValues {
  measureText: Record<string, number>;
  computedStyle: Record<string, Record<string, string>>;
  rect: Record<string, Box>;
}

export interface Fixture {
  name: string;
  note?: string;
  expected: Record<LayerName, LayerExpectation>;
  tolerances: Tolerances;
  referenceRgba: Buffer;
  candidateRgba: Buffer;
  mask: Uint8Array | null;
  /** 1 = text-region pixel, compared under the screenshot text tier. */
  textMask: Uint8Array | null;
  reference: LayerValues;
  candidate: LayerValues;
  width: number;
  height: number;
}

interface RawFixtureJson {
  name?: string;
  note?: string;
  expected?: Partial<Record<LayerName, LayerExpectation>>;
  tolerances?: Partial<LayerTolerances>;
}

function readLayerValues(dir: string, file: string, label: string): LayerValues {
  const path = join(dir, file);
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<LayerValues>;
  if (!raw.measureText || !raw.computedStyle || !raw.rect) {
    throw new Error(`fixture ${dir}: ${label} missing one of measureText/computedStyle/rect`);
  }
  return { measureText: raw.measureText, computedStyle: raw.computedStyle, rect: raw.rect };
}

/**
 * Normalize one raw layer expectation into the single typed form. Anything that
 * is not `'pass'` or a typed gap declaration ({ result:'fail', reason, sunset })
 * is rejected, so the retired top-level `"fail"` shorthand cannot silently
 * reach the evaluator.
 */
function normalizeLayerExpectation(layer: LayerName, raw: unknown, fixture: string): LayerExpectation {
  if (raw === undefined) return 'pass';
  if (raw === 'pass') return 'pass';
  if (typeof raw === 'string') {
    throw new Error(
      `fixture ${fixture}: expected.${layer} shorthand "${raw}" is retired — use a typed gap object { result:'fail', reason, sunset }`,
    );
  }
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const gap = raw as Partial<GapDeclaration>;
    if (gap.result === 'fail') {
      if (typeof gap.reason !== 'string' || gap.reason.trim() === '') {
        throw new Error(`fixture ${fixture}: expected.${layer} gap needs a non-empty 'reason'`);
      }
      if (typeof gap.sunset !== 'string' || gap.sunset.trim() === '') {
        throw new Error(`fixture ${fixture}: expected.${layer} gap needs a non-empty 'sunset'`);
      }
      return { result: 'fail', reason: gap.reason, sunset: gap.sunset };
    }
  }
  throw new Error(`fixture ${fixture}: expected.${layer} must be 'pass' or a typed gap declaration`);
}

function loadFixture(dir: string, baseTolerances: Tolerances): Fixture {
  const raw = JSON.parse(readFileSync(join(dir, 'fixture.json'), 'utf8')) as RawFixtureJson;
  const name = raw.name ?? dir.split('/').pop() ?? dir;
  const rawExpected = raw.expected ?? {};
  const expected: Record<LayerName, LayerExpectation> = {
    measureText: normalizeLayerExpectation('measureText', rawExpected.measureText, name),
    computedStyle: normalizeLayerExpectation('computedStyle', rawExpected.computedStyle, name),
    rect: normalizeLayerExpectation('rect', rawExpected.rect, name),
    screenshot: normalizeLayerExpectation('screenshot', rawExpected.screenshot, name),
  };
  const tolerances = mergeTolerances(baseTolerances, raw.tolerances ?? {});

  const reference = readLayerValues(dir, 'reference.json', 'reference');
  const candidate = readLayerValues(dir, 'candidate.json', 'candidate');

  const referencePng = readFileSync(join(dir, 'reference.png'));
  const candidatePng = readFileSync(join(dir, 'candidate.png'));
  const refImg = decodePng(referencePng);
  const candImg = decodePng(candidatePng);
  if (refImg.width !== candImg.width || refImg.height !== candImg.height) {
    throw new Error(`fixture ${name}: candidate/reference dimensions differ`);
  }
  const width = refImg.width;
  const height = refImg.height;

  const maskPath = join(dir, 'mask.png');
  let mask: Uint8Array | null = null;
  if (statSync(maskPath, { throwIfNoEntry: false })?.isFile()) {
    mask = loadMask(readFileSync(maskPath), width, height);
  }

  const textMaskPath = join(dir, 'text-mask.png');
  let textMask: Uint8Array | null = null;
  if (statSync(textMaskPath, { throwIfNoEntry: false })?.isFile()) {
    textMask = loadMask(readFileSync(textMaskPath), width, height);
  }

  return {
    name,
    note: raw.note,
    expected,
    tolerances,
    referenceRgba: refImg.data,
    candidateRgba: candImg.data,
    mask,
    textMask,
    reference,
    candidate,
    width,
    height,
  };
}

/** Load every fixture (a directory with a fixture.json) under `dir`. */
export function loadFixtureSet(dir: string, baseTolerances: Tolerances): Fixture[] {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const fixtures: Fixture[] = [];
  for (const entry of entries) {
    const fixtureDir = join(dir, entry);
    if (statSync(join(fixtureDir, 'fixture.json'), { throwIfNoEntry: false })?.isFile()) {
      fixtures.push(loadFixture(fixtureDir, baseTolerances));
    }
  }
  return fixtures;
}
