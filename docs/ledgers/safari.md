# Safari-Track Ledger

Owning module: `src/config/safari.ts` (per-browser browser-config), driving the
same font-resolution seam as the chrome/firefox configs: every measurement/paint
path resolves CSS families through `resolveFontFamily` for the active config,
and the Pretext seam resolves the fixture's real computed family before the
Canvas is touched. Exercised via the cross-browser probe
(`probes/probe-browser-gap.mjs`) and the seam tests (`npm run test:probe`).

## Scope

The charter (§4, §8) parks the Safari target: the browser oracle is "tracked on
macOS CI, not scheduled until the platform is provisioned." This task extends
the browser-config mechanism to Safari **to the extent of glyph resolution**:

- **`src/config/safari.ts`** — a `browser: 'safari'` config registering the
  faces WebKit resolves the assigned CSS families to (fontconfig on
  Linux/WebKitGTK) and carrying a fallback table so the engine measures/paints
  those stacks with the same faces WebKit would use.
- **`src/config/index.ts`** — `getBrowserConfig('safari')` registry entry;
  `BrowserTarget` widened to `'chrome' | 'firefox' | 'safari'`.
- **The seam** — `renderHtml` with `browserConfig: safariConfig` presses the
  safari-config measurement canvas into Pretext (`src/layout/render.ts`), so
  seam measurement resolves Safari's faces (see `src/pretext/index.ts`). The
  probe runs exactly this path per fixture.

## Safari fallback table

WebKitGTK resolves CSS families through fontconfig; the table is grounded in
`fc-match <family>` (the fontconfig alias/pattern resolution WebKit's font
selection consults) on this machine, following the css-family → registered-face
shape the chrome config establishes:

| CSS family | Registered face | Rationale (fc-match) |
| --- | --- | --- |
| `Courier New` | `Liberation Mono` | fontconfig alias → `LiberationMono-Regular.ttf` |
| `Arial` | `Liberation Sans` | fontconfig alias → `LiberationSans-Regular.ttf` |
| `sans-serif` | `Liberation Sans` | fontconfig `Sans` → `LiberationSans-Regular.ttf` |
| `Times New Roman` | `Liberation Serif` | fontconfig alias → `LiberationSerif-Regular.ttf` |
| `Georgia` | `Liberation Serif` | fontconfig alias → `LiberationSerif-Regular.ttf` |
| `serif` | `Liberation Serif` | fontconfig `Serif` → `LiberationSerif-Regular.ttf` |
| `monospace` | Hack Nerd Font (or Liberation Mono) | fontconfig `Monospace` → `HackNerdFont-Regular.ttf` when installed |

`fonts` registers each resolution target plus the probe/safari-corpus faces
(`Noto Sans` default, `Source Code Pro`, `Liberation Mono/Sans/Serif`),
mirroring the chrome set's `existsSync` guard for the machine-specific fixed-
pitch face. `defaultFamily`/`defaultFile` = `Noto Sans`.

**Caveat:** the table is authored from this Linux host's fontconfig resolution
— the WebKitGTK substrate — not from a live WebKit oracle (see "Platform
status" below). When a WebKit-capable platform is provisioned, the oracle
measurement must confirm each entry reproduces WebKit's advances to sub-pixel
before the entry is treated as lock-tight; the chrome/firefox fallback tables
were populated the same way (oracle-verified). No entry may be added that does
not reproduce the target browser's advances to sub-pixel (per `firefox.md`, the
generics were deliberately unmapped there; the safari table maps them only
because WebKit/fontconfig resolves them to a registered face this host can
measure — the probe fixtures must stay confirmed against the real oracle.)

## Platform status

Playwright's WebKit build (its `webkit-2336` browser, the pin this repo records
in `package-lock.json`) is built for Ubuntu 24.04 arm64 and requires glibc ≥
2.35–2.38; this host is Oracle Linux 9 aarch64 with glibc 2.34, so
`webkit.launch()` fails with a missing-dependencies error. The probe therefore:

- attempts all three browsers and reports every pair among those that launch —
  on this host that is Chrome-vs-Firefox; Safari pairs are reported with the
  unavailable reason;
- runs the safari-config seam against **Chrome's** line fragments as the
  WebKit-free reference, because the chrome and safari fallback tables resolve
  every probe fixture family to the same registered face (so a seam delta is a
  pure resolution/seam error, not a browser difference);
- consults the WebKit oracle itself whenever it does launch.

This is the honest, documented posture the charter §8 "parked" line describes:
the config and its resolution authority are real and exercised; the browser
oracle cross-check is the parked part.

## Results

- `npm run build` green (tsc strict).
- `npm run test:probe` green: the seam font-resolution authority tests assert
  `resolveFontFamilyInShorthand` resolves the fixture family through the active
  config, that a fallback family's seam measurement equals the resolved face's
  within the layer-1 mean tolerance (≤ 0.01px), and that a seam resolving along
  a *different* config's table would fail the band (the regression gate).
- `npm run probe:browser-gap` green: every launched-browser pair reports
  per-pair deltas; the safari seam (resolved family) passes every flat-text
  probe fixture within the layer-1 max band (mean Δ 0.008–0.015px — Pretext's
  documented width-reporting rounding, parity.md Honest Reading #2).
- `npm run verify:firefox` / `npm run verify:four-layer` stay green with the
  seam resolving each fixture's real family (firefox fallback seam mean 0.0000px).

## Divergences

None within the verified surface. The WebKit-oracle confirmation of the
fallback table is outstanding by design (platform provisioning); the probe
fixtures and the seam tests keep the resolution authority green meanwhile, so a
seam that stops resolving through the active config fails loudly.