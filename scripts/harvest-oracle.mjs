import { chromium } from 'playwright';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodePng, encodePng } from '../dist/harness/png.js';

const corpus = process.argv[2] ?? 'corpus/harness-tolerances';

function* fixtures() {
  for (const entry of readdirSync(corpus, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(corpus, entry.name);
    const fpath = join(dir, 'fixture.json');
    if (!statSync(fpath, { throwIfNoEntry: false })?.isFile()) continue;
    const raw = JSON.parse(readFileSync(fpath, 'utf8'));
    if (!raw.harvest) continue;
    yield { dir, name: entry.name, raw };
  }
}

const browser = await chromium.launch();
try {
  for (const { dir, name, raw } of fixtures()) {
    const h = raw.harvest;
    const page = await browser.newPage({ viewport: { width: h.viewport.width, height: h.viewport.height } });
    await page.setContent(h.html);
    await page.evaluate(() => document.fonts.ready);

    const shot = await page.screenshot();
    const refImg = decodePng(shot);
    const { width, height } = refImg;

    const measureText = {};
    if (h.measureText) {
      for (const s of h.measureText) {
        measureText[s] = await page.evaluate((t) => {
          const ctx = document.createElement('canvas').getContext('2d');
          return ctx.measureText(t).width;
        }, s);
      }
    }

    const computedStyle = {};
    if (h.computedStyle) {
      for (const { id, props } of h.computedStyle) {
        computedStyle[id] = await page.evaluate(
          ({ id, props }) => {
            const cs = getComputedStyle(document.getElementById(id));
            const out = {};
            for (const p of props) out[p] = cs.getPropertyValue(p);
            return out;
          },
          { id, props },
        );
      }
    }

    const rect = {};
    if (h.rects) {
      for (const id of h.rects) {
        rect[id] = await page.$eval(`#${id}`, (el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
      }
    }

    const values = { measureText, computedStyle, rect };
    writeFileSync(join(dir, 'reference.json'), JSON.stringify(values, null, 2) + '\n');
    writeFileSync(join(dir, 'candidate.json'), JSON.stringify(values, null, 2) + '\n');
    writeFileSync(join(dir, 'reference.png'), shot);

    if (h.divergence) {
      const d = h.divergence;
      const cand = Buffer.from(refImg.data);
      for (let y = d.y; y < d.y + d.height; y++) {
        for (let x = d.x; x < d.x + d.width; x++) {
          const o = (y * width + x) * 4;
          cand[o] = Math.max(0, Math.min(255, cand[o] + d.delta[0]));
          cand[o + 1] = Math.max(0, Math.min(255, cand[o + 1] + d.delta[1]));
          cand[o + 2] = Math.max(0, Math.min(255, cand[o + 2] + d.delta[2]));
        }
      }
      writeFileSync(join(dir, 'candidate.png'), encodePng(width, height, cand));
    } else {
      writeFileSync(join(dir, 'candidate.png'), shot);
    }

    if (h.mask) {
      const m = h.mask;
      const rgba = Buffer.alloc(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (x >= m.x && x < m.x + m.width && y >= m.y && y < m.y + m.height) {
            const o = (y * width + x) * 4;
            rgba[o] = 255;
            rgba[o + 1] = 255;
            rgba[o + 2] = 255;
            rgba[o + 3] = 255;
          }
        }
      }
      writeFileSync(join(dir, 'mask.png'), encodePng(width, height, rgba));
    }

    console.log(`harvested ${name}: ${width}x${height}, strings=${h.measureText?.length ?? 0}, props=${(h.computedStyle ?? []).reduce((n, e) => n + e.props.length, 0)}, rects=${h.rects?.length ?? 0}${h.divergence ? ', divergence injected' : ''}${h.mask ? ', mask written' : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
}
mkdirSync(corpus, { recursive: true });
