/**
 * Pure logic shared by the cross-browser probe (`probe-browser-gap.mjs`) and
 * its test suite. Everything here is deterministic and browser-free so the
 * tests can run without Playwright; the probe script adds the browser
 * harvesting on top of `compareLayers`.
 */

export const MASK_PAD = 2;

/** Build a text-region mask (1 = text pixel) from fragment rects, padded. */
export function rectsToTextMask(width, height, rects, pad = MASK_PAD) {
  const mask = new Uint8Array(width * height);
  for (const r of rects ?? []) {
    const x0 = Math.max(0, Math.floor(r.x) - pad);
    const y0 = Math.max(0, Math.floor(r.y) - pad);
    const x1 = Math.min(width, Math.ceil(r.x + r.width) + pad);
    const y1 = Math.min(height, Math.ceil(r.y + r.height) + pad);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) mask[y * width + x] = 1;
    }
  }
  return mask;
}

export function delta(a, b) {
  return Math.abs(a - b);
}

const DIMS = ['x', 'y', 'width', 'height'];

/**
 * The probe's fixture set. Same HTML is rendered in both browsers. Kept here
 * (not in the probe script) so the test suite can validate the exact fixtures
 * the probe runs and the probe stays a thin browser harness.
 */
export const FIXTURES = [
  {
    name: 'noto-text',
    note: 'multi-line paragraph in the family both configs register (Noto Sans)',
    viewport: { width: 460, height: 140 },
    html:
      "<html><head><style>html,body{margin:0;padding:0}</style></head>" +
      "<body><div id=\"para\" style=\"font-family:'Noto Sans';font-size:16px;line-height:24px;width:320px\">" +
      "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. " +
      "Sphinx of black quartz, judge my vow.</div></body></html>",
    measureText: [
      { text: 'The quick brown fox jumps over the lazy dog.', font: "16px 'Noto Sans'" },
      { text: 'Pack my box with five dozen liquor jugs.', font: "16px 'Noto Sans'" },
      { text: 'Sphinx of black quartz, judge my vow.', font: "16px 'Noto Sans'" },
    ],
    computedStyle: [{ id: 'para', props: ['display', 'font-size', 'font-family', 'line-height', 'width', 'white-space'] }],
    rects: ['para'],
    textElements: ['para'],
  },
  {
    name: 'source-code-pro-text',
    note: 'text in the firefox-config registered mono face (Source Code Pro)',
    viewport: { width: 460, height: 160 },
    html:
      "<html><head><style>html,body{margin:0;padding:0}</style></head>" +
      "<body><div id=\"p1\" style=\"font-family:'Source Code Pro';font-size:16px;line-height:24px;width:300px\">" +
      "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.</div>" +
      "<div id=\"p2\" style=\"font-family:'Source Code Pro';font-size:20px;line-height:30px;width:260px\">" +
      "How vexingly quick daft zebras jump!</div></body></html>",
    measureText: [
      { text: 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.', font: "16px 'Source Code Pro'" },
      { text: 'How vexingly quick daft zebras jump!', font: "20px 'Source Code Pro'" },
    ],
    computedStyle: [
      { id: 'p1', props: ['font-size', 'font-family', 'line-height', 'width'] },
      { id: 'p2', props: ['font-size', 'font-family', 'line-height', 'width'] },
    ],
    rects: ['p1', 'p2'],
    textElements: ['p1', 'p2'],
  },
  {
    name: 'courier-new-fallback',
    note: 'unregistered family: firefox fallback table maps it to Source Code Pro, chrome resolves its own way',
    viewport: { width: 460, height: 160 },
    html:
      "<html><head><style>html,body{margin:0;padding:0}</style></head>" +
      "<body><div id=\"p1\" style=\"font-family:'Courier New';font-size:16px;line-height:24px;width:300px\">" +
      "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.</div>" +
      "<div id=\"p2\" style=\"font-family:'Courier New';font-size:20px;line-height:30px;width:260px\">" +
      "How vexingly quick daft zebras jump!</div></body></html>",
    measureText: [
      { text: 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.', font: "16px 'Courier New'" },
      { text: 'How vexingly quick daft zebras jump!', font: "20px 'Courier New'" },
    ],
    computedStyle: [
      { id: 'p1', props: ['font-family', 'font-size', 'line-height', 'width'] },
      { id: 'p2', props: ['font-family', 'font-size', 'line-height', 'width'] },
    ],
    rects: ['p1', 'p2'],
    textElements: ['p1', 'p2'],
  },
  {
    name: 'layout-with-text',
    note: 'boxes + text in conjunction: float, margins, padding, bordered box with a paragraph',
    viewport: { width: 460, height: 200 },
    html:
      "<html><head><style>html,body{margin:0;padding:0}</style></head>" +
      "<body><div id=\"box\" style=\"font-family:'Noto Sans';font-size:14px;line-height:20px;width:360px;padding:12px;border:2px solid black;margin:10px;background:#ddd\">" +
      "<span id=\"fl\" style=\"float:left;width:80px;height:60px;background:red\"></span>" +
      "<div id=\"txt\">The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.</div>" +
      "</div></body></html>",
    measureText: [
      { text: 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.', font: "14px 'Noto Sans'" },
    ],
    computedStyle: [
      { id: 'box', props: ['width', 'padding', 'border', 'margin', 'font-family', 'background-color'] },
      { id: 'fl', props: ['float', 'width', 'height', 'background-color'] },
      { id: 'txt', props: ['font-size', 'line-height', 'width'] },
    ],
    rects: ['box', 'fl', 'txt'],
    textElements: ['txt'],
  },
  {
    name: 'mixed-family',
    note: 'one registered + one unregistered family on the same page',
    viewport: { width: 460, height: 180 },
    html:
      "<html><head><style>html,body{margin:0;padding:0}</style></head>" +
      "<body><div id=\"a\" style=\"font-family:'Noto Sans';font-size:16px;line-height:24px;width:300px\">" +
      "Pack my box with five dozen liquor jugs.</div>" +
      "<div id=\"b\" style=\"font-family:'Liberation Mono';font-size:16px;line-height:24px;width:300px\">" +
      "How vexingly quick daft zebras jump!</div></body></html>",
    measureText: [
      { text: 'Pack my box with five dozen liquor jugs.', font: "16px 'Noto Sans'" },
      { text: 'How vexingly quick daft zebras jump!', font: "16px 'Liberation Mono'" },
    ],
    computedStyle: [
      { id: 'a', props: ['font-family', 'font-size', 'line-height', 'width'] },
      { id: 'b', props: ['font-family', 'font-size', 'line-height', 'width'] },
    ],
    rects: ['a', 'b'],
    textElements: ['a', 'b'],
  },
];

/**
 * Compare two harvested layer sets (each shaped like the probe's `harvest`
 * result) and return structured per-layer results. Pure: no browser needed,
 * so callers can feed synthetic or recorded data.
 */
export function compareLayers(chrome, firefox, fixture) {
  const tol = fixture.tolerances?.layers ?? null;

  // Layer 1: measureText.
  const mKeys = Object.keys(chrome.measureText ?? {});
  const mDeltas = mKeys.map((k) => delta(chrome.measureText?.[k] ?? NaN, firefox.measureText?.[k] ?? NaN));
  const mMean = mDeltas.length ? mDeltas.reduce((s, d) => s + d, 0) / mDeltas.length : 0;
  const mMax = mDeltas.length ? Math.max(...mDeltas) : 0;
  const measureText = {
    count: mKeys.length,
    deltas: mDeltas,
    meanDelta: mMean,
    maxDelta: mMax,
    exceeds: tol ? mMax > tol.measureText.maxPx : false,
  };

  // Layer 2: computedStyle.
  let styleMismatch = 0;
  let styleCount = 0;
  const styleMismatches = [];
  for (const { id, props } of fixture.computedStyle ?? []) {
    for (const p of props) {
      styleCount++;
      const c = chrome.computedStyle?.[id]?.[p];
      const f = firefox.computedStyle?.[id]?.[p];
      if (c !== f) {
        styleMismatch++;
        styleMismatches.push({ id, prop: p, chrome: c, firefox: f });
      }
    }
  }
  const computedStyle = { count: styleCount, mismatches: styleMismatch, details: styleMismatches };

  // Layer 3: rect.
  const ids = new Set([...Object.keys(chrome.rects ?? {}), ...Object.keys(firefox.rects ?? {})]);
  let rectDim = 0;
  let rectBoxes = 0;
  const rectDeltas = [];
  const rectDetails = [];
  for (const id of ids) {
    rectBoxes++;
    const rc = chrome.rects?.[id] ?? {};
    const rf = firefox.rects?.[id] ?? {};
    for (const d of DIMS) {
      rectDim++;
      const del = rc[d] == null || rf[d] == null ? NaN : delta(rc[d], rf[d]);
      rectDeltas.push(del);
      rectDetails.push({ id, dim: d, delta: del });
    }
  }
  const rectMax = rectDeltas.length ? Math.max(...rectDeltas) : 0;
  const rect = {
    boxes: rectBoxes,
    dims: rectDim,
    maxDelta: rectMax,
    exceeds: tol ? rectMax > tol.rect.maxPx : false,
    details: rectDetails,
  };

  // Layer 3.5: line fragments per text element.
  const lineFragments = [];
  for (const id of Object.keys(chrome.textsById ?? {})) {
    const cw = chrome.widthsById?.[id] ?? [];
    const fw = firefox.widthsById?.[id] ?? [];
    const result = { id, chromeLines: cw.length, firefoxLines: fw.length, sameCount: cw.length === fw.length };
    if (cw.length === fw.length && cw.length > 0) {
      const lineDeltas = cw.map((w, i) => delta(w, fw[i]));
      result.meanDelta = lineDeltas.reduce((s, d) => s + d, 0) / lineDeltas.length;
      result.maxDelta = Math.max(...lineDeltas);
    } else {
      result.meanDelta = 0;
      result.maxDelta = 0;
    }
    lineFragments.push(result);
  }

  return { measureText, computedStyle, rect, lineFragments };
}

/**
 * Validate every fixture's shape and that referenced ids exist in its HTML.
 * Returns an array of `{ fixture, problems }`; problems is empty when valid.
 */
export function validateFixtures(fixtures) {
  const problems = [];
  for (const f of fixtures) {
    const bad = [];
    const { width, height } = f.viewport ?? {};
    if (!Number.isFinite(width) || width <= 0) bad.push(`viewport.width invalid (${width})`);
    if (!Number.isFinite(height) || height <= 0) bad.push(`viewport.height invalid (${height})`);
    if (typeof f.html !== 'string' || f.html.length === 0) bad.push('html missing');
    if (!Array.isArray(f.measureText)) bad.push('measureText not an array');
    for (const m of f.measureText ?? []) {
      if (typeof m.text !== 'string') bad.push(`measureText.text missing (${JSON.stringify(m)})`);
      if (typeof m.font !== 'string') bad.push(`measureText.font missing (${JSON.stringify(m)})`);
    }
    if (!Array.isArray(f.computedStyle)) bad.push('computedStyle not an array');
    for (const cs of f.computedStyle ?? []) {
      if (typeof cs.id !== 'string') bad.push(`computedStyle.id missing (${JSON.stringify(cs)})`);
      if (!Array.isArray(cs.props) || cs.props.length === 0) bad.push(`computedStyle.props missing/empty (${JSON.stringify(cs)})`);
    }
    if (!Array.isArray(f.rects)) bad.push('rects not an array');
    if (!Array.isArray(f.textElements)) bad.push('textElements not an array');
    // Ids referenced by computedStyle/rects/textElements must appear in the HTML.
    const csIds = Array.isArray(f.computedStyle) ? f.computedStyle.map((c) => c.id) : [];
    for (const id of csIds) {
      if (id && !f.html.includes(`id="${id}"`)) bad.push(`computedStyle id "${id}" not present in html`);
    }
    for (const id of Array.isArray(f.rects) ? f.rects : []) {
      if (!f.html.includes(`id="${id}"`)) bad.push(`rects id "${id}" not present in html`);
    }
    for (const id of Array.isArray(f.textElements) ? f.textElements : []) {
      if (!f.html.includes(`id="${id}"`)) bad.push(`textElements id "${id}" not present in html`);
    }
    problems.push({ fixture: f.name, problems: bad });
  }
  return problems;
}
