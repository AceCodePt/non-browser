#!/usr/bin/env node
/**
 * Acceptance gate for the font-registration-faces task, run by the daemon's
 * session-idle hook.
 *
 * Why this exists: `npm run verify` stays green on unchanged code (the typed
 * known-gaps fixtures assert their divergences STILL exist, so a no-op agent
 * passes the default hook). A task whose acceptance is only `npm run verify`
 * can therefore be archived without doing its work. This gate makes the
 * acceptance check the task's actual requirements instead.
 *
 * Exits 0 only when:
 *   1. the chrome browser-config registers a Thai-capable and an emoji-capable face,
 *   2. no hard-coded /home/sagi font path remains in src/config (de-machine-calibrate),
 *   3. corpus/measure-corpus/known-gaps no longer lists the Thai or emoji-smiley
 *      strings (they moved into the pass corpus).
 *
 * Numerical parity of the reclassified strings is then proven by
 * `npm run verify:text-measure` (run by the hook after this gate).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromeConfig } from '../dist/config/index.js';

const knownGapStrings = ['สวัสดีชาวโลก ภาษาไทย', '😀 😃 😄'];

function fail(msg) {
  console.error(`verify-font-registration: FAIL — ${msg}`);
  process.exit(1);
}

// 1. Faces registered in the chrome browser-config.
const registered = chromeConfig.fonts.map((f) => `${f.family} @ ${f.filePath}`);
const hasThai = registered.some((r) => /thai/i.test(r));
const hasEmoji = registered.some((r) => /emoji/i.test(r));
if (!hasThai) fail(`no Thai-capable face registered; set: ${registered.join('; ')}`);
if (!hasEmoji) fail(`no emoji-capable face registered; set: ${registered.join('; ')}`);

// 2. No machine-specific hard-coded font paths.
for (const f of chromeConfig.fonts) {
  if (f.filePath.includes('/home/')) fail(`hard-coded user path in registration: ${f.filePath}`);
}

// 3. Known-gaps fixture no longer carries the Thai/emoji entries.
const fixturePath = resolve('corpus/measure-corpus/known-gaps/fixture.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) || {};
const entries = fixture.entries ?? [];
for (const s of knownGapStrings) {
  if (entries.some((e) => e.text === s)) fail(`known-gap entry still present: ${JSON.stringify(s)}`);
}

console.log('verify-font-registration: PASS — Thai + emoji faces registered, no /home paths, gap entries reclassified');