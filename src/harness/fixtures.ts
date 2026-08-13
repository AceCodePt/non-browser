import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng } from './png.js';
import { loadMask } from './mask.js';
import { mergeTolerances, type LayerTolerances, type Tolerances } from './tolerances.js';

export type LayerName = 'measureText' | 'computedStyle' | 'rect' | 'screenshot';
export type ExpectedResult = 'pass' | 'fail';

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
  expected: Record<LayerName, ExpectedResult>;
  tolerances: Tolerances;
  referenceRgba: Buffer;
  candidateRgba: Buffer;
  mask: Uint8Array | null;
  reference: LayerValues;
  candidate: LayerValues;
  width: number;
  height: number;
}

interface RawFixtureJson {
  name?: string;
  note?: string;
  expected?: Partial<Record<LayerName, ExpectedResult>>;
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

function loadFixture(dir: string, baseTolerances: Tolerances): Fixture {
  const raw = JSON.parse(readFileSync(join(dir, 'fixture.json'), 'utf8')) as RawFixtureJson;
  const name = raw.name ?? dir.split('/').pop() ?? dir;
  const expected: Record<LayerName, ExpectedResult> = {
    measureText: raw.expected?.measureText ?? 'pass',
    computedStyle: raw.expected?.computedStyle ?? 'pass',
    rect: raw.expected?.rect ?? 'pass',
    screenshot: raw.expected?.screenshot ?? 'pass',
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

  return {
    name,
    note: raw.note,
    expected,
    tolerances,
    referenceRgba: refImg.data,
    candidateRgba: candImg.data,
    mask,
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
