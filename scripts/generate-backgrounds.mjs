#!/usr/bin/env node
/**
 * One-shot generator for the corpus/backgrounds fixture directories (the
 * background painting surface slice). Idempotent: rewrites the fixture
 * definitions in place; reference/candidate artifacts are produced by
 * verify-backgrounds.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CORPUS = 'corpus/backgrounds';

const style = 'html,body{margin:0;padding:0}';

function html(body) {
  return `<html><head><style>${style}</style></head><body>${body}</body></html>`;
}

function div(id, styleAttr, children = '') {
  return `<div id="${id}" style="${styleAttr}">${children}</div>`;
}

const fixtures = [
  {
    name: 'linear-gradient',
    note: 'The canonical gradient: linear-gradient(to right, red, blue) paints across the box per css-images-3 §3.4 (gradient line from left edge to right edge), and the full computed background longhand set serializes exactly like Chrome (color slot transparent, gradient with resolved rgb stops, 0% 0% / auto padding-box border-box).',
    viewport: { width: 240, height: 180 },
    html: html(div('g', 'position:absolute;left:40px;top:40px;width:160px;height:100px;background-image:linear-gradient(to right, red, blue)')),
    computedStyle: [{ id: 'g', props: ['background-image', 'background-position', 'background-size', 'background-repeat', 'background-clip', 'background-origin', 'background-color', 'background'] }],
    rects: ['g'],
  },
  {
    name: 'gradient-color-layer',
    note: 'A gradient layered over background-color: the semi-transparent gradient composites over the color underneath (background-color paints first, the image layers stack on top), plus a hard-stop band (red 25%, blue 25%) proving stop-position clamping rasterizes like Chrome.',
    viewport: { width: 240, height: 220 },
    html: html(
      div('a', 'position:absolute;left:40px;top:30px;width:160px;height:80px;background-color:#ffdd00;background-image:linear-gradient(to bottom, rgba(255,0,0,0.7), rgba(0,0,255,0.7))') +
      div('b', 'position:absolute;left:40px;top:130px;width:160px;height:60px;background-image:linear-gradient(90deg, red 25%, blue 25%)'),
    ),
    computedStyle: [{ id: 'a', props: ['background-image', 'background-color'] }, { id: 'b', props: ['background-image'] }],
    rects: ['a', 'b'],
  },
  {
    name: 'two-layer-stack',
    note: 'Two background-image layers stack in source order, first on top: a horizontal red fade with alpha over a vertical yellow-blue gradient. Computed background-image/position/size/repeat serialize as comma lists matching Chrome.',
    viewport: { width: 240, height: 180 },
    html: html(div('s', 'position:absolute;left:40px;top:40px;width:160px;height:100px;background-image:linear-gradient(to right, rgba(255,0,0,0.8), rgba(255,0,0,0)), linear-gradient(to bottom, #ffd400, #00b4ff)')),
    computedStyle: [{ id: 's', props: ['background-image', 'background-position', 'background-size', 'background-repeat'] }],
    rects: ['s'],
  },
  {
    name: 'size-pos-repeat',
    note: 'background-size (two-value, single percent), background-position (px offsets, center), and background-repeat (no-repeat, repeat-x, space, round) all shape the painted result: a sized gradient offset inside its box, a repeated stripe, a spaced tile run, and a round-scaled stripe.',
    viewport: { width: 520, height: 260 },
    html: html(
      div('a', 'position:absolute;left:30px;top:30px;width:110px;height:90px;background:#e8e8e8;background-image:linear-gradient(to right, red, blue);background-size:60px 40px;background-position:20px 15px;background-repeat:no-repeat') +
      div('b', 'position:absolute;left:170px;top:30px;width:110px;height:90px;background-image:linear-gradient(to bottom, black, white);background-size:30px 100%;background-repeat:repeat-x') +
      div('c', 'position:absolute;left:310px;top:30px;width:180px;height:90px;background-image:radial-gradient(circle 15px at 50% 50%, red, blue);background-repeat:space') +
      div('d', 'position:absolute;left:30px;top:150px;width:110px;height:80px;background-image:repeating-linear-gradient(to right, black 0 7px, white 7px 14px);background-repeat:round') +
      div('e', 'position:absolute;left:170px;top:150px;width:110px;height:80px;background:#e8e8e8;background-image:linear-gradient(to right, purple, orange);background-size:50% 50%;background-position:center;background-repeat:no-repeat') +
      div('f', 'position:absolute;left:310px;top:150px;width:180px;height:80px;background-image:linear-gradient(to right, teal, pink);background-size:auto 30px;background-repeat:repeat no-repeat'),
    ),
    computedStyle: [
      { id: 'a', props: ['background-size', 'background-position', 'background-repeat'] },
      { id: 'e', props: ['background-size', 'background-position'] },
      { id: 'f', props: ['background-size', 'background-repeat'] },
    ],
    rects: ['a', 'b', 'c', 'd', 'e', 'f'],
  },
  {
    name: 'cover-contain',
    note: 'background-size keywords cover and contain (and the two-value forms alongside them). Gradients have no intrinsic size, so cover/contain resolve to the positioning area exactly like Chrome paints them; the computed background-size strings must match Chrome.',
    viewport: { width: 420, height: 260 },
    html: html(
      div('a', 'position:absolute;left:30px;top:30px;width:160px;height:90px;background-image:linear-gradient(to right, red, blue);background-size:cover;background-repeat:no-repeat') +
      div('b', 'position:absolute;left:230px;top:30px;width:160px;height:90px;background-image:linear-gradient(to right, red, blue);background-size:contain;background-repeat:no-repeat') +
      div('c', 'position:absolute;left:30px;top:150px;width:160px;height:90px;background-image:linear-gradient(to right, green, yellow);background-size:100px 40px;background-position:30px 25px;background-repeat:no-repeat') +
      div('d', 'position:absolute;left:230px;top:150px;width:160px;height:90px;background-image:linear-gradient(to bottom, green, yellow);background-size:70% 60%;background-position:10px 10px;background-repeat:no-repeat'),
    ),
    computedStyle: [
      { id: 'a', props: ['background-size'] },
      { id: 'b', props: ['background-size'] },
      { id: 'c', props: ['background-size'] },
      { id: 'd', props: ['background-size'] },
    ],
    rects: ['a', 'b', 'c', 'd'],
  },
  {
    name: 'clip-origin',
    note: 'background-clip and background-origin move the painted region: border over padding over content, each with border 12px and padding 14px, over a background-color so the unpainted bands show. The rounded case clips a gradient to the inner (padding-edge) radii of a 24px border-radius box.',
    viewport: { width: 560, height: 260 },
    html: html(
      div('a', 'position:absolute;left:30px;top:30px;width:110px;height:90px;border:12px solid rgba(0,0,0,0.25);padding:14px;background-color:#e8f4ff;background-image:linear-gradient(to right, red, blue);background-origin:border-box;background-clip:border-box') +
      div('b', 'position:absolute;left:190px;top:30px;width:110px;height:90px;border:12px solid rgba(0,0,0,0.25);padding:14px;background-color:#e8f4ff;background-image:linear-gradient(to right, red, blue);background-origin:padding-box;background-clip:padding-box') +
      div('c', 'position:absolute;left:350px;top:30px;width:110px;height:90px;border:12px solid rgba(0,0,0,0.25);padding:14px;background-color:#e8f4ff;background-image:linear-gradient(to right, red, blue);background-origin:content-box;background-clip:content-box') +
      div('d', 'position:absolute;left:30px;top:150px;width:110px;height:90px;border:12px solid rgba(0,0,0,0.25);padding:14px;background-color:#e8f4ff;background-image:linear-gradient(to right, red, blue);background-origin:border-box;background-clip:content-box') +
      div('e', 'position:absolute;left:190px;top:150px;width:110px;height:90px;border:12px solid rgba(0,0,0,0.25);padding:14px;background-color:#e8f4ff;border-radius:24px;background-image:linear-gradient(135deg, red, blue);background-origin:padding-box;background-clip:padding-box') +
      div('f', 'position:absolute;left:350px;top:150px;width:110px;height:90px;border:12px solid rgba(0,0,0,0.25);padding:14px;background-color:#e8f4ff;border-radius:50%;background-image:radial-gradient(circle at 50% 50%, white, navy);background-origin:border-box;background-clip:border-box'),
    ),
    computedStyle: [
      { id: 'a', props: ['background-clip', 'background-origin'] },
      { id: 'd', props: ['background-clip', 'background-origin'] },
      { id: 'e', props: ['background-clip', 'background-origin', 'border-radius'] },
    ],
    rects: ['a', 'b', 'c', 'd', 'e', 'f'],
  },
  {
    name: 'radial-gradients',
    note: 'Radial ending shapes per css-images-3 sizing: default farthest-corner ellipse, circle at 30% 30%, explicit 40px 60px ellipse radii, circle closest-side, circle farthest-corner at an offset position, and a repeating-radial stripe ring.',
    viewport: { width: 560, height: 260 },
    html: html(
      div('a', 'position:absolute;left:30px;top:30px;width:110px;height:90px;background-image:radial-gradient(red, blue)') +
      div('b', 'position:absolute;left:190px;top:30px;width:110px;height:90px;background-image:radial-gradient(circle at 30% 30%, white, black)') +
      div('c', 'position:absolute;left:350px;top:30px;width:110px;height:90px;background-image:radial-gradient(ellipse 40px 60px at center, #ffff00, #0000ff)') +
      div('d', 'position:absolute;left:30px;top:150px;width:110px;height:90px;background-image:radial-gradient(circle closest-side, red, blue)') +
      div('e', 'position:absolute;left:190px;top:150px;width:110px;height:90px;background-image:radial-gradient(circle farthest-corner at 20px 25px, #00c853, #d500f9)') +
      div('f', 'position:absolute;left:350px;top:150px;width:110px;height:90px;background-image:repeating-radial-gradient(circle at center, red 0px, red 8px, blue 8px, blue 16px)'),
    ),
    computedStyle: [
      { id: 'b', props: ['background-image'] },
      { id: 'c', props: ['background-image'] },
      { id: 'e', props: ['background-image'] },
      { id: 'f', props: ['background-image'] },
    ],
    rects: ['a', 'b', 'c', 'd', 'e', 'f'],
  },
  {
    name: 'shorthand',
    note: 'The background shorthand full grammar: image + color + position/size + repeat + attachment + origin/clip box keywords in one declaration, and a second layer painting over it. The computed background string must serialize component-for-component like Chrome (color, image, repeat, attachment, position / size, origin, clip).',
    viewport: { width: 480, height: 200 },
    html: html(
      div('a', 'position:absolute;left:30px;top:30px;width:190px;height:140px;background:#2244cc linear-gradient(to right, rgba(255,255,255,0.9), rgba(255,255,255,0)) no-repeat center / 80px 60px content-box padding-box') +
      div('b', 'position:absolute;left:260px;top:30px;width:190px;height:140px;border:10px solid rgba(0,0,0,0.2);padding:12px;background:linear-gradient(to bottom, #ffd400, #ff3d00) 10px 20px / 50px 40px repeat-x fixed border-box border-box'),
    ),
    computedStyle: [
      { id: 'a', props: ['background', 'background-image', 'background-color', 'background-position', 'background-size', 'background-repeat', 'background-clip', 'background-origin', 'background-attachment'] },
      { id: 'b', props: ['background', 'background-attachment', 'background-origin'] },
    ],
    rects: ['a', 'b'],
  },
  {
    name: 'url-unsupported',
    note: 'url() raster backgrounds are chartered-out (no image decode): the declaration parses and serializes (computed background-image keeps url("...") verbatim, never dropped) but paints nothing — Chrome, pointed at an unresolvable URL, also paints nothing, so the gradient underneath shows through both engines.',
    viewport: { width: 240, height: 220 },
    html: html(
      div('a', "position:absolute;left:40px;top:30px;width:160px;height:70px;background-image:url('https://invalid.invalid/a.png');background-color:#eeeeee") +
      div('b', "position:absolute;left:40px;top:120px;width:160px;height:70px;background-image:url('https://invalid.invalid/a.png'), linear-gradient(to right, red, blue)"),
    ),
    computedStyle: [
      { id: 'a', props: ['background-image', 'background'] },
      { id: 'b', props: ['background-image'] },
    ],
    rects: ['a', 'b'],
  },
];

for (const f of fixtures) {
  const dir = join(CORPUS, f.name);
  mkdirSync(dir, { recursive: true });
  const fixture = {
    name: f.name,
    note: f.note,
    harvest: {
      viewport: f.viewport,
      html: f.html,
      computedStyle: f.computedStyle,
      rects: f.rects,
    },
    expected: {
      measureText: 'pass',
      computedStyle: 'pass',
      rect: 'pass',
      screenshot: 'pass',
    },
  };
  writeFileSync(join(dir, 'fixture.json'), JSON.stringify(fixture, null, 2) + '\n');
  console.log(`wrote ${join(dir, 'fixture.json')}`);
}
